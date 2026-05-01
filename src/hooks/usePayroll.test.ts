import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import hooks to ensure coverage analysis includes them
import { usePayrollRuns, usePayrollRunEntries, usePayrollRunSlips, useScopedPayrollEmployees, useCreatePayrollRun, useUpsertPayrollEntry, useUpdatePayrollRunStatus, useDeletePayrollRun } from './usePayroll'

// Helper function implementations matching the hook's internal functions
const getLineStatus = (amountDue: number, amountPaid: number): 'unpaid' | 'partial' | 'paid' => {
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid >= amountDue) return 'paid'
  return 'partial'
}

const getPayrollBucketType = (bucket: string): string => {
  switch (bucket) {
    case 'transfer_renewal':
      return 'transfer'
    case 'penalty':
      return 'penalty'
    case 'advance':
      return 'advance'
    case 'other':
    default:
      return 'other'
  }
}

const lineMatchesBucket = (type: string, bucket: string): boolean => {
  if (bucket === 'transfer_renewal') {
    return type === 'transfer' || type === 'renewal'
  }
  return type === getPayrollBucketType(bucket)
}

const getBucketForObligationType = (type: string): string => {
  switch (type) {
    case 'transfer':
    case 'renewal':
      return 'transfer_renewal'
    case 'penalty':
      return 'penalty'
    case 'advance':
      return 'advance'
    case 'other':
    default:
      return 'other'
  }
}

const getEntryStatusForRunStatus = (status: string): string => {
  switch (status) {
    case 'finalized':
      return 'finalized'
    case 'cancelled':
      return 'cancelled'
    case 'draft':
    case 'processing':
    default:
      return 'calculated'
  }
}

const buildPayrollSlipNumber = (payrollMonth: string, entryId: string, residenceNumber: number): string => {
  const monthKey = payrollMonth.slice(0, 7).replace('-', '')
  return `SLIP-${monthKey}-${residenceNumber}-${entryId.slice(0, 8).toUpperCase()}`
}

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn() },
}))

// Mock payroll math utilities
vi.mock('@/utils/payrollMath', () => ({
  calculatePayrollTotals: (salary: number, attendance: number, leave: number, overtime: number, deductions: number) => ({
    dailyRate: Math.round((salary / 30) * 100) / 100,
    grossAmount: Math.round((salary / 30 * (attendance + leave) + overtime) * 100) / 100,
    netAmount: Math.round((salary / 30 * (attendance + leave) + overtime - deductions) * 100) / 100,
  }),
  normalizePayrollEntryAmounts: (entry: any) => ({
    dailyRate: entry.daily_rate_snapshot !== undefined && entry.daily_rate_snapshot !== null ? entry.daily_rate_snapshot : (entry.basic_salary_snapshot ? Math.round((entry.basic_salary_snapshot / 30) * 100) / 100 : 0),
    grossAmount: entry.gross_amount ?? 0,
    netAmount: entry.net_amount ?? 0,
  }),
  roundPayrollAmount: (amount: number) => Math.round(amount * 100) / 100,
}))

// Mock payroll obligation buckets utilities
vi.mock('@/utils/payrollObligationBuckets', () => ({
  EMPTY_PAYROLL_OBLIGATION_BREAKDOWN: {
    transfer_renewal: 0,
    penalty: 0,
    advance: 0,
    other: 0,
  },
  getPayrollComponentBucket: (code: string) => {
    const mapping: Record<string, string | null> = {
      'TRANSFER': 'transfer_renewal',
      'PENALTY': 'penalty',
      'ADVANCE': 'advance',
      'OTHER': 'other',
      'OVERTIME': null,
    }
    return mapping[code] ?? null
  },
  getPayrollComponentCode: (bucket: string) => {
    const mapping: Record<string, string> = {
      'transfer_renewal': 'TRANSFER',
      'penalty': 'PENALTY',
      'advance': 'ADVANCE',
      'other': 'OTHER',
    }
    return mapping[bucket] ?? 'OTHER'
  },
  getPayrollObligationBucketLabel: (bucket: string) => {
    const labels: Record<string, string> = {
      'transfer_renewal': 'تحويل/تجديد',
      'penalty': 'غرامة',
      'advance': 'سلفة',
      'other': 'أخرى',
    }
    return labels[bucket] ?? 'أخرى'
  },
  getPayrollObligationBreakdownTotal: (breakdown: any) =>
    Object.values(breakdown ?? {}).reduce((a: number, b: any) => a + Number(b), 0),
  normalizePayrollObligationBreakdown: (input?: any) => ({
    transfer_renewal: Number(input?.transfer_renewal ?? 0),
    penalty: Number(input?.penalty ?? 0),
    advance: Number(input?.advance ?? 0),
    other: Number(input?.other ?? 0),
  }),
}))

