/**
 * Session Management and Token Refresh
 * 
 * Comprehensive session lifecycle management:
 * - Session timeout and expiration
 * - Token refresh strategies
 * - User activity tracking
 * - Graceful logout and session revocation
 * - Immediate session termination on user disable
 */

import { useState, useEffect } from 'react'
import { logger } from './logger'
import { supabase } from '../lib/supabase'

/**
 * Session Configuration
 */
export const SessionConfig = {
  // Session Duration
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  TOKEN_REFRESH_INTERVAL_MS: 10 * 60 * 1000, // 10 minutes
  INACTIVITY_WARNING_MS: 25 * 60 * 1000, // 25 minutes
  ACTIVITY_CHECK_INTERVAL_MS: 60 * 1000, // Check activity every minute

  // Token Settings
  TOKEN_EXPIRY_BUFFER_MS: 2 * 60 * 1000, // Refresh 2 minutes before expiry

  // Event Tracking
  TRACK_ACTIVITY: true,
  LOG_SESSION_EVENTS: true,
}

/**
 * Session State
 */
interface SessionState {
  userId: string
  email: string
  sessionStartTime: number
  lastActivityTime: number
  isActive: boolean
  tokenExpiryTime: number
}

/**
 * Session Data for Event Listeners
 */
export interface SessionData {
  userId?: string
  email?: string
  sessionStartTime?: number
  lastActivityTime?: number
  isActive?: boolean
  tokenExpiryTime?: number
  event?: string
  timestamp?: number
  message?: string
  [key: string]: string | number | boolean | undefined
}

/**
 * Session Manager Class
 */
export class SessionManager {
  private static sessionState: SessionState | null = null
  private static refreshInterval: ReturnType<typeof setInterval> | null = null
  private static activityCheckInterval: ReturnType<typeof setInterval> | null = null
  private static inactivityWarningTimer: ReturnType<typeof setTimeout> | null = null
  private static sessionValidationInterval: ReturnType<typeof setInterval> | null = null
  private static listeners: Map<string, Set<(data: SessionData) => void>> = new Map()
  private static lastActivityTime: number = Date.now()
  private static currentSessionId: string | null = null

  /**
   * Initialize session management
   */
  static initialize(userId: string, email: string, tokenExpiryTime: number): void {
    logger.info('[SessionManager] Initializing session management')

    this.sessionState = {
      userId,
      email,
      sessionStartTime: Date.now(),
      lastActivityTime: Date.now(),
      isActive: true,
      tokenExpiryTime
    }

    this.startTokenRefresh()
    this.startActivityTracking()
    this.startInactivityWarning()
    this.startSessionValidation()
    this.setupActivityListeners()

    logger.info('[SessionManager] Session initialized', {
      userId,
      expiryIn: tokenExpiryTime - Date.now()
    })
  }

