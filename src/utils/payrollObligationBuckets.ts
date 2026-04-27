
export type PayrollObligationBucketKey = 'transfer_renewal' | 'penalty' | 'advance' | 'other'

export interface PayrollObligationBreakdown {
  transfer_renewal: number
  penalty: number
  advance: number
  other: number
}

export const EMPTY_PAYROLL_OBLIGATION_BREAKDOWN: PayrollObligationBreakdown = {
  transfer_renewal: 0,
  penalty: 0,
  advance: 0,
  other: 0,
}

export const PAYROLL_OBLIGATION_BUCKET_LABELS: Record<PayrollObligationBucketKey, string> = {
  transfer_renewal: 'رسوم نقل وتجديد',
  penalty: 'جزاءات وغرامات',
  advance: 'سلف',
  other: 'أخرى',
}

export function normalizePayrollObligationBreakdown(
  value?: Partial<PayrollObligationBreakdown> | null
): PayrollObligationBreakdown {
  return {
    transfer_renewal: Number(value?.transfer_renewal || 0),
    penalty: Number(value?.penalty || 0),
    advance: Number(value?.advance || 0),
    other: Number(value?.other || 0),
  }
}

export function getPayrollObligationBucketLabel(bucket: PayrollObligationBucketKey): string {
  return PAYROLL_OBLIGATION_BUCKET_LABELS[bucket]
}

export function getPayrollObligationBucketFromType(
  type: ObligationType
): PayrollObligationBucketKey {
  if (type === 'transfer' || type === 'renewal') return 'transfer_renewal'
  if (type === 'penalty') return 'penalty'
  if (type === 'advance') return 'advance'
  return 'other'
}

export function getPayrollComponentCode(bucket: PayrollObligationBucketKey): string {
  switch (bucket) {
    case 'transfer_renewal':
      return 'TRANSFER_RENEWAL'
    case 'penalty':
      return 'PENALTY'
    case 'advance':
      return 'ADVANCE'
    case 'other':
    default:
      return 'OTHER'
  }
}

export function getPayrollComponentBucket(code?: string | null): PayrollObligationBucketKey | null {
  switch ((code || '').toUpperCase()) {
    case 'TRANSFER_RENEWAL':
      return 'transfer_renewal'
    case 'PENALTY':
      return 'penalty'
    case 'ADVANCE':
      return 'advance'
    case 'OTHER':
      return 'other'
    default:
      return null
  }
}

export function getPayrollObligationBreakdownTotal(
  value?: Partial<PayrollObligationBreakdown> | null
): number {
  const normalized = normalizePayrollObligationBreakdown(value)
  return normalized.transfer_renewal + normalized.penalty + normalized.advance + normalized.other
}
