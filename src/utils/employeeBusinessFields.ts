import type { Employee } from '@/lib/supabase'

export const HIRED_WORKER_CONTRACT_STATUS_OPTIONS = ['أجير', 'بإنتظار إجراءات النقل', 'بدون أجير'] as const

export type HiredWorkerContractStatusOption = (typeof HIRED_WORKER_CONTRACT_STATUS_OPTIONS)[number]

export interface EmployeeBusinessFields {
  hired_worker_contract_status: HiredWorkerContractStatusOption
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
    }
  }

  return fields
}

const DEFAULT_FIELDS: EmployeeBusinessFields = {
  hired_worker_contract_status: 'بدون أجير',
  bank_name: '',
}

function sanitizeEnumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim() as T[number]
  return allowed.includes(trimmed) ? trimmed : fallback
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
    bank_name: sanitizeText(fields.bank_name),
  }, employee.hired_worker_contract_expiry)
}

export function buildEmployeeBusinessAdditionalFields(
  currentFields: Record<string, string | number | boolean | null> | undefined,
  input: {
    hired_worker_contract_status?: string
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
    bank_name: sanitizeText(input.bank_name),
  }, input.hired_worker_contract_expiry)

  return {
    ...current,
    ...normalizedFields,
  }
}