  /**
   * Start automatic token refresh
   */
  private static startTokenRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }

    this.refreshInterval = setInterval(() => {
      this.refreshToken()
    }, SessionConfig.TOKEN_REFRESH_INTERVAL_MS)

    logger.debug('[SessionManager] Token refresh started')
  }

  /**
   * Refresh authentication token
   */
  static async refreshToken(): Promise<boolean> {
    try {
      if (!this.sessionState) {
        logger.warn('[SessionManager] No active session for token refresh')
        return false
      }

      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        logger.error('[SessionManager] Token refresh failed:', error)
        return false
      }

      if (data?.session) {
        // Update token expiry time
        const expiresIn = data.session.expires_in || 3600 // Default 1 hour
        this.sessionState.tokenExpiryTime = Date.now() + (expiresIn * 1000)

        logger.info('[SessionManager] Token refreshed successfully', {
          expiresIn,
          newExpiryTime: this.sessionState.tokenExpiryTime
        })

        this.emit('token_refreshed', {
          expiresIn,
          newExpiryTime: this.sessionState.tokenExpiryTime
        })

        return true
      }

      return false
    } catch (error) {
      logger.error('[SessionManager] Unexpected error during token refresh:', error)
      return false
    }
  }

  /**
   * Start activity tracking
   */
  private static startActivityTracking(): void {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval)
    }

    this.activityCheckInterval = setInterval(() => {
      this.checkActivityStatus()
    }, SessionConfig.ACTIVITY_CHECK_INTERVAL_MS)

    logger.debug('[SessionManager] Activity tracking started')
  }

  /**
   * Start session validation (check if session was terminated remotely)
   */
  private static startSessionValidation(): void {
    if (this.sessionValidationInterval) {
      clearInterval(this.sessionValidationInterval)
    }

    // Check every 30 seconds if the session is still valid in the database
    this.sessionValidationInterval = setInterval(() => {
      this.validateSessionInDatabase()
    }, 30 * 1000) // 30 seconds

    logger.debug('[SessionManager] Session validation started')
  }

  /**
   * Validate if session is still active in database
   * This allows remote session termination to take effect
   */
  private static async validateSessionInDatabase(): Promise<void> {
    if (!this.sessionState) {
      return
    }

    try {
      const now = new Date().toISOString()
      
      // Check if the session is still active in the database
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('is_active, logged_out_at, id')
        .eq('user_id', this.sessionState.userId)
        .eq('is_active', true)
        .gt('expires_at', now)

      if (error) {
        // If table doesn't exist, skip validation
        if (error.message?.includes('not found') || error.message?.includes('schema cache')) {
          return
        }
        logger.warn('[SessionManager] Error validating session:', error)
        return
      }

      // If no active session found, user was logged out remotely
      if (!sessions || sessions.length === 0) {
        logger.warn('[SessionManager] No active session found - session was terminated remotely')
        this.emit('session_revoked_immediately', {
          reason: 'session_terminated_remotely',
          revokedAt: new Date().toISOString()
        })
        await this.endSession('disabled')
      }
    } catch (error) {
      logger.error('[SessionManager] Error in session validation:', error)
    }
  }

  /**
   * Check session activity status
   */
  private static checkActivityStatus(): void {
    if (!this.sessionState) return

    const timeSinceLastActivity = Date.now() - this.lastActivityTime

    // If activity detected, update last activity time
    if (timeSinceLastActivity < SessionConfig.ACTIVITY_CHECK_INTERVAL_MS) {
      this.sessionState.lastActivityTime = Date.now()
      this.emit('activity_detected')
    }

    // Check for inactivity timeout
    if (timeSinceLastActivity > SessionConfig.SESSION_TIMEOUT_MS) {
      logger.warn('[SessionManager] Session timeout due to inactivity')
      this.endSession('inactivity_timeout')
    }
  }

  /**
   * Start inactivity warning
   */
  private static startInactivityWarning(): void {
    if (this.inactivityWarningTimer) {
      clearTimeout(this.inactivityWarningTimer)
    }

    this.inactivityWarningTimer = setTimeout(() => {
      if (this.sessionState && this.sessionState.isActive) {
        logger.warn('[SessionManager] Inactivity warning triggered')
        this.emit('inactivity_warning', {
          remainingTime: SessionConfig.SESSION_TIMEOUT_MS - SessionConfig.INACTIVITY_WARNING_MS,
          message: 'Your session will expire in 5 minutes due to inactivity'
        })
      }
    }, SessionConfig.INACTIVITY_WARNING_MS)
  }

  /**
   * Setup activity listeners (mouse, keyboard, etc.)
   */
  private static setupActivityListeners(): void {
    const updateLastActivity = () => {
      this.lastActivityTime = Date.now()
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

    events.forEach(event => {
      document.addEventListener(event, updateLastActivity, { passive: true })
    })

    logger.debug('[SessionManager] Activity listeners setup complete')
  }

  /**
   * Track user action (for audit logging)
   */
  static async trackAction(actionType: string, details: Record<string, unknown> = {}): Promise<void> {
    if (!SessionConfig.TRACK_ACTIVITY || !this.sessionState) return

    try {
      // Log to audit system if available
      logger.info('[SessionManager] User action tracked', {
        userId: this.sessionState.userId,
        actionType,
        timestamp: new Date().toISOString(),
        ...details
      })

      // Update activity time
      this.lastActivityTime = Date.now()
      if (this.sessionState) {
        this.sessionState.lastActivityTime = Date.now()
      }
    } catch (error) {
      logger.error('[SessionManager] Error tracking action:', error)
    }
  }

  /**
   * Get current session info
   */
  static getSessionInfo(): SessionState | null {
    return this.sessionState ? { ...this.sessionState } : null
  }

  /**
   * Check if session is still valid
   */
  static isSessionValid(): boolean {
    if (!this.sessionState) return false

    const now = Date.now()
    const isTokenValid = now < this.sessionState.tokenExpiryTime
    const isActive = this.sessionState.isActive

    return isTokenValid && isActive
  }

  /**
   * Get time remaining in session
   */
  static getSessionTimeRemaining(): number {
    if (!this.sessionState) return 0

    const timeRemaining = this.sessionState.tokenExpiryTime - Date.now()
    return Math.max(0, timeRemaining)
  }

  /**
   * End current session
   */
  static async endSession(reason: 'user_logout' | 'inactivity_timeout' | 'disabled' | 'expired' = 'user_logout'): Promise<void> {
    try {
      if (this.sessionState) {
        logger.info('[SessionManager] Ending session', {
          userId: this.sessionState.userId,
          reason,
          duration: Date.now() - this.sessionState.sessionStartTime
        })

        // Mark session as inactive
        this.sessionState.isActive = false

        // Emit session end event
        this.emit('session_ended', {
          reason,
          duration: Date.now() - this.sessionState.sessionStartTime
        })
      }

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()

      if (error) {
        logger.error('[SessionManager] Error during signOut:', error)
      }

      // Clear all intervals and timers
      this.cleanup()

      logger.info('[SessionManager] Session ended successfully')
    } catch (error) {
      logger.error('[SessionManager] Error ending session:', error)
      this.cleanup()
    }
  }

  /**
   * Immediate session revocation (when user is disabled)
   * 
   * This method forcefully terminates the session without waiting
   */
  static async revokeSessionImmediately(userId: string, reason: string = 'user_disabled'): Promise<void> {
    try {
      logger.warn('[SessionManager] IMMEDIATE SESSION REVOCATION', {
        userId,
        reason,
        timestamp: new Date().toISOString()
      })

      if (this.sessionState && this.sessionState.userId === userId) {
        // Mark session as revoked
        this.sessionState.isActive = false
        this.sessionState.tokenExpiryTime = Date.now() - 1000 // Set to past

        // Emit immediate revocation event
        this.emit('session_revoked_immediately', {
          reason,
          revokedAt: new Date().toISOString()
        })

        // Sign out immediately
        await supabase.auth.signOut()

        // Cleanup
        this.cleanup()

        logger.warn('[SessionManager] Session revoked immediately')
      }
    } catch (error) {
      logger.error('[SessionManager] Error revoking session immediately:', error)
      // Force cleanup even on error
      this.cleanup()
    }
  }

  /**
   * Cleanup all timers and listeners
   */
  private static cleanup(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }

    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval)
      this.activityCheckInterval = null
    }

    if (this.inactivityWarningTimer) {
      clearTimeout(this.inactivityWarningTimer)
      this.inactivityWarningTimer = null
    }

    if (this.sessionValidationInterval) {
      clearInterval(this.sessionValidationInterval)
      this.sessionValidationInterval = null
    }

    this.sessionState = null
    this.currentSessionId = null
    logger.debug('[SessionManager] Cleanup complete')
  }

  /**
   * Register event listener
   */
  static on(event: string, callback: (data: SessionData) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  /**
   * Remove event listener
   */
  static off(event: string, callback: (data: SessionData) => void): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  /**
   * Emit event
   */
  private static emit(event: string, data?: SessionData): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data || {})
        } catch (error) {
          logger.error(`[SessionManager] Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Get session stats
   */
  static getStats(): {
    isActive: boolean
    sessionDuration: number
    inactivityDuration: number
    tokenExpiresIn: number
  } | null {
    if (!this.sessionState) return null

    return {
      isActive: this.sessionState.isActive,
      sessionDuration: Date.now() - this.sessionState.sessionStartTime,
      inactivityDuration: Date.now() - this.lastActivityTime,
      tokenExpiresIn: Math.max(0, this.sessionState.tokenExpiryTime - Date.now())
    }
  }
}

/**
 * Session Monitor Component (React Hook)
 * 
 * @example
 * function App() {
 *   useSessionMonitor({
 *     onWarning: () => showWarningModal(),
 *     onExpired: () => redirectToLogin()
 *   })
 *   return <div>...</div>
 * }
 */
export function useSessionMonitor(callbacks?: {
  onWarning?: () => void
  onExpired?: () => void
  onRevoked?: () => void
}): SessionState | null {
  const [sessionState, setSessionState] = useState<SessionState | null>(null)

  useEffect(() => {
    // Listen for session events
    const handleWarning = () => {
      callbacks?.onWarning?.()
    }

    const handleExpired = () => {
      callbacks?.onExpired?.()
    }

    const handleRevoked = () => {
      callbacks?.onRevoked?.()
    }

    SessionManager.on('inactivity_warning', handleWarning)
    SessionManager.on('session_ended', handleExpired)
    SessionManager.on('session_revoked_immediately', handleRevoked)

    // Update state
    setSessionState(SessionManager.getSessionInfo())

    return () => {
      SessionManager.off('inactivity_warning', handleWarning)
      SessionManager.off('session_ended', handleExpired)
      SessionManager.off('session_revoked_immediately', handleRevoked)
    }
  }, [callbacks])

  return sessionState
}

/**
 * Check Session Health
 */
export class SessionHealthCheck {
  static async performHealthCheck(): Promise<{
    isHealthy: boolean
    status: string
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check if session is valid
    if (!SessionManager.isSessionValid()) {
      issues.push('Session is invalid or expired')
      recommendations.push('User should log in again')
    }

    // Check token refresh
    const sessionInfo = SessionManager.getSessionInfo()
    if (sessionInfo) {
      const timeRemaining = SessionManager.getSessionTimeRemaining()
      
      if (timeRemaining < SessionConfig.TOKEN_EXPIRY_BUFFER_MS) {
        issues.push('Token is expiring soon')
        recommendations.push('Refresh token immediately')
      }

      // Check for unusual activity
      const stats = SessionManager.getStats()
      if (stats && stats.inactivityDuration > SessionConfig.SESSION_TIMEOUT_MS) {
        issues.push('User has been inactive for too long')
        recommendations.push('Terminate session and require re-login')
      }
    }

    return {
      isHealthy: issues.length === 0,
      status: issues.length === 0 ? 'OK' : 'WARNING',
      issues,
      recommendations
    }
  }
}

/**
 * Export Summary
 */
export const SessionManagement = {
  SessionConfig,
  SessionManager,
  SessionHealthCheck,
  useSessionMonitor,
}
