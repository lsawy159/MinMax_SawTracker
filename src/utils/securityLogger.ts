import { supabase } from '@/lib/supabase'

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export enum AuditActionType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
  PERMISSION_CHANGE = 'permission_change',
  ROLE_CHANGE = 'role_change',
  ACCESS_DENIED = 'access_denied',
}

export interface AuditLogEntry {
  user_id?: string
  action_type: AuditActionType | string
  resource_type: string
  resource_id?: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  status?: 'success' | 'failure'
  error_message?: string
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

const isDev = import.meta.env.DEV
const isTest = import.meta.env.MODE === 'test'

class SecurityLogger {
  private logs: LogEntry[] = []
  private maxLogs = 100

  private recordLog(level: LogLevel, formattedMessage: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message: formattedMessage,
      timestamp: new Date().toISOString(),
      context
    }

    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (isTest) return false
    if (level === LogLevel.ERROR) return true
    return isDev
  }

  private formatMessage(level: LogLevel, ...args: unknown[]): string {
    const prefix = {
      [LogLevel.DEBUG]: '🔍 [DEBUG]',
      [LogLevel.INFO]: 'ℹ️ [INFO]',
      [LogLevel.WARN]: '⚠️ [WARN]',
      [LogLevel.ERROR]: '❌ [ERROR]',
    }[level]
    return `${prefix} ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}`
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(LogLevel.DEBUG, ...args)
      this.recordLog(LogLevel.DEBUG, formatted)
      console.warn(formatted)
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, ...args)
      this.recordLog(LogLevel.INFO, formatted)
      console.warn(formatted)
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(LogLevel.WARN, ...args)
      this.recordLog(LogLevel.WARN, formatted)
      console.warn(formatted)
    }
  }

  error(...args: unknown[]): void {
    const formatted = this.formatMessage(LogLevel.ERROR, ...args)
    this.recordLog(LogLevel.ERROR, formatted)
    console.error(formatted)
  }

  /**
   * Log audit event to database
   * Captures important security and business events
   */
  async logAudit(entry: AuditLogEntry): Promise<void> {
    try {
      const user = await supabase.auth.getUser()
      const userId = user.data.user?.id

      const auditEntry = {
        user_id: entry.user_id || userId,
        action_type: entry.action_type,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        old_values: entry.old_values,
        new_values: entry.new_values,
        ip_address: entry.ip_address || await this.getClientIP(),
        user_agent: entry.user_agent || navigator.userAgent,
        status: entry.status || 'success',
        error_message: entry.error_message,
      }

      const { error } = await supabase
        .from('audit_log')
        .insert(auditEntry)

      if (error) {
        console.error('Failed to log audit event:', error)
      }
    } catch (err) {
      console.error('Error logging audit event:', err)
    }
  }

  /**
   * Log security event
   * Used for suspicious activities and security alerts
   */
  async logSecurityEvent(
    eventType: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      const user = await supabase.auth.getUser()
      const userId = user.data.user?.id

      const { error } = await supabase
        .from('security_events')
        .insert({
          event_type: eventType,
          severity,
          user_id: userId,
          description,
          details: details || {},
          ip_address: await this.getClientIP(),
          is_resolved: false,
        })

      if (error) {
        console.error('Failed to log security event:', error)
      }
    } catch (err) {
      console.error('Error logging security event:', err)
    }
  }

  /**
   * Get client IP address (requires backend support)
   */
  private async getClientIP(): Promise<string | undefined> {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return undefined
    }
  }

  /**
   * Log failed login attempt
   */
  async logFailedLogin(email: string, reason: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('login_attempts')
        .insert({
          email,
          attempt_type: 'failed',
          failure_reason: reason,
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
        })

      if (error) {
        console.error('Failed to log login attempt:', error)
      }

      // Log as security event
      await this.logSecurityEvent(
        'failed_login',
        `Failed login attempt for ${email}`,
        'medium',
        { reason }
      )
    } catch (err) {
      console.error('Error logging failed login:', err)
    }
  }

  /**
   * Log successful login
   */
  async logSuccessfulLogin(userId: string, email: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('login_attempts')
        .insert({
          user_id: userId,
          email,
          attempt_type: 'success',
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
        })

      if (error) {
        console.error('Failed to log login attempt:', error)
      }

      // Log audit event
      await this.logAudit({
        user_id: userId,
        action_type: AuditActionType.LOGIN,
        resource_type: 'user',
        resource_id: userId,
      })
    } catch (err) {
      console.error('Error logging successful login:', err)
    }
  }

  /**
   * Log data export
   */
  async logExport(
    userId: string,
    resourceType: string,
    resourceId: string,
    format: string
  ): Promise<void> {
    await this.logAudit({
      user_id: userId,
      action_type: AuditActionType.EXPORT,
      resource_type: resourceType,
      resource_id: resourceId,
      new_values: { export_format: format, exported_at: new Date().toISOString() },
    })
  }

  /**
   * Log access denied event
   */
  async logAccessDenied(
    userId: string | undefined,
    resource: string,
    reason: string
  ): Promise<void> {
    await this.logAudit({
      user_id: userId,
      action_type: AuditActionType.ACCESS_DENIED,
      resource_type: resource,
      status: 'failure',
      error_message: reason,
    })

    await this.logSecurityEvent(
      'access_denied',
      `Access denied: ${reason}`,
      'high',
      { resource, attempted_by: userId }
    )
  }
}

export const logger = new SecurityLogger()
export const securityLogger = new SecurityLogger()