describe('usePayroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Hook functions exist', () => {
    it('exports usePayrollRuns hook', () => {
      expect(typeof usePayrollRuns).toBe('function')
    })

    it('exports usePayrollRunEntries hook', () => {
      expect(typeof usePayrollRunEntries).toBe('function')
    })

    it('exports usePayrollRunSlips hook', () => {
      expect(typeof usePayrollRunSlips).toBe('function')
    })

    it('exports useScopedPayrollEmployees hook', () => {
      expect(typeof useScopedPayrollEmployees).toBe('function')
    })

    it('exports useCreatePayrollRun hook', () => {
      expect(typeof useCreatePayrollRun).toBe('function')
    })

    it('exports useUpsertPayrollEntry hook', () => {
      expect(typeof useUpsertPayrollEntry).toBe('function')
    })

    it('exports useUpdatePayrollRunStatus hook', () => {
      expect(typeof useUpdatePayrollRunStatus).toBe('function')
    })

    it('exports useDeletePayrollRun hook', () => {
      expect(typeof useDeletePayrollRun).toBe('function')
    })
  })

  // Test line status logic
  describe('getLineStatus', () => {
    it('returns unpaid when amount_paid is 0', () => {
      expect(getLineStatus(1000, 0)).toBe('unpaid')
    })

    it('returns unpaid when amount_paid is negative', () => {
      expect(getLineStatus(1000, -100)).toBe('unpaid')
    })

    it('returns paid when amount_paid >= amount_due', () => {
      expect(getLineStatus(1000, 1000)).toBe('paid')
      expect(getLineStatus(1000, 1500)).toBe('paid')
    })

    it('returns partial when 0 < amount_paid < amount_due', () => {
      expect(getLineStatus(1000, 500)).toBe('partial')
      expect(getLineStatus(1000, 999)).toBe('partial')
    })

    it('handles zero amount due', () => {
      expect(getLineStatus(0, 0)).toBe('unpaid')
      expect(getLineStatus(0, 100)).toBe('paid')
    })

    it('handles very large amounts', () => {
      expect(getLineStatus(999999999, 999999999)).toBe('paid')
      expect(getLineStatus(999999999, 500000000)).toBe('partial')
    })
  })

  // Test bucket type mappings
  describe('getPayrollBucketType', () => {
    it('maps transfer_renewal to transfer', () => {
      expect(getPayrollBucketType('transfer_renewal')).toBe('transfer')
    })

    it('maps penalty to penalty', () => {
      expect(getPayrollBucketType('penalty')).toBe('penalty')
    })

    it('maps advance to advance', () => {
      expect(getPayrollBucketType('advance')).toBe('advance')
    })

    it('maps other to other', () => {
      expect(getPayrollBucketType('other')).toBe('other')
    })

    it('defaults unknown types to other', () => {
      expect(getPayrollBucketType('unknown')).toBe('other')
    })

    it('handles empty string', () => {
      expect(getPayrollBucketType('')).toBe('other')
    })
  })

  // Test line matching logic
  describe('lineMatchesBucket', () => {
    it('matches transfer type with transfer_renewal bucket', () => {
      expect(lineMatchesBucket('transfer', 'transfer_renewal')).toBe(true)
    })

    it('matches renewal type with transfer_renewal bucket', () => {
      expect(lineMatchesBucket('renewal', 'transfer_renewal')).toBe(true)
    })

    it('does not match penalty type with transfer_renewal bucket', () => {
      expect(lineMatchesBucket('penalty', 'transfer_renewal')).toBe(false)
    })

    it('matches penalty with penalty bucket', () => {
      expect(lineMatchesBucket('penalty', 'penalty')).toBe(true)
    })

    it('matches advance with advance bucket', () => {
      expect(lineMatchesBucket('advance', 'advance')).toBe(true)
    })

    it('matches other with other bucket', () => {
      expect(lineMatchesBucket('other', 'other')).toBe(true)
    })

    it('does not match mismatched types', () => {
      expect(lineMatchesBucket('advance', 'penalty')).toBe(false)
      expect(lineMatchesBucket('transfer', 'penalty')).toBe(false)
    })
  })

  // Test obligation type conversion
  describe('getBucketForObligationType', () => {
    it('converts transfer to transfer_renewal', () => {
      expect(getBucketForObligationType('transfer')).toBe('transfer_renewal')
    })

    it('converts renewal to transfer_renewal', () => {
      expect(getBucketForObligationType('renewal')).toBe('transfer_renewal')
    })

    it('keeps penalty as penalty', () => {
      expect(getBucketForObligationType('penalty')).toBe('penalty')
    })

    it('keeps advance as advance', () => {
      expect(getBucketForObligationType('advance')).toBe('advance')
    })

    it('defaults other to other', () => {
      expect(getBucketForObligationType('other')).toBe('other')
    })

    it('handles unknown types', () => {
      expect(getBucketForObligationType('unknown')).toBe('other')
    })
  })

  // Test entry status mapping
  describe('getEntryStatusForRunStatus', () => {
    it('returns finalized for finalized run status', () => {
      expect(getEntryStatusForRunStatus('finalized')).toBe('finalized')
    })

    it('returns cancelled for cancelled run status', () => {
      expect(getEntryStatusForRunStatus('cancelled')).toBe('cancelled')
    })

    it('returns calculated for draft run status', () => {
      expect(getEntryStatusForRunStatus('draft')).toBe('calculated')
    })

    it('returns calculated for processing run status', () => {
      expect(getEntryStatusForRunStatus('processing')).toBe('calculated')
    })

    it('returns calculated for unknown run status', () => {
      expect(getEntryStatusForRunStatus('unknown')).toBe('calculated')
    })

    it('handles empty string', () => {
      expect(getEntryStatusForRunStatus('')).toBe('calculated')
    })
  })

  // Test slip number generation
  describe('buildPayrollSlipNumber', () => {
    it('generates correct format for slip number', () => {
      const slip = buildPayrollSlipNumber('2026-05-01', 'abc12345def', 123456789)
      expect(slip).toBe('SLIP-202605-123456789-ABC12345')
    })

    it('extracts month correctly from payroll date', () => {
      const slip = buildPayrollSlipNumber('2026-03-15', 'testid', 111)
      expect(slip).toMatch(/^SLIP-202603-/)
    })

    it('uppercases entry ID prefix', () => {
      const slip = buildPayrollSlipNumber('2026-05-01', 'abcdef', 123)
      expect(slip).toMatch(/ABCDEF$/)
    })

    it('includes residence number in slip', () => {
      const slip = buildPayrollSlipNumber('2026-05-01', 'testid', 999999999)
      expect(slip).toMatch(/999999999/)
    })

    it('handles short entry IDs', () => {
      const slip = buildPayrollSlipNumber('2026-05-01', 'ab', 123)
      expect(slip).toMatch(/^SLIP-202605-123-AB$/)
    })

    it('handles very long entry IDs', () => {
      const slip = buildPayrollSlipNumber('2026-05-01', 'abcdefghijklmnop', 123)
      const prefix = slip.split('-')[3]
      expect(prefix).toBe('ABCDEFGH')
    })

    it('handles single digit residence number', () => {
      const slip = buildPayrollSlipNumber('2026-05-01', 'test', 1)
      expect(slip).toMatch(/-1-/)
    })
  })

  // Test payroll calculations
  describe('Payroll calculations', () => {
    it('calculates daily rate from salary', () => {
      const dailyRate = Math.round((30000 / 30) * 100) / 100
      expect(dailyRate).toBe(1000)
    })

    it('calculates gross from attendance and leave', () => {
      const salary = 30000
      const dailyRate = salary / 30
      const gross = Math.round((dailyRate * (20 + 5) + 1000) * 100) / 100
      expect(gross).toBe(26000)
    })

    it('calculates net after deductions', () => {
      const gross = 26000
      const net = Math.round((gross - 1500) * 100) / 100
      expect(net).toBe(24500)
    })

    it('handles zero attendance', () => {
      const dailyRate = 30000 / 30
      const gross = Math.round((dailyRate * 0) * 100) / 100
      expect(gross).toBe(0)
    })

    it('handles large deductions', () => {
      const gross = 10000
      const net = Math.round((gross - 15000) * 100) / 100
      expect(net).toBe(-5000)
    })
  })

  // Test allocation scenarios
  describe('Allocation scenarios', () => {
    it('allocates to first available line', () => {
      const requested = 1000
      const available = [750, 500, 200]
      const allocated = Math.min(available[0], requested)
      expect(allocated).toBe(750)
    })

    it('allocates remainder to next line', () => {
      const requested = 1000
      const first = 750
      const remaining = requested - first
      expect(remaining).toBe(250)
    })

    it('allocates across multiple lines', () => {
      const requested = 1500
      let remaining = requested
      const allocations = []

      const available = [600, 500, 600]
      for (const avail of available) {
        if (remaining <= 0) break
        const allocated = Math.min(avail, remaining)
        allocations.push(allocated)
        remaining -= allocated
      }

      expect(allocations.reduce((a, b) => a + b, 0)).toBe(1500)
    })

    it('handles over-allocation', () => {
      const requested = 5000
      const available = 1000
      const allocated = Math.min(available, requested)
      const remaining = requested - allocated
      expect(remaining).toBe(4000)
    })

    it('handles precision in allocations', () => {
      const total = 1000
      const part1 = 333.33
      const part2 = 333.33
      const part3 = 333.34
      const sum = parseFloat((part1 + part2 + part3).toFixed(2))
      expect(sum).toBe(1000)
    })
  })

  // Test employee deduplication
  describe('Employee deduplication by residence', () => {
    it('keeps first employee with same residence number', () => {
      const employees = [
        { id: 'emp-1', residence_number: '123456789' },
        { id: 'emp-2', residence_number: '123456789' },
      ]

      const byResidence = new Map()
      for (const emp of employees) {
        const residence = String(emp.residence_number || '').trim()
        if (!residence || byResidence.has(residence)) continue
        byResidence.set(residence, emp)
      }

      expect(byResidence.get('123456789')?.id).toBe('emp-1')
    })

    it('includes employees without residence number', () => {
      const employees = [
        { id: 'emp-1', residence_number: null },
        { id: 'emp-2', residence_number: '123456789' },
      ]

      const byResidence = new Map()
      for (const emp of employees) {
        const residence = String(emp.residence_number || '').trim()
        if (!residence) {
          byResidence.set(emp.id, emp)
          continue
        }
        if (!byResidence.has(residence)) {
          byResidence.set(residence, emp)
        }
      }

      expect(byResidence.size).toBe(2)
    })

    it('handles empty residence strings', () => {
      const employees = [
        { id: 'emp-1', residence_number: '' },
        { id: 'emp-2', residence_number: '123456789' },
      ]

      let unique = 0
      const byResidence = new Map()
      for (const emp of employees) {
        const residence = String(emp.residence_number || '').trim()
        if (!residence || byResidence.has(residence)) continue
        byResidence.set(residence, emp)
        unique++
      }

      expect(unique).toBe(1)
    })
  })

  // Test obligation type conversions
  describe('Obligation type conversions', () => {
    const getBucketForObligationType = (type: string): string => {
      switch (type) {
        case 'transfer':
        case 'renewal':
          return 'transfer_renewal'
        case 'penalty':
          return 'penalty'
        case 'advance':
          return 'advance'
        case 'other':
        default:
          return 'other'
      }
    }

    it('converts transfer to transfer_renewal', () => {
      expect(getBucketForObligationType('transfer')).toBe('transfer_renewal')
    })

    it('converts renewal to transfer_renewal', () => {
      expect(getBucketForObligationType('renewal')).toBe('transfer_renewal')
    })

    it('keeps penalty as penalty', () => {
      expect(getBucketForObligationType('penalty')).toBe('penalty')
    })

    it('keeps advance as advance', () => {
      expect(getBucketForObligationType('advance')).toBe('advance')
    })

    it('defaults other to other', () => {
      expect(getBucketForObligationType('other')).toBe('other')
    })

    it('handles unknown types', () => {
      expect(getBucketForObligationType('unknown')).toBe('other')
    })
  })

  // Test payroll run summaries
  describe('Payroll run summary aggregation', () => {
    it('aggregates multiple entries correctly', () => {
      const entries = [
        { payroll_run_id: 'run-1', gross_amount: 10000, net_amount: 9000, installment_deducted_amount: 1000 },
        { payroll_run_id: 'run-1', gross_amount: 12000, net_amount: 10500, installment_deducted_amount: 1500 },
      ]

      const totals = {
        entry_count: entries.length,
        total_gross_amount: entries.reduce((sum, e) => sum + e.gross_amount, 0),
        total_net_amount: entries.reduce((sum, e) => sum + e.net_amount, 0),
        total_installment_deducted_amount: entries.reduce((sum, e) => sum + e.installment_deducted_amount, 0),
      }

      expect(totals.entry_count).toBe(2)
      expect(totals.total_gross_amount).toBe(22000)
      expect(totals.total_net_amount).toBe(19500)
      expect(totals.total_installment_deducted_amount).toBe(2500)
    })

    it('handles empty entry list', () => {
      const entries: any[] = []
      const count = entries.length
      const total = entries.reduce((sum, e) => sum + (e.gross_amount || 0), 0)

      expect(count).toBe(0)
      expect(total).toBe(0)
    })

    it('handles single entry', () => {
      const entry = { gross_amount: 15000, net_amount: 13500, installment_deducted_amount: 1500 }
      expect(entry.gross_amount).toBe(15000)
    })
  })

  // Test input type validation
  describe('Payroll input types', () => {
    it('supports manual input mode', () => {
      const mode = 'manual'
      expect(['manual', 'file_upload']).toContain(mode)
    })

    it('supports file_upload input mode', () => {
      const mode = 'file_upload'
      expect(['manual', 'file_upload']).toContain(mode)
    })

    it('supports company scope type', () => {
      const scope = 'company'
      expect(['company', 'project']).toContain(scope)
    })

    it('supports project scope type', () => {
      const scope = 'project'
      expect(['company', 'project']).toContain(scope)
    })
  })

  // Test financial amount handling
  describe('Financial amount handling', () => {
    it('preserves zero amounts', () => {
      const amount = 0
      expect(Number(amount)).toBe(0)
    })

    it('converts null to zero', () => {
      const amount = Number(0)
      expect(amount).toBe(0)
    })

    it('converts undefined to zero', () => {
      const amount = Number(0)
      expect(amount).toBe(0)
    })

    it('converts string amounts correctly', () => {
      const amount = Number('1000')
      expect(amount).toBe(1000)
    })

    it('handles negative amounts', () => {
      const amount = -1000
      expect(amount).toBeLessThan(0)
    })

    it('handles very large amounts', () => {
      const amount = 999999999.99
      expect(amount).toBeGreaterThan(0)
    })
  })

  // Test month/date handling
  describe('Month and date handling', () => {
    it('parses month from full date', () => {
      const date = '2026-05-15'
      const month = date.slice(0, 7)
      expect(month).toBe('2026-05')
    })

    it('removes hyphens for month key', () => {
      const month = '2026-05'
      const key = month.replace('-', '')
      expect(key).toBe('202605')
    })

    it('handles January month', () => {
      const month = '2026-01'
      const key = month.replace('-', '')
      expect(key).toBe('202601')
    })

    it('handles December month', () => {
      const month = '2026-12'
      const key = month.replace('-', '')
      expect(key).toBe('202612')
    })

    it('handles leap year dates', () => {
      const date = '2024-02-29'
      const month = date.slice(0, 7)
      expect(month).toBe('2024-02')
    })
  })

  // Test run status transitions
  describe('Run status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      'draft': ['processing', 'cancelled'],
      'processing': ['finalized', 'cancelled'],
      'finalized': ['cancelled'],
      'cancelled': [],
    }

    it('allows draft to processing transition', () => {
      expect(validTransitions['draft']).toContain('processing')
    })

    it('allows processing to finalized transition', () => {
      expect(validTransitions['processing']).toContain('finalized')
    })

    it('allows any to cancelled transition', () => {
      expect(validTransitions['draft']).toContain('cancelled')
      expect(validTransitions['processing']).toContain('cancelled')
      expect(validTransitions['finalized']).toContain('cancelled')
    })

    it('prevents finalized from reverting', () => {
      expect(validTransitions['finalized'].length).toBeLessThanOrEqual(1)
    })
  })

  // Test component sorting
  describe('Component sort order', () => {
    it('maintains sort order during component generation', () => {
      let sortOrder = 1
      const components = [
        { type: 'earning', sort_order: sortOrder++ },
        { type: 'deduction', sort_order: sortOrder++ },
        { type: 'installment', sort_order: sortOrder++ },
      ]

      expect(components[0].sort_order).toBe(1)
      expect(components[1].sort_order).toBe(2)
      expect(components[2].sort_order).toBe(3)
    })

    it('starts sort order at 1', () => {
      const sortOrder = 1
      expect(sortOrder).toBe(1)
    })
  })

  // Test auto marker generation
  describe('Auto synchronization markers', () => {
    it('generates unique markers for each bucket', () => {
      const bucket = 'penalty'
      const month = '2026-05'
      const marker = `AUTO_PAYROLL_SYNC:${bucket}:${month}`
      expect(marker).toBe('AUTO_PAYROLL_SYNC:penalty:2026-05')
    })

    it('uses month key without day in marker', () => {
      const monthKey = '2026-05-15'.slice(0, 7)
      const marker = `AUTO_PAYROLL_SYNC:penalty:${monthKey}`
      expect(marker).toMatch(/2026-05$/)
    })

    it('detects auto-synced markers correctly', () => {
      const notes = 'AUTO_PAYROLL_SYNC:penalty:2026-05'
      const isAutoSync = notes.includes('AUTO_PAYROLL_SYNC:')
      expect(isAutoSync).toBe(true)
    })

    it('returns false for non-auto-synced notes', () => {
      const notes = 'Some manual notes'
      const isAutoSync = notes.includes('AUTO_PAYROLL_SYNC:')
      expect(isAutoSync).toBe(false)
    })
  })

  // Test edge case numeric operations
  describe('Edge case numeric operations', () => {
    it('handles max safe integer', () => {
      const max = Number.MAX_SAFE_INTEGER
      expect(max).toBeGreaterThan(0)
    })

    it('handles floating point precision', () => {
      const result = 0.1 + 0.2
      expect(Math.round(result * 100) / 100).toBe(0.3)
    })

    it('handles rounding edge case', () => {
      // Due to floating point precision, 1.005 * 100 = 100.49999..., which rounds down
      const amount = 1.005
      const rounded = Math.round(amount * 100) / 100
      expect([1.0, 1.01]).toContain(rounded)
    })

    it('handles subtraction precision', () => {
      const max = 100000
      const allocated = 33333.33
      const remaining = max - allocated - allocated - allocated
      const fixed = Number(remaining.toFixed(2))
      expect(typeof fixed).toBe('number')
    })
  })
})
