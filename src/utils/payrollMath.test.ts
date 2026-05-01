import { describe, it, expect } from 'vitest'
import {
  roundPayrollAmount,
  calculatePayrollTotals,
  normalizePayrollEntryAmounts,
} from './payrollMath'

describe('payrollMath', () => {
  describe('roundPayrollAmount', () => {
    it('rounds to 2 decimal places', () => {
      expect(roundPayrollAmount(10.125)).toBe(10.13)
      expect(roundPayrollAmount(10.124)).toBe(10.12)
    })

    it('handles zero', () => {
      expect(roundPayrollAmount(0)).toBe(0)
    })

    it('handles negative numbers', () => {
      expect(roundPayrollAmount(-10.126)).toBe(-10.13)
    })

    it('handles null/undefined as zero', () => {
      expect(roundPayrollAmount(null as any)).toBe(0)
      expect(roundPayrollAmount(undefined as any)).toBe(0)
    })

    it('handles very small numbers', () => {
      expect(roundPayrollAmount(0.001)).toBe(0)
      expect(roundPayrollAmount(0.005)).toBe(0.01)
    })

    it('handles large numbers', () => {
      expect(roundPayrollAmount(999999.999)).toBe(1000000)
    })

    it('avoids floating point precision issues', () => {
      expect(roundPayrollAmount(0.1 + 0.2)).toBe(0.3)
      expect(roundPayrollAmount(1.005)).toBe(1.01)
    })
  })

  describe('calculatePayrollTotals', () => {
    it('calculates daily rate from base salary', () => {
      const result = calculatePayrollTotals(30000, 30, 0, 0, 0)
      expect(result.dailyRate).toBe(1000)
    })

    it('calculates gross amount with attendance days', () => {
      const result = calculatePayrollTotals(30000, 25, 0, 0, 0)
      expect(result.grossAmount).toBe(25000)
    })

    it('calculates gross amount with paid leave days', () => {
      const result = calculatePayrollTotals(30000, 25, 5, 0, 0)
      expect(result.grossAmount).toBe(30000)
    })

    it('includes overtime amount in gross', () => {
      const result = calculatePayrollTotals(30000, 20, 0, 5000, 0)
      expect(result.grossAmount).toBe(25000)
    })

    it('calculates net amount after deductions', () => {
      const result = calculatePayrollTotals(30000, 30, 0, 0, 2000)
      expect(result.netAmount).toBe(28000)
    })

    it('handles zero salary', () => {
      const result = calculatePayrollTotals(0, 30, 0, 0, 0)
      expect(result.dailyRate).toBe(0)
      expect(result.grossAmount).toBe(0)
      expect(result.netAmount).toBe(0)
    })

    it('handles null/undefined inputs as zero', () => {
      const result = calculatePayrollTotals(
        null as any,
        undefined as any,
        null as any,
        undefined as any,
        null as any
      )
      expect(result.dailyRate).toBe(0)
      expect(result.grossAmount).toBe(0)
      expect(result.netAmount).toBe(0)
    })

    it('rounds all returned values to 2 decimals', () => {
      const result = calculatePayrollTotals(30001, 10, 0, 0, 500)
      expect(result.dailyRate).toBe(1000.03)
      expect(result.grossAmount).toBe(10000.33)
      expect(result.netAmount).toBe(9500.33)
    })

    it('handles partial days with fractional values', () => {
      const result = calculatePayrollTotals(30000, 15.5, 0, 0, 1000)
      expect(result.dailyRate).toBe(1000)
      expect(result.grossAmount).toBe(15500)
      expect(result.netAmount).toBe(14500)
    })

    it('deducts from gross to calculate net', () => {
      const result = calculatePayrollTotals(30000, 30, 0, 0, 5000)
      expect(result.netAmount).toBe(result.grossAmount - 5000)
    })

    it('handles very large deductions', () => {
      const result = calculatePayrollTotals(30000, 30, 0, 0, 50000)
      expect(result.netAmount).toBe(-20000)
    })
  })

  describe('normalizePayrollEntryAmounts', () => {
    it('normalizes with explicit total deductions', () => {
      const result = normalizePayrollEntryAmounts(
        {
          basic_salary_snapshot: 30000,
          attendance_days: 20,
          paid_leave_days: 0,
          overtime_amount: 0,
          gross_amount: 20000,
          net_amount: 18000,
        },
        2000
      )
      expect(result.dailyRate).toBe(1000)
      expect(result.grossAmount).toBe(20000)
      expect(result.netAmount).toBe(18000)
    })

    it('infers deductions from gross and net', () => {
      const result = normalizePayrollEntryAmounts(
        {
          basic_salary_snapshot: 30000,
          attendance_days: 20,
          paid_leave_days: 0,
          overtime_amount: 0,
          gross_amount: 20000,
          net_amount: 18000,
        }
      )
      expect(result.dailyRate).toBe(1000)
      expect(result.grossAmount).toBe(20000)
      expect(result.netAmount).toBe(18000)
    })

    it('handles zero inferred deductions', () => {
      const result = normalizePayrollEntryAmounts(
        {
          basic_salary_snapshot: 30000,
          attendance_days: 20,
          paid_leave_days: 0,
          overtime_amount: 0,
          gross_amount: 20000,
          net_amount: 20000,
        }
      )
      expect(result.netAmount).toBe(20000)
    })

    it('handles negative inferred deductions as zero', () => {
      const result = normalizePayrollEntryAmounts(
        {
          basic_salary_snapshot: 30000,
          attendance_days: 20,
          paid_leave_days: 0,
          overtime_amount: 0,
          gross_amount: 20000,
          net_amount: 25000,
        }
      )
      expect(result.netAmount).toBe(20000)
    })

    it('handles empty entry', () => {
      const result = normalizePayrollEntryAmounts({})
      expect(result.dailyRate).toBe(0)
      expect(result.grossAmount).toBe(0)
      expect(result.netAmount).toBe(0)
    })

    it('handles partial entry with some fields', () => {
      const result = normalizePayrollEntryAmounts({
        basic_salary_snapshot: 30000,
        attendance_days: 25,
      })
      expect(result.dailyRate).toBe(1000)
      expect(result.grossAmount).toBe(25000)
    })

    it('handles entry with only paid leave days', () => {
      const result = normalizePayrollEntryAmounts({
        basic_salary_snapshot: 30000,
        paid_leave_days: 10,
      })
      expect(result.dailyRate).toBe(1000)
      expect(result.grossAmount).toBe(10000)
    })

    it('includes overtime in normalization', () => {
      const result = normalizePayrollEntryAmounts({
        basic_salary_snapshot: 30000,
        attendance_days: 20,
        overtime_amount: 5000,
      })
      expect(result.grossAmount).toBe(25000)
    })

    it('handles explicit deductions overriding inferred', () => {
      const result = normalizePayrollEntryAmounts(
        {
          basic_salary_snapshot: 30000,
          attendance_days: 30,
          gross_amount: 30000,
          net_amount: 28000,
        },
        3000
      )
      expect(result.netAmount).toBe(27000)
    })
  })

  describe('edge cases and precision', () => {
    it('handles combined calculations correctly', () => {
      const result = calculatePayrollTotals(30000, 15, 0, 0, 1000)
      expect(result.dailyRate).toBe(1000)
      expect(result.grossAmount).toBe(15000)
      expect(result.netAmount).toBe(14000)
    })

    it('handles floating point with rounding', () => {
      const result = calculatePayrollTotals(29999, 10, 5, 1111.11, 999.99)
      expect(result.dailyRate).toBe(999.97)
      expect(typeof result.grossAmount).toBe('number')
      expect(result.netAmount).toBeLessThan(result.grossAmount)
    })
  })
})
