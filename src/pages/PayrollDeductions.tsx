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
  ClipboardList,
  UserPlus,
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
  type ScopedPayrollEmployee,
} from '@/hooks/usePayroll'
import {
  useAllObligationsSummary,
  useCreateEmployeeObligationPlan,
  useEmployeeObligations,
  useUpdateObligationLinePayment,
  type AllObligationsSummaryRow,
} from '@/hooks/useEmployeeObligations'
import { useEmployees } from '@/hooks/useEmployees'
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

interface PayrollRunSeedRow {
  employee_id: string
  employee_name: string
  residence_number: string
  included: boolean
  attendance_days: number
  paid_leave_days: number
  basic_salary_snapshot: number
  overtime_amount: number
  transfer_renewal_amount: number
  penalty_amount: number
  advance_amount: number
  other_amount: number
  overtime_notes: string
  deductions_notes: string
  notes: string
}

function buildPayrollRunSeedRow(employee: ScopedPayrollEmployee): PayrollRunSeedRow {
  const suggestedBreakdown = normalizePayrollObligationBreakdown(
    employee.suggested_deduction_breakdown
  )

  return {
    employee_id: employee.id,
    employee_name: employee.name,
    residence_number: normalizeResidenceNumber(employee.residence_number),
    included: true,
    attendance_days: 30,
    paid_leave_days: 0,
    basic_salary_snapshot: Number(employee.salary || 0),
    overtime_amount: 0,
    transfer_renewal_amount: suggestedBreakdown.transfer_renewal,
    penalty_amount: suggestedBreakdown.penalty,
    advance_amount: suggestedBreakdown.advance,
    other_amount: suggestedBreakdown.other,
    overtime_notes: '',
    deductions_notes: '',
    notes: '',
  }
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
  const [activePageTab, setActivePageTab] = useState<'search' | 'runs' | 'obligations'>('search')
  const [obligationsSearchQuery, setObligationsSearchQuery] = useState('')
  const [showAddObligationDialog, setShowAddObligationDialog] = useState(false)
  const [addObligationEmployeeSearch, setAddObligationEmployeeSearch] = useState('')
  const [addObligationSelectedEmployeeId, setAddObligationSelectedEmployeeId] = useState('')
  const [addObligationForm, setAddObligationForm] = useState({
    obligation_type: 'advance' as 'transfer' | 'renewal' | 'penalty' | 'advance' | 'other',
    total_amount: 0,
    installment_count: 1,
    start_month: new Date().toISOString().slice(0, 7),
    notes: '',
  })
  const [exportingObligations, setExportingObligations] = useState(false)
  // Obligation detail/edit modal
  const [obligationDetailEmployeeId, setObligationDetailEmployeeId] = useState<string | null>(null)
  const [editingObligationLineId, setEditingObligationLineId] = useState<string | null>(null)
  const [obligationPaymentForm, setObligationPaymentForm] = useState({
    amount_paid: 0,
    notes: '',
  })
  const [showPayrollRunForm, setShowPayrollRunForm] = useState(false)
  const [showPayrollEntryForm, setShowPayrollEntryForm] = useState(false)
  const [showPayrollRunDetailsModal, setShowPayrollRunDetailsModal] = useState(false)
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
  const hasInitializedPayrollRunSelectionRef = useRef(false)
  const [payrollForm, setPayrollForm] = useState({
    payroll_month: new Date().toISOString().slice(0, 7),
    scope_type: 'company' as PayrollScopeType,
    scope_id: '',
    input_mode: 'manual' as PayrollInputMode,
    notes: '',
  })
  const [newPayrollRunRows, setNewPayrollRunRows] = useState<PayrollRunSeedRow[]>([])
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
  const createObligationPlan = useCreateEmployeeObligationPlan()
  const updateObligationLinePayment = useUpdateObligationLinePayment()
  const { data: allObligationsSummary = [], isLoading: obligationsLoading, refetch: refetchObligations } =
    useAllObligationsSummary()
  const { data: allEmployees = [] } = useEmployees()

  // Fetch obligation plans for the employee currently open in the detail modal
  const { data: detailObligationPlans = [], isLoading: detailObligationsLoading } =
    useEmployeeObligations(obligationDetailEmployeeId ?? undefined)

  const payrollRunList = payrollRuns
  const selectedPayrollRun = payrollRunList.find((run) => run.id === selectedPayrollRunId) ?? null
  const normalizedPayrollFormMonth = payrollForm.payroll_month
    ? `${payrollForm.payroll_month}-01`
    : undefined
  const { data: payrollRunSeedEmployees = [], isLoading: payrollRunSeedEmployeesLoading } =
    useScopedPayrollEmployees(
      payrollForm.scope_type,
      payrollForm.scope_id || undefined,
      normalizedPayrollFormMonth
    )
  const { data: scopedPayrollEmployees = [], isLoading: scopedEmployeesLoading } =
    useScopedPayrollEmployees(
      selectedPayrollRun?.scope_type,
      selectedPayrollRun?.scope_id,
      selectedPayrollRun?.payroll_month
    )
  const scopeOptions = payrollForm.scope_type === 'company' ? companies : projects
  const selectedPayrollEmployee =
    scopedPayrollEmployees.find((employee) => employee.id === payrollEntryForm.employee_id) ?? null
  const selectedNewPayrollRunRows = useMemo(
    () => newPayrollRunRows.filter((row) => row.included),
    [newPayrollRunRows]
  )
  const allNewPayrollRunRowsSelected =
    newPayrollRunRows.length > 0 && selectedNewPayrollRunRows.length === newPayrollRunRows.length
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

  // ─── Obligations Tab: filtered rows ───────────────────────────────────────
  const filteredObligationsSummary = useMemo((): AllObligationsSummaryRow[] => {
    const q = obligationsSearchQuery.trim().toLowerCase()
    if (!q) return allObligationsSummary
    return allObligationsSummary.filter(
      (row) =>
        row.employee_name.toLowerCase().includes(q) ||
        row.residence_number.includes(q) ||
        row.project_name.toLowerCase().includes(q) ||
        row.company_name.toLowerCase().includes(q)
    )
  }, [allObligationsSummary, obligationsSearchQuery])

  // Employee list for the add-obligation dialog (search by name or residence_number)
  const dialogEmployeeOptions = useMemo(() => {
    const q = addObligationEmployeeSearch.trim().toLowerCase()
    if (!q) return allEmployees.slice(0, 30)
    return allEmployees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        String(emp.residence_number || '').includes(addObligationEmployeeSearch.trim())
    )
  }, [allEmployees, addObligationEmployeeSearch])

  const handleAddObligation = async () => {
    if (!addObligationSelectedEmployeeId) {
      toast.error('يرجى اختيار موظف أولاً')
      return
    }
    if (addObligationForm.total_amount <= 0) {
      toast.error('يرجى إدخال قيمة الالتزام')
      return
    }
    if (addObligationForm.installment_count <= 0) {
      toast.error('عدد الأقساط يجب أن يكون 1 على الأقل')
      return
    }
    try {
      const perInstallment =
        Math.round((addObligationForm.total_amount / addObligationForm.installment_count) * 100) /
        100
      const amounts = Array.from(
        { length: addObligationForm.installment_count },
        (_, i) =>
          i === addObligationForm.installment_count - 1
            ? Math.round(
                (addObligationForm.total_amount - perInstallment * (addObligationForm.installment_count - 1)) * 100
              ) / 100
            : perInstallment
      )
      const normalizedStartMonth = /^\d{4}-\d{2}$/.test(addObligationForm.start_month)
        ? `${addObligationForm.start_month}-01`
        : addObligationForm.start_month

      await createObligationPlan.mutateAsync({
        employee_id: addObligationSelectedEmployeeId,
        obligation_type: addObligationForm.obligation_type,
        total_amount: addObligationForm.total_amount,
        start_month: normalizedStartMonth,
        installment_amounts: amounts,
        notes: addObligationForm.notes || null,
      })
      toast.success('تم إضافة الالتزام بنجاح')
      setShowAddObligationDialog(false)
      setAddObligationSelectedEmployeeId('')
      setAddObligationEmployeeSearch('')
      setAddObligationForm({
        obligation_type: 'advance',
        total_amount: 0,
        installment_count: 1,
        start_month: new Date().toISOString().slice(0, 7),
        notes: '',
      })
      void refetchObligations()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل إضافة الالتزام'
      toast.error(msg)
    }
  }

  const exportObligationsToExcel = async () => {
    if (filteredObligationsSummary.length === 0) {
      toast.warning('لا توجد بيانات التزامات للتصدير')
      return
    }
    try {
      setExportingObligations(true)
      const XLSX = await loadXlsx()
      const employeeIds = filteredObligationsSummary.map((row) => row.employee_id)
      const monthSet = new Set<string>()
      const monthlyDueByEmployee = new Map<string, Map<string, number>>()
      const totalObligationsByEmployee = new Map<string, number>()
      const totalPaidByEmployee = new Map<string, number>()

      const { data: obligationHeaders, error: obligationHeadersError } = await supabase
        .from('employee_obligation_headers')
        .select('id,employee_id,status,total_amount')
        .in('employee_id', employeeIds)
        .in('status', ['active', 'draft'])

      if (obligationHeadersError) {
        throw obligationHeadersError
      }

      const typedHeaders =
        (obligationHeaders ?? []) as Array<{
          id: string
          employee_id: string
          status: string
          total_amount: number
        }>
      const headerIds = typedHeaders.map((header) => header.id)

      for (const header of typedHeaders) {
        totalObligationsByEmployee.set(
          header.employee_id,
          (totalObligationsByEmployee.get(header.employee_id) ?? 0) + Number(header.total_amount || 0)
        )
      }

      if (headerIds.length > 0) {
        const { data: obligationLines, error: obligationLinesError } = await supabase
          .from('employee_obligation_lines')
          .select('header_id,employee_id,due_month,amount_due,amount_paid')
          .in('header_id', headerIds)

        if (obligationLinesError) {
          throw obligationLinesError
        }

        const typedLines = (obligationLines ?? []) as Array<{
          header_id: string
          employee_id: string
          due_month: string
          amount_due: number
          amount_paid: number
        }>

        for (const line of typedLines) {
          const monthKey = line.due_month?.slice(0, 7)
          if (!monthKey) continue
          monthSet.add(monthKey)

          const employeeMonthMap =
            monthlyDueByEmployee.get(line.employee_id) ?? new Map<string, number>()
          employeeMonthMap.set(
            monthKey,
            (employeeMonthMap.get(monthKey) ?? 0) + Number(line.amount_due || 0)
          )
          monthlyDueByEmployee.set(line.employee_id, employeeMonthMap)

          totalPaidByEmployee.set(
            line.employee_id,
            (totalPaidByEmployee.get(line.employee_id) ?? 0) + Number(line.amount_paid || 0)
          )
        }
      }

      const sortedMonths = Array.from(monthSet).sort((a, b) => a.localeCompare(b))

      const headers = [
        'اسم الموظف',
        'رقم الإقامة',
        'المشروع',
        'المؤسسة',
        'إجمالي الالتزامات',
        'إجمالي المدفوع',
        'نقل كفالة (المتبقي)',
        'تجديد (المتبقي)',
        'جزاءات (المتبقي)',
        'سلف (المتبقي)',
        'أخرى (المتبقي)',
        'إجمالي المتبقي',
        ...sortedMonths.map((month) => `قسط ${month}`),
      ]
      const rows = filteredObligationsSummary.map((row) => [
        row.employee_name,
        row.residence_number,
        row.project_name,
        row.company_name,
        totalObligationsByEmployee.get(row.employee_id) ?? 0,
        totalPaidByEmployee.get(row.employee_id) ?? 0,
        row.transfer_remaining,
        row.renewal_remaining,
        row.penalty_remaining,
        row.advance_remaining,
        row.other_remaining,
        row.total_remaining,
        ...sortedMonths.map(
          (month) => monthlyDueByEmployee.get(row.employee_id)?.get(month) ?? 0
        ),
      ])
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['قائمة الالتزامات والاستقطاعات'],
        [`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],
        [],
        headers,
        ...rows,
      ])
      const lastColumnIndex = headers.length - 1
      worksheet['!cols'] = [
        { wch: 24 },
        { wch: 16 },
        { wch: 20 },
        { wch: 20 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        ...sortedMonths.map(() => ({ wch: 14 })),
      ]
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } },
      ]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Obligations')
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      saveAs(blob, `obligations_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('تم تصدير قائمة الالتزامات بنجاح')
    } catch (err) {
      console.error(err)
      toast.error('فشل تصدير الالتزامات')
    } finally {
      setExportingObligations(false)
    }
  }

  const handleOpenObligationDetail = (employeeId: string) => {
    setObligationDetailEmployeeId(employeeId)
    setEditingObligationLineId(null)
    setObligationPaymentForm({ amount_paid: 0, notes: '' })
  }

  const handleCloseObligationDetail = () => {
    setObligationDetailEmployeeId(null)
    setEditingObligationLineId(null)
    setObligationPaymentForm({ amount_paid: 0, notes: '' })
  }

  const handleStartEditObligationLine = (
    lineId: string,
    amountPaid: number,
    notes?: string | null
  ) => {
    setEditingObligationLineId(lineId)
    setObligationPaymentForm({ amount_paid: amountPaid, notes: notes || '' })
  }

  const handleSaveObligationLinePayment = async (lineId: string, amountDue: number) => {
    if (!obligationDetailEmployeeId) return
    const amountPaid = Number(obligationPaymentForm.amount_paid)
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      toast.error('قيمة المدفوع يجب أن تكون صفراً أو أكبر')
      return
    }
    if (amountPaid > amountDue) {
      toast.error('قيمة المدفوع لا يمكن أن تتجاوز قيمة القسط')
      return
    }
    try {
      await updateObligationLinePayment.mutateAsync({
        lineId,
        employeeId: obligationDetailEmployeeId,
        amount_paid: amountPaid,
        notes: obligationPaymentForm.notes.trim() || null,
      })
      toast.success('تم تحديث سداد القسط بنجاح')
      setEditingObligationLineId(null)
      setObligationPaymentForm({ amount_paid: 0, notes: '' })
      void refetchObligations()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل تحديث السداد')
    }
  }

  const compactButtonBaseClass =
    'h-9 px-3 text-sm font-medium rounded-lg transition inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed'
  const outlineCompactButtonClass = `${compactButtonBaseClass} bg-surface border border-border-300 text-foreground-secondary hover:bg-surface-secondary-50`
  const primaryCompactButtonClass = `${compactButtonBaseClass} bg-primary text-foreground hover:bg-[#e2b800]`
  const successCompactButtonClass = `${compactButtonBaseClass} bg-green-600 text-white hover:bg-green-700`
  const indigoCompactButtonClass = `${compactButtonBaseClass} bg-indigo-600 text-white hover:bg-indigo-700`
  const slateCompactButtonClass = `${compactButtonBaseClass} bg-surface-secondary-600 text-white hover:bg-surface-secondary-700`
  const warningCompactButtonClass = `${compactButtonBaseClass} bg-amber-600 text-white hover:bg-amber-700`
  const orangeCompactButtonClass = `${compactButtonBaseClass} bg-orange-600 text-white hover:bg-orange-700`
  const dangerCompactButtonClass = `${compactButtonBaseClass} bg-red-600 text-white hover:bg-red-700`
  const payrollFieldInputClass =
    'w-full rounded-xl border border-border-300 bg-surface px-3 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-foreground-tertiary focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-100'
  const payrollReadonlyFieldClass =
    'w-full rounded-xl border border-border-200 bg-surface-secondary-50 px-3 py-2.5 text-sm text-foreground-secondary shadow-sm'
  const payrollRunSectionClass =
    'rounded-[28px] border border-border-200 bg-gradient-to-br from-surface via-surface to-surface-secondary-50 shadow-sm'
  const payrollRunStatCardClass =
    'relative overflow-hidden rounded-2xl border border-border-200 bg-gradient-to-br from-surface via-surface to-surface-secondary-50 p-4 md:p-5 shadow-sm'
  const payrollRunListCardClass =
    'group rounded-2xl border border-border-200 bg-gradient-to-br from-surface via-surface to-surface-secondary-50 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md'

  useEffect(() => {
    if (scopeOptions.length > 0 && !scopeOptions.some((item) => item.id === payrollForm.scope_id)) {
      setPayrollForm((current) => ({
        ...current,
        scope_id: scopeOptions[0]?.id ?? '',
      }))
    }
  }, [scopeOptions, payrollForm.scope_id])

  useEffect(() => {
    if (!hasInitializedPayrollRunSelectionRef.current && payrollRunList.length > 0) {
      setSelectedPayrollRunId(payrollRunList[0].id)
      hasInitializedPayrollRunSelectionRef.current = true
      return
    }

    if (selectedPayrollRunId && !payrollRunList.some((run) => run.id === selectedPayrollRunId)) {
      setSelectedPayrollRunId(payrollRunList[0]?.id ?? null)
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
    if (!showPayrollRunForm || !payrollForm.scope_id || !normalizedPayrollFormMonth) {
      return
    }

    setNewPayrollRunRows(payrollRunSeedEmployees.map((employee) => buildPayrollRunSeedRow(employee)))
  }, [
    showPayrollRunForm,
    payrollForm.scope_id,
    normalizedPayrollFormMonth,
    payrollRunSeedEmployees,
  ])

  useEffect(() => {
    if (
      selectedPayrollRun &&
      scopedPayrollEmployees.length > 0 &&
      !scopedPayrollEmployees.some((employee) => employee.id === payrollEntryForm.employee_id)
    ) {
      const defaultEmployee = scopedPayrollEmployees[0]
      setPayrollEntryForm((current) => {
        const nextSalary = Number(defaultEmployee.salary || 0)
        const nextBreakdown = normalizePayrollObligationBreakdown(
          defaultEmployee.suggested_deduction_breakdown
        )

        if (
          current.employee_id === defaultEmployee.id &&
          Number(current.basic_salary_snapshot || 0) === nextSalary &&
          Number(current.transfer_renewal_amount || 0) === nextBreakdown.transfer_renewal &&
          Number(current.penalty_amount || 0) === nextBreakdown.penalty &&
          Number(current.advance_amount || 0) === nextBreakdown.advance &&
          Number(current.other_amount || 0) === nextBreakdown.other &&
          Number(current.installment_deducted_amount || 0) ===
            nextBreakdown.transfer_renewal + nextBreakdown.advance
        ) {
          return current
        }

        return {
          ...current,
          employee_id: defaultEmployee.id,
          basic_salary_snapshot: nextSalary,
          transfer_renewal_amount: nextBreakdown.transfer_renewal,
          penalty_amount: nextBreakdown.penalty,
          advance_amount: nextBreakdown.advance,
          other_amount: nextBreakdown.other,
          deductions_amount: nextBreakdown.penalty + nextBreakdown.other,
          installment_deducted_amount:
            nextBreakdown.transfer_renewal + nextBreakdown.advance,
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
        const nextBreakdown = normalizePayrollObligationBreakdown(
          selectedPayrollEmployee.suggested_deduction_breakdown
        )
        const next = {
          ...current,
          basic_salary_snapshot: Number(selectedPayrollEmployee.salary || 0),
          transfer_renewal_amount:
            current.transfer_renewal_amount === 0
              ? nextBreakdown.transfer_renewal
              : current.transfer_renewal_amount,
          penalty_amount:
            current.penalty_amount === 0 ? nextBreakdown.penalty : current.penalty_amount,
          advance_amount:
            current.advance_amount === 0 ? nextBreakdown.advance : current.advance_amount,
          other_amount: current.other_amount === 0 ? nextBreakdown.other : current.other_amount,
          deductions_amount:
            (current.penalty_amount === 0 ? nextBreakdown.penalty : current.penalty_amount) +
            (current.other_amount === 0 ? nextBreakdown.other : current.other_amount),
          installment_deducted_amount:
            current.installment_deducted_amount === 0
              ? nextBreakdown.transfer_renewal + nextBreakdown.advance
              : current.installment_deducted_amount,
        }

        const isUnchanged = JSON.stringify(current) === JSON.stringify(next)
        return isUnchanged ? current : next
      })
    }
  }, [selectedPayrollEmployee, payrollEntries, payrollEntryBreakdownById])

  const handleUpdateNewPayrollRunRow = (
    employeeId: string,
    field: keyof PayrollRunSeedRow,
    value: string | number | boolean
  ) => {
    setNewPayrollRunRows((current) =>
      current.map((row) => (row.employee_id === employeeId ? { ...row, [field]: value } : row))
    )
  }

  const handleToggleSelectAllNewPayrollRows = (checked: boolean) => {
    setNewPayrollRunRows((current) => current.map((row) => ({ ...row, included: checked })))
  }

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
            ...(entry as PayrollEntry),
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

    if (payrollRunSeedEmployees.length > 0 && selectedNewPayrollRunRows.length === 0) {
      toast.error('اختر موظفًا واحدًا على الأقل لإضافته داخل المسير')
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
      setShowPayrollRunDetailsModal(true)
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

      for (const row of selectedNewPayrollRunRows) {
        const employee = payrollRunSeedEmployees.find((item) => item.id === row.employee_id)
        if (!employee) {
          continue
        }

        const rowBreakdown = normalizePayrollObligationBreakdown({
          transfer_renewal: row.transfer_renewal_amount,
          penalty: row.penalty_amount,
          advance: row.advance_amount,
          other: row.other_amount,
        })
        const rowDeductionsTotal = getPayrollObligationBreakdownTotal(rowBreakdown)
        const rowTotals = calculatePayrollTotals(
          row.basic_salary_snapshot,
          row.attendance_days,
          row.paid_leave_days,
          row.overtime_amount,
          rowDeductionsTotal
        )

        await upsertPayrollEntry.mutateAsync({
          payroll_run_id: createdRun.id,
          payroll_run_status: createdRun.status,
          payroll_month: createdRun.payroll_month,
          employee_id: employee.id,
          residence_number_snapshot: employee.residence_number,
          employee_name_snapshot: employee.name,
          company_name_snapshot: employee.company?.name ?? null,
          project_name_snapshot: employee.project?.name ?? null,
          basic_salary_snapshot: row.basic_salary_snapshot,
          daily_rate_snapshot: rowTotals.dailyRate,
          attendance_days: row.attendance_days,
          paid_leave_days: row.paid_leave_days,
          overtime_amount: row.overtime_amount,
          overtime_notes: row.overtime_notes.trim() || null,
          deductions_amount: row.penalty_amount + row.other_amount,
          deductions_notes: row.deductions_notes.trim() || null,
          installment_deducted_amount:
            row.transfer_renewal_amount + row.advance_amount,
          deduction_breakdown: rowBreakdown,
          gross_amount: rowTotals.grossAmount,
          net_amount: rowTotals.netAmount,
          entry_status: 'calculated',
          notes: row.notes.trim() || null,
        })
      }

      setSelectedPayrollRunId(createdRun.id)
  setShowPayrollRunDetailsModal(true)
      setShowPayrollRunForm(false)
      setNewPayrollRunRows([])
      toast.success(
        selectedNewPayrollRunRows.length > 0
          ? `تم إنشاء المسير وإضافة ${selectedNewPayrollRunRows.length} موظف`
          : 'تم إنشاء المسير بنجاح'
      )
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
          setShowPayrollRunDetailsModal(true)
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
    } else {
      setNewPayrollRunRows([])
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
    setShowPayrollRunDetailsModal(true)
    setShowPayrollEntryForm(false)
    setSelectedPayrollSlipEntryId(null)
    setPayrollRunDeleteConfirmOpen(false)
  }

  const handleClosePayrollRunDetailsModal = () => {
    setShowPayrollRunDetailsModal(false)
    setShowPayrollEntryForm(false)
    setSelectedPayrollSlipEntryId(null)
    setPayrollRunDeleteConfirmOpen(false)
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
      setShowPayrollRunDetailsModal(false)
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

  const renderSelectedPayrollRunDetails = () => {
    if (!selectedPayrollRun) {
      return null
    }

    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-[28px] border border-sky-200/70 bg-gradient-to-br from-white via-sky-50/50 to-indigo-50/40 shadow-[0_20px_60px_-34px_rgba(14,116,144,0.42)]">
        <div className="flex items-center justify-between gap-3 border-b border-sky-100 bg-gradient-to-l from-sky-50 via-white to-indigo-50 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                عرض المسير
              </span>
              <span className="inline-flex items-center rounded-full border border-border-200 bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground-secondary">
                {selectedPayrollRun.entry_count} موظف
              </span>
            </div>
            <div className="mt-2 text-lg font-bold text-foreground">تفاصيل المسير</div>
            <div className="text-sm text-foreground-secondary mt-1">
              {getPayrollRunDisplayName(
                selectedPayrollRun.scope_type,
                selectedPayrollRun.scope_id,
                selectedPayrollRun.payroll_month
              )}{' '}
              • {selectedPayrollRun.entry_count} موظف
            </div>
            <div className="text-xs text-foreground-tertiary mt-1">
              قسائم الرواتب المولدة: {payrollSlips.length} • طريقة الإدخال:{' '}
              {getPayrollInputModeText(selectedPayrollRun.input_mode)}
            </div>
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
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-end gap-2 max-w-2xl">
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
                  selectedPayrollRun.status === 'cancelled'
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
        </div>

        {selectedPayrollRun && showPayrollEntryForm && isAdmin && (
          <div
            ref={payrollEntryFormRef}
            className="rounded-[24px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50/60 p-4 md:p-5 space-y-4 shadow-sm"
          >
            <div className="rounded-2xl border border-sky-200 bg-white/85 px-4 py-3 text-sm text-foreground-secondary shadow-sm">
              أدخل راتب الموظف يدويًا داخل المسير الحالي. إذا كان لهذا الموظف مدخل سابق في
              نفس المسير، فالحفظ سيقوم بالتحديث بدل إنشاء سجل مكرر.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 rounded-[24px] border border-white/80 bg-white/70 p-4 shadow-inner">
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">الموظف</label>
                <select
                  value={payrollEntryForm.employee_id}
                  onChange={(e) => {
                    const employee = scopedPayrollEmployees.find((item) => item.id === e.target.value)
                    const nextBreakdown =
                      employee?.suggested_deduction_breakdown ?? normalizePayrollObligationBreakdown()
                    setPayrollEntryForm((current) => ({
                      ...current,
                      employee_id: e.target.value,
                      basic_salary_snapshot: Number(employee?.salary || 0),
                      transfer_renewal_amount: nextBreakdown.transfer_renewal,
                      penalty_amount: nextBreakdown.penalty,
                      advance_amount: nextBreakdown.advance,
                      other_amount: nextBreakdown.other,
                      deductions_amount: nextBreakdown.penalty + nextBreakdown.other,
                      installment_deducted_amount:
                        nextBreakdown.transfer_renewal + nextBreakdown.advance,
                    }))
                  }}
                  className={payrollFieldInputClass}
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
                <label className="block text-sm font-medium text-foreground-secondary mb-2">أيام الحضور</label>
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">الراتب الأساسي</label>
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">الإضافي</label>
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">قسط سلفة</label>
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">قسط أخرى</label>
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">الأجر اليومي</label>
                <div className={payrollReadonlyFieldClass}>
                  {dailyRate.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">ملاحظات الإضافي</label>
                <input
                  type="text"
                  value={payrollEntryForm.overtime_notes}
                  onChange={(e) =>
                    setPayrollEntryForm((current) => ({
                      ...current,
                      overtime_notes: e.target.value,
                    }))
                  }
                  className={payrollFieldInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-2">
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
                  className={payrollFieldInputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground-secondary mb-2">ملاحظات عامة</label>
                <input
                  type="text"
                  value={payrollEntryForm.notes}
                  onChange={(e) =>
                    setPayrollEntryForm((current) => ({
                      ...current,
                      notes: e.target.value,
                    }))
                  }
                  className={payrollFieldInputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border-200 bg-white/80 p-4 shadow-sm">
                <div className="text-sm text-foreground-tertiary mb-1">إجمالي الراتب</div>
                <div className="text-xl font-bold text-foreground">{grossAmount.toLocaleString('en-US')}</div>
              </div>
              <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4 shadow-sm">
                <div className="text-sm text-red-500 mb-1">إجمالي الاستقطاعات</div>
                <div className="text-xl font-bold text-red-600">
                  {groupedDeductionsTotal.toLocaleString('en-US')}
                </div>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm">
                <div className="text-sm text-sky-600 mb-1">الصافي</div>
                <div className={`text-xl font-bold ${netAmount < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                  {netAmount.toLocaleString('en-US')}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
                <div className="text-sm text-amber-600 mb-1">اقتراح الأقساط</div>
                <div className="text-xl font-bold text-orange-600">
                  {(selectedPayrollEmployee?.suggested_installment_amount ?? 0).toLocaleString('en-US')}
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
          <div className="rounded-[24px] border border-dashed border-border-300 bg-surface-secondary-50 px-6 py-10 text-center text-foreground-tertiary">
            اختر مسيرًا لعرض التفاصيل.
          </div>
        ) : payrollEntriesLoading ? (
          <div className="rounded-[24px] border border-border-200 bg-surface-secondary-50 px-6 py-10 text-center text-foreground-tertiary">
            جاري تحميل كشف الرواتب...
          </div>
        ) : payrollEntries.length === 0 ? (
          <div className="rounded-[24px] border border-border-200 bg-gradient-to-br from-surface-secondary-50 via-surface to-surface p-8">
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
                  <div className="text-sm font-semibold text-foreground mb-2">للبدء السريع:</div>
                  <div className="space-y-1 text-sm text-foreground-secondary">
                    <p>1. اضغط على زر إدخال راتب يدوي لإضافة راتب أول موظف داخل هذا المسير.</p>
                    <p>2. أو اضغط على استيراد من Excel إذا كان لديك كشف جاهز.</p>
                    <p>3. بعد الحفظ سيظهر الموظف في جدول تفاصيل المسير أسفل هذا القسم.</p>
                  </div>
                </div>
              )}
              {selectedPayrollRunEditable && isAdmin && scopedPayrollEmployees.length > 0 && (
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
          <div className="overflow-hidden rounded-[24px] border border-border-200 bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary-50/90">
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
                    <tr key={entry.id} className="border-t border-border-100 transition hover:bg-sky-50/40">
                      <td className="px-4 py-3 font-medium text-gray-900">{entry.employee_name_snapshot}</td>
                      <td className="px-4 py-3">{entry.residence_number_snapshot}</td>
                      <td className="px-4 py-3">{entry.gross_amount.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3">{rowBreakdown.transfer_renewal.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3">{rowBreakdown.penalty.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3">{rowBreakdown.advance.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3">{rowBreakdown.other.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3 font-semibold text-blue-700">{entry.net_amount.toLocaleString('en-US')}</td>
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
          </div>
        )}

        {selectedPayrollRun && selectedPayrollRunEditable && (
          <div className="rounded-[24px] border border-border-200 bg-gradient-to-br from-surface-secondary-50 via-surface to-surface px-4 py-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="lg:max-w-sm">
                <h3 className="font-semibold text-foreground mb-1">استيراد الرواتب من Excel</h3>
                <p className="text-sm text-foreground-secondary">
                  ابدأ بالقالب الجاهز، ثم ارفع الملف وراجع الصفوف قبل الاعتماد النهائي داخل نفس
                  المسير.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                <div className="rounded-xl border border-border-200 bg-white/80 px-3 py-2 text-sm text-foreground-secondary shadow-sm">
                  1. نزّل القالب وأبقِ رقم الإقامة موجودًا في كل صف.
                </div>
                <div className="rounded-xl border border-border-200 bg-white/80 px-3 py-2 text-sm text-foreground-secondary shadow-sm">
                  2. اترك أي عمود غير متوفر فارغًا وسيتم اعتباره صفرًا أو ملاحظة فارغة.
                </div>
                <div className="rounded-xl border border-border-200 bg-white/80 px-3 py-2 text-sm text-foreground-secondary shadow-sm">
                  3. راجع المعاينة قبل الاعتماد لتجنب إدخال بيانات غير مطابقة.
                </div>
              </div>
            </div>
          </div>
        )}

        {payrollImportPreviewRows.length > 0 && (
          <div className="rounded-[24px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50/60 px-4 py-4 space-y-4 shadow-sm">
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

            <div className="overflow-x-auto rounded-2xl border border-blue-200 bg-surface shadow-sm">
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
                    <tr key={`${row.employee_id}-${row.row_number}`} className="border-t border-blue-100 hover:bg-blue-50/40">
                      <td className="px-4 py-3">{row.row_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.employee_name}</td>
                      <td className="px-4 py-3">{row.residence_number}</td>
                      <td className="px-4 py-3">{row.attendance_days}</td>
                      <td className="px-4 py-3">{row.overtime_amount.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3">{row.deductions_amount.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3">{row.installment_deducted_amount.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3">{row.gross_amount.toLocaleString('en-US')}</td>
                      <td className="px-4 py-3 font-semibold text-blue-700">{row.net_amount.toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {payrollImportHeaderError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <h3 className="font-semibold text-amber-900 mb-2">مشكلة في رأس ملف Excel</h3>
            <p className="text-sm text-amber-800">{payrollImportHeaderError}</p>
          </div>
        )}

        {payrollImportErrors.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 shadow-sm">
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
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-red-200 bg-surface">
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
    )
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
                ? 'bg-primary text-foreground shadow-soft'
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
                ? 'bg-primary text-foreground shadow-soft'
                : 'border border-border-200 bg-surface text-foreground-secondary hover:bg-surface-secondary-50'
            }`}
          >
            <Wallet className="h-4 w-4" />
            مسيرات الرواتب
          </button>
          <button
            type="button"
            onClick={() => setActivePageTab('obligations')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activePageTab === 'obligations'
                ? 'bg-primary text-foreground shadow-soft'
                : 'border border-border-200 bg-surface text-foreground-secondary hover:bg-surface-secondary-50'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            قائمة الالتزامات
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
            <div className={`${payrollRunSectionClass} p-4 md:p-5 space-y-5`}>
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 rounded-2xl border border-white/70 bg-gradient-to-l from-surface-secondary-50 via-surface to-surface px-4 py-4 shadow-sm">
                <div>
                  <h2 className="text-xl font-bold text-foreground">إحصائيات مسيرات الرواتب</h2>
                  <p className="text-sm text-foreground-secondary">
                    اختر شهرًا أو مسيرًا محددًا وستتغير الكروت مباشرة.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[760px] rounded-2xl border border-border-200 bg-white/80 p-3 shadow-sm">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground-secondary">
                      فلتر الشهر
                    </label>
                    <input
                      type="month"
                      value={payrollRunStatsMonth}
                      onChange={(e) => setPayrollRunStatsMonth(e.target.value)}
                      className={payrollFieldInputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground-secondary">
                      فلتر المسير
                    </label>
                    <select
                      value={payrollRunStatsRunId}
                      onChange={(e) => setPayrollRunStatsRunId(e.target.value)}
                      className={payrollFieldInputClass}
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
                      className="w-full rounded-xl border border-border-300 bg-white px-3 py-2.5 text-sm font-medium text-foreground-secondary shadow-sm transition hover:bg-surface-secondary-50"
                    >
                      إعادة ضبط الفلتر
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className={payrollRunStatCardClass}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground-tertiary mb-1">المسيرات داخل الفلتر</p>
                      <p className="text-2xl font-bold text-foreground">
                        {filteredPayrollRunList.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-surface-secondary-50 p-3 text-foreground shadow-sm border border-border-200">
                      <Wallet className="w-6 h-6" />
                    </div>
                  </div>
                </div>
                <div className={payrollRunStatCardClass}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground-tertiary mb-1">الموظفون داخل الفلتر</p>
                      <p className="text-2xl font-bold text-sky-700">
                        {payrollRunCardsStats.employees}
                      </p>
                    </div>
                    <div className="bg-sky-100 p-3 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-sky-600" />
                    </div>
                  </div>
                </div>
                <div className={payrollRunStatCardClass}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground-tertiary mb-1">إجمالي الرواتب</p>
                      <p className="text-2xl font-bold text-foreground">
                        {payrollRunCardsStats.gross.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-indigo-100 p-3 rounded-lg">
                      <ReceiptText className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                </div>
                <div className={payrollRunStatCardClass}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground-tertiary mb-1">إجمالي الالتزامات</p>
                      <p className="text-2xl font-bold text-red-600">
                        {payrollRunCardsStats.totalObligations.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-red-100 p-3 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </div>
                <div className={payrollRunStatCardClass}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground-tertiary mb-1">رسوم نقل وتجديد</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {payrollRunCardsStats.transferRenewal.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-amber-100 p-3 rounded-lg">
                      <Calendar className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </div>
                <div className={payrollRunStatCardClass}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground-tertiary mb-1">جزاءات وغرامات</p>
                      <p className="text-2xl font-bold text-rose-600">
                        {payrollRunCardsStats.penalty.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-rose-100 p-3 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-rose-600" />
                    </div>
                  </div>
                </div>
                <div className={payrollRunStatCardClass}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground-tertiary mb-1">سلف</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {payrollRunCardsStats.advance.toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <Wallet className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>
                <div className={payrollRunStatCardClass}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground-tertiary mb-1">أخرى</p>
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

            <div className={`${payrollRunSectionClass} p-4 md:p-5 space-y-5`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-white/70 bg-gradient-to-l from-surface-secondary-50 via-surface to-surface px-4 py-4 shadow-sm">
                <div>
                  <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 mb-2">
                    إدارة المسيرات
                  </div>
                  <h2 className="text-xl font-bold text-foreground">مسيرات الرواتب</h2>
                  <p className="text-sm text-foreground-secondary">
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

              <div className="overflow-hidden rounded-[26px] border border-border-200 bg-surface shadow-[0_20px_45px_-36px_rgba(15,23,42,0.52)]">
                  <div className="border-b border-border-200 bg-gradient-to-l from-sky-50/70 via-white to-indigo-50/60 px-5 py-4 md:px-6 md:py-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-base font-bold text-foreground">قائمة المسيرات</div>
                        <div className="mt-1 text-sm text-foreground-secondary">
                          {payrollRunStatsRows.length} مدخل رواتب داخل النطاق الحالي
                        </div>
                      </div>
                      {canExport('payroll') && filteredPayrollRunList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-2 text-xs text-foreground-secondary bg-white border border-border-200 rounded-xl px-3 py-2 shadow-sm">
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
                  <div className="max-h-[62vh] overflow-y-auto">
                    {payrollRunsLoading ? (
                      <div className="p-8 text-center text-foreground-tertiary">
                        جاري تحميل مسيرات الرواتب...
                      </div>
                    ) : filteredPayrollRunList.length === 0 ? (
                      <div className="p-8 text-center text-foreground-tertiary">
                        لا توجد مسيرات مطابقة للفلاتر الحالية.
                      </div>
                    ) : (
                      filteredPayrollRunList.map((run) => (
                        <div
                          key={run.id}
                          className={`border-b border-border-100/90 p-3 transition-colors duration-200 hover:bg-sky-50/30 md:p-4 ${showPayrollRunDetailsModal && selectedPayrollRunId === run.id ? 'bg-blue-50/40' : ''}`}
                        >
                          <div
                            className={`${payrollRunListCardClass} group transition-all duration-300 ${showPayrollRunDetailsModal && selectedPayrollRunId === run.id ? 'border-sky-200 bg-gradient-to-br from-white via-sky-50/60 to-indigo-50/40 border-r-4 border-r-sky-500 shadow-[0_18px_38px_-28px_rgba(14,116,144,0.38)]' : 'hover:border-sky-100 hover:shadow-[0_16px_36px_-30px_rgba(59,130,246,0.5)]'}`}
                          >
                            <div className="flex items-start gap-3">
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
                              <div className="flex-1 text-right">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <span className="text-base font-bold text-foreground">
                                        {formatPayrollMonthLabel(run.payroll_month)}
                                      </span>
                                      <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ${run.status === 'finalized' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : run.status === 'draft' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-border-200 bg-surface-secondary-50 text-foreground-secondary'}`}
                                      >
                                        {getPayrollStatusText(run.status)}
                                      </span>
                                    </div>
                                    {showPayrollRunDetailsModal && selectedPayrollRunId === run.id && (
                                      <div className="text-xs font-medium text-blue-700 mb-2">
                                        المسير المفتوح الآن
                                      </div>
                                    )}
                                    <div className="text-sm font-semibold text-foreground-secondary">
                                      {getPayrollRunDisplayName(
                                        run.scope_type,
                                        run.scope_id,
                                        run.payroll_month
                                      )}
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                      <span className="inline-flex items-center rounded-full border border-border-200 bg-white px-2.5 py-1 text-foreground-secondary shadow-sm">
                                        طريقة الإدخال: {getPayrollInputModeText(run.input_mode)}
                                      </span>
                                      <span className="inline-flex items-center rounded-full border border-border-200 bg-white px-2.5 py-1 text-foreground-secondary shadow-sm">
                                        {run.entry_count} موظف
                                      </span>
                                      <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 shadow-sm">
                                        صافي {run.total_net_amount.toLocaleString('en-US')}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 self-start">
                                    {showPayrollRunDetailsModal && selectedPayrollRunId === run.id && (
                                      <span className="inline-flex items-center rounded-full border border-sky-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-sky-700 shadow-sm">
                                        مفتوح الآن
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (showPayrollRunDetailsModal && selectedPayrollRunId === run.id) {
                                          handleClosePayrollRunDetailsModal()
                                          return
                                        }
                                        handleSelectPayrollRun(run.id)
                                      }}
                                      className={`${outlineCompactButtonClass} rounded-xl border-sky-100 bg-white shadow-sm hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 group-hover:border-sky-200`}
                                    >
                                      <Eye className="w-4 h-4" />
                                      {showPayrollRunDetailsModal && selectedPayrollRunId === run.id
                                        ? 'إخفاء المسير'
                                        : 'عرض المسير'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      ))
                    )}
                  </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            Tab: قائمة الالتزامات
        ══════════════════════════════════════════════════════════════ */}
        {activePageTab === 'obligations' && (
          <div className="space-y-5 mb-6">
            {/* Header bar */}
            <div className="rounded-2xl border border-border-200 bg-surface p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">قائمة الالتزامات والاستقطاعات</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    ملخص جميع الالتزامات النشطة على الموظفين — تعديل القيمة هنا يُحدِّث خطة
                    الالتزام مباشرة.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void refetchObligations()}
                    className={outlineCompactButtonClass}
                    disabled={obligationsLoading}
                  >
                    {obligationsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    تحديث
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowAddObligationDialog(true)}
                      className={primaryCompactButtonClass}
                    >
                      <UserPlus className="h-4 w-4" />
                      إضافة التزام
                    </button>
                  )}
                  {canExport('payroll') && (
                    <button
                      type="button"
                      onClick={() => void exportObligationsToExcel()}
                      disabled={exportingObligations || filteredObligationsSummary.length === 0}
                      className={successCompactButtonClass}
                    >
                      {exportingObligations ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      تصدير Excel
                    </button>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="max-w-sm">
                <label className="mb-1 block text-sm font-medium text-foreground-secondary">
                  بحث
                </label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
                  <input
                    type="text"
                    value={obligationsSearchQuery}
                    onChange={(e) => setObligationsSearchQuery(e.target.value)}
                    placeholder="الاسم أو رقم الإقامة أو المشروع"
                    className="w-full rounded-xl border border-border-300 bg-surface py-2 pr-9 pl-3 text-sm"
                  />
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border-200 bg-surface p-3">
                  <p className="text-xs text-foreground-tertiary mb-1">عدد الموظفين</p>
                  <p className="text-xl font-bold text-foreground">
                    {filteredObligationsSummary.length}
                  </p>
                </div>
                <div className="rounded-xl border border-border-200 bg-surface p-3">
                  <p className="text-xs text-foreground-tertiary mb-1">إجمالي المتبقي</p>
                  <p className="text-xl font-bold text-red-600">
                    {filteredObligationsSummary
                      .reduce((s, r) => s + r.total_remaining, 0)
                      .toLocaleString('en-US')}
                  </p>
                </div>
                <div className="rounded-xl border border-border-200 bg-surface p-3">
                  <p className="text-xs text-foreground-tertiary mb-1">سلف متبقية</p>
                  <p className="text-xl font-bold text-blue-700">
                    {filteredObligationsSummary
                      .reduce((s, r) => s + r.advance_remaining, 0)
                      .toLocaleString('en-US')}
                  </p>
                </div>
                <div className="rounded-xl border border-border-200 bg-surface p-3">
                  <p className="text-xs text-foreground-tertiary mb-1">جزاءات متبقية</p>
                  <p className="text-xl font-bold text-rose-600">
                    {filteredObligationsSummary
                      .reduce((s, r) => s + r.penalty_remaining, 0)
                      .toLocaleString('en-US')}
                  </p>
                </div>
              </div>

              {/* Table */}
              {obligationsLoading ? (
                <div className="py-10 text-center text-sm text-foreground-tertiary">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                  جاري تحميل بيانات الالتزامات...
                </div>
              ) : filteredObligationsSummary.length === 0 ? (
                <div className="rounded-xl border border-border-200 bg-surface-secondary-50 py-10 text-center text-sm text-foreground-tertiary">
                  لا توجد التزامات نشطة حالياً.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-200">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-secondary-50">
                      <tr>
                        <th className="px-4 py-3 text-right font-semibold">الموظف</th>
                        <th className="px-4 py-3 text-right font-semibold">رقم الإقامة</th>
                        <th className="px-4 py-3 text-right font-semibold">المشروع</th>
                        <th className="px-4 py-3 text-right font-semibold">المؤسسة</th>
                        <th className="px-4 py-3 text-right font-semibold">نقل كفالة</th>
                        <th className="px-4 py-3 text-right font-semibold">تجديد</th>
                        <th className="px-4 py-3 text-right font-semibold">جزاءات</th>
                        <th className="px-4 py-3 text-right font-semibold">سلف</th>
                        <th className="px-4 py-3 text-right font-semibold">أخرى</th>
                        <th className="px-4 py-3 text-right font-semibold text-red-700">
                          إجمالي المتبقي
                        </th>
                        <th className="px-4 py-3 text-center font-semibold">تعديل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-100">
                      {filteredObligationsSummary.map((row) => (
                        <tr
                          key={row.employee_id}
                          className="hover:bg-surface-secondary-50 transition"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {row.employee_name}
                          </td>
                          <td className="px-4 py-3 font-mono text-foreground-secondary">
                            {row.residence_number}
                          </td>
                          <td className="px-4 py-3 text-foreground-secondary">
                            {row.project_name || '—'}
                          </td>
                          <td className="px-4 py-3 text-foreground-secondary">
                            {row.company_name || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {row.transfer_remaining > 0 ? (
                              <span className="text-amber-700 font-medium">
                                {row.transfer_remaining.toLocaleString('en-US')}
                              </span>
                            ) : (
                              <span className="text-foreground-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.renewal_remaining > 0 ? (
                              <span className="text-amber-700 font-medium">
                                {row.renewal_remaining.toLocaleString('en-US')}
                              </span>
                            ) : (
                              <span className="text-foreground-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.penalty_remaining > 0 ? (
                              <span className="text-rose-600 font-medium">
                                {row.penalty_remaining.toLocaleString('en-US')}
                              </span>
                            ) : (
                              <span className="text-foreground-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.advance_remaining > 0 ? (
                              <span className="text-blue-700 font-medium">
                                {row.advance_remaining.toLocaleString('en-US')}
                              </span>
                            ) : (
                              <span className="text-foreground-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.other_remaining > 0 ? (
                              <span className="text-violet-700 font-medium">
                                {row.other_remaining.toLocaleString('en-US')}
                              </span>
                            ) : (
                              <span className="text-foreground-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-red-600">
                            {row.total_remaining.toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenObligationDetail(row.employee_id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              تفاصيل
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-secondary-50 border-t border-border-200 font-semibold">
                      <tr>
                        <td className="px-4 py-3" colSpan={4}>
                          الإجمالي ({filteredObligationsSummary.length} موظف)
                        </td>
                        <td className="px-4 py-3 text-amber-700">
                          {filteredObligationsSummary
                            .reduce((s, r) => s + r.transfer_remaining, 0)
                            .toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3 text-amber-700">
                          {filteredObligationsSummary
                            .reduce((s, r) => s + r.renewal_remaining, 0)
                            .toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3 text-rose-600">
                          {filteredObligationsSummary
                            .reduce((s, r) => s + r.penalty_remaining, 0)
                            .toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3 text-blue-700">
                          {filteredObligationsSummary
                            .reduce((s, r) => s + r.advance_remaining, 0)
                            .toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3 text-violet-700">
                          {filteredObligationsSummary
                            .reduce((s, r) => s + r.other_remaining, 0)
                            .toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3 text-red-600">
                          {filteredObligationsSummary
                            .reduce((s, r) => s + r.total_remaining, 0)
                            .toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {payrollRunDeleteConfirmOpen && selectedPayrollRun && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-secondary-950/55 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!deletePayrollRun.isPending) {
                setPayrollRunDeleteConfirmOpen(false)
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-border-200 bg-surface shadow-2xl"
              onClick={(event) => event.stopPropagation()}
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

        {showPayrollRunDetailsModal && selectedPayrollRun && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-secondary-950/65 p-3 backdrop-blur-md md:p-4"
            onClick={() => {
              if (
                !updatePayrollRunStatus.isPending &&
                !deletePayrollRun.isPending &&
                !upsertPayrollEntry.isPending &&
                !confirmingPayrollExcelImport
              ) {
                handleClosePayrollRunDetailsModal()
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="app-modal-surface w-full max-w-7xl max-h-[94vh] overflow-y-auto border border-sky-100 shadow-[0_32px_100px_-38px_rgba(15,23,42,0.58)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="app-modal-header sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-sky-100 bg-gradient-to-l from-sky-50 via-white to-indigo-50 px-5 py-4 md:px-6 md:py-5">
                <div>
                  <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-sky-700 mb-2">
                    كشف المسير
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">عرض المسير</h2>
                  <p className="mt-1 text-sm text-foreground-secondary max-w-3xl">
                    {getPayrollRunDisplayName(
                      selectedPayrollRun.scope_type,
                      selectedPayrollRun.scope_id,
                      selectedPayrollRun.payroll_month
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClosePayrollRunDetailsModal}
                  disabled={
                    updatePayrollRunStatus.isPending ||
                    deletePayrollRun.isPending ||
                    upsertPayrollEntry.isPending ||
                    confirmingPayrollExcelImport
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-200 bg-white/90 text-foreground-tertiary shadow-sm hover:bg-surface-secondary-50 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-gradient-to-b from-surface-secondary-50/70 to-surface p-4 md:p-5">{renderSelectedPayrollRunDetails()}</div>
            </div>
          </div>
        )}

        {showPayrollRunForm && isAdmin && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-surface-secondary-950/55 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!createPayrollRun.isPending && !upsertPayrollEntry.isPending) {
                handleTogglePayrollRunForm()
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-7xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border-200 bg-surface shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border-200 bg-surface px-5 py-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">إضافة مسير جديد</h2>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    اختر المشروع أو المؤسسة، وسيتم تحميل موظفي النطاق تلقائيًا مع الراتب
                    الحالي والأقساط المستحقة لهذا الشهر.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePayrollRunForm}
                  disabled={createPayrollRun.isPending || upsertPayrollEntry.isPending}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-200 text-foreground-tertiary hover:bg-surface-secondary-50 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground-secondary">
                      شهر الرواتب
                    </label>
                    <input
                      type="month"
                      value={payrollForm.payroll_month}
                      onChange={(e) =>
                        setPayrollForm((current) => ({ ...current, payroll_month: e.target.value }))
                      }
                      className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground-secondary">
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
                      className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                    >
                      <option value="company">مسير لمؤسسة</option>
                      <option value="project">مسير لمشروع</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground-secondary">
                      {payrollForm.scope_type === 'project' ? 'اختر المشروع' : 'اختر المؤسسة'}
                    </label>
                    <select
                      value={payrollForm.scope_id}
                      onChange={(e) =>
                        setPayrollForm((current) => ({ ...current, scope_id: e.target.value }))
                      }
                      className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
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
                    <label className="mb-2 block text-sm font-medium text-foreground-secondary">
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
                      className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                    >
                      <option value="manual">يدوي</option>
                      <option value="excel">Excel</option>
                      <option value="mixed">مختلط</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  {payrollForm.scope_id ? (
                    <>
                      سيتم إنشاء:{' '}
                      <strong>
                        {getPayrollRunDisplayName(
                          payrollForm.scope_type,
                          payrollForm.scope_id,
                          payrollForm.payroll_month
                        )}
                      </strong>
                      {' — '}الموظفون يظهرون مرة واحدة فقط بناءً على رقم الإقامة.
                    </>
                  ) : (
                    'اختر الشهر والنطاق أولاً ليتم تحميل قائمة الموظفين تلقائيًا.'
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground-secondary">
                    ملاحظات المسير
                  </label>
                  <textarea
                    value={payrollForm.notes}
                    onChange={(e) =>
                      setPayrollForm((current) => ({ ...current, notes: e.target.value }))
                    }
                    rows={2}
                    className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm resize-none"
                    placeholder="اختياري"
                  />
                </div>

                <div className="rounded-2xl border border-border-200 overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-border-200 bg-surface-secondary-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold text-foreground">موظفو المسير</div>
                      <div className="mt-1 text-sm text-foreground-secondary">
                        الموظفون المعروضون مرتبطون بنفس المشروع أو المؤسسة، والراتب والأقساط
                        محمّلة تلقائيًا وقابلة للتعديل قبل الإنشاء.
                      </div>
                    </div>
                    {newPayrollRunRows.length > 0 && (
                      <label className="inline-flex items-center gap-2 text-sm text-foreground-secondary">
                        <input
                          type="checkbox"
                          checked={allNewPayrollRunRowsSelected}
                          onChange={(e) =>
                            handleToggleSelectAllNewPayrollRows(e.target.checked)
                          }
                          className="rounded border-border-300"
                        />
                        تحديد الكل
                      </label>
                    )}
                  </div>

                  {!payrollForm.scope_id || !normalizedPayrollFormMonth ? (
                    <div className="px-4 py-10 text-center text-sm text-foreground-tertiary">
                      اختر الشهر والنطاق لعرض الموظفين.
                    </div>
                  ) : payrollRunSeedEmployeesLoading ? (
                    <div className="px-4 py-10 text-center text-sm text-foreground-tertiary">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      جاري تحميل موظفي المسير...
                    </div>
                  ) : newPayrollRunRows.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-foreground-tertiary">
                      لا يوجد موظفون داخل هذا النطاق حاليًا.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1380px] text-sm">
                        <thead className="bg-surface-secondary-50">
                          <tr>
                            <th className="px-3 py-3 text-right">اختيار</th>
                            <th className="px-3 py-3 text-right">الموظف</th>
                            <th className="px-3 py-3 text-right">الإقامة</th>
                            <th className="px-3 py-3 text-right">الراتب</th>
                            <th className="px-3 py-3 text-right">الأجر اليومي</th>
                            <th className="px-3 py-3 text-right">الحضور</th>
                            <th className="px-3 py-3 text-right">الإجازات</th>
                            <th className="px-3 py-3 text-right">نقل/تجديد</th>
                            <th className="px-3 py-3 text-right">جزاءات</th>
                            <th className="px-3 py-3 text-right">سلفة</th>
                            <th className="px-3 py-3 text-right">أخرى</th>
                            <th className="px-3 py-3 text-right">إجمالي الاستقطاعات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-100">
                          {newPayrollRunRows.map((row) => {
                            const rowDailyRate = roundPayrollAmount(row.basic_salary_snapshot / 30)
                            const rowTotalDeductions =
                              row.transfer_renewal_amount +
                              row.penalty_amount +
                              row.advance_amount +
                              row.other_amount

                            return (
                              <tr
                                key={row.employee_id}
                                className={row.included ? 'bg-surface' : 'bg-surface-secondary-50/70'}
                              >
                                <td className="px-3 py-3">
                                  <input
                                    type="checkbox"
                                    checked={row.included}
                                    onChange={(e) =>
                                      handleUpdateNewPayrollRunRow(
                                        row.employee_id,
                                        'included',
                                        e.target.checked
                                      )
                                    }
                                    className="rounded border-border-300"
                                  />
                                </td>
                                <td className="px-3 py-3 font-medium text-foreground">
                                  {row.employee_name}
                                </td>
                                <td className="px-3 py-3 font-mono text-foreground-secondary">
                                  {row.residence_number}
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.basic_salary_snapshot}
                                    onChange={(e) =>
                                      handleUpdateNewPayrollRunRow(
                                        row.employee_id,
                                        'basic_salary_snapshot',
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="w-28 rounded-lg border border-border-300 bg-surface px-2 py-1.5"
                                  />
                                </td>
                                <td className="px-3 py-3 text-foreground-secondary">
                                  {rowDailyRate.toLocaleString('en-US')}
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={row.attendance_days}
                                    onChange={(e) =>
                                      handleUpdateNewPayrollRunRow(
                                        row.employee_id,
                                        'attendance_days',
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="w-20 rounded-lg border border-border-300 bg-surface px-2 py-1.5"
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={row.paid_leave_days}
                                    onChange={(e) =>
                                      handleUpdateNewPayrollRunRow(
                                        row.employee_id,
                                        'paid_leave_days',
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="w-20 rounded-lg border border-border-300 bg-surface px-2 py-1.5"
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.transfer_renewal_amount}
                                    onChange={(e) =>
                                      handleUpdateNewPayrollRunRow(
                                        row.employee_id,
                                        'transfer_renewal_amount',
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="w-24 rounded-lg border border-border-300 bg-surface px-2 py-1.5"
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.penalty_amount}
                                    onChange={(e) =>
                                      handleUpdateNewPayrollRunRow(
                                        row.employee_id,
                                        'penalty_amount',
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="w-24 rounded-lg border border-border-300 bg-surface px-2 py-1.5"
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.advance_amount}
                                    onChange={(e) =>
                                      handleUpdateNewPayrollRunRow(
                                        row.employee_id,
                                        'advance_amount',
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="w-24 rounded-lg border border-border-300 bg-surface px-2 py-1.5"
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={row.other_amount}
                                    onChange={(e) =>
                                      handleUpdateNewPayrollRunRow(
                                        row.employee_id,
                                        'other_amount',
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    className="w-24 rounded-lg border border-border-300 bg-surface px-2 py-1.5"
                                  />
                                </td>
                                <td className="px-3 py-3 font-semibold text-red-600">
                                  {rowTotalDeductions.toLocaleString('en-US')}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border-200 px-5 py-4">
                <div className="text-sm text-foreground-secondary">
                  المحددون: <strong>{selectedNewPayrollRunRows.length}</strong> من أصل{' '}
                  <strong>{newPayrollRunRows.length}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePayrollRunForm}
                    className={outlineCompactButtonClass}
                    disabled={createPayrollRun.isPending || upsertPayrollEntry.isPending}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePayrollRun}
                    className={successCompactButtonClass}
                    disabled={createPayrollRun.isPending || upsertPayrollEntry.isPending}
                  >
                    {createPayrollRun.isPending || upsertPayrollEntry.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    إنشاء المسير
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            Modal: تفاصيل وتعديل التزامات الموظف
        ══════════════════════════════════════════════════════════════ */}
        {obligationDetailEmployeeId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-surface-secondary-950/55 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!editingObligationLineId) {
                handleCloseObligationDetail()
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-200 bg-surface shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border-200 bg-surface px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    التزامات الموظف
                  </h2>
                  <p className="text-sm text-foreground-secondary mt-0.5">
                    {allObligationsSummary.find(r => r.employee_id === obligationDetailEmployeeId)?.employee_name ?? ''}
                    {' — '}
                    {allObligationsSummary.find(r => r.employee_id === obligationDetailEmployeeId)?.residence_number ?? ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseObligationDetail}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-200 text-foreground-tertiary hover:bg-surface-secondary-50 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {detailObligationsLoading ? (
                  <div className="py-10 text-center text-sm text-foreground-tertiary">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
                    جاري تحميل الالتزامات...
                  </div>
                ) : detailObligationPlans.filter(p => p.status === 'active' || p.status === 'draft').length === 0 ? (
                  <div className="py-10 text-center text-sm text-foreground-tertiary">
                    لا توجد التزامات نشطة لهذا الموظف.
                  </div>
                ) : (
                  detailObligationPlans
                    .filter(p => p.status === 'active' || p.status === 'draft')
                    .map(plan => {
                      const planRemaining = plan.lines.reduce(
                        (s, l) => s + Math.max(l.amount_due - l.amount_paid, 0),
                        0
                      )
                      const planPaid = plan.lines.reduce(
                        (s, l) => s + Number(l.amount_paid || 0),
                        0
                      )
                      return (
                        <div
                          key={plan.id}
                          className="rounded-xl border border-border-200 bg-surface overflow-hidden"
                        >
                          {/* Plan header */}
                          <div className="flex items-center justify-between gap-3 bg-surface-secondary-50 px-4 py-3 border-b border-border-100">
                            <div>
                              <span className="font-semibold text-foreground">{plan.title}</span>
                              <span className="mr-2 text-xs rounded-full px-2 py-0.5 bg-blue-100 text-blue-700">
                                {plan.installment_count} قسط
                              </span>
                            </div>
                            <div className="text-sm text-foreground-secondary">
                              مدفوع:{' '}
                              <strong className="text-green-700">
                                {planPaid.toLocaleString('en-US')}
                              </strong>
                              {' / '}متبقي:{' '}
                              <strong className="text-red-600">
                                {planRemaining.toLocaleString('en-US')}
                              </strong>
                            </div>
                          </div>

                          {/* Lines */}
                          <div className="divide-y divide-border-100">
                            {plan.lines
                              .filter(l => l.line_status === 'unpaid' || l.line_status === 'partial')
                              .map(line => {
                                const remaining = Math.max(line.amount_due - line.amount_paid, 0)
                                const isEditing = editingObligationLineId === line.id
                                return (
                                  <div key={line.id} className="px-4 py-3 space-y-3">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-foreground-secondary">
                                          {line.due_month.slice(0, 7)}
                                        </span>
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                            line.line_status === 'partial'
                                              ? 'bg-amber-100 text-amber-700'
                                              : 'bg-blue-100 text-blue-700'
                                          }`}
                                        >
                                          {line.line_status === 'partial' ? 'جزئي' : 'مفتوح'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 text-sm">
                                        <span className="text-foreground-tertiary">
                                          المستحق: {line.amount_due.toLocaleString('en-US')}
                                        </span>
                                        <span className="text-green-700">
                                          مدفوع: {line.amount_paid.toLocaleString('en-US')}
                                        </span>
                                        <span className="font-semibold text-red-600">
                                          متبقي: {remaining.toLocaleString('en-US')}
                                        </span>
                                        {!isEditing && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleStartEditObligationLine(
                                                line.id,
                                                line.amount_paid,
                                                line.notes
                                              )
                                            }
                                            className="inline-flex items-center gap-1 rounded-lg border border-border-200 bg-surface px-2.5 py-1 text-xs font-medium text-foreground-secondary hover:bg-surface-secondary-50 transition"
                                          >
                                            تعديل
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {isEditing && (
                                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                                              إجمالي المدفوع حتى الآن
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              max={line.amount_due}
                                              step="0.01"
                                              value={obligationPaymentForm.amount_paid}
                                              onChange={e =>
                                                setObligationPaymentForm(f => ({
                                                  ...f,
                                                  amount_paid: Number(e.target.value) || 0,
                                                }))
                                              }
                                              className="w-full rounded-lg border border-border-300 bg-surface px-3 py-2 text-sm"
                                            />
                                          </div>
                                          <div>
                                            <label className="mb-1 block text-xs font-medium text-foreground-secondary">
                                              ملاحظات
                                            </label>
                                            <input
                                              type="text"
                                              value={obligationPaymentForm.notes}
                                              onChange={e =>
                                                setObligationPaymentForm(f => ({
                                                  ...f,
                                                  notes: e.target.value,
                                                }))
                                              }
                                              className="w-full rounded-lg border border-border-300 bg-surface px-3 py-2 text-sm"
                                              placeholder="اختياري"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setEditingObligationLineId(null)}
                                            className={outlineCompactButtonClass}
                                            disabled={updateObligationLinePayment.isPending}
                                          >
                                            إلغاء
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void handleSaveObligationLinePayment(
                                                line.id,
                                                line.amount_due
                                              )
                                            }
                                            className={successCompactButtonClass}
                                            disabled={updateObligationLinePayment.isPending}
                                          >
                                            {updateObligationLinePayment.isPending ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <CheckCircle className="h-4 w-4" />
                                            )}
                                            حفظ
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )
                    })
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-border-200 px-5 py-4">
                <button
                  type="button"
                  onClick={handleCloseObligationDetail}
                  className={outlineCompactButtonClass}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            Dialog: إضافة التزام جديد
        ══════════════════════════════════════════════════════════════ */}
        {showAddObligationDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-secondary-950/55 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-lg rounded-2xl border border-border-200 bg-surface shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border-200 px-5 py-4">
                <h2 className="text-lg font-bold text-foreground">إضافة التزام جديد</h2>
                <button
                  type="button"
                  onClick={() => setShowAddObligationDialog(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-200 text-foreground-tertiary hover:bg-surface-secondary-50 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                {/* Employee search */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground-secondary">
                    البحث عن موظف (الاسم أو رقم الإقامة)
                  </label>
                  <input
                    type="text"
                    value={addObligationEmployeeSearch}
                    onChange={(e) => {
                      setAddObligationEmployeeSearch(e.target.value)
                      setAddObligationSelectedEmployeeId('')
                    }}
                    placeholder="اكتب الاسم أو رقم الإقامة..."
                    className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                  />
                  {addObligationEmployeeSearch && !addObligationSelectedEmployeeId && (
                    <div className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-border-200 bg-surface shadow-lg">
                      {dialogEmployeeOptions.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-foreground-tertiary">لا توجد نتائج</p>
                      ) : (
                        dialogEmployeeOptions.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setAddObligationSelectedEmployeeId(emp.id as string)
                              setAddObligationEmployeeSearch(
                                `${emp.name} — ${emp.residence_number}`
                              )
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-secondary-50 text-right"
                          >
                            <span className="font-medium">{emp.name}</span>
                            <span className="font-mono text-foreground-tertiary text-xs">
                              {emp.residence_number}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {addObligationSelectedEmployeeId && (
                    <p className="mt-1 text-xs text-green-700 font-medium flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      تم اختيار الموظف
                    </p>
                  )}
                </div>

                {/* Obligation type */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground-secondary">
                    نوع الالتزام
                  </label>
                  <select
                    value={addObligationForm.obligation_type}
                    onChange={(e) =>
                      setAddObligationForm((f) => ({
                        ...f,
                        obligation_type: e.target.value as typeof addObligationForm.obligation_type,
                      }))
                    }
                    className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                  >
                    <option value="advance">سلفة</option>
                    <option value="transfer">نقل كفالة</option>
                    <option value="renewal">تجديد</option>
                    <option value="penalty">غرامة / جزاء</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                {/* Amount + installments */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground-secondary">
                      قيمة الالتزام الكلية
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={addObligationForm.total_amount || ''}
                      onChange={(e) =>
                        setAddObligationForm((f) => ({
                          ...f,
                          total_amount: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground-secondary">
                      عدد أشهر الأقساط
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={addObligationForm.installment_count || ''}
                      onChange={(e) =>
                        setAddObligationForm((f) => ({
                          ...f,
                          installment_count: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                      placeholder="1"
                    />
                  </div>
                </div>

                {/* Start month */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground-secondary">
                    شهر بداية أول قسط
                  </label>
                  <input
                    type="month"
                    value={addObligationForm.start_month}
                    onChange={(e) =>
                      setAddObligationForm((f) => ({ ...f, start_month: e.target.value }))
                    }
                    className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm"
                  />
                </div>

                {/* Preview */}
                {addObligationForm.total_amount > 0 && addObligationForm.installment_count > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    قسط شهري تقريبي:{' '}
                    <strong>
                      {(
                        addObligationForm.total_amount / addObligationForm.installment_count
                      ).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </strong>{' '}
                    × {addObligationForm.installment_count} شهر
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground-secondary">
                    ملاحظات (اختياري)
                  </label>
                  <textarea
                    value={addObligationForm.notes}
                    onChange={(e) =>
                      setAddObligationForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    className="w-full rounded-xl border border-border-300 bg-surface px-3 py-2 text-sm resize-none"
                    placeholder="أي ملاحظات إضافية..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowAddObligationDialog(false)}
                  className={outlineCompactButtonClass}
                  disabled={createObligationPlan.isPending}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddObligation()}
                  className={primaryCompactButtonClass}
                  disabled={createObligationPlan.isPending || !addObligationSelectedEmployeeId}
                >
                  {createObligationPlan.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  إضافة الالتزام
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
