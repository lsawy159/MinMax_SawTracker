import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { calculateDaysRemaining, getStatusColor, getStatusColorLevel } from '../statusHelpers'
import { add } from 'date-fns'
import { subDays } from 'date-fns'

describe('statusHelpers', () => {
  let mockDate: Date

  beforeEach(() => {
    // Mock today as 2026-04-25 for consistent testing
    mockDate = new Date('2026-04-25T00:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('calculateDaysRemaining', () => {
    it('returns 0 for null input', () => {
      expect(calculateDaysRemaining(null)).toBe(0)
    })

    it('returns 0 for undefined input', () => {
      expect(calculateDaysRemaining(undefined)).toBe(0)
    })

    it('returns 0 for invalid date string', () => {
      expect(calculateDaysRemaining('invalid-date')).toBe(0)
    })

    it('calculates positive days for future date string', () => {
      // 2026-05-01 is 6 days after 2026-04-25
      expect(calculateDaysRemaining('2026-05-01')).toBe(6)
    })

    it('calculates positive days for future Date object', () => {
      const futureDate = add(mockDate, { days: 10 })
      expect(calculateDaysRemaining(futureDate)).toBe(10)
    })

    it('returns 0 for today', () => {
      expect(calculateDaysRemaining(mockDate)).toBe(0)
    })

    it('calculates negative days for past date', () => {
      // 2026-04-20 is 5 days before 2026-04-25
      expect(calculateDaysRemaining('2026-04-20')).toBe(-5)
    })

    it('calculates negative days for past Date object', () => {
      const pastDate = subDays(mockDate, 7)
      expect(calculateDaysRemaining(pastDate)).toBe(-7)
    })

    it('handles single day boundaries correctly', () => {
      const tomorrow = add(mockDate, { days: 1 })
      expect(calculateDaysRemaining(tomorrow)).toBe(1)

      const yesterday = subDays(mockDate, 1)
      expect(calculateDaysRemaining(yesterday)).toBe(-1)
    })

    it('ignores time component in date calculations', () => {
      // Date with future time on same day should return 0
      const todayWithLaterTime = new Date(mockDate)
      todayWithLaterTime.setHours(23, 59, 59)
      expect(calculateDaysRemaining(todayWithLaterTime)).toBe(0)
    })
  })

  describe('getStatusColorLevel', () => {
    it('returns "expired" for negative days', () => {
      expect(getStatusColorLevel(-1)).toBe('expired')
      expect(getStatusColorLevel(-100)).toBe('expired')
    })

    it('returns "critical" for 0-7 days', () => {
      expect(getStatusColorLevel(0)).toBe('critical')
      expect(getStatusColorLevel(1)).toBe('critical')
      expect(getStatusColorLevel(7)).toBe('critical')
    })

    it('returns "warning" for 8-30 days', () => {
      expect(getStatusColorLevel(8)).toBe('warning')
      expect(getStatusColorLevel(15)).toBe('warning')
      expect(getStatusColorLevel(30)).toBe('warning')
    })

    it('returns "ok" for 31+ days', () => {
      expect(getStatusColorLevel(31)).toBe('ok')
      expect(getStatusColorLevel(100)).toBe('ok')
    })

    it('returns "ok" for null input', () => {
      expect(getStatusColorLevel(null)).toBe('ok')
    })

    it('returns "ok" for undefined input', () => {
      expect(getStatusColorLevel(undefined)).toBe('ok')
    })

    it('treats boundary values correctly', () => {
      expect(getStatusColorLevel(7)).toBe('critical')
      expect(getStatusColorLevel(8)).toBe('warning')
      expect(getStatusColorLevel(30)).toBe('warning')
      expect(getStatusColorLevel(31)).toBe('ok')
    })
  })

  describe('getStatusColor', () => {
    it('returns red colors for expired status', () => {
      const color = getStatusColor(-5)
      expect(color).toEqual({
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      })
    })

    it('returns red colors for critical status (0-7 days)', () => {
      const color = getStatusColor(3)
      expect(color).toEqual({
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      })
    })

    it('returns yellow colors for warning status (8-30 days)', () => {
      const color = getStatusColor(15)
      expect(color).toEqual({
        backgroundColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200'
      })
    })

    it('returns green colors for ok status (31+ days)', () => {
      const color = getStatusColor(60)
      expect(color).toEqual({
        backgroundColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      })
    })

    it('returns green colors for null input', () => {
      const color = getStatusColor(null)
      expect(color).toEqual({
        backgroundColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      })
    })

    it('returns green colors for undefined input', () => {
      const color = getStatusColor(undefined)
      expect(color).toEqual({
        backgroundColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      })
    })

    it('returns consistent colors across boundary transitions', () => {
      // Expired/Critical transition
      const critical = getStatusColor(0)
      expect(critical.textColor).toBe('text-red-700')

      // Critical/Warning transition
      const warning = getStatusColor(8)
      expect(warning.textColor).toBe('text-yellow-700')

      // Warning/Ok transition
      const ok = getStatusColor(31)
      expect(ok.textColor).toBe('text-green-700')
    })

    it('always returns object with all required keys', () => {
      const testCases = [-1, 0, 7, 8, 30, 31, null, undefined]
      testCases.forEach(days => {
        const color = getStatusColor(days)
        expect(color).toHaveProperty('backgroundColor')
        expect(color).toHaveProperty('textColor')
        expect(color).toHaveProperty('borderColor')
        expect(typeof color.backgroundColor).toBe('string')
        expect(typeof color.textColor).toBe('string')
        expect(typeof color.borderColor).toBe('string')
      })
    })
  })

  describe('integration: calculateDaysRemaining + getStatusColor', () => {
    it('maps future date to ok status', () => {
      const futureDate = '2026-06-01'
      const days = calculateDaysRemaining(futureDate)
      const color = getStatusColor(days)
      expect(color.textColor).toBe('text-green-700')
    })

    it('maps soon-expiring date to critical status', () => {
      const soonDate = '2026-04-30' // 5 days away
      const days = calculateDaysRemaining(soonDate)
      const color = getStatusColor(days)
      expect(color.textColor).toBe('text-red-700')
    })

    it('maps expired date to expired status', () => {
      const expiredDate = '2026-04-15' // 10 days ago
      const days = calculateDaysRemaining(expiredDate)
      const color = getStatusColor(days)
      expect(color.textColor).toBe('text-red-700')
    })
  })

  describe('edge cases', () => {
    it('handles leap year dates', () => {
      // Set system time to day before leap day
      const leapYearDate = new Date('2024-02-29T00:00:00Z')
      const daysUntilLeap = calculateDaysRemaining(leapYearDate)
      expect(typeof daysUntilLeap).toBe('number')
    })

    it('handles very large date differences', () => {
      const farFutureDate = '2050-12-31'
      const days = calculateDaysRemaining(farFutureDate)
      expect(days).toBeGreaterThan(9000)
    })

    it('handles zero as explicit value (today)', () => {
      const today = new Date('2026-04-25T12:30:45Z') // Same day, different time
      const days = calculateDaysRemaining(today)
      expect(days).toBe(0)
      expect(getStatusColorLevel(days)).toBe('critical')
    })

    it('preserves consistency across multiple calls', () => {
      const testDate = '2026-05-15'
      const result1 = calculateDaysRemaining(testDate)
      const result2 = calculateDaysRemaining(testDate)
      expect(result1).toBe(result2)
    })
  })
})
