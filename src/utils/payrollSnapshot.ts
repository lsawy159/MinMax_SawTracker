import { supabase } from '@/lib/supabase'
import { logger } from './logger'

export interface PayrollSnapshot {
  timestamp: string
  runId: string
  entries: Array<{
    employee_id: string
    gross_amount: number
    net_amount: number
    installment_deducted_amount: number
    entry_status: string
  }>
  totals: {
    employees_count: number
    gross_total: number
    net_total: number
    installment_total: number
  }
}

export interface PayrollDiff {
  added: PayrollSnapshot['entries']
  removed: PayrollSnapshot['entries']
  modified: Array<{
    employee_id: string
    field: string
    old_value: unknown
    new_value: unknown
  }>
  totals_diff: {
    employees_count: number
    gross_total: number
    net_total: number
    installment_total: number
  }
}

export async function takePayrollSnapshot(runId: string): Promise<PayrollSnapshot> {
  const { data: entries, error } = await supabase
    .from('payroll_entries')
    .select(
      'employee_id, gross_amount, net_amount, installment_deducted_amount, entry_status'
    )
    .eq('payroll_run_id', runId)

  if (error) {
    logger.error('Error taking payroll snapshot:', error)
    throw error
  }

  const entryList = entries ?? []

  const snapshot: PayrollSnapshot = {
    timestamp: new Date().toISOString(),
    runId,
    entries: entryList as PayrollSnapshot['entries'],
    totals: {
      employees_count: entryList.length,
      gross_total: entryList.reduce(
        (sum, e) => sum + (Number(e.gross_amount) || 0),
        0
      ),
      net_total: entryList.reduce(
        (sum, e) => sum + (Number(e.net_amount) || 0),
        0
      ),
      installment_total: entryList.reduce(
        (sum, e) => sum + (Number(e.installment_deducted_amount) || 0),
        0
      ),
    },
  }

  return snapshot
}

export function comparePayrollSnapshots(
  before: PayrollSnapshot,
  after: PayrollSnapshot
): PayrollDiff {
  const beforeMap = new Map(before.entries.map((e) => [e.employee_id, e]))
  const afterMap = new Map(after.entries.map((e) => [e.employee_id, e]))

  const added: PayrollSnapshot['entries'] = []
  const removed: PayrollSnapshot['entries'] = []
  const modified: PayrollDiff['modified'] = []

  // Find added and modified
  for (const [employeeId, afterEntry] of afterMap) {
    const beforeEntry = beforeMap.get(employeeId)

    if (!beforeEntry) {
      added.push(afterEntry)
    } else {
      // Check for modifications
      const fields = ['gross_amount', 'net_amount', 'installment_deducted_amount', 'entry_status'] as const
      for (const field of fields) {
        const beforeValue = beforeEntry[field]
        const afterValue = afterEntry[field]

        if (
          typeof beforeValue === 'number' &&
          typeof afterValue === 'number'
        ) {
          // Numeric comparison with small tolerance for rounding
          if (Math.abs(beforeValue - afterValue) > 0.01) {
            modified.push({
              employee_id: employeeId,
              field,
              old_value: beforeValue,
              new_value: afterValue,
            })
          }
        } else if (beforeValue !== afterValue) {
          modified.push({
            employee_id: employeeId,
            field,
            old_value: beforeValue,
            new_value: afterValue,
          })
        }
      }
    }
  }

  // Find removed
  for (const [employeeId, beforeEntry] of beforeMap) {
    if (!afterMap.has(employeeId)) {
      removed.push(beforeEntry)
    }
  }

  const diff: PayrollDiff = {
    added,
    removed,
    modified,
    totals_diff: {
      employees_count: after.totals.employees_count - before.totals.employees_count,
      gross_total: Math.abs(after.totals.gross_total - before.totals.gross_total),
      net_total: Math.abs(after.totals.net_total - before.totals.net_total),
      installment_total: Math.abs(
        after.totals.installment_total - before.totals.installment_total
      ),
    },
  }

  return diff
}

export function hasPayrollDrift(diff: PayrollDiff): boolean {
  return (
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.modified.length > 0 ||
    diff.totals_diff.employees_count !== 0 ||
    diff.totals_diff.gross_total > 0.01 ||
    diff.totals_diff.net_total > 0.01 ||
    diff.totals_diff.installment_total > 0.01
  )
}
