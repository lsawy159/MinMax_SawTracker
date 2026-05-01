import { useState, useEffect, useMemo, ReactNode } from 'react'
import { supabase, Employee, Company, Project } from '@/lib/supabase'
import {
  FileDown,
  CheckSquare,
  Square,
  Calendar,
  Shield,
  FileText,
  Building2,
  RotateCcw,
  Search,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { saveAs } from 'file-saver'
import { loadXlsx } from '@/utils/lazyXlsx'
import { differenceInDays } from 'date-fns'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { normalizeArabic } from '@/utils/textUtils'
import { getEmployeeBusinessFields } from '@/utils/employeeBusinessFields'
import {
  EMPTY_PAYROLL_OBLIGATION_BREAKDOWN,
  getPayrollComponentBucket,
  getPayrollObligationBreakdownTotal,
  getPayrollObligationBucketFromType,
  normalizePayrollObligationBreakdown,
} from '@/utils/payrollObligationBuckets'
import { EmployeeListSkeleton } from '@/components/ui/Skeleton'

interface CompanyWithStats extends Company {
  employee_count?: number
  available_slots?: number
}

interface ExportTabProps {
  initialExportType?: 'employees' | 'companies'
  hideTypeSelector?: boolean
}

export default function ExportTab({
  initialExportType = 'employees',
  hideTypeSelector = false,
}: ExportTabProps = {}) {
  const [exportType, setExportType] = useState<'employees' | 'companies'>(initialExportType)
  const [employees, setEmployees] = useState<
    (Employee & { company: Company; project?: Project })[]
  >([])
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [companiesFilterQuery, setCompaniesFilterQuery] = useState('')
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [selectedProjectName, setSelectedProjectName] = useState<string>('')
  const [projectFilterQuery, setProjectFilterQuery] = useState<string>('')
  const [expandedFilterGroup, setExpandedFilterGroup] = useState<string | null>(null)
  const [expandedCompanyFilterGroup, setExpandedCompanyFilterGroup] = useState<string | null>(null)
  const [employeeExportMode, setEmployeeExportMode] = useState<'basic' | 'monthly'>('basic')
  const [monthlyExportMonth, setMonthlyExportMonth] = useState(new Date().toISOString().slice(0, 7))

  // Multi-select for companies (replaces filterCompany)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set())

  // Employee filters
  const [employeeFilters, setEmployeeFilters] = useState({
    expiredResidence: false,
    expiringResidence30: false,
    expiredHealthInsurance: false,
    expiringHealthInsurance30: false,
    expiredHiredContract: false,
    expiringHiredContract30: false,
    expiredContract: false,
    expiringContract30: false,
  })

  // Company filters
  const [companyFilters, setCompanyFilters] = useState({
    completed: false,
    vacant1: false,
    vacant2: false,
    vacant3: false,
    vacant4: false,
    expiredCommercialReg: false,
    expiringCommercialReg30: false,
    expiredPowerSub: false,
    expiringPowerSub30: false,
    expiredMoqeemSub: false,
    expiringMoqeemSub30: false,
    exempted: false,
    notExempted: false,
  })

  // UI chip component
  const Chip = ({
    active,
    onClick,
    children,
    color = 'blue',
  }: {
    active: boolean
    onClick: () => void
    children: ReactNode
    color?: 'blue' | 'green'
  }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-medium leading-4 transition ${
        active
          ? color === 'blue'
            ? 'border-primary bg-primary text-slate-950 hover:bg-primary/90'
            : 'border-green-600 bg-green-600 text-white hover:bg-green-700'
          : color === 'blue'
            ? 'border-neutral-200 bg-white text-neutral-700 hover:bg-primary/10'
            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-green-50'
      }`}
    >
      {children}
    </button>
  )

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [employeesRes, companiesRes] = await Promise.all([
        supabase
          .from('employees')
          .select(
            'id,company_id,name,profession,nationality,birth_date,phone,passport_number,residence_number,joining_date,contract_expiry,hired_worker_contract_expiry,residence_expiry,project_id,project_name,bank_account,residence_image_url,health_insurance_expiry,salary,notes,additional_fields,is_deleted,deleted_at,created_at,updated_at, company:companies(id,name,unified_number), project:projects(id,name)'
          )
          .order('name'),
        supabase
          .from('companies')
          .select(
            'id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_number,commercial_registration_status,additional_fields,ending_subscription_power_date,ending_subscription_moqeem_date,employee_count,max_employees,notes,exemptions,company_type,created_at,updated_at'
          )
          .order('name'),
      ])

      if (employeesRes.error) throw employeesRes.error
      if (companiesRes.error) throw companiesRes.error

      setEmployees(
        (employeesRes.data || []) as unknown as (Employee & {
          company: Company
          project?: Project
        })[]
      )

      // [OPTIMIZATION] حساب عدد الموظفين لكل الشركات باستعلام واحد بدلاً من عدة استعلامات
      // استخدام البيانات المحملة بالفعل من employeesRes
      const employeeCounts: Record<string, number> = {}
      employeesRes.data?.forEach((emp) => {
        if (emp.company_id) {
          employeeCounts[emp.company_id] = (employeeCounts[emp.company_id] || 0) + 1
        }
      })

      // دمج البيانات
      const companiesWithStats = (companiesRes.data || []).map((company) => {
        const employeeCount = employeeCounts[company.id] || 0
        const maxEmployees = company.max_employees || 4
        const availableSlots = Math.max(0, maxEmployees - employeeCount)

        return {
          ...company,
          employee_count: employeeCount,
          available_slots: availableSlots,
        } as CompanyWithStats
      })

      setCompanies(companiesWithStats)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  // Helper functions for date checks
  const isExpired = (date: string | null | undefined): boolean => {
    if (!date) return false
    const daysRemaining = differenceInDays(new Date(date), new Date())
    return daysRemaining < 0
  }

  const isExpiringWithin30Days = (date: string | null | undefined): boolean => {
    if (!date) return false
    const daysRemaining = differenceInDays(new Date(date), new Date())
    return daysRemaining >= 0 && daysRemaining <= 30
  }

  // Date status helpers for colored indicators
  const getDaysRemaining = (date?: string | null): number | null => {
    if (!date) return null
    return differenceInDays(new Date(date), new Date())
  }

  // Thresholds similar to main Employees page (fallback values)
  const STATUS_THRESHOLDS = {
    urgent: 7,
    high: 15,
    medium: 30,
  }

  const getDateTextColor = (days: number | null): string => {
    if (days === null) return 'text-neutral-700'
    if (days < 0) return 'text-red-700'
    if (days <= STATUS_THRESHOLDS.urgent) return 'text-red-600'
    if (days <= STATUS_THRESHOLDS.high) return 'text-warning-600'
    if (days <= STATUS_THRESHOLDS.medium) return 'text-amber-600'
    return 'text-neutral-700'
  }

  const formatDateStatus = (days: number | null, expiredLabel: string): string => {
    if (days === null) return ''
    if (days < 0) return expiredLabel
    if (days === 0) return 'اليوم'
    return `بعد ${days} يوم`
  }

  const calculateAvailableSlots = (company: CompanyWithStats): number => {
    const employeeCount = company.employee_count || 0
    const maxEmployees = company.max_employees || 4
    return Math.max(0, maxEmployees - employeeCount)
  }

  // Filter employees based on search, company selection, and filter options
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.profession.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(emp.residence_number ?? '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())

      // Company filter - if no companies selected, show all; otherwise only selected companies
      const matchesCompany =
        selectedCompanyIds.size === 0 || selectedCompanyIds.has(emp.company_id?.toString() || '')

      // Project filter
      const matchesProject =
        !selectedProjectName ||
        (emp.project?.name || emp.project_name || '').toLowerCase() ===
          selectedProjectName.toLowerCase()

      if (!matchesSearch || !matchesCompany || !matchesProject) return false

      // Apply employee filters (all must match if enabled)
      if (employeeFilters.expiredResidence && !isExpired(emp.residence_expiry)) return false
      if (employeeFilters.expiringResidence30 && !isExpiringWithin30Days(emp.residence_expiry))
        return false
      if (employeeFilters.expiredHealthInsurance && !isExpired(emp.health_insurance_expiry))
        return false
      if (
        employeeFilters.expiringHealthInsurance30 &&
        !isExpiringWithin30Days(emp.health_insurance_expiry)
      )
        return false
      if (employeeFilters.expiredHiredContract && !isExpired(emp.hired_worker_contract_expiry))
        return false
      if (
        employeeFilters.expiringHiredContract30 &&
        !isExpiringWithin30Days(emp.hired_worker_contract_expiry)
      )
        return false
      if (employeeFilters.expiredContract && !isExpired(emp.contract_expiry)) return false
      if (employeeFilters.expiringContract30 && !isExpiringWithin30Days(emp.contract_expiry))
        return false

      return true
    })
  }, [employees, searchQuery, selectedCompanyIds, selectedProjectName, employeeFilters])

  // Filter companies list inside employee sidebar by query
  const companiesForEmployeeFilter = useMemo(() => {
    if (!companiesFilterQuery) return companies
    const q = companiesFilterQuery.toLowerCase()
    return companies.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        String(c.unified_number ?? '')
          .toLowerCase()
          .includes(q)
    )
  }, [companies, companiesFilterQuery])

  // Unique projects for filter
  const projectsForEmployeeFilter = useMemo(() => {
    const all = employees
      .map((e) => (e.project?.name || e.project_name || '').trim())
      .filter(Boolean) as string[]
    const unique = Array.from(new Set(all))
    if (!projectFilterQuery) return unique.sort()
    const q = projectFilterQuery.toLowerCase()
    return unique.filter((name) => name.toLowerCase().includes(q)).sort()
  }, [employees, projectFilterQuery])

  // Filter companies based on filter options
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // Search filter by name or unified number
      const matchesSearch =
        !companySearchQuery ||
        (company.name || '').toLowerCase().includes(companySearchQuery.toLowerCase()) ||
        String(company.unified_number ?? '')
          .toLowerCase()
          .includes(companySearchQuery.toLowerCase())
      if (!matchesSearch) return false
      // Apply company filters (all must match if enabled)
      if (companyFilters.completed) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 0) return false
      }
      if (companyFilters.vacant1) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 1) return false
      }
      if (companyFilters.vacant2) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 2) return false
      }
      if (companyFilters.vacant3) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 3) return false
      }
      if (companyFilters.vacant4) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 4) return false
      }
      if (companyFilters.expiredCommercialReg && !isExpired(company.commercial_registration_expiry))
        return false
      if (
        companyFilters.expiringCommercialReg30 &&
        !isExpiringWithin30Days(company.commercial_registration_expiry)
      )
        return false
      if (companyFilters.expiredPowerSub && !isExpired(company.ending_subscription_power_date))
        return false
      if (
        companyFilters.expiringPowerSub30 &&
        !isExpiringWithin30Days(company.ending_subscription_power_date)
      )
        return false
      if (companyFilters.expiredMoqeemSub && !isExpired(company.ending_subscription_moqeem_date))
        return false
      if (
        companyFilters.expiringMoqeemSub30 &&
        !isExpiringWithin30Days(company.ending_subscription_moqeem_date)
      )
        return false

      if (companyFilters.exempted || companyFilters.notExempted) {
        const targetPhrase = normalizeArabic('تم الاعفاء')
        const normalizedValue = normalizeArabic(company.exemptions)
        const isExempt = normalizedValue.includes(targetPhrase)

        if (companyFilters.exempted && !companyFilters.notExempted && !isExempt) return false
        if (!companyFilters.exempted && companyFilters.notExempted && isExempt) return false
      }

      return true
    })
  }, [companies, companyFilters, companySearchQuery])

  const toggleEmployeeSelection = (id: string) => {
    const newSet = new Set(selectedEmployees)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedEmployees(newSet)
  }

  const toggleAllEmployees = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set())
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map((e) => e.id)))
    }
  }

  // Toggle company selection for employee filter
  const toggleCompanySelectionForEmployees = (id: string) => {
    const newSet = new Set(selectedCompanyIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedCompanyIds(newSet)
  }

  const toggleAllCompaniesForEmployees = () => {
    if (selectedCompanyIds.size === companies.length) {
      setSelectedCompanyIds(new Set())
    } else {
      setSelectedCompanyIds(new Set(companies.map((c) => c.id)))
    }
  }

  // Toggle company selection for export
  const toggleCompanySelection = (id: string) => {
    const newSet = new Set(selectedCompanies)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedCompanies(newSet)
  }

  const toggleAllCompanies = () => {
    if (selectedCompanies.size === filteredCompanies.length) {
      setSelectedCompanies(new Set())
    } else {
      setSelectedCompanies(new Set(filteredCompanies.map((c) => c.id)))
    }
  }

  // Toggle employee filter options
  const toggleEmployeeFilter = (filterKey: keyof typeof employeeFilters) => {
    setEmployeeFilters((prev) => ({
      ...prev,
      [filterKey]: !prev[filterKey],
    }))
  }

  // Toggle company filter options
  const toggleCompanyFilter = (filterKey: keyof typeof companyFilters) => {
    setCompanyFilters((prev) => ({
      ...prev,
      [filterKey]: !prev[filterKey],
    }))
  }

  // Toggle filter groups
  const toggleFilterGroup = (group: string) => {
    setExpandedFilterGroup(expandedFilterGroup === group ? null : group)
  }

  const toggleCompanyFilterGroup = (group: string) => {
    setExpandedCompanyFilterGroup(expandedCompanyFilterGroup === group ? null : group)
  }

  // Calculate active filters count
  const getActiveEmployeeFiltersCount = useMemo(() => {
    let count = 0
    Object.values(employeeFilters).forEach((val) => {
      if (val) count++
    })
    if (selectedCompanyIds.size > 0) count++
    if (selectedProjectName) count++
    return count
  }, [employeeFilters, selectedCompanyIds, selectedProjectName])

  const getActiveCompanyFiltersCount = useMemo(() => {
    let count = 0
    Object.values(companyFilters).forEach((val) => {
      if (val) count++
    })
    return count
  }, [companyFilters])

  // Reset all filters
  const resetEmployeeFilters = () => {
    setEmployeeFilters({
      expiredResidence: false,
      expiringResidence30: false,
      expiredHealthInsurance: false,
      expiringHealthInsurance30: false,
      expiredHiredContract: false,
      expiringHiredContract30: false,
      expiredContract: false,
      expiringContract30: false,
    })
    setSelectedCompanyIds(new Set())
    setSearchQuery('')
    toast.success('تم إعادة تعيين جميع الفلاتر')
  }

  const resetCompanyFilters = () => {
    setCompanyFilters({
      completed: false,
      vacant1: false,
      vacant2: false,
      vacant3: false,
      vacant4: false,
      expiredCommercialReg: false,
      expiringCommercialReg30: false,
      expiredPowerSub: false,
      expiringPowerSub30: false,
      expiredMoqeemSub: false,
      expiringMoqeemSub30: false,
      exempted: false,
      notExempted: false,
    })
    setSearchQuery('')
    toast.success('تم إعادة تعيين جميع الفلاتر')
  }

  const exportEmployees = async () => {
    if (selectedEmployees.size === 0) {
      toast.error('الرجاء اختيار موظف واحد على الأقل')
      return
    }

    setLoading(true)
    try {
      const XLSX = await loadXlsx()
      const selectedData = filteredEmployees.filter((e) => selectedEmployees.has(e.id))
      const selectedIds = selectedData.map((emp) => emp.id)

      const payrollMap = new Map<
        string,
        {
          overtime_amount?: number
          deductions_amount?: number
          installment_deducted_amount?: number
          deductions_notes?: string
          overtime_notes?: string
          breakdown: typeof EMPTY_PAYROLL_OBLIGATION_BREAKDOWN
        }
      >()

      const obligationTotalsMap = new Map<string, typeof EMPTY_PAYROLL_OBLIGATION_BREAKDOWN>()

      if (selectedIds.length > 0) {
        const { data: obligationHeaders, error: obligationTotalsError } = await supabase
          .from('employee_obligation_headers')
          .select('employee_id, obligation_type, total_amount, status')
          .in('employee_id', selectedIds)

        if (obligationTotalsError) throw obligationTotalsError
        ;(obligationHeaders || []).forEach((header) => {
          const bucket = getPayrollObligationBucketFromType(header.obligation_type)
          const current = normalizePayrollObligationBreakdown(
            obligationTotalsMap.get(header.employee_id)
          )
          current[bucket] += Number(header.total_amount || 0)
          obligationTotalsMap.set(header.employee_id, current)
        })
      }

      if (employeeExportMode === 'monthly' && selectedIds.length > 0) {
        const monthStart = `${monthlyExportMonth}-01`
        const nextMonthDate = new Date(`${monthlyExportMonth}-01T00:00:00`)
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1)
        const nextMonthStart = nextMonthDate.toISOString().slice(0, 10)

        const { data: payrollEntries, error: payrollError } = await supabase
          .from('payroll_entries')
          .select(
            'id, employee_id, payroll_month, overtime_amount, deductions_amount, installment_deducted_amount, deductions_notes, overtime_notes'
          )
          .in('employee_id', selectedIds)
          .gte('payroll_month', monthStart)
          .lt('payroll_month', nextMonthStart)

        if (payrollError) throw payrollError

        const entryIds = (payrollEntries || []).map((entry) => entry.id)
        const { data: components, error: componentsError } =
          entryIds.length > 0
            ? await supabase
                .from('payroll_entry_components')
                .select('payroll_entry_id, component_code, amount')
                .in('payroll_entry_id', entryIds)
            : { data: [], error: null }

        if (componentsError) throw componentsError

        const breakdownByEntryId = new Map<string, typeof EMPTY_PAYROLL_OBLIGATION_BREAKDOWN>()
        ;(components || []).forEach((component) => {
          const bucket = getPayrollComponentBucket(component.component_code)
          if (!bucket) return

          const current = normalizePayrollObligationBreakdown(
            breakdownByEntryId.get(component.payroll_entry_id)
          )
          current[bucket] += Number(component.amount || 0)
          breakdownByEntryId.set(component.payroll_entry_id, current)
        })
        ;(payrollEntries || []).forEach((entry) => {
          const currentBreakdown = normalizePayrollObligationBreakdown(
            breakdownByEntryId.get(entry.id) ?? {
              ...EMPTY_PAYROLL_OBLIGATION_BREAKDOWN,
              penalty: Number(entry.deductions_amount || 0),
              advance: Number(entry.installment_deducted_amount || 0),
            }
          )

          payrollMap.set(entry.employee_id, {
            overtime_amount: Number(entry.overtime_amount || 0),
            deductions_amount: Number(entry.deductions_amount || 0),
            installment_deducted_amount: Number(entry.installment_deducted_amount || 0),
            deductions_notes: entry.deductions_notes || '',
            overtime_notes: entry.overtime_notes || '',
            breakdown: currentBreakdown,
          })
        })
      }

      const excelData = selectedData.map((emp) => {
        const businessFields = getEmployeeBusinessFields(emp)
        const obligationTotals = normalizePayrollObligationBreakdown(
          obligationTotalsMap.get(emp.id)
        )
        const baseRow = {
          الاسم: emp.name,
          المهنة: emp.profession || '',
          الجنسية: emp.nationality || '',
          'رقم الإقامة': emp.residence_number,
          'رقم الجواز': emp.passport_number || '',
          'رقم الهاتف': emp.phone || '',
          'الحساب البنكي': emp.bank_account || '',
          'اسم البنك': businessFields.bank_name,
          الراتب: emp.salary || '',
          'حالة عقد أجير': businessFields.hired_worker_contract_status,
          'إجمالي رسوم نقل وتجديد': obligationTotals.transfer_renewal,
          'إجمالي جزاءات وغرامات': obligationTotals.penalty,
          'إجمالي السلف': obligationTotals.advance,
          'إجمالي أخرى': obligationTotals.other,
          'إجمالي الاستقطاعات': getPayrollObligationBreakdownTotal(obligationTotals),
          المشروع: emp.project?.name || emp.project_name || '',
          'الشركة أو المؤسسة': emp.company?.name || '',
          'الرقم الموحد': emp.company?.unified_number || '',
          'تاريخ الميلاد': emp.birth_date ? formatDateShortWithHijri(emp.birth_date) : '',
          'تاريخ الالتحاق': emp.joining_date ? formatDateShortWithHijri(emp.joining_date) : '',
          'تاريخ انتهاء الإقامة': emp.residence_expiry
            ? formatDateShortWithHijri(emp.residence_expiry)
            : '',
          'تاريخ انتهاء العقد': emp.contract_expiry
            ? formatDateShortWithHijri(emp.contract_expiry)
            : '',
          'تاريخ انتهاء عقد أجير': emp.hired_worker_contract_expiry
            ? formatDateShortWithHijri(emp.hired_worker_contract_expiry)
            : '',
          'تاريخ انتهاء التأمين الصحي': emp.health_insurance_expiry
            ? formatDateShortWithHijri(emp.health_insurance_expiry)
            : '',
          'رابط صورة الإقامة': emp.residence_image_url || '',
          الملاحظات: emp.notes || '',
        }

        if (employeeExportMode !== 'monthly') {
          return baseRow
        }

        const payrollEntry = payrollMap.get(emp.id)
        const monthlyBreakdown = normalizePayrollObligationBreakdown(payrollEntry?.breakdown)

        return {
          ...baseRow,
          الشهر: monthlyExportMonth,
          الإضافي: Number(payrollEntry?.overtime_amount || 0),
          'ملاحظات الجزاءات': payrollEntry?.deductions_notes || '',
          'ملاحظات الإضافي': payrollEntry?.overtime_notes || '',
          'قسط رسوم نقل وتجديد': monthlyBreakdown.transfer_renewal,
          'قسط جزاءات وغرامات': monthlyBreakdown.penalty,
          'قسط سلفة': monthlyBreakdown.advance,
          'قسط أخرى': monthlyBreakdown.other,
          'إجمالي استقطاعات الشهر': getPayrollObligationBreakdownTotal(monthlyBreakdown),
        }
      })

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        employeeExportMode === 'monthly' ? 'تصدير شهري' : 'الموظفين'
      )

      ws['!cols'] =
        employeeExportMode === 'monthly'
          ? [
              { wch: 20 },
              { wch: 18 },
              { wch: 14 },
              { wch: 16 },
              { wch: 16 },
              { wch: 25 },
              { wch: 25 },
              { wch: 14 },
              { wch: 14 },
              { wch: 16 },
              { wch: 14 },
              { wch: 14 },
              { wch: 20 },
              { wch: 24 },
              { wch: 16 },
              { wch: 15 },
              { wch: 15 },
              { wch: 15 },
              { wch: 15 },
              { wch: 18 },
              { wch: 20 },
              { wch: 20 },
              { wch: 18 },
              { wch: 28 },
              { wch: 28 },
              { wch: 22 },
              { wch: 22 },
            ]
          : [
              { wch: 20 },
              { wch: 20 },
              { wch: 15 },
              { wch: 15 },
              { wch: 15 },
              { wch: 15 },
              { wch: 25 },
              { wch: 15 },
              { wch: 14 },
              { wch: 18 },
              { wch: 16 },
              { wch: 14 },
              { wch: 14 },
              { wch: 20 },
              { wch: 25 },
              { wch: 15 },
              { wch: 15 },
              { wch: 15 },
              { wch: 15 },
              { wch: 15 },
              { wch: 20 },
              { wch: 25 },
              { wch: 25 },
            ]

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const dateLabel = new Date().toISOString().split('T')[0]
      const exportFileName =
        employeeExportMode === 'monthly'
          ? `employees_monthly_export_${monthlyExportMonth}_${dateLabel}.xlsx`
          : `employees_export_${dateLabel}.xlsx`

      saveAs(data, exportFileName)
      toast.success(`تم تصدير ${selectedEmployees.size} موظف بنجاح`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('فشل تصدير البيانات')
    } finally {
      setLoading(false)
    }
  }

  const exportCompanies = async () => {
    if (selectedCompanies.size === 0) {
      toast.error('الرجاء اختيار مؤسسة واحدة على الأقل')
      return
    }

    setLoading(true)
    try {
      const XLSX = await loadXlsx()
      // Export only selected companies from filtered list
      const selectedData = filteredCompanies.filter((c) => selectedCompanies.has(c.id))

      const excelData = selectedData.map((company) => ({
        'اسم المؤسسة': company.name,
        'الرقم الموحد': company.unified_number || '',
        'رقم اشتراك التأمينات الاجتماعية': company.social_insurance_number || '',
        'رقم اشتراك قوى': company.labor_subscription_number || '',
        'تاريخ انتهاء السجل التجاري': company.commercial_registration_expiry
          ? formatDateShortWithHijri(company.commercial_registration_expiry)
          : '',
        'تاريخ انتهاء اشتراك قوى': company.ending_subscription_power_date
          ? formatDateShortWithHijri(company.ending_subscription_power_date)
          : '',
        'تاريخ انتهاء اشتراك مقيم': company.ending_subscription_moqeem_date
          ? formatDateShortWithHijri(company.ending_subscription_moqeem_date)
          : '',
        'عدد الموظفين': company.employee_count || 0,
        'الحد الأقصى للموظفين': company.max_employees || 0,
        الاعفاءات: company.exemptions || '',
        'نوع المؤسسة': company.company_type || '',
        الملاحظات: company.notes || '',
      }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'المؤسسات')

      const wscols = [
        { wch: 30 }, // اسم المؤسسة
        { wch: 20 }, // الرقم الموحد
        { wch: 25 }, // رقم اشتراك التأمينات الاجتماعية
        { wch: 20 }, // رقم اشتراك قوى
        { wch: 25 }, // تاريخ انتهاء السجل التجاري
        { wch: 25 }, // تاريخ انتهاء اشتراك قوى
        { wch: 25 }, // تاريخ انتهاء اشتراك مقيم
        { wch: 15 }, // عدد الموظفين
        { wch: 20 }, // الحد الأقصى للموظفين
        { wch: 20 }, // الاعفاءات
        { wch: 20 }, // نوع المؤسسة
        { wch: 25 }, // الملاحظات
      ]
      ws['!cols'] = wscols

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const data = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      saveAs(data, `companies_export_${new Date().toISOString().split('T')[0]}.xlsx`)

      toast.success(`تم تصدير ${selectedCompanies.size} مؤسسة بنجاح`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('فشل تصدير البيانات')
    } finally {
      setLoading(false)
    }
  }

  const isInitialLoading = loading && employees.length === 0 && companies.length === 0

  if (isInitialLoading) {
    return (
      <div className="space-y-4 text-[13px] leading-5">
        <div className="app-filter-surface">
          <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
        </div>
        <EmployeeListSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-3 text-[13px] leading-5">
      {!hideTypeSelector && (
        <div>
          <label className="block text-[12px] font-medium text-neutral-700 mb-1">
            نوع البيانات المراد تصديرها
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setExportType('employees')
                setSelectedEmployees(new Set())
                setSelectedCompanyIds(new Set())
                setSearchQuery('')
              }}
              className={`flex-1 rounded-md border px-3 py-2 font-medium transition ${
                exportType === 'employees'
                  ? 'border-primary bg-primary/15 text-slate-900'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
            >
              موظفين
            </button>
            <button
              onClick={() => {
                setExportType('companies')
                setSelectedCompanies(new Set())
                setSearchQuery('')
              }}
              className={`flex-1 px-3 py-2 rounded-md border font-medium transition ${
                exportType === 'companies'
                  ? 'border-green-600 bg-green-50 text-success-700'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
            >
              مؤسسات
            </button>
          </div>
        </div>
      )}

      {/* Export Employees Section */}
      {exportType === 'employees' && (
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[14px] font-bold text-neutral-900">تصدير الموظفين</h3>
            <button
              onClick={exportEmployees}
              disabled={loading || selectedEmployees.size === 0}
              className="app-button-primary px-3 py-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-5 h-5" />
              )}
              {loading ? 'جارٍ التصدير...' : `تصدير المحدد (${selectedEmployees.size})`}
            </button>
          </div>

          <div className="app-filter-surface mb-3 flex flex-col gap-3 md:flex-row md:items-end">
            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                نوع تصدير الموظفين
              </label>
              <select
                value={employeeExportMode}
                onChange={(e) => setEmployeeExportMode(e.target.value as 'basic' | 'monthly')}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="basic">تصدير أساسي للموظفين</option>
                <option value="monthly">تصدير شهري بالتفاصيل المالية</option>
              </select>
            </div>

            {employeeExportMode === 'monthly' && (
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  الشهر المطلوب
                </label>
                <input
                  type="month"
                  value={monthlyExportMonth}
                  onChange={(e) => setMonthlyExportMonth(e.target.value)}
                  className="app-input py-2.5"
                />
              </div>
            )}
          </div>

          {/* Search and Filter Toggle */}
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="بحث بالاسم أو المهنة أو رقم الإقامة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="app-input py-2"
              />
            </div>
          </div>

          {/* Active Filters Bar */}
          {(getActiveEmployeeFiltersCount > 0 ||
            selectedCompanyIds.size > 0 ||
            companiesFilterQuery) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {employeeFilters.expiredResidence && (
                <Chip
                  active={true}
                  onClick={() => toggleEmployeeFilter('expiredResidence')}
                  color="blue"
                >
                  الإقامات المنتهية ✕
                </Chip>
              )}
              {employeeFilters.expiringResidence30 && (
                <Chip
                  active={true}
                  onClick={() => toggleEmployeeFilter('expiringResidence30')}
                  color="blue"
                >
                  تنتهي خلال 30 يوم ✕
                </Chip>
              )}
              {employeeFilters.expiredHealthInsurance && (
                <Chip
                  active={true}
                  onClick={() => toggleEmployeeFilter('expiredHealthInsurance')}
                  color="blue"
                >
                  تأمين صحي منتهي ✕
                </Chip>
              )}
              {employeeFilters.expiringHealthInsurance30 && (
                <Chip
                  active={true}
                  onClick={() => toggleEmployeeFilter('expiringHealthInsurance30')}
                  color="blue"
                >
                  تأمين صحي ينتهي خلال 30 يوم ✕
                </Chip>
              )}
              {employeeFilters.expiredHiredContract && (
                <Chip
                  active={true}
                  onClick={() => toggleEmployeeFilter('expiredHiredContract')}
                  color="blue"
                >
                  أجير منتهي ✕
                </Chip>
              )}
              {employeeFilters.expiringHiredContract30 && (
                <Chip
                  active={true}
                  onClick={() => toggleEmployeeFilter('expiringHiredContract30')}
                  color="blue"
                >
                  أجير ينتهي خلال 30 يوم ✕
                </Chip>
              )}
              {employeeFilters.expiredContract && (
                <Chip
                  active={true}
                  onClick={() => toggleEmployeeFilter('expiredContract')}
                  color="blue"
                >
                  عقد منتهي ✕
                </Chip>
              )}
              {employeeFilters.expiringContract30 && (
                <Chip
                  active={true}
                  onClick={() => toggleEmployeeFilter('expiringContract30')}
                  color="blue"
                >
                  عقد ينتهي خلال 30 يوم ✕
                </Chip>
              )}
              {selectedCompanyIds.size > 0 && (
                <Chip active={true} onClick={() => setSelectedCompanyIds(new Set())} color="blue">
                  مؤسسات محددة ({selectedCompanyIds.size}) ✕
                </Chip>
              )}
              {companiesFilterQuery && (
                <Chip active={true} onClick={() => setCompaniesFilterQuery('')} color="blue">
                  تصفية المؤسسات ✕
                </Chip>
              )}
              {selectedProjectName && (
                <Chip active={true} onClick={() => setSelectedProjectName('')} color="blue">
                  المشروع: {selectedProjectName} ✕
                </Chip>
              )}
            </div>
          )}

          {/* Horizontal Collapsible Filter Groups */}
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <button
              onClick={() => toggleFilterGroup('companies')}
              className={`app-toggle-button text-[12px] ${expandedFilterGroup === 'companies' ? 'app-toggle-button-active' : ''}`}
            >
              <Building2 className="w-3.5 h-3.5 inline mr-1" />
              المؤسسات
            </button>
            <button
              onClick={() => toggleFilterGroup('residence')}
              className={`app-toggle-button text-[12px] ${expandedFilterGroup === 'residence' ? 'app-toggle-button-active' : ''}`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              الإقامة
            </button>
            <button
              onClick={() => toggleFilterGroup('insurance')}
              className={`app-toggle-button text-[12px] ${expandedFilterGroup === 'insurance' ? 'app-toggle-button-active' : ''}`}
            >
              <Shield className="w-3.5 h-3.5 inline mr-1" />
              التأمين الصحي
            </button>
            <button
              onClick={() => toggleFilterGroup('project')}
              className={`app-toggle-button text-[12px] ${expandedFilterGroup === 'project' ? 'app-toggle-button-active' : ''}`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              المشروع
            </button>
            <button
              onClick={() => toggleFilterGroup('hiredContract')}
              className={`app-toggle-button text-[12px] ${expandedFilterGroup === 'hiredContract' ? 'app-toggle-button-active' : ''}`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              عقد أجير
            </button>
            <button
              onClick={() => toggleFilterGroup('employeeContract')}
              className={`app-toggle-button text-[12px] ${expandedFilterGroup === 'employeeContract' ? 'app-toggle-button-active' : ''}`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              العقد
            </button>
            {getActiveEmployeeFiltersCount > 0 && (
              <button
                onClick={resetEmployeeFilters}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-red-50 text-red-700 hover:bg-red-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                إعادة تعيين
              </button>
            )}
          </div>

          {/* Expanded Filter Group Content */}
          {expandedFilterGroup === 'companies' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 space-y-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  value={companiesFilterQuery}
                  onChange={(e) => setCompaniesFilterQuery(e.target.value)}
                  placeholder="فلترة المؤسسات بالاسم أو الرقم الموحد"
                  className="app-input bg-white py-2 pr-8 text-[12px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAllCompaniesForEmployees}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                >
                  {selectedCompanyIds.size === companies.length
                    ? 'إلغاء تحديد الكل'
                    : `تحديد الكل (${companies.length})`}
                </button>
              </div>
              <div className="border border-neutral-200 rounded-md bg-white max-h-40 overflow-y-auto p-2 space-y-1">
                {companiesForEmployeeFilter.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center gap-2 py-1 px-2 hover:bg-blue-50 rounded cursor-pointer transition"
                    onClick={() => toggleCompanySelectionForEmployees(company.id)}
                  >
                    {selectedCompanyIds.has(company.id) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    )}
                    <span className="text-[12px] text-neutral-700">
                      {company.name} - {company.unified_number || 'بدون رقم موحد'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expandedFilterGroup === 'residence' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
              <Chip
                active={employeeFilters.expiredResidence}
                onClick={() => toggleEmployeeFilter('expiredResidence')}
                color="blue"
              >
                الإقامات المنتهية
              </Chip>
              <Chip
                active={employeeFilters.expiringResidence30}
                onClick={() => toggleEmployeeFilter('expiringResidence30')}
                color="blue"
              >
                تنتهي خلال 30 يوم
              </Chip>
            </div>
          )}

          {expandedFilterGroup === 'insurance' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
              <Chip
                active={employeeFilters.expiredHealthInsurance}
                onClick={() => toggleEmployeeFilter('expiredHealthInsurance')}
                color="blue"
              >
                منتهي
              </Chip>
              <Chip
                active={employeeFilters.expiringHealthInsurance30}
                onClick={() => toggleEmployeeFilter('expiringHealthInsurance30')}
                color="blue"
              >
                ينتهي خلال 30 يوم
              </Chip>
            </div>
          )}

          {expandedFilterGroup === 'project' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 space-y-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  value={projectFilterQuery}
                  onChange={(e) => setProjectFilterQuery(e.target.value)}
                  placeholder="بحث باسم المشروع"
                  className="app-input bg-white py-2 pr-8 text-[12px]"
                />
              </div>
              <div className="border border-neutral-200 rounded-md bg-white max-h-40 overflow-y-auto p-2 space-y-1">
                <div
                  className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition ${selectedProjectName === '' ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                  onClick={() => setSelectedProjectName('')}
                >
                  <span className="text-[12px] text-neutral-700">الكل (بدون تحديد مشروع)</span>
                </div>
                {projectsForEmployeeFilter.map((name) => (
                  <div
                    key={name}
                    className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition ${selectedProjectName === name ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                    onClick={() => setSelectedProjectName(name)}
                  >
                    <span className="text-[12px] text-neutral-700">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expandedFilterGroup === 'hiredContract' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
              <Chip
                active={employeeFilters.expiredHiredContract}
                onClick={() => toggleEmployeeFilter('expiredHiredContract')}
                color="blue"
              >
                منتهي
              </Chip>
              <Chip
                active={employeeFilters.expiringHiredContract30}
                onClick={() => toggleEmployeeFilter('expiringHiredContract30')}
                color="blue"
              >
                ينتهي خلال 30 يوم
              </Chip>
            </div>
          )}

          {expandedFilterGroup === 'employeeContract' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
              <Chip
                active={employeeFilters.expiredContract}
                onClick={() => toggleEmployeeFilter('expiredContract')}
                color="blue"
              >
                منتهي
              </Chip>
              <Chip
                active={employeeFilters.expiringContract30}
                onClick={() => toggleEmployeeFilter('expiringContract30')}
                color="blue"
              >
                ينتهي خلال 30 يوم
              </Chip>
            </div>
          )}

          {/* Employees List - Desktop Table (hidden on mobile) */}
          <div className="hidden lg:block bg-white rounded-md border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-3 py-1.5 text-center text-[11px] font-medium text-neutral-700 uppercase w-10">
                      <button
                        onClick={toggleAllEmployees}
                        className="flex items-center justify-center w-4 h-4"
                      >
                        {selectedEmployees.size === filteredEmployees.length &&
                        filteredEmployees.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      الاسم
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      المهنة
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      الجنسية
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      الشركة
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      المشروع
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      رقم الإقامة
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      انتهاء العقد
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      عقد أجير
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      انتهاء الإقامة
                    </th>
                    <th className="px-3 py-1.5 text-right text-[11px] font-medium text-neutral-700 uppercase">
                      التأمين الصحي
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-neutral-50 cursor-pointer"
                      onClick={() => toggleEmployeeSelection(emp.id)}
                    >
                      <td className="px-3 py-1.5 text-center">
                        {selectedEmployees.has(emp.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400" />
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-[12px] font-medium text-neutral-900">
                        {emp.name}
                      </td>
                      <td className="px-3 py-1.5 text-[12px] text-neutral-700">{emp.profession}</td>
                      <td className="px-3 py-1.5 text-[12px] text-neutral-700">
                        {emp.nationality}
                      </td>
                      <td className="px-3 py-1.5 text-[12px] text-neutral-700">
                        {(() => {
                          const companyName = emp.company?.name || ''
                          const unifiedNumber = emp.company?.unified_number
                          return unifiedNumber ? `${companyName} (${unifiedNumber})` : companyName
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-[12px] text-neutral-700">
                        {emp.project?.name || emp.project_name || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-[12px] font-mono text-neutral-900">
                        {emp.residence_number || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-[12px]">
                        {(() => {
                          const d = getDaysRemaining(emp.contract_expiry)
                          return (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className={getDateTextColor(d)}>
                                {emp.contract_expiry
                                  ? formatDateShortWithHijri(emp.contract_expiry)
                                  : '-'}
                              </span>
                              {emp.contract_expiry && (
                                <span className="text-[11px] text-neutral-500">
                                  {formatDateStatus(d, 'منتهي')}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-[12px]">
                        {(() => {
                          const d = getDaysRemaining(emp.hired_worker_contract_expiry)
                          return (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className={getDateTextColor(d)}>
                                {emp.hired_worker_contract_expiry
                                  ? formatDateShortWithHijri(emp.hired_worker_contract_expiry)
                                  : '-'}
                              </span>
                              {emp.hired_worker_contract_expiry && (
                                <span className="text-[11px] text-neutral-500">
                                  {formatDateStatus(d, 'منتهي')}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-[12px]">
                        {(() => {
                          const d = getDaysRemaining(emp.residence_expiry)
                          return (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className={getDateTextColor(d)}>
                                {emp.residence_expiry
                                  ? formatDateShortWithHijri(emp.residence_expiry)
                                  : '-'}
                              </span>
                              {emp.residence_expiry && (
                                <span className="text-[11px] text-neutral-500">
                                  {formatDateStatus(d, 'منتهية')}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-[12px]">
                        {(() => {
                          const d = getDaysRemaining(emp.health_insurance_expiry)
                          return (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className={getDateTextColor(d)}>
                                {emp.health_insurance_expiry
                                  ? formatDateShortWithHijri(emp.health_insurance_expiry)
                                  : '-'}
                              </span>
                              {emp.health_insurance_expiry && (
                                <span className="text-[11px] text-neutral-500">
                                  {formatDateStatus(d, 'منتهي')}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employees Grid - Mobile View (visible on small screens) */}
          <div className="lg:hidden space-y-3">
            {/* Select All Button */}
            <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
              <button
                onClick={toggleAllEmployees}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {selectedEmployees.size === filteredEmployees.length &&
                filteredEmployees.length > 0 ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span>تحديد الكل ({filteredEmployees.length})</span>
              </button>
            </div>

            {/* Employees Grid */}
            {filteredEmployees.map((emp) => {
              const contractDays = getDaysRemaining(emp.contract_expiry)
              const hiredDays = getDaysRemaining(emp.hired_worker_contract_expiry)
              const residenceDays = getDaysRemaining(emp.residence_expiry)
              const insuranceDays = getDaysRemaining(emp.health_insurance_expiry)

              return (
                <div
                  key={emp.id}
                  onClick={() => toggleEmployeeSelection(emp.id)}
                  className={`bg-white border-2 rounded-lg p-4 cursor-pointer transition-all shadow-sm ${
                    selectedEmployees.has(emp.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-neutral-200 hover:border-blue-300 hover:shadow'
                  }`}
                >
                  {/* Header with checkbox and name */}
                  <div className="flex items-start gap-3 mb-3 pb-3 border-b border-neutral-200">
                    <div className="pt-0.5">
                      {selectedEmployees.has(emp.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-neutral-900 text-base leading-tight">
                        {emp.name}
                      </h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs text-neutral-600">{emp.profession}</span>
                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs text-neutral-600">{emp.nationality}</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        {emp.company?.name || 'غير محدد'}
                      </p>
                      {emp.project?.name && (
                        <p className="text-xs text-success-600 mt-0.5">📁 {emp.project.name}</p>
                      )}
                      {emp.residence_number && (
                        <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                          🆔 {emp.residence_number}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Information Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* العقد */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-500 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        العقد
                      </p>
                      {emp.contract_expiry ? (
                        <>
                          <p className={`text-xs font-medium ${getDateTextColor(contractDays)}`}>
                            {formatDateShortWithHijri(emp.contract_expiry)}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {formatDateStatus(contractDays, 'منتهي')}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-neutral-400">غير محدد</p>
                      )}
                    </div>

                    {/* عقد الأجير */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-500 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        عقد الأجير
                      </p>
                      {emp.hired_worker_contract_expiry ? (
                        <>
                          <p className={`text-xs font-medium ${getDateTextColor(hiredDays)}`}>
                            {formatDateShortWithHijri(emp.hired_worker_contract_expiry)}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {formatDateStatus(hiredDays, 'منتهي')}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-neutral-400">غير محدد</p>
                      )}
                    </div>

                    {/* الإقامة */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        الإقامة
                      </p>
                      {emp.residence_expiry ? (
                        <>
                          <p className={`text-xs font-medium ${getDateTextColor(residenceDays)}`}>
                            {formatDateShortWithHijri(emp.residence_expiry)}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {formatDateStatus(residenceDays, 'منتهية')}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-neutral-400">غير محدد</p>
                      )}
                    </div>

                    {/* التأمين الصحي */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-500 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        التأمين
                      </p>
                      {emp.health_insurance_expiry ? (
                        <>
                          <p className={`text-xs font-medium ${getDateTextColor(insuranceDays)}`}>
                            {formatDateShortWithHijri(emp.health_insurance_expiry)}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {formatDateStatus(insuranceDays, 'منتهي')}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-neutral-400">غير محدد</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Export Companies Section */}
      {exportType === 'companies' && (
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[14px] font-bold text-neutral-900">تصدير المؤسسات</h3>
            <button
              onClick={exportCompanies}
              disabled={loading || selectedCompanies.size === 0}
              className="app-button-success px-3 py-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-5 h-5" />
              )}
              {loading ? 'جارٍ التصدير...' : `تصدير المحدد (${selectedCompanies.size})`}
            </button>
          </div>

          {/* Company Search */}
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="بحث باسم المؤسسة أو الرقم الموحد..."
                value={companySearchQuery}
                onChange={(e) => setCompanySearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Active Filters Bar */}
          {getActiveCompanyFiltersCount > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {companyFilters.completed && (
                <Chip active={true} onClick={() => toggleCompanyFilter('completed')} color="green">
                  مكتملة ✕
                </Chip>
              )}
              {companyFilters.vacant1 && (
                <Chip active={true} onClick={() => toggleCompanyFilter('vacant1')} color="green">
                  مكان شاغر ✕
                </Chip>
              )}
              {companyFilters.vacant2 && (
                <Chip active={true} onClick={() => toggleCompanyFilter('vacant2')} color="green">
                  مكانين شاغرين ✕
                </Chip>
              )}
              {companyFilters.vacant3 && (
                <Chip active={true} onClick={() => toggleCompanyFilter('vacant3')} color="green">
                  3 أماكن ✕
                </Chip>
              )}
              {companyFilters.vacant4 && (
                <Chip active={true} onClick={() => toggleCompanyFilter('vacant4')} color="green">
                  4 أماكن ✕
                </Chip>
              )}
              {companyFilters.expiredCommercialReg && (
                <Chip
                  active={true}
                  onClick={() => toggleCompanyFilter('expiredCommercialReg')}
                  color="green"
                >
                  سجل تجاري منتهي ✕
                </Chip>
              )}
              {companyFilters.expiringCommercialReg30 && (
                <Chip
                  active={true}
                  onClick={() => toggleCompanyFilter('expiringCommercialReg30')}
                  color="green"
                >
                  سجل ينتهي خلال 30 يوم ✕
                </Chip>
              )}
              {companyFilters.expiredPowerSub && (
                <Chip
                  active={true}
                  onClick={() => toggleCompanyFilter('expiredPowerSub')}
                  color="green"
                >
                  اشتراك قوى منتهي ✕
                </Chip>
              )}
              {companyFilters.expiringPowerSub30 && (
                <Chip
                  active={true}
                  onClick={() => toggleCompanyFilter('expiringPowerSub30')}
                  color="green"
                >
                  قوى ينتهي خلال 30 يوم ✕
                </Chip>
              )}
              {companyFilters.expiredMoqeemSub && (
                <Chip
                  active={true}
                  onClick={() => toggleCompanyFilter('expiredMoqeemSub')}
                  color="green"
                >
                  اشتراك مقيم منتهي ✕
                </Chip>
              )}
              {companyFilters.expiringMoqeemSub30 && (
                <Chip
                  active={true}
                  onClick={() => toggleCompanyFilter('expiringMoqeemSub30')}
                  color="green"
                >
                  مقيم ينتهي خلال 30 يوم ✕
                </Chip>
              )}
              {companyFilters.exempted && (
                <Chip active={true} onClick={() => toggleCompanyFilter('exempted')} color="green">
                  تم الاعفاء ✕
                </Chip>
              )}
              {companyFilters.notExempted && (
                <Chip
                  active={true}
                  onClick={() => toggleCompanyFilter('notExempted')}
                  color="green"
                >
                  غير معفى ✕
                </Chip>
              )}
            </div>
          )}

          {/* Horizontal Collapsible Filter Groups */}
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <button
              onClick={() => toggleCompanyFilterGroup('slots')}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
                expandedCompanyFilterGroup === 'slots'
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 inline mr-1" />
              الأماكن الشاغرة
            </button>
            <button
              onClick={() => toggleCompanyFilterGroup('commercial')}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
                expandedCompanyFilterGroup === 'commercial'
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              السجل التجاري
            </button>
            <button
              onClick={() => toggleCompanyFilterGroup('subscriptions')}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
                expandedCompanyFilterGroup === 'subscriptions'
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              الاشتراكات
            </button>
            <button
              onClick={() => toggleCompanyFilterGroup('exemptions')}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
                expandedCompanyFilterGroup === 'exemptions'
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              الاعفاءات
            </button>
            {getActiveCompanyFiltersCount > 0 && (
              <button
                onClick={resetCompanyFilters}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-red-50 text-red-700 hover:bg-red-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                إعادة تعيين
              </button>
            )}
          </div>

          {/* Expanded Filter Group Content */}
          {expandedCompanyFilterGroup === 'slots' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
              <Chip
                active={companyFilters.completed}
                onClick={() => toggleCompanyFilter('completed')}
                color="green"
              >
                مكتملة
              </Chip>
              <Chip
                active={companyFilters.vacant1}
                onClick={() => toggleCompanyFilter('vacant1')}
                color="green"
              >
                مكان شاغر
              </Chip>
              <Chip
                active={companyFilters.vacant2}
                onClick={() => toggleCompanyFilter('vacant2')}
                color="green"
              >
                مكانين شاغرين
              </Chip>
              <Chip
                active={companyFilters.vacant3}
                onClick={() => toggleCompanyFilter('vacant3')}
                color="green"
              >
                3 أماكن
              </Chip>
              <Chip
                active={companyFilters.vacant4}
                onClick={() => toggleCompanyFilter('vacant4')}
                color="green"
              >
                4 أماكن
              </Chip>
            </div>
          )}

          {expandedCompanyFilterGroup === 'commercial' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
              <Chip
                active={companyFilters.expiredCommercialReg}
                onClick={() => toggleCompanyFilter('expiredCommercialReg')}
                color="green"
              >
                سجل منتهي
              </Chip>
              <Chip
                active={companyFilters.expiringCommercialReg30}
                onClick={() => toggleCompanyFilter('expiringCommercialReg30')}
                color="green"
              >
                ينتهي خلال 30 يوم
              </Chip>
            </div>
          )}

          {expandedCompanyFilterGroup === 'subscriptions' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <span className="text-[11px] font-semibold text-neutral-600">اشتراك قوى:</span>
                <Chip
                  active={companyFilters.expiredPowerSub}
                  onClick={() => toggleCompanyFilter('expiredPowerSub')}
                  color="green"
                >
                  منتهي
                </Chip>
                <Chip
                  active={companyFilters.expiringPowerSub30}
                  onClick={() => toggleCompanyFilter('expiringPowerSub30')}
                  color="green"
                >
                  ينتهي خلال 30 يوم
                </Chip>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-[11px] font-semibold text-neutral-600">اشتراك مقيم:</span>
                <Chip
                  active={companyFilters.expiredMoqeemSub}
                  onClick={() => toggleCompanyFilter('expiredMoqeemSub')}
                  color="green"
                >
                  منتهي
                </Chip>
                <Chip
                  active={companyFilters.expiringMoqeemSub30}
                  onClick={() => toggleCompanyFilter('expiringMoqeemSub30')}
                  color="green"
                >
                  ينتهي خلال 30 يوم
                </Chip>
              </div>
            </div>
          )}

          {expandedCompanyFilterGroup === 'exemptions' && (
            <div className="bg-neutral-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
              <Chip
                active={companyFilters.exempted}
                onClick={() => toggleCompanyFilter('exempted')}
                color="green"
              >
                تم الاعفاء
              </Chip>
              <Chip
                active={companyFilters.notExempted}
                onClick={() => toggleCompanyFilter('notExempted')}
                color="green"
              >
                غير معفى
              </Chip>
            </div>
          )}

          {/* Companies List - Desktop View (hidden on mobile) */}
          <div className="hidden md:block border border-neutral-200 rounded-md overflow-hidden">
            <div className="bg-neutral-50 px-3 py-1.5 border-b border-neutral-200 flex items-center gap-2 text-[13px] overflow-x-auto">
              <button
                onClick={toggleAllCompanies}
                className="text-success-600 hover:text-success-700 flex-shrink-0"
              >
                {selectedCompanies.size === filteredCompanies.length ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <span className="font-medium text-neutral-700 whitespace-nowrap">
                تحديد الكل ({filteredCompanies.length})
              </span>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {filteredCompanies.map((company) => (
                <div
                  key={company.id}
                  className="px-3 py-2 border-b border-neutral-100 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                  onClick={() => toggleCompanySelection(company.id)}
                >
                  {selectedCompanies.has(company.id) ? (
                    <CheckSquare className="w-4 h-4 text-success-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">
                      {company.unified_number
                        ? `${company.name} (${company.unified_number})`
                        : company.name}
                    </div>
                    <div className="text-neutral-600">
                      {company.max_employees && ` | الحد: ${company.max_employees} موظف`}
                      {company.available_slots !== undefined &&
                        ` | أماكن شاغرة: ${company.available_slots}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Companies Grid - Mobile View (visible on small screens) */}
          <div className="md:hidden space-y-3">
            {/* Select All Button */}
            <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
              <button
                onClick={toggleAllCompanies}
                className="flex items-center gap-2 text-sm font-medium text-success-600 hover:text-success-700"
              >
                {selectedCompanies.size === filteredCompanies.length ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span>تحديد الكل ({filteredCompanies.length})</span>
              </button>
            </div>

            {/* Companies Grid */}
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                onClick={() => toggleCompanySelection(company.id)}
                className={`bg-white border-2 rounded-lg p-4 cursor-pointer transition-all shadow-sm ${
                  selectedCompanies.has(company.id)
                    ? 'border-green-500 bg-green-50'
                    : 'border-neutral-200 hover:border-green-300 hover:shadow'
                }`}
              >
                {/* Header with checkbox and company name */}
                <div className="flex items-start gap-3 mb-3 pb-3 border-b border-neutral-200">
                  <div className="pt-0.5">
                    {selectedCompanies.has(company.id) ? (
                      <CheckSquare className="w-5 h-5 text-success-600" />
                    ) : (
                      <Square className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-neutral-900 text-base leading-tight">
                      {company.name}
                    </h4>
                    {company.unified_number && (
                      <p className="text-xs text-neutral-600 mt-1 font-mono">
                        🏢 {company.unified_number}
                      </p>
                    )}
                    {company.company_type && (
                      <p className="text-xs text-blue-600 mt-0.5">{company.company_type}</p>
                    )}
                  </div>
                </div>

                {/* Company Stats */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="text-xs text-neutral-600">عدد الموظفين</p>
                    <p className="text-lg font-bold text-blue-700">{company.employee_count || 0}</p>
                  </div>
                  {company.max_employees && (
                    <div className="bg-purple-50 p-2 rounded">
                      <p className="text-xs text-neutral-600">الحد الأقصى</p>
                      <p className="text-lg font-bold text-purple-700">{company.max_employees}</p>
                    </div>
                  )}
                  {company.available_slots !== undefined && (
                    <div className="bg-green-50 p-2 rounded">
                      <p className="text-xs text-neutral-600">أماكن شاغرة</p>
                      <p className="text-lg font-bold text-success-700">
                        {company.available_slots}
                      </p>
                    </div>
                  )}
                </div>

                {/* Expiry Dates */}
                <div className="space-y-2">
                  {company.commercial_registration_expiry && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-600">السجل التجاري</span>
                      <span className="font-medium">{company.commercial_registration_expiry}</span>
                    </div>
                  )}
                  {company.ending_subscription_power_date && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-600">اشتراك قوى</span>
                      <span className="font-medium">{company.ending_subscription_power_date}</span>
                    </div>
                  )}
                  {company.ending_subscription_moqeem_date && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-600">اشتراك مقيم</span>
                      <span className="font-medium">{company.ending_subscription_moqeem_date}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
