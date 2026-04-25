/**
 * Error handling utilities for safe error type checking and message extraction
 */

/**
 * Supabase error response interface
 */
export interface SupabaseErrorResponse {
  message?: string
  code?: string
  status?: number
  statusCode?: number
  error?: string
  details?: string
  hint?: string
}

/**
 * Extract error message from any type of error
 * @param error - Unknown error object
 * @returns Safe error message string
 */
export function getErrorMessage(error: unknown): string {
  // Handle native Error objects
  if (error instanceof Error) {
    return error.message
  }

  // Handle objects with message property
  if (typeof error === 'object' && error !== null) {
    const err = error as SupabaseErrorResponse
    return err.message || err.error || 'حدث خطأ غير معروف'
  }

  // Handle string or other types
  return String(error) || 'حدث خطأ غير معروف'
}

/**
 * Extract HTTP status code from error
 * @param error - Unknown error object
 * @returns Status code if available, undefined otherwise
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const err = error as SupabaseErrorResponse
    return err.status || err.statusCode
  }
  return undefined
}

/**
 * Convert any value to safe string for input elements
 * @param value - Unknown value
 * @returns Safe string representation
 */
export function getInputValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return ''  // Do not assign boolean to input
  }
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

/**
 * Type guard to check if error is a Supabase error response
 */
export function isSupabaseError(error: unknown): error is SupabaseErrorResponse {
  return typeof error === 'object' && error !== null && ('message' in error || 'error' in error)
}

/**
 * Safe error status check
 * @param error - Unknown error object
 * @param statusCode - Status code to check
 * @returns True if error has the specified status code
 */
export function hasErrorStatus(error: unknown, statusCode: number): boolean {
  const status = getErrorStatus(error)
  return status === statusCode
}
