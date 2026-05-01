const isDev = import.meta.env.DEV
const isTest = import.meta.env.MODE === 'test'
const debugLogsFromEnv = import.meta.env.VITE_DEBUG_LOGS === 'true'

function isVerboseLoggingEnabled(): boolean {
  if (isTest || !isDev) {
    return false
  }

  if (debugLogsFromEnv) {
    return true
  }

  if (typeof window === 'undefined') {
    return false
  }

  try {
    const localFlag = window.localStorage.getItem('sawtracker:debug-logs')
    if (localFlag === 'true') {
      return true
    }

    const params = new URLSearchParams(window.location.search)
    return params.get('debugLogs') === 'true'
  } catch {
    return false
  }
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 100

  private recordLog(
    level: LogLevel,
    formattedMessage: string,
    context?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      level,
      message: formattedMessage,
      timestamp: new Date().toISOString(),
      context,
    }

    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (isTest) return false

    if (level >= LogLevel.WARN) {
      return true
    }

    return isVerboseLoggingEnabled()
  }

  private formatMessage(level: LogLevel, ...args: unknown[]): string {
    const prefix = {
      [LogLevel.DEBUG]: '🔍 [DEBUG]',
      [LogLevel.INFO]: 'ℹ️ [INFO]',
      [LogLevel.WARN]: '⚠️ [WARN]',
      [LogLevel.ERROR]: '❌ [ERROR]',
    }[level]
    return `${prefix} ${args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(' ')}`
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      // Use console.warn for debug messages as console.log is not allowed
      const formatted = this.formatMessage(LogLevel.DEBUG, ...args)
      this.recordLog(LogLevel.DEBUG, formatted)
      console.warn(formatted)
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      // Use console.warn for info messages as console.info is not allowed
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

    // في الإنتاج، إرسال الأخطاء إلى Sentry
    if (!isDev && typeof window !== 'undefined') {
      try {
        // import Sentry dynamically to avoid circular dependencies
        import('@sentry/react').then(({ captureException }) => {
          const errorObj = args.find((arg) => arg instanceof Error) || new Error(formatted)
          captureException(errorObj, {
            level: 'error',
            tags: {
              source: 'logger',
            },
            extra: {
              originalArgs: args,
            },
          })
        }).catch(() => {
          // Silently fail if Sentry is not available
        })
      } catch {
        // Silently fail if dynamic import fails
      }
    }
  }
}

export const logger = new Logger()
