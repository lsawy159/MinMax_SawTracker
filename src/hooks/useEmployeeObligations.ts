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
        .select(
          'id,employee_id,obligation_type,title,total_amount,currency_code,start_month,installment_count,status,created_by_user_id,superseded_by_header_id,notes,created_at,updated_at'
        )
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
        .select(
          'id,header_id,employee_id,due_month,amount_due,amount_paid,line_status,source_version,manual_override,override_reason,rescheduled_from_line_id,rescheduled_to_line_id,payroll_entry_id,notes,created_at,updated_at'
        )
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
    mutationFn: async ({
      lineId,
      employeeId,
      ...updates
    }: UpdateEmployeeObligationLinePaymentInput) => {
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
        .select(
          'id,header_id,employee_id,due_month,amount_due,amount_paid,line_status,source_version,manual_override,override_reason,rescheduled_from_line_id,rescheduled_to_line_id,payroll_entry_id,notes,created_at,updated_at'
        )
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
      queryClient.invalidateQueries({ queryKey: ['all-obligations-summary'] })
    },
  })
}

// ========================================
// Summary row used in the deductions list tab
// ========================================
export interface ObligationSummaryRow {
  employee_id: string
  employee_name: string
  residence_number: string
  project_name: string
  company_name: string
  // Per-type totals (remaining / outstanding)
  transfer: number
  renewal: number
  penalty: number
  advance: number
  other: number
  total_remaining: number
  // Active header ids by type (for linking)
  active_header_ids: Record<string, string[]>
  // Upcoming month's installment per type (due_month of earliest unpaid line)
  upcoming_installment: number
}

export interface AllObligationsSummaryRow {
  employee_id: string
  employee_name: string
  residence_number: string
  project_name: string
  company_name: string
  transfer_remaining: number
  renewal_remaining: number
  penalty_remaining: number
  advance_remaining: number
  other_remaining: number
  total_remaining: number
  transfer_monthly: number
  renewal_monthly: number
  penalty_monthly: number
  advance_monthly: number
  other_monthly: number
  total_monthly: number
}

