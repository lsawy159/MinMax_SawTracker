const isDev = import.meta.env.DEV
const isTest = import.meta.env.MODE === 'test'

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
      // Use console.warn for debug messages as console.log is not allowed
      console.warn(this.formatMessage(LogLevel.DEBUG, ...args))
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      // Use console.warn for info messages as console.info is not allowed
      console.warn(this.formatMessage(LogLevel.INFO, ...args))
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, ...args))
    }
  }

  error(...args: unknown[]): void {
    console.error(this.formatMessage(LogLevel.ERROR, ...args))
    // في الإنتاج، يمكن إرسال الأخطاء لخدمة tracking
  }
}

export const logger = new Logger()

