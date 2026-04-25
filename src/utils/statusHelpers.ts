import { differenceInDays } from 'date-fns'

/**
 * Status level enumeration for expiry tracking.
 * Maps to color system: red (expired/critical), orange (warning), green (ok).
 */
export type StatusColorLevel = 'expired' | 'critical' | 'warning' | 'ok'

/**
 * Helper to normalize date inputs and guard against invalid values.
 * @param value - Date as string (ISO), Date object, or null/undefined
 * @returns Valid Date or null if parsing fails
 */
const toValidDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Calculate days remaining until a given expiry date.
 * Returns 0 for null/undefined dates; negative values indicate past expiry.
 *
 * @param date - Expiry date as string (ISO), Date object, or null/undefined
 * @returns Number of days remaining (negative if expired)
 *
 * @example
 * calculateDaysRemaining('2026-05-01') // 6 (if today is 2026-04-25)
 * calculateDaysRemaining(new Date('2026-04-20')) // -5 (already expired)
 * calculateDaysRemaining(null) // 0
 */
export const calculateDaysRemaining = (date: string | Date | null | undefined): number => {
  const expiryDate = toValidDate(date)
  if (!expiryDate) return 0

  const today = new Date()
  // Reset time to ensure correct date comparison (midnight UTC)
  today.setHours(0, 0, 0, 0)
  expiryDate.setHours(0, 0, 0, 0)

  return differenceInDays(expiryDate, today)
}

/**
 * Get status color level based on days remaining.
 * Maps days to a 4-level urgency system: expired, critical, warning, ok.
 *
 * @param days - Days remaining (negative = expired, null/undefined treated as safe)
 * @returns Status level: 'expired' (days < 0), 'critical' (0-7), 'warning' (8-30), 'ok' (>30 or null/undefined)
 *
 * @example
 * getStatusColorLevel(-5) // 'expired'
 * getStatusColorLevel(3) // 'critical'
 * getStatusColorLevel(15) // 'warning'
 * getStatusColorLevel(60) // 'ok'
 * getStatusColorLevel(null) // 'ok' (defaults to safe)
 */
export const getStatusColorLevel = (days: number | null | undefined): StatusColorLevel => {
  // Treat null/undefined as safe (no expiry date defined)
  if (days == null) return 'ok'
  if (days < 0) return 'expired'
  if (days <= 7) return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

/**
 * Get Tailwind color classes for a given status level.
 * Returns object with backgroundColor, textColor, and borderColor classes.
 *
 * @param days - Days remaining (null/undefined treated as safe 'ok')
 * @returns Color object: { backgroundColor, textColor, borderColor }
 *
 * @example
 * getStatusColor(-5)
 * // { backgroundColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' }
 *
 * getStatusColor(null)
 * // { backgroundColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' }
 */
export const getStatusColor = (
  days: number | null | undefined
): {
  backgroundColor: string
  textColor: string
  borderColor: string
} => {
  const level = getStatusColorLevel(days)

  switch (level) {
    case 'expired':
      return {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
      }
    case 'critical':
      return {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
      }
    case 'warning':
      return {
        backgroundColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
      }
    case 'ok':
    default:
      return {
        backgroundColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
      }
  }
}