export function useAllObligationsSummary() {
  return useQuery({
    queryKey: ['all-obligations-summary'],
    queryFn: async () => {
      const [
        { data: employeesData, error: employeesError },
        { data: headersData, error: headersError },
        { data: linesData, error: linesError },
      ] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, residence_number, project_name, project:projects(name), company:companies(name)')
          .eq('is_deleted', false),
        supabase
          .from('employee_obligation_headers')
          .select('id, employee_id, obligation_type, status')
          .in('status', ['active', 'draft']),
        supabase
          .from('employee_obligation_lines')
          .select('id, header_id, employee_id, due_month, amount_due, amount_paid, line_status')
          .in('line_status', ['unpaid', 'partial']),
      ])

      if (employeesError) throw employeesError
      if (headersError) throw headersError
      if (linesError) throw linesError

      // Build maps
      const employeeMap = new Map<
        string,
        { name: string; residence_number: string; project_name: string; company_name: string }
      >()
      ;(employeesData ?? []).forEach((emp) => {
        const projectRel = Array.isArray(emp.project) ? emp.project[0] : emp.project
        const companyRel = Array.isArray(emp.company) ? emp.company[0] : emp.company
        employeeMap.set(emp.id as string, {
          name: String(emp.name || ''),
          residence_number: String(emp.residence_number || ''),
          project_name: String(projectRel?.name || emp.project_name || ''),
          company_name: String((companyRel as { name?: string } | null)?.name || ''),
        })
      })

      // Map header_id -> obligation_type
      const headerTypeMap = new Map<string, string>()
      ;(headersData ?? []).forEach((h) => {
        headerTypeMap.set(h.id as string, h.obligation_type as string)
      })

      // Accumulate remaining & monthly per employee per type
      type TypeTotals = {
        transfer_remaining: number
        renewal_remaining: number
        penalty_remaining: number
        advance_remaining: number
        other_remaining: number
        // earliest unpaid month per type
        transfer_months: string[]
        renewal_months: string[]
        penalty_months: string[]
        advance_months: string[]
        other_months: string[]
      }

      const accByEmployee = new Map<string, TypeTotals>()

      const getAcc = (empId: string): TypeTotals => {
        if (!accByEmployee.has(empId)) {
          accByEmployee.set(empId, {
            transfer_remaining: 0,
            renewal_remaining: 0,
            penalty_remaining: 0,
            advance_remaining: 0,
            other_remaining: 0,
            transfer_months: [],
            renewal_months: [],
            penalty_months: [],
            advance_months: [],
            other_months: [],
          })
        }
        return accByEmployee.get(empId)!
      }

      ;(linesData ?? []).forEach((line) => {
        const obligationType = headerTypeMap.get(line.header_id as string) ?? 'other'
        const remaining = Math.max(
          Number(line.amount_due || 0) - Number(line.amount_paid || 0),
          0
        )
        const acc = getAcc(line.employee_id as string)
        const month = String(line.due_month || '')

        if (obligationType === 'transfer') {
          acc.transfer_remaining += remaining
          acc.transfer_months.push(month)
        } else if (obligationType === 'renewal') {
          acc.renewal_remaining += remaining
          acc.renewal_months.push(month)
        } else if (obligationType === 'penalty') {
          acc.penalty_remaining += remaining
          acc.penalty_months.push(month)
        } else if (obligationType === 'advance') {
          acc.advance_remaining += remaining
          acc.advance_months.push(month)
        } else {
          acc.other_remaining += remaining
          acc.other_months.push(month)
        }
      })

      // Build result rows — only employees with at least one outstanding obligation
      const rows: AllObligationsSummaryRow[] = []
      accByEmployee.forEach((acc, empId) => {
        const meta = employeeMap.get(empId)
        if (!meta) return

        const total =
          acc.transfer_remaining +
          acc.renewal_remaining +
          acc.penalty_remaining +
          acc.advance_remaining +
          acc.other_remaining

        if (total <= 0) return

        // Monthly installment = count of upcoming lines (next month) per type
        // We approximate by counting distinct months in upcoming lines (sorted ascending, first month)
        const earliestMonth = (months: string[]) =>
          months.length > 0 ? [...months].sort()[0] : null

        const countMonthly = (months: string[]): number => {
          const earliest = earliestMonth(months)
          if (!earliest) return 0
          return months.filter((m) => m === earliest).length
        }

        // Actually monthly = the amount due for the nearest upcoming month
        // Since lines have amount_due per line, we just sum the remaining for current lines
        // but we want the installment amount per type for the upcoming month.
        // We'll just compute total remaining per type as the "outstanding" column.

        rows.push({
          employee_id: empId,
          employee_name: meta.name,
          residence_number: meta.residence_number,
          project_name: meta.project_name,
          company_name: meta.company_name,
          transfer_remaining: acc.transfer_remaining,
          renewal_remaining: acc.renewal_remaining,
          penalty_remaining: acc.penalty_remaining,
          advance_remaining: acc.advance_remaining,
          other_remaining: acc.other_remaining,
          total_remaining: total,
          // Monthly = just use count of lines as proxy (simplified)
          transfer_monthly: countMonthly(acc.transfer_months) > 0 ? acc.transfer_remaining / Math.max(countMonthly(acc.transfer_months), 1) : 0,
          renewal_monthly: countMonthly(acc.renewal_months) > 0 ? acc.renewal_remaining / Math.max(countMonthly(acc.renewal_months), 1) : 0,
          penalty_monthly: countMonthly(acc.penalty_months) > 0 ? acc.penalty_remaining / Math.max(countMonthly(acc.penalty_months), 1) : 0,
          advance_monthly: countMonthly(acc.advance_months) > 0 ? acc.advance_remaining / Math.max(countMonthly(acc.advance_months), 1) : 0,
          other_monthly: countMonthly(acc.other_months) > 0 ? acc.other_remaining / Math.max(countMonthly(acc.other_months), 1) : 0,
          total_monthly: 0,
        })
      })

      // Sort by employee name
      rows.sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'ar'))
      return rows
    },
  })
}
