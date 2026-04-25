import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  EmployeeObligationHeader,
  EmployeeObligationLine,
  ObligationPlanStatus,
  ObligationType,
  supabase,
} from '@/lib/supabase'
import { logger } from '@/utils/logger'

export interface EmployeeObligationPlan extends EmployeeObligationHeader {
  lines: EmployeeObligationLine[]
}

export interface CreateEmployeeObligationPlanInput {
  employee_id: string
  obligation_type: ObligationType
  title?: string
  total_amount: number
  currency_code?: string
  start_month: string
  installment_amounts: number[]
  status?: ObligationPlanStatus
  notes?: string | null
}

interface CreateEmployeeObligationPlanResult {
  header_id: string
  line_count: number
}

function getObligationTypeLabel(type: ObligationType): string {
  switch (type) {
    case 'advance':
      return 'سلفة'
    case 'transfer':
      return 'نقل كفالة'
    case 'renewal':
      return 'تجديد'
    case 'penalty':
      return 'غرامة'
    case 'other':
    default:
      return 'التزام آخر'
  }
}

export interface UpdateEmployeeObligationLinePaymentInput {
  lineId: string
  employeeId: string
  amount_paid: number
  manual_override?: boolean
  override_reason?: string | null
  notes?: string | null
}

export function useEmployeeObligations(employeeId?: string) {
  return useQuery({
    queryKey: ['employee-obligations', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      if (!employeeId) {
        return [] as EmployeeObligationPlan[]
      }

      const { data: headers, error: headersError } = await supabase
        .from('employee_obligation_headers')
        .select('id,employee_id,obligation_type,title,total_amount,currency_code,start_month,installment_count,status,created_by_user_id,superseded_by_header_id,notes,created_at,updated_at')
        .eq('employee_id', employeeId)
        .order('start_month', { ascending: false })

      if (headersError) {
        logger.error('Error fetching obligation headers:', headersError)
        throw headersError
      }

      const headerList = (headers ?? []) as EmployeeObligationHeader[]
      if (headerList.length === 0) {
        return []
      }

      const headerIds = headerList.map((header) => header.id)

      const { data: lines, error: linesError } = await supabase
        .from('employee_obligation_lines')
        .select('id,header_id,employee_id,due_month,amount_due,amount_paid,line_status,source_version,manual_override,override_reason,rescheduled_from_line_id,rescheduled_to_line_id,payroll_entry_id,notes,created_at,updated_at')
        .eq('employee_id', employeeId)
        .in('header_id', headerIds)
        .order('due_month', { ascending: true })

      if (linesError) {
        logger.error('Error fetching obligation lines:', linesError)
        throw linesError
      }

      const linesByHeader = new Map<string, EmployeeObligationLine[]>()
      for (const line of (lines ?? []) as EmployeeObligationLine[]) {
        const existingLines = linesByHeader.get(line.header_id) ?? []
        existingLines.push(line)
        linesByHeader.set(line.header_id, existingLines)
      }

      return headerList.map((header) => ({
        ...header,
        title: header.title || getObligationTypeLabel(header.obligation_type),
        lines: linesByHeader.get(header.id) ?? [],
      }))
    },
  })
}

export function useCreateEmployeeObligationPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateEmployeeObligationPlanInput) => {
      const { data, error } = await supabase
        .rpc('create_employee_obligation_plan', {
          p_employee_id: input.employee_id,
          p_obligation_type: input.obligation_type,
          p_title: input.title?.trim() || getObligationTypeLabel(input.obligation_type),
          p_total_amount: input.total_amount,
          p_currency_code: input.currency_code ?? 'SAR',
          p_start_month: input.start_month,
          p_installment_amounts: input.installment_amounts,
          p_status: input.status ?? 'active',
          p_notes: input.notes ?? null,
        })
        .single()

      if (error) {
        logger.error('Error creating employee obligation plan:', error)
        throw error
      }

      return data as CreateEmployeeObligationPlanResult
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['employee-obligations', variables.employee_id],
      })
    },
  })
}

export function useUpdateObligationLinePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ lineId, employeeId, ...updates }: UpdateEmployeeObligationLinePaymentInput) => {
      const payload = {
        amount_paid: updates.amount_paid,
        manual_override: updates.manual_override ?? false,
        override_reason: updates.override_reason ?? null,
        notes: updates.notes ?? null,
      }

      const { data, error } = await supabase
        .from('employee_obligation_lines')
        .update(payload)
        .eq('id', lineId)
        .select('id,header_id,employee_id,due_month,amount_due,amount_paid,line_status,source_version,manual_override,override_reason,rescheduled_from_line_id,rescheduled_to_line_id,payroll_entry_id,notes,created_at,updated_at')
        .single()

      if (error) {
        logger.error('Error updating obligation line payment:', error)
        throw error
      }

      return {
        employeeId,
        line: data as EmployeeObligationLine,
      }
    },
    onSuccess: ({ employeeId }) => {
      queryClient.invalidateQueries({
        queryKey: ['employee-obligations', employeeId],
      })
    },
  })
}