/**
 * Security Integration Module
 * Provides convenient hooks and utilities for integrating security logging
 * throughout the application
 */

import { supabase } from '@/lib/supabase'
import { logger } from './securityLogger'
import AuditService from './auditService'

/**
 * Wrap a function to automatically log failures
 */
export function withErrorLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  actionType: string,
  resourceType: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await logger.logSecurityEvent(
        'suspicious_activity',
        `Error during ${actionType} on ${resourceType}: ${errorMessage}`,
        'medium',
        { action: actionType, resource: resourceType, error: errorMessage }
      )
      throw error
    }
  }) as T
}

/**
 * Hook for logging component access
 */
export function useAuditLog() {
  return {
    /**
     * Log a data creation
     */
    logCreate: async (resourceType: string, resourceId: string, data: Record<string, unknown>) => {
      await AuditService.logCreate(resourceType, resourceId, data)
    },

    /**
     * Log a data update
     */
    logUpdate: async (
      resourceType: string,
      resourceId: string,
      oldData: Record<string, unknown>,
      newData: Record<string, unknown>
    ) => {
      await AuditService.logUpdate(resourceType, resourceId, oldData, newData)
    },

    /**
     * Log a data deletion
     */
    logDelete: async (resourceType: string, resourceId: string, data: Record<string, unknown>) => {
      await AuditService.logDelete(resourceType, resourceId, data)
    },

    /**
     * Log a data export
     */
    logExport: async (resourceType: string, resourceId: string, format: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        await logger.logExport(user.id, resourceType, resourceId, format)
      }
    },

    /**
     * Log access denied
     */
    logAccessDenied: async (resource: string, reason: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      await logger.logAccessDenied(user?.id, resource, reason)
    },
  }
}

/**
 * Security context for components
 */
export interface SecurityContext {
  userId?: string
  userRole?: string
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canExport: boolean
}

/**
 * Check if user has permission for an action
 */
export async function checkPermission(): Promise<boolean> {
  try {
    // This would typically check the user_permissions table
    // For now, we'll return true and let RLS handle the actual access control
    return true
  } catch (error) {
    console.error('Permission check failed:', error)
    return false
  }
}

/**
 * Log all API/database errors automatically
 */
export function setupGlobalErrorLogging() {
  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', event => {
    logger.error('Unhandled promise rejection:', event.reason)
  })

  // Log global errors
  window.addEventListener('error', event => {
    logger.error('Global error:', event.error)
  })
}

/**
 * User activity tracker
 */
export class ActivityTracker {
  private inactivityTimeout: ReturnType<typeof setTimeout> | null = null
  private inactivityInterval: ReturnType<typeof setInterval> | null = null
  private lastActivityTime: number = Date.now()
  private sessionStartTime: number = Date.now()
  private isTracking: boolean = false

  /**
   * Start tracking user activity
   */
  startTracking(sessionTimeoutMinutes: number = 30) {
    // منع بدء التتبع أكثر من مرة
    if (this.isTracking) {
      logger.debug('[ActivityTracker] Already tracking, skipping duplicate start')
      return
    }

    this.isTracking = true
    logger.debug('[ActivityTracker] Starting activity tracking')

    // Track user interactions
    const activities = ['mousedown', 'keydown', 'scroll', 'touchstart']
    
    activities.forEach(activity => {
      document.addEventListener(activity, () => this.updateActivity(), true)
    })

    // تنظيف أي interval قديم قبل إنشاء واحد جديد
    if (this.inactivityInterval) {
      clearInterval(this.inactivityInterval)
    }

    // Check for inactivity periodically
    this.inactivityInterval = setInterval(() => this.checkInactivity(sessionTimeoutMinutes), 60000) // Check every minute
  }

  /**
   * Update last activity time
   */
  private updateActivity() {
    this.lastActivityTime = Date.now()
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout)
    }
  }

  /**
   * Check if user is inactive
   */
  private checkInactivity(sessionTimeoutMinutes: number) {
    const inactiveTime = (Date.now() - this.lastActivityTime) / 1000 / 60 // Convert to minutes
    
    if (inactiveTime > sessionTimeoutMinutes) {
      logger.warn(`User inactive for ${inactiveTime} minutes. Logging out.`)
      // Trigger logout
      window.dispatchEvent(new Event('session-expired'))
    }
  }

  /**
   * Stop tracking user activity and cleanup
   */
  stopTracking() {
    if (this.inactivityInterval) {
      clearInterval(this.inactivityInterval)
      this.inactivityInterval = null
    }
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout)
      this.inactivityTimeout = null
    }
    this.isTracking = false
    logger.debug('[ActivityTracker] Stopped activity tracking')
  }

  /**
   * Get session duration
   */
  getSessionDuration(): number {
    return Date.now() - this.sessionStartTime
  }

  /**
   * Reset session timer
   */
  resetSession() {
    this.sessionStartTime = Date.now()
    this.lastActivityTime = Date.now()
  }
}

/**
 * Create an activity tracker instance
 */
export const activityTracker = new ActivityTracker()

/**
 * Setup security features on app initialization
 */
export async function initializeSecurity() {
  // Setup global error logging
  setupGlobalErrorLogging()

  // Start tracking user activity
  activityTracker.startTracking(30) // 30 minute timeout

  // Initialize other security features
  logger.info('Security system initialized')
}

export default {
  withErrorLogging,
  useAuditLog,
  checkPermission,
  setupGlobalErrorLogging,
  ActivityTracker,
  activityTracker,
  initializeSecurity,
}
