import { toast } from 'sonner'
import { logger } from './logger'

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public userMessage: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleError(error: unknown): void {
  if (error instanceof AppError) {
    logger.error(`[${error.code}] ${error.message}`, error.originalError)
    toast.error(error.userMessage)
  } else if (error instanceof Error) {
    logger.error('Unknown error:', error)
    
    // تحديد نوع الخطأ من الرسالة
    if (error.message.includes('network') || error.message.includes('fetch')) {
      toast.error('خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى.')
    } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      toast.error('ليس لديك صلاحية لتنفيذ هذه العملية.')
    } else {
      toast.error('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.')
    }
  } else {
    logger.error('Unknown error type:', error)
    toast.error('حدث خطأ غير متوقع.')
  }
}

export function createError(
  message: string,
  code: ErrorCode,
  userMessage: string,
  originalError?: unknown
): AppError {
  return new AppError(message, code, userMessage, originalError)
}

