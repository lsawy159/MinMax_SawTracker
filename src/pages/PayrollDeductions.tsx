import { ChangeEvent, useState, useEffect, useMemo, useRef } from 'react'
import Layout from '@/components/layout/Layout'
import {
  BarChart3,
  RefreshCw,
  Download,
  AlertTriangle,
  Calendar,
  Wallet,
  Plus,
  Loader2,
  ReceiptText,
  Eye,
  FileUp,
  CheckCircle,
  Trash2,
  X,
  Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { saveAs } from 'file-saver'
import { usePermissions } from '@/utils/permissions'
import { loadXlsx } from '@/utils/lazyXlsx'
import { useCompanies } from '@/hooks/useCompanies'
import { useProjects } from '@/hooks/useProjects'
import {
  useCreatePayrollRun,
  useDeletePayrollRun,
  usePayrollRunEntries,
  usePayrollRunSlips,
  usePayrollRuns,
  useScopedPayrollEmployees,
  useUpsertPayrollEntry,
  useUpdatePayrollRunStatus,
} from '@/hooks/usePayroll'
import { PayrollEntry, PayrollInputMode, PayrollScopeType } from '@/lib/supabase'
import {
  EMPTY_PAYROLL_OBLIGATION_BREAKDOWN,
  PayrollObligationBreakdown,
  getPayrollComponentBucket,
  getPayrollObligationBreakdownTotal,
  normalizePayrollObligationBreakdown,
} from '@/utils/payrollObligationBuckets'
import {
  calculatePayrollTotals,
  normalizePayrollEntryAmounts,
  roundPayrollAmount,
} from '@/utils/payrollMath'

interface PayrollExportRow {
  'اسم الموظف': string
  'رقم الإقامة': number
  المؤسسة: string
  المشروع: string
  'إجمالي الراتب': number
  'صافي الراتب': number
  'قسط رسوم نقل وتجديد': number
  'قسط جزاءات وغرامات': number
  'قسط سلفة': number
  'قسط أخرى': number
  'إجمالي الاستقطاعات': number
  'أيام الحضور': number
  'الإجازات المدفوعة': number
  الحالة: string
  ملاحظات: string
}

interface PayrollSearchRow extends PayrollEntry {
  payroll_month_label: string
  payroll_run_status: string
  project_label: string
  company_label: string
  residence_label: string
  deduction_breakdown: PayrollObligationBreakdown
  total_deductions: number
  obligation_total: number
  obligation_paid: number
  obligation_remaining: number
}

interface ObligationInsightRow {
  employee_id: string
  employee_name: string
  residence_number: string
  project_name: string
  due_month: string
  amount_due: number
  amount_paid: number
}

interface PayrollExcelRow {
  residence_number: string
  attendance_days: number
  paid_leave_days: number
  overtime_amount: number
  transfer_renewal_amount: number
  penalty_amount: number
  advance_amount: number
  other_amount: number
  deductions_amount: number
  installment_deducted_amount: number
  overtime_notes: string
  deductions_notes: string
  notes: string
}

interface PayrollExcelPreviewRow extends PayrollExcelRow {
  row_number: number
  employee_id: string
  employee_name: string
  company_name?: string | null
  project_name?: string | null
  basic_salary_snapshot: number
  daily_rate_snapshot: number
  gross_amount: number
  net_amount: number
}

const PAYROLL_EXCEL_HEADERS = {
  residence_number: ['رقم الإقامة', 'رقم الاقامة', 'residence_number', 'residence number'],
  attendance_days: ['أيام الحضور', 'ايام الحضور', 'attendance_days', 'attendance days'],
  paid_leave_days: ['الإجازات المدفوعة', 'الاجازات المدفوعة', 'paid_leave_days', 'paid leave days'],
  overtime_amount: ['الإضافي', 'الاضافي', 'overtime_amount', 'overtime amount'],
  transfer_renewal_amount: [
    'قسط رسوم نقل وتجديد',
    'رسوم نقل وتجديد',
    'transfer_renewal_amount',
    'transfer renewal amount',
  ],
  penalty_amount: ['قسط جزاءات وغرامات', 'جزاءات وغرامات', 'penalty_amount', 'penalty amount'],
  advance_amount: ['قسط سلفة', 'سلفة', 'advance_amount', 'advance amount'],
  other_amount: ['قسط أخرى', 'أخرى', 'other_amount', 'other amount'],
  deductions_amount: ['الخصومات', 'الحسومات', 'deductions_amount', 'deductions amount'],
  installment_deducted_amount: [
    'خصم الأقساط',
    'خصم الاقساط',
    'installment_deducted_amount',
    'installment deducted amount',
  ],
  overtime_notes: ['ملاحظات الإضافي', 'ملاحظات الاضافي', 'overtime_notes', 'overtime notes'],
  deductions_notes: [
    'ملاحظات الخصومات',
    'ملاحظات الحسومات',
    'deductions_notes',
    'deductions notes',
  ],
  notes: ['ملاحظات', 'notes'],
} as const

const REQUIRED_PAYROLL_EXCEL_FIELDS: Array<keyof typeof PAYROLL_EXCEL_HEADERS> = [
  'residence_number',
]

function normalizePayrollExcelHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

function normalizeResidenceNumber(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

function toNumericPayrollValue(value: unknown): number {
  const normalizedValue = typeof value === 'string' ? value.replace(/,/g, '').trim() : value
  const numericValue = Number(normalizedValue)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export default function PayrollDeductions() {
  const { canDelete, canExport, canView, isAdmin } = usePermissions()
  const [activePageTab, setActivePageTab] = useState<'search' | 'runs'>('search')
  const [showPayrollRunForm, setShowPayrollRunForm] = useState(false)
  const [showPayrollEntryForm, setShowPayrollEntryForm] = useState(false)
  const [selectedPayrollRunId, setSelectedPayrollRunId] = useState<string | null>(null)
  const [selectedPayrollSlipEntryId, setSelectedPayrollSlipEntryId] = useState<string | null>(null)
  const [payrollSearchQuery, setPayrollSearchQuery] = useState('')
  const [payrollSearchMonth, setPayrollSearchMonth] = useState('')
  const [payrollSearchProject, setPayrollSearchProject] = useState('')
  const [payrollRunStatsMonth, setPayrollRunStatsMonth] = useState('')
  const [payrollRunStatsRunId, setPayrollRunStatsRunId] = useState('')
  const [allPayrollSearchRows, setAllPayrollSearchRows] = useState<PayrollSearchRow[]>([])
  const [obligationInsightRows, setObligationInsightRows] = useState<ObligationInsightRow[]>([])
  const [payrollInsightsLoading, setPayrollInsightsLoading] = useState(false)
  const [importingPayrollExcel, setImportingPayrollExcel] = useState(false)
  const [confirmingPayrollExcelImport, setConfirmingPayrollExcelImport] = useState(false)
  const [payrollImportErrors, setPayrollImportErrors] = useState<string[]>([])
  const [payrollImportHeaderError, setPayrollImportHeaderError] = useState<string | null>(null)
  const [payrollImportPreviewRows, setPayrollImportPreviewRows] = useState<
    PayrollExcelPreviewRow[]
  >([])
  const [payrollImportFileName, setPayrollImportFileName] = useState<string>('')
  const [selectedPayrollExportRunIds, setSelectedPayrollExportRunIds] = useState<string[]>([])
  const [exportingSelectedPayrollRuns, setExportingSelectedPayrollRuns] = useState(false)
  const [payrollRunDeleteConfirmOpen, setPayrollRunDeleteConfirmOpen] = useState(false)
  const payrollSlipPreviewRef = useRef<HTMLDivElement | null>(null)
  const payrollExcelInputRef = useRef<HTMLInputElement | null>(null)
  const payrollEntryFormRef = useRef<HTMLDivElement | null>(null)
  const payrollDetailsPanelRef = useRef<HTMLDivElement | null>(null)
  const [payrollForm, setPayrollForm] = useState({
    payroll_month: new Date().toISOString().slice(0, 7),
    scope_type: 'company' as PayrollScopeType,
    scope_id: '',
    input_mode: 'manual' as PayrollInputMode,
    notes: '',
  })
  const [payrollEntryForm, setPayrollEntryForm] = useState({
    employee_id: '',
    attendance_days: 30,
    paid_leave_days: 0,
    basic_salary_snapshot: 0,
    overtime_amount: 0,
    transfer_renewal_amount: 0,
    penalty_amount: 0,
    advance_amount: 0,
    other_amount: 0,
    deductions_amount: 0,
    installment_deducted_amount: 0,
    overtime_notes: '',
    deductions_notes: '',
    notes: '',
  })
  const { data: companies = [] } = useCompanies()
  const { data: projects = [] } = useProjects()
  const {
    data: payrollRuns = [],
    isLoading: payrollRunsLoading,
    refetch: refetchPayrollRuns,
  } = usePayrollRuns()
  const {
    data: payrollEntries = [],
    isLoading: payrollEntriesLoading,
    refetch: refetchPayrollEntries,
  } = usePayrollRunEntries(selectedPayrollRunId ?? undefined)
  const { data: payrollSlips = [], refetch: refetchPayrollSlips } = usePayrollRunSlips(
    selectedPayrollRunId ?? undefined
  )
  const createPayrollRun = useCreatePayrollRun()
  const upsertPayrollEntry = useUpsertPayrollEntry()
  const updatePayrollRunStatus = useUpdatePayrollRunStatus()
  const deletePayrollRun = useDeletePayrollRun()

  const payrollRunList = payrollRuns
  const selectedPayrollRun = payrollRunList.find((run) => run.id === selectedPayrollRunId) ?? null
  const { data: scopedPayrollEmployees = [], isLoading: scopedEmployeesLoading } =
    useScopedPayrollEmployees(
      selectedPayrollRun?.scope_type,
      selectedPayrollRun?.scope_id,
      selectedPayrollRun?.payroll_month
    )
  const scopeOptions = payrollForm.scope_type === 'company' ? companies : projects
  const selectedPayrollEmployee =
    scopedPayrollEmployees.find((employee) => employee.id === payrollEntryForm.employee_id) ?? null
  const payrollSlipEntryIds = useMemo(
    () => new Set(payrollSlips.map((slip) => slip.payroll_entry_id)),
    [payrollSlips]
  )
  const selectedPayrollSlip =
    payrollSlips.find((slip) => slip.payroll_entry_id === selectedPayrollSlipEntryId) ?? null
  const baseSalary = Number(
    payrollEntryForm.basic_salary_snapshot || selectedPayrollEmployee?.salary || 0
  )
  const deductionBreakdown = normalizePayrollObligationBreakdown({
    transfer_renewal: payrollEntryForm.transfer_renewal_amount,
    penalty: payrollEntryForm.penalty_amount,
    advance: payrollEntryForm.advance_amount,
    other: payrollEntryForm.other_amount,
  })
  const groupedDeductionsTotal = getPayrollObligationBreakdownTotal(deductionBreakdown)
  const { dailyRate, grossAmount, netAmount } = calculatePayrollTotals(
    baseSalary,
    payrollEntryForm.attendance_days,
    payrollEntryForm.paid_leave_days,
    payrollEntryForm.overtime_amount,
    groupedDeductionsTotal
  )
  const selectedPayrollRunEditable = Boolean(
    selectedPayrollRun &&
      selectedPayrollRun.status !== 'finalized' &&
      selectedPayrollRun.status !== 'cancelled'
  )
  const selectedSlipSnapshot = selectedPayrollSlip?.snapshot_data as
    | {
        payroll_run?: Record<string, unknown>
        payroll_entry?: Partial<PayrollEntry>
        components?: Array<{
          component_type?: string
          component_code?: string
          amount?: number
          notes?: string | null
        }>
      }
    | undefined
  const selectedSlipEntry = selectedSlipSnapshot?.payroll_entry
  const selectedSlipComponents = Array.isArray(selectedSlipSnapshot?.components)
    ? selectedSlipSnapshot.components
    : []
  const selectedSlipTotals = selectedSlipEntry
    ? normalizePayrollEntryAmounts(selectedSlipEntry as Partial<PayrollEntry>)
    : null
  const payrollEntryBreakdownById = useMemo(
    () => new Map(allPayrollSearchRows.map((row) => [row.id, row.deduction_breakdown])),
    [allPayrollSearchRows]
  )

  const hasPayrollViewPermission = canView('payroll')
  const compactButtonBaseClass =
    'h-9 px-3 text-sm font-medium rounded-lg transition inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed'
  const outlineCompactButtonClass = `${compactButtonBaseClass} bg-surface border border-border-300 text-foreground-secondary hover:bg-surface-secondary-50`
  const primaryCompactButtonClass = `${compactButtonBaseClass} bg-primary text-slate-950 hover:bg-[#e2b800]`
  const successCompactButtonClass = `${compactButtonBaseClass} bg-green-600 text-white hover:bg-green-700`
  const indigoCompactButtonClass = `${compactButtonBaseClass} bg-indigo-600 text-white hover:bg-indigo-700`
  const slateCompactButtonClass = `${compactButtonBaseClass} bg-surface-secondary-600 text-white hover:bg-surface-secondary-700`
  const warningCompactButtonClass = `${compactButtonBaseClass} bg-amber-600 text-white hover:bg-amber-700`
  const orangeCompactButtonClass = `${compactButtonBaseClass} bg-orange-600 text-white hover:bg-orange-700`
  const dangerCompactButtonClass = `${compactButtonBaseClass} bg-red-600 text-white hover:bg-red-700`

  useEffect(() => {
    if (scopeOptions.length > 0 && !scopeOptions.some((item) => item.id === payrollForm.scope_id)) {
      setPayrollForm((current) => ({
        ...current,
        scope_id: scopeOptions[0]?.id ?? '',
      }))
    }
  }, [scopeOptions, payrollForm.scope_id])

  useEffect(() => {
    if (!selectedPayrollRunId && payrollRunList.length > 0) {
      setSelectedPayrollRunId(payrollRunList[0].id)
    }
  }, [payrollRunList, selectedPayrollRunId])

  useEffect(() => {
    setSelectedPayrollExportRunIds((current) => {
      const next = current.filter((runId) =>
        payrollRunList.some((run) => run.id === runId && run.entry_count > 0)
      )
      const isUnchanged =
        next.length === current.length && next.every((runId, index) => runId === current[index])
      return isUnchanged ? current : next
    })
  }, [payrollRunList])

  useEffect(() => {
    setPayrollImportPreviewRows([])
    setPayrollImportErrors([])
    setPayrollImportHeaderError(null)
    setPayrollImportFileName('')
  }, [selectedPayrollRunId])

  useEffect(() => {
    if (selectedPayrollSlipEntryId && !payrollSlipEntryIds.has(selectedPayrollSlipEntryId)) {
      setSelectedPayrollSlipEntryId(null)
    }
  }, [selectedPayrollSlipEntryId, payrollSlipEntryIds])

  useEffect(() => {
    if (
      selectedPayrollRun &&
      scopedPayrollEmployees.length > 0 &&
      !scopedPayrollEmployees.some((employee) => employee.id === payrollEntryForm.employee_id)
    ) {
      const defaultEmployee = scopedPayrollEmployees[0]
      setPayrollEntryForm((current) => {
        const nextSalary = Number(defaultEmployee.salary || 0)
        const nextInstallment = defaultEmployee.suggested_installment_amount

        if (
          current.employee_id === defaultEmployee.id &&
          Number(current.basic_salary_snapshot || 0) === nextSalary &&
          Number(current.advance_amount || 0) === nextInstallment &&
          Number(current.installment_deducted_amount || 0) === nextInstallment
        ) {
          return current
        }

        return {
          ...current,
          employee_id: defaultEmployee.id,
          basic_salary_snapshot: nextSalary,
          advance_amount: nextInstallment,
          installment_deducted_amount: nextInstallment,
        }
      })
    }
  }, [selectedPayrollRun, scopedPayrollEmployees, payrollEntryForm.employee_id])

  useEffect(() => {
    if (selectedPayrollEmployee) {
      const existingEntry = payrollEntries.find(
        (entry) => entry.employee_id === selectedPayrollEmployee.id
      )

      if (existingEntry) {
        const existingBreakdown = normalizePayrollObligationBreakdown(
          payrollEntryBreakdownById.get(existingEntry.id) ?? {
            ...EMPTY_PAYROLL_OBLIGATION_BREAKDOWN,
            penalty: Number(existingEntry.deductions_amount) || 0,
            advance: Number(existingEntry.installment_deducted_amount) || 0,
          }
        )

        setPayrollEntryForm((current) => {
          const next = {
            ...current,
            employee_id: selectedPayrollEmployee.id,
            attendance_days: Number(existingEntry.attendance_days) || 0,
            paid_leave_days: Number(existingEntry.paid_leave_days) || 0,
            basic_salary_snapshot:
              Number(existingEntry.basic_salary_snapshot) ||
              Number(selectedPayrollEmployee.salary || 0),
            overtime_amount: Number(existingEntry.overtime_amount) || 0,
            transfer_renewal_amount: existingBreakdown.transfer_renewal,
            penalty_amount: existingBreakdown.penalty,
            advance_amount: existingBreakdown.advance,
            other_amount: existingBreakdown.other,
            deductions_amount: Number(existingEntry.deductions_amount) || 0,
            installment_deducted_amount: Number(existingEntry.installment_deducted_amount) || 0,
            overtime_notes: existingEntry.overtime_notes || '',
            deductions_notes: existingEntry.deductions_notes || '',
            notes: existingEntry.notes || '',
          }

          const isUnchanged = JSON.stringify(current) === JSON.stringify(next)
          return isUnchanged ? current : next
        })
        return
      }

      setPayrollEntryForm((current) => {
        const next = {
          ...current,
          basic_salary_snapshot: Number(
            current.basic_salary_snapshot || selectedPayrollEmployee.salary || 0
          ),
          advance_amount:
            current.advance_amount === 0
              ? selectedPayrollEmployee.suggested_installment_amount
              : current.advance_amount,
          installment_deducted_amount:
            current.installment_deducted_amount === 0
              ? selectedPayrollEmployee.suggested_installment_amount
              : current.installment_deducted_amount,
        }

        const isUnchanged = JSON.stringify(current) === JSON.stringify(next)
        return isUnchanged ? current : next
      })
    }
  }, [selectedPayrollEmployee, payrollEntries, payrollEntryBreakdownById])

  const loadPayrollInsights = async () => {
    try {
      setPayrollInsightsLoading(true)

      const [
        { data: entriesData, error: entriesError },
        { data: componentsData, error: componentsError },
        { data: employeesData, error: employeesError },
        { data: obligationLinesData, error: obligationLinesError },
      ] = await Promise.all([
        supabase
          .from('payroll_entries')
          .select(
            'id,payroll_run_id,employee_id,residence_number_snapshot,employee_name_snapshot,company_name_snapshot,project_name_snapshot,basic_salary_snapshot,daily_rate_snapshot,attendance_days,paid_leave_days,overtime_amount,overtime_notes,deductions_amount,deductions_notes,installment_deducted_amount,gross_amount,net_amount,entry_status,notes,created_at,updated_at, payroll_run:payroll_runs(id,payroll_month,scope_type,scope_id,input_mode,status,uploaded_file_path,notes,created_by_user_id,approved_by_user_id,created_at,updated_at,approved_at)'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('payroll_entry_components')
          .select('payroll_entry_id, component_code, amount'),
        supabase
          .from('employees')
          .select('id, name, residence_number, project_name, project:projects(name)')
          .eq('is_deleted', false),
        supabase
          .from('employee_obligation_lines')
          .select('employee_id, due_month, amount_due, amount_paid, line_status')
          .order('due_month', { ascending: false }),
      ])

      if (entriesError) throw entriesError
      if (componentsError) throw componentsError
      if (employeesError) throw employeesError
      if (obligationLinesError) throw obligationLinesError

      const employeeMetaMap = new Map<
        string,
        { name: string; residence_number: string; project_name: string }
      >()
      ;(employeesData || []).forEach((employee) => {
        const projectRelation = Array.isArray(employee.project)
          ? employee.project[0]
          : employee.project
        employeeMetaMap.set(employee.id as string, {
          name: String(employee.name || ''),
          residence_number: String(employee.residence_number || ''),
          project_name: String(projectRelation?.name || employee.project_name || ''),
        })
      })

      const breakdownByEntryId = new Map<string, PayrollObligationBreakdown>()
      ;(componentsData || []).forEach((component) => {
        const bucket = getPayrollComponentBucket(component.component_code as string | undefined)
        if (!bucket) {
          return
        }

        const current = normalizePayrollObligationBreakdown(
          breakdownByEntryId.get(component.payroll_entry_id as string)
        )
        current[bucket] += Number(component.amount || 0)
        breakdownByEntryId.set(component.payroll_entry_id as string, current)
      })

      const nextObligationRows = (
        (obligationLinesData || []) as Array<Record<string, unknown>>
      ).map((line) => {
        const meta = employeeMetaMap.get(String(line.employee_id))
        return {
          employee_id: String(line.employee_id || ''),
          employee_name: meta?.name || '',
          residence_number: meta?.residence_number || '',
          project_name: meta?.project_name || '',
          due_month: String(line.due_month || ''),
          amount_due: Number(line.amount_due || 0),
          amount_paid: Number(line.amount_paid || 0),
        }
      })

      const obligationSummaryByEmployeeMonth = new Map<
        string,
        { total: number; paid: number; remaining: number }
      >()
      nextObligationRows.forEach((line) => {
        const monthKey = String(line.due_month || '').slice(0, 7)
        const key = `${line.employee_id}::${monthKey}`
        const current = obligationSummaryByEmployeeMonth.get(key) ?? {
          total: 0,
          paid: 0,
          remaining: 0,
        }
        current.total += Number(line.amount_due || 0)
        current.paid += Number(line.amount_paid || 0)
        current.remaining += Math.max(
          Number(line.amount_due || 0) - Number(line.amount_paid || 0),
          0
        )
        obligationSummaryByEmployeeMonth.set(key, current)
      })

      const nextSearchRows = ((entriesData || []) as Array<Record<string, unknown>>).map(
        (entry) => {
          const meta = employeeMetaMap.get(String(entry.employee_id))
          const payrollRunMeta =
            (entry.payroll_run as { payroll_month?: string; status?: string } | null) ?? null
          const payrollMonthLabel = String(payrollRunMeta?.payroll_month || '').slice(0, 7)
          const obligationSummary = obligationSummaryByEmployeeMonth.get(
            `${String(entry.employee_id)}::${payrollMonthLabel}`
          )
          const breakdown = normalizePayrollObligationBreakdown(
            breakdownByEntryId.get(String(entry.id)) ?? {
              ...EMPTY_PAYROLL_OBLIGATION_BREAKDOWN,
              penalty: Number(entry.deductions_amount || 0),
              advance: Number(entry.installment_deducted_amount || 0),
            }
          )
          const totalDeductions = getPayrollObligationBreakdownTotal(breakdown)
          const normalizedTotals = calculatePayrollTotals(
            Number(entry.basic_salary_snapshot || 0),
            Number(entry.attendance_days || 0),
            Number(entry.paid_leave_days || 0),
            Number(entry.overtime_amount || 0),
            totalDeductions
          )

          return {
            ...(entry as unknown as PayrollEntry),
            gross_amount: normalizedTotals.grossAmount,
            net_amount: normalizedTotals.netAmount,
            daily_rate_snapshot: normalizedTotals.dailyRate,
            payroll_month_label: payrollMonthLabel,
            payroll_run_status: String(payrollRunMeta?.status || 'draft'),
            project_label: String(entry.project_name_snapshot || meta?.project_name || ''),
            company_label: String(entry.company_name_snapshot || ''),
            residence_label: String(
              entry.residence_number_snapshot || meta?.residence_number || ''
            ),
            deduction_breakdown: breakdown,
            total_deductions: totalDeductions,
            obligation_total: Number(obligationSummary?.total || 0),
            obligation_paid: Number(obligationSummary?.paid || 0),
            obligation_remaining: Number(obligationSummary?.remaining || 0),
          } as PayrollSearchRow
        }
      )

      setAllPayrollSearchRows(nextSearchRows)
      setObligationInsightRows(nextObligationRows)
    } catch (error) {
      console.error('Error loading payroll insights:', error)
      toast.error('تعذر تحديث بحث الاستقطاعات حالياً')
    } finally {
      setPayrollInsightsLoading(false)
    }
  }

  useEffect(() => {
    void loadPayrollInsights()
  }, [payrollRunList.length])

  const filteredPayrollSearchRows = useMemo(() => {
    const normalizedQuery = payrollSearchQuery.trim().toLowerCase()
    return allPayrollSearchRows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.employee_name_snapshot.toLowerCase().includes(normalizedQuery) ||
        String(row.residence_label || '')
          .toLowerCase()
          .includes(normalizedQuery) ||
        String(row.project_label || '')
          .toLowerCase()
          .includes(normalizedQuery)

      const matchesMonth = !payrollSearchMonth || row.payroll_month_label === payrollSearchMonth
      const matchesProject = !payrollSearchProject || row.project_label === payrollSearchProject

      return matchesQuery && matchesMonth && matchesProject
    })
  }, [allPayrollSearchRows, payrollSearchMonth, payrollSearchProject, payrollSearchQuery])

  const filteredObligationInsightRows = useMemo(() => {
    const normalizedQuery = payrollSearchQuery.trim().toLowerCase()
    return obligationInsightRows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.employee_name.toLowerCase().includes(normalizedQuery) ||
        row.residence_number.toLowerCase().includes(normalizedQuery) ||
        row.project_name.toLowerCase().includes(normalizedQuery)

      const matchesMonth = !payrollSearchMonth || row.due_month.slice(0, 7) === payrollSearchMonth
      const matchesProject = !payrollSearchProject || row.project_name === payrollSearchProject

      return matchesQuery && matchesMonth && matchesProject
    })
  }, [obligationInsightRows, payrollSearchMonth, payrollSearchProject, payrollSearchQuery])

  const obligationStats = useMemo(() => {
    return filteredObligationInsightRows.reduce(
      (totals, row) => {
        totals.total += Number(row.amount_due || 0)
        totals.paid += Number(row.amount_paid || 0)
        totals.remaining += Math.max(Number(row.amount_due || 0) - Number(row.amount_paid || 0), 0)
        return totals
      },
      { total: 0, paid: 0, remaining: 0 }
    )
  }, [filteredObligationInsightRows])

  const projectFilterOptions = useMemo(() => {
    const values = Array.from(
      new Set(allPayrollSearchRows.map((row) => row.project_label).filter(Boolean))
    )
    return values.sort((left, right) => left.localeCompare(right, 'ar'))
  }, [allPayrollSearchRows])

  const filteredPayrollRunList = useMemo(() => {
    return payrollRunList.filter((run) => {
      const matchesMonth =
        !payrollRunStatsMonth || run.payroll_month.slice(0, 7) === payrollRunStatsMonth
      const matchesRun = !payrollRunStatsRunId || run.id === payrollRunStatsRunId
      return matchesMonth && matchesRun
    })
  }, [payrollRunList, payrollRunStatsMonth, payrollRunStatsRunId])

  const payrollRunStatsRows = useMemo(() => {
    return allPayrollSearchRows.filter((row) => {
      const matchesMonth = !payrollRunStatsMonth || row.payroll_month_label === payrollRunStatsMonth
      const matchesRun = !payrollRunStatsRunId || row.payroll_run_id === payrollRunStatsRunId
      return matchesMonth && matchesRun
    })
  }, [allPayrollSearchRows, payrollRunStatsMonth, payrollRunStatsRunId])

  const payrollRunCardsStats = useMemo(() => {
    const uniqueEmployees = new Set(payrollRunStatsRows.map((row) => row.employee_id)).size

    return payrollRunStatsRows.reduce(
      (totals, row) => {
        totals.employees = uniqueEmployees
        totals.gross = roundPayrollAmount(totals.gross + Number(row.gross_amount || 0))
        totals.transferRenewal = roundPayrollAmount(
          totals.transferRenewal + Number(row.deduction_breakdown.transfer_renewal || 0)
        )
        totals.penalty = roundPayrollAmount(
          totals.penalty + Number(row.deduction_breakdown.penalty || 0)
        )
        totals.advance = roundPayrollAmount(
          totals.advance + Number(row.deduction_breakdown.advance || 0)
        )
        totals.other = roundPayrollAmount(totals.other + Number(row.deduction_breakdown.other || 0))
        totals.totalObligations = roundPayrollAmount(
          totals.totalObligations + Number(row.total_deductions || 0)
        )
        return totals
      },
      {
        employees: uniqueEmployees,
        gross: 0,
        transferRenewal: 0,
        penalty: 0,
        advance: 0,
        other: 0,
        totalObligations: 0,
      }
    )
  }, [payrollRunStatsRows])

  // Export to Excel
  const buildPayrollExportRows = (
    entries: PayrollEntry[],
    run: typeof selectedPayrollRun extends null ? never : NonNullable<typeof selectedPayrollRun>,
    breakdownByEntryId: Map<string, PayrollObligationBreakdown>
  ): PayrollExportRow[] =>
    entries.map((entry: PayrollEntry) => {
      const breakdown = normalizePayrollObligationBreakdown(
        breakdownByEntryId.get(entry.id) ?? {
          ...EMPTY_PAYROLL_OBLIGATION_BREAKDOWN,
          penalty: Number(entry.deductions_amount || 0),
          advance: Number(entry.installment_deducted_amount || 0),
        }
      )
      const totalDeductions = getPayrollObligationBreakdownTotal(breakdown)
      const normalizedTotals = calculatePayrollTotals(
        Number(entry.basic_salary_snapshot || 0),
        Number(entry.attendance_days || 0),
        Number(entry.paid_leave_days || 0),
        Number(entry.overtime_amount || 0),
        totalDeductions
      )

      return {
        'اسم الموظف': entry.employee_name_snapshot,
        'رقم الإقامة': entry.residence_number_snapshot,
        المؤسسة:
          entry.company_name_snapshot ||
          (run.scope_type === 'company' ? getPayrollScopeName(run.scope_type, run.scope_id) : '-'),
        المشروع:
          entry.project_name_snapshot ||
          (run.scope_type === 'project' ? getPayrollScopeName(run.scope_type, run.scope_id) : '-'),
        'إجمالي الراتب': normalizedTotals.grossAmount,
        'صافي الراتب': normalizedTotals.netAmount,
        'قسط رسوم نقل وتجديد': breakdown.transfer_renewal,
        'قسط جزاءات وغرامات': breakdown.penalty,
        'قسط سلفة': breakdown.advance,
        'قسط أخرى': breakdown.other,
        'إجمالي الاستقطاعات': totalDeductions,
        'أيام الحضور': entry.attendance_days,
        'الإجازات المدفوعة': entry.paid_leave_days,
        الحالة: getPayrollStatusText(entry.entry_status),
        ملاحظات: entry.notes || '',
      }
    })

  const sanitizePayrollFileName = (value: string) =>
    value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_')

  const exportablePayrollRunIds = filteredPayrollRunList
    .filter((run) => run.entry_count > 0)
    .map((run) => run.id)

  const allExportablePayrollRunsSelected =
    exportablePayrollRunIds.length > 0 &&
    exportablePayrollRunIds.every((runId) => selectedPayrollExportRunIds.includes(runId))

  const fetchPayrollEntriesForExport = async (runId: string) => {
    if (selectedPayrollRun?.id === runId && payrollEntries.length > 0) {
      return payrollEntries
    }

    const { data, error } = await supabase
      .from('payroll_entries')
      .select(
        'id,payroll_run_id,employee_id,residence_number_snapshot,employee_name_snapshot,company_name_snapshot,project_name_snapshot,basic_salary_snapshot,daily_rate_snapshot,attendance_days,paid_leave_days,overtime_amount,overtime_notes,deductions_amount,deductions_notes,installment_deducted_amount,gross_amount,net_amount,entry_status,notes,created_at,updated_at'
      )
      .eq('payroll_run_id', runId)

    if (error) {
      throw error
    }

    return (data ?? []) as PayrollEntry[]
  }

  const fetchPayrollEntryBreakdowns = async (entryIds: string[]) => {
    const map = new Map<string, PayrollObligationBreakdown>()

    if (entryIds.length === 0) {
      return map
    }

    const { data, error } = await supabase
      .from('payroll_entry_components')
      .select('payroll_entry_id, component_code, amount')
      .in('payroll_entry_id', entryIds)

    if (error) {
      throw error
    }

    ;(data || []).forEach((component) => {
      const bucket = getPayrollComponentBucket(component.component_code as string | undefined)
      if (!bucket) {
        return
      }

      const current = normalizePayrollObligationBreakdown(
        map.get(component.payroll_entry_id as string)
      )
      current[bucket] += Number(component.amount || 0)
      map.set(component.payroll_entry_id as string, current)
    })

    return map
  }

  const buildPayrollExportWorkbook = (
    XLSX: Awaited<ReturnType<typeof loadXlsx>>,
    run: NonNullable<typeof selectedPayrollRun>,
    entries: PayrollEntry[],
    breakdownByEntryId: Map<string, PayrollObligationBreakdown>
  ) => {
    const rows = buildPayrollExportRows(entries, run, breakdownByEntryId)
    const scopeName = getPayrollScopeName(run.scope_type, run.scope_id)
    const runTitle = getPayrollRunDisplayName(run.scope_type, run.scope_id, run.payroll_month)
    const monthLabel = formatPayrollMonthLabel(run.payroll_month)
    const totalGross = rows.reduce(
      (sum, row) => roundPayrollAmount(sum + Number(row['إجمالي الراتب'] || 0)),
      0
    )
    const totalNet = rows.reduce(
      (sum, row) => roundPayrollAmount(sum + Number(row['صافي الراتب'] || 0)),
      0
    )
    const headers = [
      'اسم الموظف',
      'رقم الإقامة',
      'المؤسسة',
      'المشروع',
      'إجمالي الراتب',
      'صافي الراتب',
      'قسط رسوم نقل وتجديد',
      'قسط جزاءات وغرامات',
      'قسط سلفة',
      'قسط أخرى',
      'إجمالي الاستقطاعات',
      'أيام الحضور',
      'الإجازات المدفوعة',
      'الحالة',
      'ملاحظات',
    ]
    const dataRows = rows.map((row) =>
      headers.map((header) => row[header as keyof PayrollExportRow])
    )

    const worksheet = XLSX.utils.aoa_to_sheet([
      [runTitle],
      [`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],
      [],
      ['الشهر', monthLabel, 'النطاق', scopeName, 'الحالة', getPayrollStatusText(run.status)],
      [
        'طريقة الإدخال',
        getPayrollInputModeText(run.input_mode),
        'عدد الموظفين',
        String(rows.length),
        'صافي المسير',
        totalNet.toLocaleString('en-US'),
      ],
      ['إجمالي المسير', totalGross.toLocaleString('en-US')],
      [],
      headers,
      ...dataRows,
    ])

    worksheet['!cols'] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 26 },
    ]
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
    ]
    worksheet['!autofilter'] = {
      ref: `A8:O${Math.max(8, dataRows.length + 8)}`,
    }

    const styledCells = [
      'A1',
      'A2',
      'A8',
      'B8',
      'C8',
      'D8',
      'E8',
      'F8',
      'G8',
      'H8',
      'I8',
      'J8',
      'K8',
      'L8',
      'M8',
      'N8',
      'O8',
    ]
    styledCells.forEach((cellAddress) => {
      const cell = worksheet[cellAddress]
      if (!cell) {
        return
      }
      ;(cell as { s?: unknown }).s = {
        alignment: { horizontal: 'center', vertical: 'center' },
        font: { bold: true },
      }
    })

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll Report')
    return workbook
  }

  const downloadPayrollRunExcel = async (
    run: NonNullable<typeof selectedPayrollRun>,
    entries: PayrollEntry[],
    breakdownByEntryId: Map<string, PayrollObligationBreakdown>
  ) => {
    const XLSX = await loadXlsx()
    const workbook = buildPayrollExportWorkbook(XLSX, run, entries, breakdownByEntryId)
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const fileName = `${sanitizePayrollFileName(getPayrollRunDisplayName(run.scope_type, run.scope_id, run.payroll_month))}.xlsx`
    saveAs(blob, fileName)
  }

  const exportPayrollToExcel = async () => {
    if (!selectedPayrollRun) {
      toast.error('يرجى اختيار مسير أولاً')
      return
    }

    try {
      const entries = await fetchPayrollEntriesForExport(selectedPayrollRun.id)
      if (entries.length === 0) {
        toast.warning('هذا المسير لا يحتوي على بيانات رواتب للتصدير')
        return
      }

      const breakdownByEntryId = await fetchPayrollEntryBreakdowns(entries.map((item) => item.id))
      await downloadPayrollRunExcel(selectedPayrollRun, entries, breakdownByEntryId)
      toast.success('تم تصدير ملف Excel منسق لهذا المسير')
    } catch (error) {
      console.error('Error exporting payroll run to Excel:', error)
      const message = error instanceof Error ? error.message : 'فشل تصدير المسير بصيغة Excel'
      toast.error(message)
    }
  }

  const handleTogglePayrollRunExportSelection = (runId: string, checked: boolean) => {
    setSelectedPayrollExportRunIds((current) =>
      checked ? Array.from(new Set([...current, runId])) : current.filter((id) => id !== runId)
    )
  }

  const handleToggleSelectAllPayrollRuns = (checked: boolean) => {
    setSelectedPayrollExportRunIds(checked ? exportablePayrollRunIds : [])
  }

  const handleExportSelectedPayrollRuns = async () => {
    if (selectedPayrollExportRunIds.length === 0) {
      toast.error('يرجى اختيار مسير واحد على الأقل للتصدير')
      return
    }

    try {
      setExportingSelectedPayrollRuns(true)
      let exportedCount = 0
      let skippedCount = 0

      for (const runId of selectedPayrollExportRunIds) {
        const run = payrollRunList.find((item) => item.id === runId) ?? null
        if (!run) {
          continue
        }

        const entries = await fetchPayrollEntriesForExport(run.id)
        if (entries.length === 0) {
          skippedCount += 1
          continue
        }

        const breakdownByEntryId = await fetchPayrollEntryBreakdowns(entries.map((item) => item.id))
        await downloadPayrollRunExcel(run, entries, breakdownByEntryId)
        exportedCount += 1
      }

      if (exportedCount > 0) {
        toast.success(`تم تصدير ${exportedCount} ملف Excel للمسيرات المحددة`)
      }

      if (skippedCount > 0) {
        toast.warning(`تم تجاوز ${skippedCount} مسير لأنه لا يحتوي على بيانات رواتب`)
      }
    } catch (error) {
      console.error('Error exporting selected payroll runs:', error)
      const message = error instanceof Error ? error.message : 'فشل تصدير المسيرات المحددة'
      toast.error(message)
    } finally {
      setExportingSelectedPayrollRuns(false)
    }
  }

  const downloadPayrollTemplate = async () => {
    const XLSX = await loadXlsx()
    const templateData = [
      {
        'رقم الإقامة': '2123456789',
        'أيام الحضور': 30,
        'الإجازات المدفوعة': 0,
        الإضافي: 250,
        'قسط رسوم نقل وتجديد': 150,
        'قسط جزاءات وغرامات': 100,
        'قسط سلفة': 50,
        'قسط أخرى': 0,
        'ملاحظات الإضافي': 'بدل ساعات إضافية',
        'ملاحظات الخصومات': 'سلفة أو غياب',
        ملاحظات: 'اختياري',
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll Template')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, 'قالب_استيراد_الرواتب.xlsx')
    toast.success('تم تنزيل قالب استيراد الرواتب')
  }

  const handleCreatePayrollRun = async () => {
    if (!payrollForm.payroll_month) {
      toast.error('يرجى اختيار شهر الرواتب')
      return
    }

    if (!payrollForm.scope_id) {
      toast.error(
        payrollForm.scope_type === 'project' ? 'يرجى اختيار المشروع' : 'يرجى اختيار المؤسسة'
      )
      return
    }

    const requestedPayrollMonth = `${payrollForm.payroll_month}-01`
    const existingRun = payrollRunList.find(
      (run) =>
        run.payroll_month.slice(0, 7) === payrollForm.payroll_month &&
        run.scope_type === payrollForm.scope_type &&
        run.scope_id === payrollForm.scope_id
    )

    if (existingRun) {
      setSelectedPayrollRunId(existingRun.id)
      setShowPayrollRunForm(false)
      toast.warning(getExistingRunWarningMessage(existingRun))
      return
    }

    try {
      const createdRun = await createPayrollRun.mutateAsync({
        payroll_month: requestedPayrollMonth,
        scope_type: payrollForm.scope_type,
        scope_id: payrollForm.scope_id,
        input_mode: payrollForm.input_mode,
        notes: payrollForm.notes.trim() || null,
      })

      setSelectedPayrollRunId(createdRun.id)
      setShowPayrollRunForm(false)
      toast.success('تم إنشاء المسير بنجاح')
    } catch (error) {
      console.error('Error creating payroll run:', error)

      const isDuplicateRunError =
        typeof error === 'object' &&
        error !== null &&
        (('code' in error && error.code === '23505') ||
          ('message' in error &&
            typeof error.message === 'string' &&
            (error.message.includes('duplicate key') ||
              error.message.includes('payroll_runs_scope_month_unique'))))

      if (isDuplicateRunError) {
        const matchingRun = payrollRunList.find(
          (run) =>
            run.payroll_month.slice(0, 7) === payrollForm.payroll_month &&
            run.scope_type === payrollForm.scope_type &&
            run.scope_id === payrollForm.scope_id
        )

        if (matchingRun) {
          setSelectedPayrollRunId(matchingRun.id)
          setShowPayrollRunForm(false)
          toast.warning(getExistingRunWarningMessage(matchingRun))
          return
        }
      }

      const message = error instanceof Error ? error.message : 'فشل إنشاء المسير'
      toast.error(message)
    }
  }

  const handleUpsertPayrollEntry = async () => {
    if (!selectedPayrollRun) {
      toast.error('يرجى اختيار مسير أولاً')
      return
    }

    if (!selectedPayrollEmployee) {
      toast.error('يرجى اختيار الموظف')
      return
    }

    if (netAmount < 0) {
      toast.error('صافي الراتب لا يمكن أن يكون سالبًا')
      return
    }

    try {
      await upsertPayrollEntry.mutateAsync({
        payroll_run_id: selectedPayrollRun.id,
        payroll_run_status: selectedPayrollRun.status,
        payroll_month: selectedPayrollRun.payroll_month,
        employee_id: selectedPayrollEmployee.id,
        residence_number_snapshot: selectedPayrollEmployee.residence_number,
        employee_name_snapshot: selectedPayrollEmployee.name,
        company_name_snapshot: selectedPayrollEmployee.company?.name ?? null,
        project_name_snapshot: selectedPayrollEmployee.project?.name ?? null,
        basic_salary_snapshot: baseSalary,
        daily_rate_snapshot: dailyRate,
        attendance_days: payrollEntryForm.attendance_days,
        paid_leave_days: payrollEntryForm.paid_leave_days,
        overtime_amount: payrollEntryForm.overtime_amount,
        overtime_notes: payrollEntryForm.overtime_notes.trim() || null,
        deductions_amount: deductionBreakdown.penalty + deductionBreakdown.other,
        deductions_notes: payrollEntryForm.deductions_notes.trim() || null,
        installment_deducted_amount:
          deductionBreakdown.transfer_renewal + deductionBreakdown.advance,
        deduction_breakdown: deductionBreakdown,
        gross_amount: grossAmount,
        net_amount: netAmount,
        entry_status: 'calculated',
        notes: payrollEntryForm.notes.trim() || null,
      })

      await loadPayrollInsights()
      toast.success('تم حفظ مدخل الراتب وربطه بالالتزامات المالية')
      setShowPayrollEntryForm(false)
    } catch (error) {
      console.error('Error upserting payroll entry:', error)
      const message = error instanceof Error ? error.message : 'فشل حفظ مدخل الراتب'
      toast.error(message)
    }
  }

  const logPayrollActivity = async (action: string, details: Record<string, unknown>) => {
    try {
      await supabase.from('activity_log').insert({
        entity_type: 'payroll',
        entity_id: selectedPayrollRun?.id,
        action,
        details,
      })
    } catch (error) {
      console.error('Error logging payroll activity:', error)
    }
  }

  const handleUpdatePayrollRunStatus = async (status: 'draft' | 'finalized' | 'cancelled') => {
    if (!selectedPayrollRun) {
      toast.error('يرجى اختيار مسير أولاً')
      return
    }

    if (status === 'finalized' && payrollEntries.length === 0) {
      toast.error('لا يمكن اعتماد مسير فارغ')
      return
    }

    try {
      await updatePayrollRunStatus.mutateAsync({
        runId: selectedPayrollRun.id,
        status,
        approved_at: status === 'finalized' ? new Date().toISOString() : null,
      })

      await logPayrollActivity('payroll_run_status_updated', {
        payroll_run_id: selectedPayrollRun.id,
        payroll_month: selectedPayrollRun.payroll_month,
        from_status: selectedPayrollRun.status,
        to_status: status,
        entry_count: payrollEntries.length,
      })

      await loadPayrollInsights()

      toast.success(
        status === 'finalized'
          ? 'تم اعتماد المسير'
          : status === 'cancelled'
            ? 'تم إلغاء المسير'
            : 'تمت إعادة المسير إلى مسودة'
      )
    } catch (error) {
      console.error('Error updating payroll run status:', error)
      const message = error instanceof Error ? error.message : 'فشل تحديث حالة المسير'
      toast.error(message)
    }
  }

  const handlePrintPayrollSlip = () => {
    if (!selectedPayrollSlip || !selectedSlipEntry) {
      toast.error('لا توجد قسيمة جاهزة للطباعة')
      return
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800')
    if (!printWindow) {
      toast.error('تعذر فتح نافذة الطباعة')
      return
    }

    const componentRows =
      selectedSlipComponents.length > 0
        ? selectedSlipComponents
            .map(
              (component) => `
          <tr>
            <td>${component.component_type || '-'}</td>
            <td>${component.component_code || '-'}</td>
            <td>${Number(component.amount || 0).toLocaleString('en-US')}</td>
            <td>${component.notes || '-'}</td>
          </tr>
        `
            )
            .join('')
        : '<tr><td colspan="4">لا توجد مكونات تفصيلية محفوظة</td></tr>'

    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8" />
          <title>${selectedPayrollSlip.slip_number}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111827; }
            h1, h2, p { margin: 0; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
            .muted { color: #6b7280; font-size: 13px; margin-top: 6px; }
            .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background: #f9fafb; }
            .label { color: #6b7280; font-size: 13px; margin-bottom: 8px; }
            .value { font-size: 18px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: right; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>قسيمة راتب</h1>
              <p class="muted">${selectedPayrollSlip.slip_number}</p>
            </div>
            <div>
              <p class="muted">تاريخ التوليد: ${selectedPayrollSlip.generated_at ? new Date(selectedPayrollSlip.generated_at).toLocaleString('en-GB') : '-'}</p>
            </div>
          </div>

          <div class="grid">
            <div class="card"><div class="label">الموظف</div><div class="value">${selectedSlipEntry.employee_name_snapshot || '-'}</div></div>
            <div class="card"><div class="label">رقم الإقامة</div><div class="value">${selectedSlipEntry.residence_number_snapshot || '-'}</div></div>
            <div class="card"><div class="label">إجمالي الراتب</div><div class="value">${Number(selectedSlipTotals?.grossAmount || selectedSlipEntry.gross_amount || 0).toLocaleString('en-US')}</div></div>
            <div class="card"><div class="label">صافي الراتب</div><div class="value">${Number(selectedSlipTotals?.netAmount || selectedSlipEntry.net_amount || 0).toLocaleString('en-US')}</div></div>
          </div>

          <div class="grid">
            <div class="card"><div class="label">الخصومات</div><div class="value">${Number(selectedSlipEntry.deductions_amount || 0).toLocaleString('en-US')}</div></div>
            <div class="card"><div class="label">خصم الأقساط</div><div class="value">${Number(selectedSlipEntry.installment_deducted_amount || 0).toLocaleString('en-US')}</div></div>
            <div class="card"><div class="label">أيام الحضور</div><div class="value">${Number(selectedSlipEntry.attendance_days || 0).toLocaleString('en-US')}</div></div>
            <div class="card"><div class="label">الإجازات المدفوعة</div><div class="value">${Number(selectedSlipEntry.paid_leave_days || 0).toLocaleString('en-US')}</div></div>
          </div>

          <h2>مكونات القسيمة</h2>
          <table>
            <thead>
              <tr>
                <th>النوع</th>
                <th>الكود</th>
                <th>المبلغ</th>
                <th>الملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${componentRows}
            </tbody>
          </table>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const handleDownloadPayrollSlipPdf = async () => {
    if (!selectedPayrollSlip || !selectedSlipEntry || !payrollSlipPreviewRef.current) {
      toast.error('لا توجد قسيمة جاهزة للتنزيل')
      return
    }

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(payrollSlipPreviewRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      })

      const imageData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imageWidth = pageWidth
      const imageHeight = (canvas.height * imageWidth) / canvas.width

      let remainingHeight = imageHeight
      let position = 0

      pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
      remainingHeight -= pageHeight

      while (remainingHeight > 0) {
        position = remainingHeight - imageHeight
        pdf.addPage()
        pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
        remainingHeight -= pageHeight
      }

      pdf.save(`${selectedPayrollSlip.slip_number}.pdf`)
      toast.success('تم تنزيل القسيمة بصيغة PDF')
    } catch (error) {
      console.error('Error generating payroll slip PDF:', error)
      toast.error('فشل تنزيل القسيمة بصيغة PDF')
    }
  }

  const handleOpenPayrollExcelImport = () => {
    payrollExcelInputRef.current?.click()
  }

  const handleConfirmPayrollExcelImport = async () => {
    if (!selectedPayrollRun || payrollImportPreviewRows.length === 0) {
      toast.error('لا توجد صفوف جاهزة لاعتماد الاستيراد')
      return
    }

    try {
      setConfirmingPayrollExcelImport(true)

      for (const row of payrollImportPreviewRows) {
        await upsertPayrollEntry.mutateAsync({
          payroll_run_id: selectedPayrollRun.id,
          payroll_run_status: selectedPayrollRun.status,
          payroll_month: selectedPayrollRun.payroll_month,
          employee_id: row.employee_id,
          residence_number_snapshot: Number(row.residence_number),
          employee_name_snapshot: row.employee_name,
          company_name_snapshot: row.company_name ?? null,
          project_name_snapshot: row.project_name ?? null,
          basic_salary_snapshot: row.basic_salary_snapshot,
          daily_rate_snapshot: row.daily_rate_snapshot,
          attendance_days: row.attendance_days,
          paid_leave_days: row.paid_leave_days,
          overtime_amount: row.overtime_amount,
          overtime_notes: row.overtime_notes || null,
          deductions_amount: row.penalty_amount + row.other_amount,
          deductions_notes: row.deductions_notes || null,
          installment_deducted_amount: row.transfer_renewal_amount + row.advance_amount,
          deduction_breakdown: {
            transfer_renewal: row.transfer_renewal_amount,
            penalty: row.penalty_amount,
            advance: row.advance_amount,
            other: row.other_amount,
          },
          gross_amount: row.gross_amount,
          net_amount: row.net_amount,
          entry_status: 'calculated',
          notes: row.notes || null,
        })
      }

      await loadPayrollInsights()
      toast.success(
        `تم اعتماد ${payrollImportPreviewRows.length} مدخل راتب من ملف Excel وربطه بالالتزامات`
      )
      setPayrollImportPreviewRows([])
      setPayrollImportFileName('')
      if (payrollImportErrors.length === 0) {
        setPayrollImportHeaderError(null)
      }
    } catch (error) {
      console.error('Error confirming payroll Excel import:', error)
      const message = error instanceof Error ? error.message : 'فشل اعتماد استيراد الرواتب'
      toast.error(message)
    } finally {
      setConfirmingPayrollExcelImport(false)
    }
  }

  const handleClearPayrollImportPreview = () => {
    setPayrollImportPreviewRows([])
    setPayrollImportErrors([])
    setPayrollImportHeaderError(null)
    setPayrollImportFileName('')
  }

  const handlePayrollExcelImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]

    if (!selectedPayrollRun) {
      toast.error('يرجى اختيار مسير أولاً')
      event.target.value = ''
      return
    }

    if (!selectedFile) {
      return
    }

    setPayrollImportErrors([])
    setPayrollImportHeaderError(null)
    setPayrollImportPreviewRows([])
    setPayrollImportFileName(selectedFile.name)

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error('يرجى اختيار ملف Excel صالح')
      event.target.value = ''
      return
    }

    try {
      setImportingPayrollExcel(true)
      const fileData = await selectedFile.arrayBuffer()
      const XLSX = await loadXlsx()
      const workbook = XLSX.read(fileData)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })

      if (rows.length === 0) {
        toast.error('ملف Excel فارغ')
        return
      }

      const sheetHeaders = Object.keys(rows[0] ?? {}).map((header) =>
        normalizePayrollExcelHeader(header)
      )
      const missingRequiredHeaders = REQUIRED_PAYROLL_EXCEL_FIELDS.filter((fieldKey) => {
        const aliases = PAYROLL_EXCEL_HEADERS[fieldKey]
        return !aliases.some((alias) => sheetHeaders.includes(normalizePayrollExcelHeader(alias)))
      })

      if (missingRequiredHeaders.length > 0) {
        const missingHeadersText = missingRequiredHeaders
          .map((fieldKey) => PAYROLL_EXCEL_HEADERS[fieldKey][0])
          .join('، ')
        setPayrollImportHeaderError(
          `الملف لا يحتوي على الأعمدة المطلوبة التالية: ${missingHeadersText}`
        )
        toast.error('هيكل ملف الرواتب غير صحيح')
        return
      }

      const scopedEmployeesByResidence = new Map(
        scopedPayrollEmployees.map((employee) => [
          normalizeResidenceNumber(employee.residence_number),
          employee,
        ])
      )

      const normalizedRows: PayrollExcelRow[] = rows.map((row) => {
        const normalizedMap = new Map<string, unknown>()
        Object.entries(row).forEach(([key, value]) => {
          normalizedMap.set(normalizePayrollExcelHeader(key), value)
        })

        const getValue = (aliases: readonly string[]) => {
          for (const alias of aliases) {
            const match = normalizedMap.get(normalizePayrollExcelHeader(alias))
            if (match !== undefined) {
              return match
            }
          }
          return ''
        }

        const transferRenewalAmount = toNumericPayrollValue(
          getValue(PAYROLL_EXCEL_HEADERS.transfer_renewal_amount)
        )
        const penaltyAmount = toNumericPayrollValue(getValue(PAYROLL_EXCEL_HEADERS.penalty_amount))
        const advanceAmount = toNumericPayrollValue(getValue(PAYROLL_EXCEL_HEADERS.advance_amount))
        const otherAmount = toNumericPayrollValue(getValue(PAYROLL_EXCEL_HEADERS.other_amount))
        const legacyDeductionsAmount = toNumericPayrollValue(
          getValue(PAYROLL_EXCEL_HEADERS.deductions_amount)
        )
        const legacyInstallmentAmount = toNumericPayrollValue(
          getValue(PAYROLL_EXCEL_HEADERS.installment_deducted_amount)
        )

        return {
          residence_number: normalizeResidenceNumber(
            getValue(PAYROLL_EXCEL_HEADERS.residence_number)
          ),
          attendance_days: toNumericPayrollValue(getValue(PAYROLL_EXCEL_HEADERS.attendance_days)),
          paid_leave_days: toNumericPayrollValue(getValue(PAYROLL_EXCEL_HEADERS.paid_leave_days)),
          overtime_amount: toNumericPayrollValue(getValue(PAYROLL_EXCEL_HEADERS.overtime_amount)),
          transfer_renewal_amount: transferRenewalAmount,
          penalty_amount: penaltyAmount || legacyDeductionsAmount,
          advance_amount: advanceAmount || legacyInstallmentAmount,
          other_amount: otherAmount,
          deductions_amount: penaltyAmount + otherAmount || legacyDeductionsAmount,
          installment_deducted_amount:
            transferRenewalAmount + advanceAmount || legacyInstallmentAmount,
          overtime_notes: String(getValue(PAYROLL_EXCEL_HEADERS.overtime_notes) || '').trim(),
          deductions_notes: String(getValue(PAYROLL_EXCEL_HEADERS.deductions_notes) || '').trim(),
          notes: String(getValue(PAYROLL_EXCEL_HEADERS.notes) || '').trim(),
        }
      })

      const importErrors: string[] = []
      const previewRows: PayrollExcelPreviewRow[] = []

      for (const [index, row] of normalizedRows.entries()) {
        if (!row.residence_number) {
          importErrors.push(`الصف ${index + 2}: رقم الإقامة مفقود`)
          continue
        }

        const employee = scopedEmployeesByResidence.get(row.residence_number)
        if (!employee) {
          importErrors.push(
            `الصف ${index + 2}: لا يوجد موظف ضمن نطاق المسير برقم إقامة ${row.residence_number}`
          )
          continue
        }

        const groupedImportDeductions = getPayrollObligationBreakdownTotal({
          transfer_renewal: row.transfer_renewal_amount,
          penalty: row.penalty_amount,
          advance: row.advance_amount,
          other: row.other_amount,
        })
        const {
          dailyRate: employeeDailyRate,
          grossAmount: importedGrossAmount,
          netAmount: importedNetAmount,
        } = calculatePayrollTotals(
          Number(employee.salary ?? 0),
          row.attendance_days,
          row.paid_leave_days,
          row.overtime_amount,
          groupedImportDeductions
        )

        if (importedNetAmount < 0) {
          importErrors.push(`الصف ${index + 2}: صافي الراتب لا يمكن أن يكون سالبًا`)
          continue
        }

        previewRows.push({
          row_number: index + 2,
          employee_id: employee.id,
          employee_name: employee.name,
          company_name: employee.company?.name ?? null,
          project_name: employee.project?.name ?? null,
          basic_salary_snapshot: employee.salary ?? 0,
          daily_rate_snapshot: employeeDailyRate,
          gross_amount: importedGrossAmount,
          net_amount: importedNetAmount,
          ...row,
        })
      }

      setPayrollImportPreviewRows(previewRows)

      if (importErrors.length > 0) {
        setPayrollImportErrors(importErrors)
        toast.warning(
          `تمت معاينة ${previewRows.length} صف صالح، وتعذر تجهيز ${importErrors.length} صف`
        )
        console.error('Payroll Excel import errors:', importErrors)
      } else if (previewRows.length > 0) {
        toast.success(`تم تجهيز ${previewRows.length} صف للمراجعة قبل الاعتماد`)
      } else {
        toast.error('لم يتم العثور على صفوف صالحة للاستيراد')
      }
    } catch (error) {
      console.error('Error importing payroll Excel:', error)
      const message = error instanceof Error ? error.message : 'فشل استيراد ملف الرواتب'
      toast.error(message)
    } finally {
      setImportingPayrollExcel(false)
      event.target.value = ''
    }
  }

  const getPayrollStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'مسودة'
      case 'processing':
        return 'قيد المعالجة'
      case 'finalized':
        return 'نهائي'
      case 'cancelled':
        return 'ملغي'
      case 'calculated':
        return 'محسوب'
      case 'paid':
        return 'مدفوع'
      default:
        return status
    }
  }

  const getPayrollScopeName = (scopeType: PayrollScopeType, scopeId: string) => {
    if (scopeType === 'company') {
      return companies.find((company) => company.id === scopeId)?.name ?? 'مؤسسة غير معروفة'
    }

    return projects.find((project) => project.id === scopeId)?.name ?? 'مشروع غير معروف'
  }

  const getPayrollInputModeText = (inputMode: PayrollInputMode) => {
    switch (inputMode) {
      case 'manual':
        return 'يدوي'
      case 'excel':
        return 'Excel'
      case 'mixed':
        return 'مختلط'
      default:
        return inputMode
    }
  }

  const formatPayrollMonthLabel = (monthValue: string) => {
    const normalizedMonth = monthValue.slice(0, 7)
    const parsedDate = new Date(`${normalizedMonth}-01T00:00:00`)

    if (Number.isNaN(parsedDate.getTime())) {
      return normalizedMonth
    }

    return new Intl.DateTimeFormat('ar', {
      month: 'long',
      year: 'numeric',
    }).format(parsedDate)
  }

  const getPayrollRunDisplayName = (
    scopeType: PayrollScopeType,
    scopeId: string,
    payrollMonth: string
  ) => {
    const scopeName = getPayrollScopeName(scopeType, scopeId)
    const monthLabel = formatPayrollMonthLabel(payrollMonth)

    return scopeType === 'project'
      ? `مسير شهر ${monthLabel} لمشروع ${scopeName}`
      : `مسير شهر ${monthLabel} لمؤسسة ${scopeName}`
  }

  const getExistingRunWarningMessage = (run: {
    status: string
    scope_type: PayrollScopeType
    scope_id: string
    payroll_month: string
  }) => {
    const runLabel = getPayrollRunDisplayName(run.scope_type, run.scope_id, run.payroll_month)

    return run.status === 'cancelled'
      ? `${runLabel} موجود بالفعل لكنه ملغي حاليًا، وتم فتحه لك. اضغط على إعادة فتح المسير للمتابعة.`
      : `${runLabel} موجود بالفعل وتم فتحه لك بدل إنشاء نسخة مكررة.`
  }

  const handleTogglePayrollRunForm = () => {
    if (!showPayrollRunForm) {
      const defaultScopeType: PayrollScopeType = projects.length > 0 ? 'project' : 'company'
      const defaultScopeOptions = defaultScopeType === 'project' ? projects : companies

      setPayrollForm((current) => ({
        ...current,
        scope_type: defaultScopeType,
        scope_id:
          defaultScopeOptions.some((item) => item.id === current.scope_id) &&
          current.scope_type === defaultScopeType
            ? current.scope_id
            : (defaultScopeOptions[0]?.id ?? ''),
      }))
    }

    setShowPayrollRunForm((current) => !current)
  }

  const handleRefreshPayrollData = async () => {
    await Promise.all([
      refetchPayrollRuns(),
      refetchPayrollEntries(),
      refetchPayrollSlips(),
      loadPayrollInsights(),
    ])
    toast.success('تم تحديث بيانات الرواتب')
  }

  const handleOpenPayrollEntryForm = () => {
    if (!selectedPayrollRun) {
      toast.error('يرجى اختيار مسير أولاً')
      return
    }

    if (!selectedPayrollRunEditable) {
      toast.error(
        selectedPayrollRun.status === 'cancelled'
          ? 'هذا المسير ملغي حاليًا. اضغط على إعادة فتح المسير أولاً ثم أضف الرواتب.'
          : 'لا يمكن إدخال راتب يدوي لأن هذا المسير نهائي أو ملغي'
      )
      return
    }

    if (scopedEmployeesLoading) {
      toast.warning('جاري تحميل الموظفين المرتبطين بهذا المسير، حاول مرة أخرى بعد لحظة')
      return
    }

    if (scopedPayrollEmployees.length === 0) {
      toast.warning(
        'لا يوجد موظفون داخل نطاق هذا المسير حاليًا. أضف موظفًا للنطاق أولاً ثم حاول مرة أخرى.'
      )
      return
    }

    setShowPayrollEntryForm(true)
    window.requestAnimationFrame(() => {
      payrollEntryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleSelectPayrollRun = (runId: string) => {
    setSelectedPayrollRunId(runId)
    setShowPayrollEntryForm(false)
    setSelectedPayrollSlipEntryId(null)
    setPayrollRunDeleteConfirmOpen(false)

    window.requestAnimationFrame(() => {
      payrollDetailsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleEditPayrollEntry = (entry: PayrollEntry) => {
    if (!selectedPayrollRunEditable) {
      toast.error('أعد المسير إلى مسودة أولاً ثم قم بالتعديل')
      return
    }

    setShowPayrollEntryForm(true)
    setPayrollEntryForm((current) => ({
      ...current,
      employee_id: entry.employee_id,
    }))

    window.requestAnimationFrame(() => {
      payrollEntryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleDeletePayrollRun = () => {
    if (!selectedPayrollRun) {
      toast.error('يرجى اختيار مسير أولاً')
      return
    }

    if (selectedPayrollRun.status !== 'cancelled') {
      toast.error('يمكن حذف المسير الملغي فقط')
      return
    }

    setPayrollRunDeleteConfirmOpen(true)
  }

  const handleConfirmDeletePayrollRun = async () => {
    if (!selectedPayrollRun) {
      toast.error('يرجى اختيار مسير أولاً')
      return
    }

    try {
      await deletePayrollRun.mutateAsync(selectedPayrollRun.id)
      const nextAvailableRun = payrollRunList.find((run) => run.id !== selectedPayrollRun.id)
      setSelectedPayrollRunId(nextAvailableRun?.id ?? null)
      setSelectedPayrollSlipEntryId(null)
      setShowPayrollEntryForm(false)
      setPayrollRunDeleteConfirmOpen(false)
      await loadPayrollInsights()
      toast.success('تم حذف المسير بنجاح')
    } catch (error) {
      console.error('Error deleting payroll run:', error)
      const message = error instanceof Error ? error.message : 'فشل حذف المسير'
      toast.error(message)
    }
  }

  if (!hasPayrollViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض صفحة الرواتب والاستقطاعات.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid">
        {/* Header */}
        <div className="app-panel mb-5 p-5">
          <div className="flex items-center gap-3">
            <div className="app-icon-chip">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">الرواتب والاستقطاعات</h1>
              <p className="mt-2 text-sm text-gray-600">
                هذه الصفحة مخصصة لمسيرات الرواتب، إدخال الرواتب، الاستيراد، القسائم، والاستقطاعات
                فقط.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActivePageTab('search')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activePageTab === 'search'
                ? 'bg-primary text-slate-950 shadow-soft'
                : 'border border-border-200 bg-surface text-foreground-secondary hover:bg-surface-secondary-50'
            }`}
          >
            <Search className="h-4 w-4" />
            البحث في الاستقطاعات
          </button>
          <button
            type="button"
            onClick={() => setActivePageTab('runs')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activePageTab === 'runs'
                ? 'bg-primary text-slate-950 shadow-soft'
                : 'border border-border-200 bg-surface text-foreground-secondary hover:bg-surface-secondary-50'
            }`}
          >
            <Wallet className="h-4 w-4" />
            مسيرات الرواتب
          </button>
        </div>

        {activePageTab === 'search' && (
          <div className="space-y-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border-200 bg-surface p-4">
                <div className="text-sm text-foreground-tertiary mb-1">إجمالي الالتزامات</div>
                <div className="text-2xl font-bold text-foreground">
                  {obligationStats.total.toLocaleString('en-US')}
                </div>
              </div>
              <div className="rounded-xl border border-border-200 bg-surface p-4">
                <div className="text-sm text-foreground-tertiary mb-1">ما تم سداده فعلياً</div>
                <div className="text-2xl font-bold text-green-600">
                  {obligationStats.paid.toLocaleString('en-US')}
                </div>
              </div>
              <div className="rounded-xl border border-border-200 bg-surface p-4">
                <div className="text-sm text-foreground-tertiary mb-1">المتبقي الفعلي</div>
                <div className="text-2xl font-bold text-red-600">
                  {obligationStats.remaining.toLocaleString('en-US')}
                </div>
              </div>
              <div className="rounded-xl border border-border-200 bg-surface p-4">
                <div className="text-sm text-foreground-tertiary mb-1">المسدد فعلياً في الشهر</div>
                <div className="text-2xl font-bold text-blue-700">
                  {filteredObligationInsightRows
                    .reduce((sum, row) => sum + Number(row.amount_paid || 0), 0)
                    .toLocaleString('en-US')}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border-200 bg-surface p-4 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">البحث التفاعلي في الاستقطاعات</h2>
                <p className="text-sm text-gray-600">
                  اكتب أي رقم أو اسم أو مشروع وسيتم الفلترة مباشرة.
                </p>
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  الأرقام داخل الصف تمثل قسط أو استقطاع المسير لهذا الشهر، أما المتبقي بالأعلى فهو
                  الرصيد الفعلي من خطة الالتزام ولا ينخفض إلا بعد اعتماد المسير نهائياً.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground-secondary">بحث</label>
                  <input
                    type="text"
                    value={payrollSearchQuery}
                    onChange={(e) => setPayrollSearchQuery(e.target.value)}
                    placeholder="الاسم أو رقم الإقامة أو المشروع"
                    className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground-secondary">الشهر</label>
                  <input
                    type="month"
                    value={payrollSearchMonth}
                    onChange={(e) => setPayrollSearchMonth(e.target.value)}
                    className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground-secondary">المشروع</label>
                  <select
                    value={payrollSearchProject}
                    onChange={(e) => setPayrollSearchProject(e.target.value)}
                    className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                  >
                    <option value="">كل المشاريع</option>
                    {projectFilterOptions.map((projectName) => (
                      <option key={projectName} value={projectName}>
                        {projectName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {payrollInsightsLoading ? (
                <div className="rounded-xl border border-border-200 bg-surface-secondary-50 px-4 py-8 text-center text-sm text-foreground-tertiary">
                  جاري تحميل بيانات البحث...
                </div>
              ) : filteredPayrollSearchRows.length === 0 ? (
                <div className="rounded-xl border border-border-200 bg-surface-secondary-50 px-4 py-8 text-center text-sm text-foreground-tertiary">
                  لا توجد نتائج مطابقة للفلاتر الحالية.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-200">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-secondary-50">
                      <tr>
                        <th className="px-4 py-3 text-right">الموظف</th>
                        <th className="px-4 py-3 text-right">الإقامة</th>
                        <th className="px-4 py-3 text-right">المشروع</th>
                        <th className="px-4 py-3 text-right">الشهر</th>
                        <th className="px-4 py-3 text-right">حالة المسير</th>
                        <th className="px-4 py-3 text-right">قسط نقل وتجديد</th>
                        <th className="px-4 py-3 text-right">قسط جزاءات</th>
                        <th className="px-4 py-3 text-right">قسط سلف</th>
                        <th className="px-4 py-3 text-right">قسط أخرى</th>
                        <th className="px-4 py-3 text-right">إجمالي استقطاع الشهر</th>
                        <th className="px-4 py-3 text-right">المتبقي الفعلي</th>
                        <th className="px-4 py-3 text-right">الصافي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayrollSearchRows.map((row) => (
                        <tr key={row.id} className="border-t hover:bg-surface-secondary-50">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {row.employee_name_snapshot}
                          </td>
                          <td className="px-4 py-3">{row.residence_label}</td>
                          <td className="px-4 py-3">{row.project_label || '-'}</td>
                          <td className="px-4 py-3">{row.payroll_month_label || '-'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                row.payroll_run_status === 'finalized'
                                  ? 'bg-green-100 text-green-700'
                                  : row.payroll_run_status === 'cancelled'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {row.payroll_run_status === 'finalized'
                                ? 'نهائي ومحتسب'
                                : row.payroll_run_status === 'cancelled'
                                  ? 'ملغي'
                                  : 'مسودة غير محتسبة'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {row.deduction_breakdown.transfer_renewal.toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-3">
                            {row.deduction_breakdown.penalty.toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-3">
                            {row.deduction_breakdown.advance.toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-3">
                            {row.deduction_breakdown.other.toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-red-600">
                            {row.total_deductions.toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-amber-700">
                            {row.obligation_remaining.toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-blue-700">
                            {row.net_amount.toLocaleString('en-US')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Content */}
        <div className={activePageTab === 'runs' ? '' : 'hidden'}>
          <div className="space-y-6">
            <div className="rounded-2xl border border-border-200 bg-surface p-4 md:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">إحصائيات مسيرات الرواتب</h2>
                  <p className="text-sm text-foreground-secondary">
                    اختر شهرًا أو مسيرًا محددًا وستتغير الكروت مباشرة.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[760px]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground-secondary">
                      فلتر الشهر
                    </label>
                    <input
                      type="month"
                      value={payrollRunStatsMonth}
                      onChange={(e) => setPayrollRunStatsMonth(e.target.value)}
                      className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground-secondary">
                      فلتر المسير
                    </label>
                    <select
                      value={payrollRunStatsRunId}
                      onChange={(e) => setPayrollRunStatsRunId(e.target.value)}
                      className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                    >
                      <option value="">كل المسيرات</option>
                      {payrollRunList.map((run) => (
                        <option key={run.id} value={run.id}>
                          {getPayrollRunDisplayName(
                            run.scope_type,
                            run.scope_id,
                            run.payroll_month
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setPayrollRunStatsMonth('')
                        setPayrollRunStatsRunId('')
                      }}
                      className="w-full rounded-xl border border-border-300 bg-surface-secondary-50 px-3 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-secondary-100 transition"
                    >
                      إعادة ضبط الفلتر
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-surface rounded-xl shadow-sm border border-border-200 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">المسيرات داخل الفلتر</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {filteredPayrollRunList.length}
                      </p>
                    </div>
                    <div className="app-icon-chip">
                      <Wallet className="w-6 h-6" />
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border-200 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">الموظفون داخل الفلتر</p>
                      <p className="text-2xl font-bold text-sky-700">
                        {payrollRunCardsStats.employees}
                      </p>
                    </div>
                    <div className="bg-sky-100 p-3 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-sky-600" />
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border-200 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">إجمالي الرواتب</p>
                      <p className="text-2xl font-bold text-foreground">
                        {payrollRunCardsStats.gross.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-indigo-100 p-3 rounded-lg">
                      <ReceiptText className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border-200 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">إجمالي الالتزامات</p>
                      <p className="text-2xl font-bold text-red-600">
                        {payrollRunCardsStats.totalObligations.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-red-100 p-3 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border-200 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">رسوم نقل وتجديد</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {payrollRunCardsStats.transferRenewal.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-amber-100 p-3 rounded-lg">
                      <Calendar className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border-200 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">جزاءات وغرامات</p>
                      <p className="text-2xl font-bold text-rose-600">
                        {payrollRunCardsStats.penalty.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-rose-100 p-3 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-rose-600" />
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border-200 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">سلف</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {payrollRunCardsStats.advance.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <Wallet className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>
                <div className="bg-surface rounded-xl shadow-sm border border-border-200 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">أخرى</p>
                      <p className="text-2xl font-bold text-violet-700">
                        {payrollRunCardsStats.other.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-violet-100 p-3 rounded-lg">
                      <Plus className="w-6 h-6 text-violet-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-2xl shadow-sm border border-border-200 p-4 md:p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">مسيرات الرواتب</h2>
                  <p className="text-sm text-gray-600">
                    أنشئ مسيرًا جديدًا لمؤسسة أو مشروع، ثم راجع كشف الموظفين المرتبط به
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleTogglePayrollRunForm}
                    className={primaryCompactButtonClass}
                  >
                    <Plus className="w-4 h-4" />
                    {showPayrollRunForm ? 'إخفاء النموذج' : 'مسير جديد'}
                  </button>
                )}
              </div>

              {showPayrollRunForm && isAdmin && (
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-primary/30 bg-primary/10 p-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      شهر الرواتب
                    </label>
                    <input
                      type="month"
                      value={payrollForm.payroll_month}
                      onChange={(e) =>
                        setPayrollForm((current) => ({ ...current, payroll_month: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      نوع المسير
                    </label>
                    <select
                      value={payrollForm.scope_type}
                      onChange={(e) =>
                        setPayrollForm((current) => ({
                          ...current,
                          scope_type: e.target.value as PayrollScopeType,
                          scope_id: '',
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="company">مسير لمؤسسة</option>
                      <option value="project">مسير لمشروع</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {payrollForm.scope_type === 'project' ? 'اختر المشروع' : 'اختر المؤسسة'}
                    </label>
                    <select
                      value={payrollForm.scope_id}
                      onChange={(e) =>
                        setPayrollForm((current) => ({ ...current, scope_id: e.target.value }))
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">اختر...</option>
                      {scopeOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      طريقة الإدخال
                    </label>
                    <select
                      value={payrollForm.input_mode}
                      onChange={(e) =>
                        setPayrollForm((current) => ({
                          ...current,
                          input_mode: e.target.value as PayrollInputMode,
                        }))
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="manual">يدوي</option>
                      <option value="excel">Excel</option>
                      <option value="mixed">مختلط</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 lg:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <div className="font-semibold mb-1">لتعمل مسيرًا حسب المشروع:</div>
                    <div>1. اختر نوع المسير = مسير لمشروع</div>
                    <div>2. ثم اختر اسم المشروع من القائمة</div>
                    <div>3. بعدها اضغط على إنشاء المسير</div>
                    {payrollForm.scope_id && (
                      <div className="mt-2 font-bold">
                        سيتم إنشاء:{' '}
                        {getPayrollRunDisplayName(
                          payrollForm.scope_type,
                          payrollForm.scope_id,
                          payrollForm.payroll_month
                        )}
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 lg:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={payrollForm.notes}
                      onChange={(e) =>
                        setPayrollForm((current) => ({ ...current, notes: e.target.value }))
                      }
                      rows={3}
                      className="w-full px-3 py-2 border rounded-md resize-none"
                      placeholder="اختياري"
                    />
                  </div>
                  <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-3">
                    <button
                      onClick={() => setShowPayrollRunForm(false)}
                      className={outlineCompactButtonClass}
                      disabled={createPayrollRun.isPending}
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleCreatePayrollRun}
                      className={successCompactButtonClass}
                      disabled={createPayrollRun.isPending}
                    >
                      {createPayrollRun.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      إنشاء المسير
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-2 border border-border-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-border-200">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="font-medium text-gray-800">
                        قائمة المسيرات ({payrollRunStatsRows.length} مدخل رواتب)
                      </div>
                      {canExport('payroll') && filteredPayrollRunList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 text-xs text-gray-700 bg-surface border border-border-200 rounded-md px-3 py-2">
                            <input
                              type="checkbox"
                              aria-label="تحديد جميع المسيرات"
                              checked={allExportablePayrollRunsSelected}
                              onChange={(e) => handleToggleSelectAllPayrollRuns(e.target.checked)}
                              className="rounded border-border-300"
                            />
                            تحديد جميع المسيرات القابلة للتصدير
                          </label>
                          <button
                            type="button"
                            onClick={handleExportSelectedPayrollRuns}
                            disabled={
                              selectedPayrollExportRunIds.length === 0 ||
                              exportingSelectedPayrollRuns
                            }
                            className={`${successCompactButtonClass} bg-emerald-600 hover:bg-emerald-700`}
                          >
                            {exportingSelectedPayrollRuns ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            تصدير المسيرات المحددة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    {payrollRunsLoading ? (
                      <div className="p-6 text-center text-gray-500">
                        جاري تحميل مسيرات الرواتب...
                      </div>
                    ) : filteredPayrollRunList.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        لا توجد مسيرات مطابقة للفلاتر الحالية.
                      </div>
                    ) : (
                      filteredPayrollRunList.map((run) => (
                        <div
                          key={run.id}
                          className={`flex items-start gap-3 border-b border-border-100 p-3 ${selectedPayrollRunId === run.id ? 'bg-blue-50' : ''}`}
                        >
                          {canExport('payroll') && (
                            <label className="mt-1 inline-flex items-center">
                              <input
                                type="checkbox"
                                aria-label={`تحديد مسير ${getPayrollRunDisplayName(run.scope_type, run.scope_id, run.payroll_month)}`}
                                checked={selectedPayrollExportRunIds.includes(run.id)}
                                disabled={run.entry_count === 0}
                                onChange={(event) =>
                                  handleTogglePayrollRunExportSelection(
                                    run.id,
                                    event.target.checked
                                  )
                                }
                                className="rounded border-border-300"
                              />
                            </label>
                          )}
                          <button
                            onClick={() => handleSelectPayrollRun(run.id)}
                            className={`flex-1 text-right p-3 rounded-lg transition ${selectedPayrollRunId === run.id ? 'bg-surface border border-blue-200 border-r-4 border-r-blue-600' : 'hover:bg-gray-50'}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="font-medium text-gray-900">
                                {formatPayrollMonthLabel(run.payroll_month)}
                              </span>
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${run.status === 'finalized' ? 'bg-green-100 text-green-700' : run.status === 'draft' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}
                              >
                                {getPayrollStatusText(run.status)}
                              </span>
                            </div>
                            {selectedPayrollRunId === run.id && (
                              <div className="text-xs font-medium text-blue-700 mb-2">
                                المسير المحدد الآن
                              </div>
                            )}
                            <div className="text-sm text-gray-600">
                              {getPayrollRunDisplayName(
                                run.scope_type,
                                run.scope_id,
                                run.payroll_month
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              طريقة الإدخال: {getPayrollInputModeText(run.input_mode)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {run.entry_count} موظف • صافي{' '}
                              {run.total_net_amount.toLocaleString('en-US')}
                            </div>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div
                  ref={payrollDetailsPanelRef}
                  className="xl:col-span-3 border border-border-200 rounded-lg overflow-hidden bg-surface"
                >
                  <div className="px-4 py-3 bg-gray-50 border-b border-border-200 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-800">تفاصيل المسير</div>
                      {selectedPayrollRun && (
                        <div className="text-sm text-gray-500 mt-1">
                          {getPayrollRunDisplayName(
                            selectedPayrollRun.scope_type,
                            selectedPayrollRun.scope_id,
                            selectedPayrollRun.payroll_month
                          )}{' '}
                          • {selectedPayrollRun.entry_count} موظف
                        </div>
                      )}
                      {selectedPayrollRun && (
                        <div className="text-xs text-gray-500 mt-1">
                          قسائم الرواتب المولدة: {payrollSlips.length} • طريقة الإدخال:{' '}
                          {getPayrollInputModeText(selectedPayrollRun.input_mode)}
                        </div>
                      )}
                      {selectedPayrollRun && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${selectedPayrollRun.status === 'finalized' ? 'bg-green-100 text-green-700' : selectedPayrollRun.status === 'draft' ? 'bg-orange-100 text-orange-700' : selectedPayrollRun.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}
                          >
                            حالة المسير: {getPayrollStatusText(selectedPayrollRun.status)}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            الإدخال: {getPayrollInputModeText(selectedPayrollRun.input_mode)}
                          </span>
                          {selectedPayrollRunEditable &&
                            scopedPayrollEmployees.length === 0 &&
                            !scopedEmployeesLoading && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                لا يوجد موظفون ضمن هذا النطاق حاليًا
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                    {selectedPayrollRun && isAdmin && (
                      <div className="flex flex-wrap items-center justify-end gap-2 max-w-xl">
                        <input
                          ref={payrollExcelInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={handlePayrollExcelImport}
                        />
                        <button
                          type="button"
                          onClick={handleRefreshPayrollData}
                          className={outlineCompactButtonClass}
                        >
                          <RefreshCw className="w-4 h-4" />
                          تحديث المسير
                        </button>
                        <button
                          onClick={() => {
                            if (showPayrollEntryForm) {
                              setShowPayrollEntryForm(false)
                              return
                            }
                            handleOpenPayrollEntryForm()
                          }}
                          className={`${primaryCompactButtonClass} disabled:bg-surface-secondary-200 disabled:text-foreground-tertiary disabled:border disabled:border-border-200`}
                          disabled={
                            !selectedPayrollRunEditable ||
                            scopedEmployeesLoading ||
                            scopedPayrollEmployees.length === 0
                          }
                          title={
                            selectedPayrollRun?.status === 'cancelled'
                              ? 'هذا المسير ملغي ويجب إعادة فتحه أولًا'
                              : scopedPayrollEmployees.length === 0
                                ? 'لا يوجد موظفون داخل نطاق المسير الحالي'
                                : undefined
                          }
                        >
                          <Plus className="w-4 h-4" />
                          {showPayrollEntryForm ? 'إخفاء النموذج' : 'إدخال راتب يدوي'}
                        </button>
                        {selectedPayrollRunEditable && (
                          <button
                            type="button"
                            onClick={downloadPayrollTemplate}
                            className={slateCompactButtonClass}
                          >
                            <Download className="w-4 h-4" />
                            قالب Excel
                          </button>
                        )}
                        {canExport('payroll') && payrollEntries.length > 0 && (
                          <button
                            type="button"
                            onClick={exportPayrollToExcel}
                            className={`${successCompactButtonClass} bg-emerald-600 hover:bg-emerald-700`}
                          >
                            <Download className="w-4 h-4" />
                            تصدير كشف المسير
                          </button>
                        )}
                        {selectedPayrollRunEditable && (
                          <button
                            type="button"
                            onClick={handleOpenPayrollExcelImport}
                            className={indigoCompactButtonClass}
                            disabled={
                              importingPayrollExcel ||
                              confirmingPayrollExcelImport ||
                              scopedPayrollEmployees.length === 0
                            }
                          >
                            {importingPayrollExcel ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileUp className="w-4 h-4" />
                            )}
                            استيراد Excel
                          </button>
                        )}
                        {selectedPayrollRunEditable && (
                          <button
                            onClick={() => handleUpdatePayrollRunStatus('finalized')}
                            className={successCompactButtonClass}
                            disabled={updatePayrollRunStatus.isPending}
                          >
                            {updatePayrollRunStatus.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ReceiptText className="w-4 h-4" />
                            )}
                            اعتماد المسير
                          </button>
                        )}
                        {selectedPayrollRun.status === 'finalized' && (
                          <button
                            onClick={() => handleUpdatePayrollRunStatus('draft')}
                            className={orangeCompactButtonClass}
                            disabled={updatePayrollRunStatus.isPending}
                          >
                            {updatePayrollRunStatus.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            إعادة إلى مسودة
                          </button>
                        )}
                        {selectedPayrollRun.status === 'cancelled' && (
                          <button
                            onClick={() => handleUpdatePayrollRunStatus('draft')}
                            className={warningCompactButtonClass}
                            disabled={updatePayrollRunStatus.isPending}
                          >
                            {updatePayrollRunStatus.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            إعادة فتح المسير
                          </button>
                        )}
                        {selectedPayrollRun.status === 'cancelled' && canDelete('payroll') && (
                          <button
                            onClick={handleDeletePayrollRun}
                            className={dangerCompactButtonClass}
                            disabled={deletePayrollRun.isPending}
                          >
                            {deletePayrollRun.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            حذف المسير
                          </button>
                        )}
                        {selectedPayrollRun.status !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdatePayrollRunStatus('cancelled')}
                            className={dangerCompactButtonClass}
                            disabled={updatePayrollRunStatus.isPending}
                          >
                            {updatePayrollRunStatus.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                            إلغاء المسير
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedPayrollRun && showPayrollEntryForm && isAdmin && (
                    <div
                      ref={payrollEntryFormRef}
                      className="p-4 border-b border-border-200 bg-blue-50 space-y-4"
                    >
                      <div className="rounded-lg border border-blue-200 bg-surface px-4 py-3 text-sm text-gray-700">
                        أدخل راتب الموظف يدويًا داخل المسير الحالي. إذا كان لهذا الموظف مدخل سابق في
                        نفس المسير، فالحفظ سيقوم بالتحديث بدل إنشاء سجل مكرر.
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            الموظف
                          </label>
                          <select
                            value={payrollEntryForm.employee_id}
                            onChange={(e) => {
                              const employee = scopedPayrollEmployees.find(
                                (item) => item.id === e.target.value
                              )
                              setPayrollEntryForm((current) => ({
                                ...current,
                                employee_id: e.target.value,
                                basic_salary_snapshot: Number(employee?.salary || 0),
                                transfer_renewal_amount: 0,
                                penalty_amount: 0,
                                advance_amount: employee?.suggested_installment_amount ?? 0,
                                other_amount: 0,
                                installment_deducted_amount:
                                  employee?.suggested_installment_amount ?? 0,
                              }))
                            }}
                            className="w-full px-3 py-2 border rounded-md"
                            disabled={scopedEmployeesLoading}
                          >
                            <option value="">اختر...</option>
                            {scopedPayrollEmployees.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.name} - {employee.residence_number}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            أيام الحضور
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={payrollEntryForm.attendance_days}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                attendance_days: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            الإجازات المدفوعة
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={payrollEntryForm.paid_leave_days}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                paid_leave_days: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            الراتب الأساسي
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={payrollEntryForm.basic_salary_snapshot}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                basic_salary_snapshot: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            الإضافي
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={payrollEntryForm.overtime_amount}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                overtime_amount: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            قسط رسوم نقل وتجديد
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={payrollEntryForm.transfer_renewal_amount}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                transfer_renewal_amount: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            قسط جزاءات وغرامات
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={payrollEntryForm.penalty_amount}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                penalty_amount: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            قسط سلفة
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={payrollEntryForm.advance_amount}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                advance_amount: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            قسط أخرى
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={payrollEntryForm.other_amount}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                other_amount: Number(e.target.value) || 0,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            الأجر اليومي
                          </label>
                          <div className="w-full px-3 py-2 border rounded-md bg-surface text-gray-700">
                            {dailyRate.toLocaleString('en-US')}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ملاحظات الإضافي
                          </label>
                          <input
                            type="text"
                            value={payrollEntryForm.overtime_notes}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                overtime_notes: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ملاحظات الاستقطاعات
                          </label>
                          <input
                            type="text"
                            value={payrollEntryForm.deductions_notes}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                deductions_notes: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ملاحظات عامة
                          </label>
                          <input
                            type="text"
                            value={payrollEntryForm.notes}
                            onChange={(e) =>
                              setPayrollEntryForm((current) => ({
                                ...current,
                                notes: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-surface border border-border-200 rounded-lg p-3">
                          <div className="text-sm text-gray-500 mb-1">إجمالي الراتب</div>
                          <div className="text-lg font-bold text-gray-900">
                            {grossAmount.toLocaleString('en-US')}
                          </div>
                        </div>
                        <div className="bg-surface border border-border-200 rounded-lg p-3">
                          <div className="text-sm text-gray-500 mb-1">إجمالي الاستقطاعات</div>
                          <div className="text-lg font-bold text-red-600">
                            {groupedDeductionsTotal.toLocaleString('en-US')}
                          </div>
                        </div>
                        <div className="bg-surface border border-border-200 rounded-lg p-3">
                          <div className="text-sm text-gray-500 mb-1">الصافي</div>
                          <div
                            className={`text-lg font-bold ${netAmount < 0 ? 'text-red-600' : 'text-blue-700'}`}
                          >
                            {netAmount.toLocaleString('en-US')}
                          </div>
                        </div>
                        <div className="bg-surface border border-border-200 rounded-lg p-3">
                          <div className="text-sm text-gray-500 mb-1">اقتراح الأقساط</div>
                          <div className="text-lg font-bold text-orange-600">
                            {(
                              selectedPayrollEmployee?.suggested_installment_amount ?? 0
                            ).toLocaleString('en-US')}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setShowPayrollEntryForm(false)}
                          className={outlineCompactButtonClass}
                          disabled={upsertPayrollEntry.isPending}
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={handleUpsertPayrollEntry}
                          className={successCompactButtonClass}
                          disabled={upsertPayrollEntry.isPending}
                        >
                          {upsertPayrollEntry.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ReceiptText className="w-4 h-4" />
                          )}
                          حفظ راتب الموظف
                        </button>
                      </div>
                    </div>
                  )}

                  {!selectedPayrollRun ? (
                    <div className="p-8 text-center text-gray-500">اختر مسيرًا لعرض التفاصيل.</div>
                  ) : payrollEntriesLoading ? (
                    <div className="p-8 text-center text-gray-500">جاري تحميل كشف الرواتب...</div>
                  ) : payrollEntries.length === 0 ? (
                    <div className="p-8 bg-surface-secondary-50 border-t border-border-100">
                      <div className="max-w-lg mx-auto text-center space-y-4">
                        <div
                          className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ${selectedPayrollRun.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}
                        >
                          {selectedPayrollRun.status === 'cancelled' ? (
                            <AlertTriangle className="w-7 h-7" />
                          ) : (
                            <Wallet className="w-7 h-7" />
                          )}
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-foreground">
                            {selectedPayrollRun.status === 'cancelled'
                              ? 'هذا المسير ملغي حاليًا'
                              : 'المسير المحدد جاهز لإدخال الرواتب'}
                          </h3>
                          <p className="text-sm text-foreground-secondary">
                            {selectedPayrollRun.status === 'cancelled'
                              ? 'هذا المسير ملغي حاليًا، لذلك لا يمكن إدخال رواتب أو استيراد بيانات بداخله حتى إعادة فتحه.'
                              : 'أنت الآن داخل تفاصيل هذا المسير. لا توجد مدخلات رواتب بعد، ويمكنك إضافة أول راتب يدويًا أو استيراد كشف كامل من Excel.'}
                          </p>
                        </div>
                        {selectedPayrollRun.status !== 'cancelled' && (
                          <div className="rounded-xl border border-border-200 bg-surface px-4 py-3 text-right">
                            <div className="text-sm font-semibold text-foreground mb-2">
                              للبدء السريع:
                            </div>
                            <div className="space-y-1 text-sm text-foreground-secondary">
                              <p>
                                1. اضغط على زر إدخال راتب يدوي لإضافة راتب أول موظف داخل هذا المسير.
                              </p>
                              <p>2. أو اضغط على استيراد من Excel إذا كان لديك كشف جاهز.</p>
                              <p>3. بعد الحفظ سيظهر الموظف في جدول تفاصيل المسير أسفل هذا القسم.</p>
                            </div>
                          </div>
                        )}
                        {selectedPayrollRunEditable &&
                          isAdmin &&
                          scopedPayrollEmployees.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={handleOpenPayrollEntryForm}
                                className={primaryCompactButtonClass}
                              >
                                <Plus className="w-4 h-4" />
                                إدخال راتب يدوي
                              </button>
                              <button
                                type="button"
                                onClick={handleOpenPayrollExcelImport}
                                className={indigoCompactButtonClass}
                                disabled={
                                  importingPayrollExcel ||
                                  confirmingPayrollExcelImport ||
                                  scopedPayrollEmployees.length === 0
                                }
                              >
                                <FileUp className="w-4 h-4" />
                                استيراد من Excel
                              </button>
                            </div>
                          )}
                        {selectedPayrollRunEditable &&
                          isAdmin &&
                          scopedPayrollEmployees.length === 0 &&
                          !scopedEmployeesLoading && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                              لا يوجد موظفون داخل نطاق هذا المسير حاليًا، لذلك تم تعطيل الإدخال
                              اليدوي والاستيراد حتى إضافة موظفين لهذا النطاق أولًا.
                            </div>
                          )}
                        <div className="text-xs text-foreground-tertiary">
                          الموظفون المتاحون داخل نطاق هذا المسير: {scopedPayrollEmployees.length}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-right">الموظف</th>
                            <th className="px-4 py-3 text-right">الإقامة</th>
                            <th className="px-4 py-3 text-right">إجمالي</th>
                            <th className="px-4 py-3 text-right">نقل/تجديد</th>
                            <th className="px-4 py-3 text-right">جزاءات</th>
                            <th className="px-4 py-3 text-right">سلفة</th>
                            <th className="px-4 py-3 text-right">أخرى</th>
                            <th className="px-4 py-3 text-right">الصافي</th>
                            <th className="px-4 py-3 text-right">الحالة</th>
                            <th className="px-4 py-3 text-right">الإجراءات</th>
                            <th className="px-4 py-3 text-right">القسيمة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollEntries.map((entry) => {
                            const rowBreakdown = normalizePayrollObligationBreakdown(
                              payrollEntryBreakdownById.get(entry.id) ?? {
                                ...EMPTY_PAYROLL_OBLIGATION_BREAKDOWN,
                                penalty: Number(entry.deductions_amount || 0),
                                advance: Number(entry.installment_deducted_amount || 0),
                              }
                            )

                            return (
                              <tr key={entry.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {entry.employee_name_snapshot}
                                </td>
                                <td className="px-4 py-3">{entry.residence_number_snapshot}</td>
                                <td className="px-4 py-3">
                                  {entry.gross_amount.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3">
                                  {rowBreakdown.transfer_renewal.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3">
                                  {rowBreakdown.penalty.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3">
                                  {rowBreakdown.advance.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3">
                                  {rowBreakdown.other.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3 font-semibold text-blue-700">
                                  {entry.net_amount.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-border-200">
                                    {getPayrollStatusText(entry.entry_status)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {selectedPayrollRunEditable && isAdmin ? (
                                    <button
                                      type="button"
                                      onClick={() => handleEditPayrollEntry(entry)}
                                      className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                                    >
                                      تعديل
                                    </button>
                                  ) : (
                                    <span className="text-xs text-foreground-tertiary">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {payrollSlipEntryIds.has(entry.id) ? (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPayrollSlipEntryId(entry.id)}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border bg-green-100 text-green-700 border-green-200 hover:bg-green-200 transition"
                                    >
                                      <Eye className="w-3 h-3" />
                                      عرض القسيمة
                                    </button>
                                  ) : (
                                    <span className="px-2 py-1 rounded-full text-xs border bg-gray-100 text-gray-600 border-border-200">
                                      غير مولدة
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedPayrollRun && selectedPayrollRunEditable && (
                    <div className="border-t border-border-200 bg-surface-secondary-50 px-4 py-4">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="lg:max-w-sm">
                          <h3 className="font-semibold text-foreground mb-1">
                            استيراد الرواتب من Excel
                          </h3>
                          <p className="text-sm text-foreground-secondary">
                            ابدأ بالقالب الجاهز، ثم ارفع الملف وراجع الصفوف قبل الاعتماد النهائي
                            داخل نفس المسير.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                          <div className="rounded-lg border border-border-200 bg-surface px-3 py-2 text-sm text-foreground-secondary">
                            1. نزّل القالب وأبقِ رقم الإقامة موجودًا في كل صف.
                          </div>
                          <div className="rounded-lg border border-border-200 bg-surface px-3 py-2 text-sm text-foreground-secondary">
                            2. اترك أي عمود غير متوفر فارغًا وسيتم اعتباره صفرًا أو ملاحظة فارغة.
                          </div>
                          <div className="rounded-lg border border-border-200 bg-surface px-3 py-2 text-sm text-foreground-secondary">
                            3. راجع المعاينة قبل الاعتماد لتجنب إدخال بيانات غير مطابقة.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {payrollImportPreviewRows.length > 0 && (
                    <div className="border-t border-border-200 bg-blue-50 px-4 py-4 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-blue-900">معاينة استيراد الرواتب</h3>
                          <p className="text-sm text-blue-700 mt-1">
                            الملف: {payrollImportFileName || 'Excel'} • الصفوف الجاهزة للاعتماد:{' '}
                            {payrollImportPreviewRows.length}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleClearPayrollImportPreview}
                            className={outlineCompactButtonClass}
                            disabled={confirmingPayrollExcelImport}
                          >
                            إلغاء المعاينة
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmPayrollExcelImport}
                            className={primaryCompactButtonClass}
                            disabled={confirmingPayrollExcelImport}
                          >
                            {confirmingPayrollExcelImport ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            اعتماد الاستيراد
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-blue-200 bg-surface">
                        <table className="w-full text-sm">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="px-4 py-3 text-right">الصف</th>
                              <th className="px-4 py-3 text-right">الموظف</th>
                              <th className="px-4 py-3 text-right">الإقامة</th>
                              <th className="px-4 py-3 text-right">الحضور</th>
                              <th className="px-4 py-3 text-right">الإضافي</th>
                              <th className="px-4 py-3 text-right">الخصومات</th>
                              <th className="px-4 py-3 text-right">الأقساط</th>
                              <th className="px-4 py-3 text-right">الإجمالي</th>
                              <th className="px-4 py-3 text-right">الصافي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payrollImportPreviewRows.map((row) => (
                              <tr
                                key={`${row.employee_id}-${row.row_number}`}
                                className="border-t border-blue-100"
                              >
                                <td className="px-4 py-3">{row.row_number}</td>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {row.employee_name}
                                </td>
                                <td className="px-4 py-3">{row.residence_number}</td>
                                <td className="px-4 py-3">{row.attendance_days}</td>
                                <td className="px-4 py-3">
                                  {row.overtime_amount.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3">
                                  {row.deductions_amount.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3">
                                  {row.installment_deducted_amount.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3">
                                  {row.gross_amount.toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3 font-semibold text-blue-700">
                                  {row.net_amount.toLocaleString('en-US')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {payrollImportHeaderError && (
                    <div className="border-t border-border-200 bg-amber-50 px-4 py-4">
                      <h3 className="font-semibold text-amber-900 mb-2">مشكلة في رأس ملف Excel</h3>
                      <p className="text-sm text-amber-800">{payrollImportHeaderError}</p>
                    </div>
                  )}

                  {payrollImportErrors.length > 0 && (
                    <div className="border-t border-border-200 bg-red-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-semibold text-red-900">أخطاء استيراد الرواتب</h3>
                          <p className="text-sm text-red-700 mt-1">
                            تم استيراد بعض الصفوف، لكن الصفوف التالية تحتاج تصحيحًا قبل إعادة الرفع.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPayrollImportErrors([])}
                          className={outlineCompactButtonClass}
                        >
                          إخفاء
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-surface">
                        <ul className="divide-y divide-red-100 text-sm text-red-800">
                          {payrollImportErrors.map((error, index) => (
                            <li key={`${error}-${index}`} className="px-4 py-3">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {payrollRunDeleteConfirmOpen && selectedPayrollRun && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-secondary-950/55 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-border-200 bg-surface shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">تأكيد حذف المسير</h2>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    {getPayrollRunDisplayName(
                      selectedPayrollRun.scope_type,
                      selectedPayrollRun.scope_id,
                      selectedPayrollRun.payroll_month
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayrollRunDeleteConfirmOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-200 text-foreground-tertiary transition hover:bg-surface-secondary-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 px-5 py-4">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  سيتم حذف هذا المسير وكل الرواتب المرتبطة به نهائيًا.
                </div>
                <p className="text-sm text-foreground-secondary">إذا كنت متأكدًا، اضغط على تأكيد الحذف.</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setPayrollRunDeleteConfirmOpen(false)}
                  className={outlineCompactButtonClass}
                  disabled={deletePayrollRun.isPending}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePayrollRun}
                  className={dangerCompactButtonClass}
                  disabled={deletePayrollRun.isPending}
                >
                  {deletePayrollRun.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedPayrollSlip && selectedSlipEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="app-modal-surface w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="app-modal-header flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">معاينة قسيمة الراتب</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedPayrollSlip.slip_number} •{' '}
                    {selectedSlipEntry.employee_name_snapshot || 'موظف'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayrollSlipEntryId(null)}
                  className="px-4 py-2 border border-border-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  إغلاق
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadPayrollSlipPdf}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
                  >
                    <Download className="w-4 h-4" />
                    تنزيل PDF
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintPayrollSlip}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                  >
                    <ReceiptText className="w-4 h-4" />
                    طباعة القسيمة
                  </button>
                </div>

                <div ref={payrollSlipPreviewRef} className="space-y-6 bg-surface">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-border-200 bg-gray-50 p-4">
                      <div className="text-sm text-gray-500 mb-1">الموظف</div>
                      <div className="font-semibold text-gray-900">
                        {selectedSlipEntry.employee_name_snapshot || '-'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border-200 bg-gray-50 p-4">
                      <div className="text-sm text-gray-500 mb-1">رقم الإقامة</div>
                      <div className="font-semibold text-gray-900">
                        {selectedSlipEntry.residence_number_snapshot || '-'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border-200 bg-gray-50 p-4">
                      <div className="text-sm text-gray-500 mb-1">تاريخ التوليد</div>
                      <div className="font-semibold text-gray-900">
                        {selectedPayrollSlip.generated_at
                          ? new Date(selectedPayrollSlip.generated_at).toLocaleString('en-GB')
                          : '-'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border-200 bg-gray-50 p-4">
                      <div className="text-sm text-gray-500 mb-1">نسخة القالب</div>
                      <div className="font-semibold text-gray-900">
                        {selectedPayrollSlip.template_version}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-sm text-blue-700 mb-1">إجمالي الراتب</div>
                      <div className="text-xl font-bold text-blue-900">
                        {Number(
                          selectedSlipTotals?.grossAmount || selectedSlipEntry.gross_amount || 0
                        ).toLocaleString('en-US')}
                      </div>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="text-sm text-red-700 mb-1">الخصومات</div>
                      <div className="text-xl font-bold text-red-900">
                        {Number(selectedSlipEntry.deductions_amount || 0).toLocaleString('en-US')}
                      </div>
                    </div>
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <div className="text-sm text-orange-700 mb-1">خصم الأقساط</div>
                      <div className="text-xl font-bold text-orange-900">
                        {Number(selectedSlipEntry.installment_deducted_amount || 0).toLocaleString(
                          'en-US'
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <div className="text-sm text-green-700 mb-1">صافي الراتب</div>
                      <div className="text-xl font-bold text-green-900">
                        {Number(
                          selectedSlipTotals?.netAmount || selectedSlipEntry.net_amount || 0
                        ).toLocaleString('en-US')}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-border-200 font-medium text-gray-800">
                      تفاصيل مكونات القسيمة
                    </div>
                    {selectedSlipComponents.length === 0 ? (
                      <div className="p-6 text-sm text-gray-500 text-center">
                        لا توجد مكونات تفصيلية محفوظة لهذه القسيمة.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-right">النوع</th>
                              <th className="px-4 py-3 text-right">الكود</th>
                              <th className="px-4 py-3 text-right">المبلغ</th>
                              <th className="px-4 py-3 text-right">الملاحظات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSlipComponents.map((component, index) => (
                              <tr
                                key={`${component.component_code || 'component'}-${index}`}
                                className="border-t"
                              >
                                <td className="px-4 py-3">{component.component_type || '-'}</td>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {component.component_code || '-'}
                                </td>
                                <td className="px-4 py-3">
                                  {Number(component.amount || 0).toLocaleString('en-US')}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {component.notes || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
