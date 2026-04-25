import { PayrollEntry } from '@/lib/supabase'

export function roundPayrollAmount(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

export function calculatePayrollTotals(
  baseSalary: number,
  attendanceDays: number,
  paidLeaveDays: number,
  overtimeAmount: number,
  groupedDeductions: number
) {
  const rawDailyRate = Number(baseSalary || 0) / 30
  const dailyRate = roundPayrollAmount(rawDailyRate)
  const grossAmount = roundPayrollAmount(((Number(attendanceDays || 0) + Number(paidLeaveDays || 0)) * rawDailyRate) + Number(overtimeAmount || 0))
  const netAmount = roundPayrollAmount(grossAmount - Number(groupedDeductions || 0))

  return {
    dailyRate,
    grossAmount,
    netAmount,
  }
}

export function normalizePayrollEntryAmounts(
  entry: Partial<Pick<PayrollEntry, 'basic_salary_snapshot' | 'attendance_days' | 'paid_leave_days' | 'overtime_amount' | 'gross_amount' | 'net_amount'>>,
  totalDeductions?: number
) {
  const inferredDeductions = totalDeductions ?? roundPayrollAmount(
    Math.max(Number(entry.gross_amount || 0) - Number(entry.net_amount || 0), 0)
  )

  return calculatePayrollTotals(
    Number(entry.basic_salary_snapshot || 0),
    Number(entry.attendance_days || 0),
    Number(entry.paid_leave_days || 0),
    Number(entry.overtime_amount || 0),
    inferredDeductions
  )
}
