import type { Employee } from '@/lib/supabase'

export const HIRED_WORKER_CONTRACT_STATUS_OPTIONS = ['أجير', 'بإنتظار إجراءات النقل', 'بدون أجير'] as const
export const TRANSFER_STATUS_OPTIONS = [
  'منقول',
  'تحت إجراء النقل',
  'بانتظار موافقة الكفيل',
  'بانتظار موافقة العامل',
  'بانتظار فترة الإشعار',
  'بإنتظار الجوازات',
  'ليس على الكفالة',
  'بإنتظار رخصة العمل',
] as const

export type HiredWorkerContractStatusOption = (typeof HIRED_WORKER_CONTRACT_STATUS_OPTIONS)[number]
export type TransferStatusOption = (typeof TRANSFER_STATUS_OPTIONS)[number]

export interface EmployeeBusinessFields {
  hired_worker_contract_status: HiredWorkerContractStatusOption
  transfer_status: TransferStatusOption
  transfer_fee: number
  renewal_fee: number
  bank_name: string
}

function applyDerivedBusinessRules(
  fields: EmployeeBusinessFields,
  hiredWorkerContractExpiry?: unknown
): EmployeeBusinessFields {
  const hasHiredWorkerContractExpiry = sanitizeText(hiredWorkerContractExpiry).length > 0

  if (hasHiredWorkerContractExpiry) {
    return {
      ...fields,
      hired_worker_contract_status: 'أجير',
      transfer_status: 'منقول',
    }
  }

  return fields
}

const DEFAULT_FIELDS: EmployeeBusinessFields = {
  hired_worker_contract_status: 'بدون أجير',
  transfer_status: 'ليس على الكفالة',
  transfer_fee: 0,
  renewal_fee: 0,
  bank_name: '',
}

function sanitizeEnumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim() as T[number]
  return allowed.includes(trimmed) ? trimmed : fallback
}

function sanitizeAmount(value: unknown): number {
  const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getEmployeeBusinessFields(
  employee: Pick<Employee, 'additional_fields' | 'hired_worker_contract_expiry'> | {
    additional_fields?: Record<string, unknown> | null | undefined
    hired_worker_contract_expiry?: string | null | undefined
  }
): EmployeeBusinessFields {
  const fields = employee.additional_fields ?? {}

  return applyDerivedBusinessRules({
    hired_worker_contract_status: sanitizeEnumValue(fields.hired_worker_contract_status, HIRED_WORKER_CONTRACT_STATUS_OPTIONS, DEFAULT_FIELDS.hired_worker_contract_status),
    transfer_status: sanitizeEnumValue(fields.transfer_status, TRANSFER_STATUS_OPTIONS, DEFAULT_FIELDS.transfer_status),
    transfer_fee: sanitizeAmount(fields.transfer_fee),
    renewal_fee: sanitizeAmount(fields.renewal_fee),
    bank_name: sanitizeText(fields.bank_name),
  }, employee.hired_worker_contract_expiry)
}

export function buildEmployeeBusinessAdditionalFields(
  currentFields: Record<string, string | number | boolean | null> | undefined,
  input: {
    hired_worker_contract_status?: string
    transfer_status?: string
    transfer_fee?: unknown
    renewal_fee?: unknown
    bank_name?: string
    hired_worker_contract_expiry?: string | null
  }
): Record<string, string | number | boolean | null> {
  const current = currentFields ?? {}

  const normalizedFields = applyDerivedBusinessRules({
    hired_worker_contract_status: sanitizeEnumValue(
      input.hired_worker_contract_status,
      HIRED_WORKER_CONTRACT_STATUS_OPTIONS,
      DEFAULT_FIELDS.hired_worker_contract_status,
    ),
    transfer_status: sanitizeEnumValue(input.transfer_status, TRANSFER_STATUS_OPTIONS, DEFAULT_FIELDS.transfer_status),
    transfer_fee: sanitizeAmount(input.transfer_fee),
    renewal_fee: sanitizeAmount(input.renewal_fee),
    bank_name: sanitizeText(input.bank_name),
  }, input.hired_worker_contract_expiry)

  return {
    ...current,
    ...normalizedFields,
  }
}
