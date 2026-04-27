import { useEffect, useState, useRef, useCallback, type CSSProperties } from 'react'
import { supabase, Employee, Company, Project } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import EmployeeCard from '@/components/employees/EmployeeCard'
import AddEmployeeModal from '@/components/employees/AddEmployeeModal'
import {
  Search,
  Calendar,
  AlertCircle,
  X,
  UserPlus,
  CheckSquare,
  Square,
  Trash2,
  Edit2,
  Eye,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  LayoutGrid,
  Table,
  User,
  FileText,
  Shield,
} from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { usePermissions } from '@/utils/permissions'
import { logger } from '@/utils/logger'
import {
  getEmployeeNotificationThresholdsPublic,
  type EmployeeNotificationThresholds,
} from '@/utils/employeeAlerts'
import { useIsMobileView } from '@/hooks/useIsMobileView'
import { useCardColumns } from '@/hooks/useUiPreferences'
import { PageHeader } from '@/components/ui/PageHeader'
import { FilterBar } from '@/components/ui/FilterBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/button'

const COLOR_THRESHOLD_FALLBACK: EmployeeNotificationThresholds = {
  residence_urgent_days: 7,
  residence_high_days: 15,
  residence_medium_days: 30,
  contract_urgent_days: 7,
  contract_high_days: 15,
  contract_medium_days: 30,
  health_insurance_urgent_days: 30,
  health_insurance_high_days: 45,
  health_insurance_medium_days: 60,
  hired_worker_contract_urgent_days: 7,
  hired_worker_contract_high_days: 15,
  hired_worker_contract_medium_days: 30,
}

export default function Employees() {
  const { canView, canCreate, canEdit, canDelete } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<
    (Employee & { company: Company; project?: Project })[]
  >([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [residenceNumberSearch, setResidenceNumberSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('')
  const [nationalityFilter, setNationalityFilter] = useState<string>('')
  const [professionFilter, setProfessionFilter] = useState<string>('')
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [contractFilter, setContractFilter] = useState<string>('')
  const [hiredWorkerContractFilter, setHiredWorkerContractFilter] = useState<string>('')
  const [residenceFilter, setResidenceFilter] = useState<string>('')
  const [healthInsuranceFilter, setHealthInsuranceFilter] = useState<string>('') // تحديث: insuranceFilter → healthInsuranceFilter
  const [showAlertsOnly, setShowAlertsOnly] = useState(false)

  const [companiesWithIds, setCompaniesWithIds] = useState<
    Array<{ id: string; name: string; unified_number?: number }>
  >([])
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [isCompanyDropdownOpen, setCompanyDropdownOpen] = useState(false)
  const [nationalities, setNationalities] = useState<string[]>([])
  const [professions, setProfessions] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [colorThresholds, setColorThresholds] = useState<EmployeeNotificationThresholds | null>(
    null
  )

  // حالة المودال
  const [selectedEmployee, setSelectedEmployee] = useState<
    (Employee & { company: Company; project?: Project }) | null
  >(null)
  const [isCardOpen, setIsCardOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // حالة التنقل بالسهام
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const rowRefs = useRef<(HTMLElement | null)[]>([])

  // حالة نوع العرض
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
  const isMobileView = useIsMobileView()
  const { gridClass: employeeGridClass } = useCardColumns()

  // حالة التعديل السريع - تم إزالتها

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<
    (Employee & { company: Company }) | null
  >(null)

  // Bulk selection states
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())

  // Bulk action modals
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [deletingEmployees, setDeletingEmployees] = useState(false)
  const [showBulkResidenceModal, setShowBulkResidenceModal] = useState(false)
  const [showBulkInsuranceModal, setShowBulkInsuranceModal] = useState(false)
  const [showBulkContractModal, setShowBulkContractModal] = useState(false)

  // Filter modal and sort states
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const companyDropdownRef = useRef<HTMLDivElement>(null)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadEmployeesRef = useRef<() => Promise<void>>()

  // التحقق من صلاحية العرض
  const hasViewPermission = canView('employees')

  // Sort states
  const [sortField, setSortField] = useState<
    | 'name'
    | 'profession'
    | 'nationality'
    | 'company'
    | 'project'
    | 'contract_expiry'
    | 'hired_worker_contract_expiry'
    | 'residence_expiry'
    | 'health_insurance_expiry'
  >('name') // تحديث: إضافة عقد أجير + المشروع + ending_subscription_insurance_date → health_insurance_expiry
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select(
          'id,company_id,name,profession,nationality,birth_date,phone,passport_number,residence_number,joining_date,contract_expiry,hired_worker_contract_expiry,residence_expiry,project_id,project_name,bank_account,residence_image_url,health_insurance_expiry,salary,notes,additional_fields,is_deleted,deleted_at,created_at,updated_at, company:companies(id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_number,commercial_registration_status,additional_fields,ending_subscription_power_date,ending_subscription_moqeem_date,employee_count,max_employees,notes,exemptions,company_type,created_at,updated_at), project:projects(id,name,description,status,created_at,updated_at)'
        )
        .order('name')

      if (error) throw error

      const employeesData = (data || []) as unknown as (Employee & {
        company: Company
        project?: Project
      })[]
      setEmployees(employeesData)

      // استخراج القوائم الفريدة للفلاتر
      // Reserved for future use: uniqueCompanies
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const uniqueCompanies = [
        ...new Set(employeesData.map((e) => e.company?.name).filter(Boolean)),
      ] as string[]
      const uniqueNationalities = [
        ...new Set(employeesData.map((e) => e.nationality).filter(Boolean)),
      ] as string[]
      const uniqueProfessions = [
        ...new Set(employeesData.map((e) => e.profession).filter(Boolean)),
      ] as string[]

      // بناء قائمة المؤسسات مع IDs و unified_number
      const companiesMap = new Map<string, { name: string; unified_number?: number }>()
      employeesData.forEach((emp) => {
        if (emp.company?.id && emp.company?.name) {
          if (!companiesMap.has(emp.company.id)) {
            companiesMap.set(emp.company.id, {
              name: emp.company.name,
              unified_number: emp.company.unified_number,
            })
          }
        }
      })
      const companiesWithIdsList = Array.from(companiesMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        unified_number: data.unified_number,
      }))
      setCompaniesWithIds(companiesWithIdsList.sort((a, b) => a.name.localeCompare(b.name)))

      // تحميل المشاريع من جدول projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (!projectsError && projectsData) {
        const projectNames = projectsData.map((p) => p.name).filter(Boolean)
        setProjects(projectNames.sort())
      } else {
        // Fallback: استخراج من project_name القديم إذا فشل تحميل المشاريع
        const uniqueProjects = [
          ...new Set(employeesData.map((e) => e.project?.name || e.project_name).filter(Boolean)),
        ] as string[]
        setProjects(uniqueProjects.sort())
      }

      // Companies list is no longer stored in state, only used for filtering
      setNationalities(uniqueNationalities.sort())
      setProfessions(uniqueProfessions.sort())
    } catch (error) {
      logger.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // حفظ loadEmployees في ref
  useEffect(() => {
    loadEmployeesRef.current = loadEmployees
  }, [loadEmployees])

  // تحميل إعدادات الألوان مع الاستماع لتحديثات الإعدادات
  useEffect(() => {
    let isMounted = true

    const loadThresholds = async () => {
      try {
        const thresholds = await getEmployeeNotificationThresholdsPublic()
        if (isMounted) {
          setColorThresholds(thresholds)
        }
      } catch (error) {
        logger.error('Error loading color thresholds:', error)
      }
    }

    loadThresholds()

    const handleSettingsUpdated = () => {
      loadThresholds()
    }

    window.addEventListener('settingsUpdated', handleSettingsUpdated)

    return () => {
      isMounted = false
      window.removeEventListener('settingsUpdated', handleSettingsUpdated)
    }
  }, [])

  useEffect(() => {
    if (hasViewPermission) {
      loadEmployees()
      handleUrlParams()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEmployees, hasViewPermission])

  // الاستماع لتحديثات الموظفين من أجهزة أخرى
  useEffect(() => {
    const handleEmployeeUpdated = () => {
      // إلغاء أي timeout سابق
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // إضافة debounce لتجنب تحديثات متعددة متزامنة
      debounceTimeoutRef.current = setTimeout(() => {
        logger.debug('[Employees] Employee updated event received, reloading...')
        if (loadEmployeesRef.current) {
          loadEmployeesRef.current()
        }
      }, 500) // 500ms debounce
    }

    window.addEventListener('employeeUpdated', handleEmployeeUpdated)

    // Cleanup
    return () => {
      window.removeEventListener('employeeUpdated', handleEmployeeUpdated)
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }
    }
  }, [])

  // Handle company filter from URL after companies are loaded
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const companyId = params.get('company')
    if (companyId && companiesWithIds.length > 0) {
      const company = companiesWithIds.find((c) => c.id === companyId)
      if (company && companyFilter !== company.name) {
        setCompanyFilter(company.name)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companiesWithIds, location.search])

  // Clear selection when filters change
  useEffect(() => {
    setSelectedEmployees(new Set())
  }, [
    searchTerm,
    residenceNumberSearch,
    companyFilter,
    nationalityFilter,
    professionFilter,
    projectFilter,
    contractFilter,
    hiredWorkerContractFilter,
    residenceFilter,
    healthInsuranceFilter,
    showAlertsOnly,
  ]) // تحديث: insuranceFilter → healthInsuranceFilter

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        companyDropdownRef.current &&
        !companyDropdownRef.current.contains(event.target as Node)
      ) {
        setCompanyDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // تحديث نص البحث عند تغيير الشركة المختارة
  useEffect(() => {
    if (companyFilter && companiesWithIds.length > 0) {
      const selectedCompany = companiesWithIds.find((c) => c.name === companyFilter)
      if (selectedCompany) {
        const displayText = selectedCompany.unified_number
          ? `${selectedCompany.name} (${selectedCompany.unified_number})`
          : selectedCompany.name
        if (companySearchQuery !== displayText) {
          setCompanySearchQuery(displayText)
        }
      }
    } else if (!companyFilter && companySearchQuery) {
      setCompanySearchQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter, companiesWithIds])

  // تصفية الشركات: البحث في الاسم أو الرقم الموحد
  const filteredCompanies = companiesWithIds.filter((company) => {
    if (companySearchQuery.trim()) {
      const query = companySearchQuery.toLowerCase().trim()
      const nameMatch = company.name?.toLowerCase().includes(query)
      const unifiedNumberMatch = company.unified_number?.toString().includes(query)
      return nameMatch || unifiedNumberMatch
    }
    return true
  })

  const handleUrlParams = () => {
    const params = new URLSearchParams(location.search)
    const filter = params.get('filter')
    const companyId = params.get('company')

    // Handle company filter from URL
    if (companyId) {
      // سنقوم بتعيين companyFilter بعد تحميل الموظفين والمؤسسات
      // سنستخدم useEffect للتعامل مع ذلك
    }

    switch (filter) {
      case 'alerts':
        // فلترة الموظفين الذين لديهم تنبيهات (عقود أو إقامات أو تأمين منتهية أو قريبة من الانتهاء)
        setContractFilter('لديه تنبيه')
        setHiredWorkerContractFilter('لديه تنبيه')
        setResidenceFilter('لديه تنبيه')
        setHealthInsuranceFilter('لديه تنبيه')
        break
      case 'expired-contracts':
        setContractFilter('منتهي')
        break
      case 'expired-residences':
        setResidenceFilter('منتهي')
        break
      case 'expired-insurance':
        setHealthInsuranceFilter('منتهي') // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'urgent-contracts':
        setContractFilter('طارئ')
        break
      case 'urgent-residences':
        setResidenceFilter('طارئ')
        break
      case 'expiring-insurance-30':
        setHealthInsuranceFilter('طارئ') // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'expiring-insurance-60':
        setHealthInsuranceFilter('متوسط') // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'expiring-insurance-90':
        setHealthInsuranceFilter('ساري') // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'active-insurance':
        setHealthInsuranceFilter('ساري') // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
    }
  }

  const getDaysRemaining = (date: string | null | undefined): number | null => {
    if (!date) return null
    try {
      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) return null
      return differenceInDays(dateObj, new Date())
    } catch {
      return null
    }
  }

  const getStatusForField = (
    expiryDate: string | null | undefined,
    fieldType: 'contract' | 'hired_worker_contract' | 'residence' | 'health_insurance'
  ): 'غير محدد' | 'منتهي' | 'طارئ' | 'عاجل' | 'متوسط' | 'ساري' => {
    if (!expiryDate) return 'غير محدد'
    const days = getDaysRemaining(expiryDate)
    if (days === null) return 'غير محدد'

    const thresholds = colorThresholds || COLOR_THRESHOLD_FALLBACK
    const urgentDays = thresholds[
      `${fieldType}_urgent_days` as keyof EmployeeNotificationThresholds
    ] as number
    const highDays = thresholds[
      `${fieldType}_high_days` as keyof EmployeeNotificationThresholds
    ] as number
    const mediumDays = thresholds[
      `${fieldType}_medium_days` as keyof EmployeeNotificationThresholds
    ] as number

    if (days < 0) return 'منتهي'
    if (days <= urgentDays) return 'طارئ'
    if (days <= highDays) return 'عاجل'
    if (days <= mediumDays) return 'متوسط'
    return 'ساري'
  }

  // دالة للتحقق من وجود تنبيه
  const hasAlert = (
    contractExpiry: string | null,
    hiredWorkerContractExpiry: string | null | undefined,
    residenceExpiry: string | null | undefined,
    healthInsuranceExpiry: string | null | undefined
  ): boolean => {
    const statuses = [
      getStatusForField(contractExpiry, 'contract'),
      getStatusForField(hiredWorkerContractExpiry, 'hired_worker_contract'),
      getStatusForField(residenceExpiry, 'residence'),
      getStatusForField(healthInsuranceExpiry, 'health_insurance'),
    ]

    // يعتبر تنبيه إذا كانت الحالة منتهية أو ضمن نطاق طارئ/عاجل/متوسط
    return statuses.some((status) => ['منتهي', 'طارئ', 'عاجل', 'متوسط'].includes(status))
  }

  // دالة للحصول على لون خلفية الخلية بناءً على حالة الانتهاء
  const getCellBackgroundColor = (days: number | null) => {
    // إذا كان null (لا يوجد تاريخ انتهاء)، لا لون خلفية
    if (days === null) return ''
    // منتهي: خلفية حمراء
    if (days < 0) return 'bg-red-50'
    return ''
  }

  // دالة للحصول على لون النص بناءً على حالة الانتهاء
  const getTextColor = (days: number | null) => {
    // إذا كان null (لا يوجد تاريخ انتهاء)، لون رمادي
    if (days === null) return 'text-neutral-700'
    // منتهي: لون أحمر
    if (days < 0) return 'text-red-600'
    return 'text-neutral-700'
  }

  // دالة لتقليص النصوص
  const truncateText = (text: string | number | null | undefined, maxLength: number): string => {
    if (text === null || text === undefined) return '-'
    // تحويل القيمة إلى نص
    const textStr = String(text)
    if (textStr.length <= maxLength) return textStr
    return textStr.substring(0, maxLength)
  }

  // دالة لتنسيق حالة التاريخ (عدد الأيام)
  const formatDateStatus = (days: number | null, expiredText: string = 'منتهي'): string => {
    if (days === null) return '-'
    if (days < 0) return expiredText
    // تقليص النص ليكون ضمن 10 أحرف
    const statusText = `${days} يوم`
    return truncateText(statusText, 10)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setResidenceNumberSearch('')
    setCompanyFilter('')
    setNationalityFilter('')
    setProfessionFilter('')
    setProjectFilter('')
    setContractFilter('')
    setHiredWorkerContractFilter('')
    setResidenceFilter('')
    setHealthInsuranceFilter('') // تحديث: setInsuranceFilter → setHealthInsuranceFilter
    setShowAlertsOnly(false)
    navigate('/employees')
  }

  const handleEmployeeClick = (employee: Employee & { company: Company }) => {
    setSelectedEmployee(employee)
    setIsCardOpen(true)
  }

  const handleCloseCard = () => {
    setIsCardOpen(false)
    setSelectedEmployee(null)
    // إعادة تعيين الصف المحدد عند إغلاق الكارت
    setSelectedRowIndex(null)
  }

  const handleUpdateEmployee = async () => {
    // إعادة تحميل قائمة الموظفين بعد التحديث
    await loadEmployees()
  }

  const getFieldLabel = (key: string): string => {
    const fieldLabels: Record<string, string> = {
      name: 'الاسم',
      phone: 'رقم الهاتف',
      profession: 'المهنة',
      nationality: 'الجنسية',
      residence_number: 'رقم الإقامة',
      passport_number: 'رقم الجواز',
      bank_account: 'الحساب البنكي',
      salary: 'الراتب',
      project_id: 'المشروع',
      company_id: 'المؤسسة',
      birth_date: 'تاريخ الميلاد',
      joining_date: 'تاريخ الالتحاق',
      residence_expiry: 'تاريخ انتهاء الإقامة',
      contract_expiry: 'تاريخ انتهاء العقد',
      hired_worker_contract_expiry: 'تاريخ انتهاء عقد أجير',
      health_insurance_expiry: 'تاريخ انتهاء التأمين الصحي',
      notes: 'الملاحظات',
      employee_name: 'اسم الموظف',
      company: 'المؤسسة',
    }
    return fieldLabels[key] || key
  }

  // تم إزالة دوال التعديل السريع

  const logActivity = async (
    employeeId: string,
    action: string,
    changes: Record<string, unknown>
  ) => {
    try {
      const employee = employees.find((e) => e.id === employeeId)

      // تحويل مفاتيح التغييرات إلى أسماء مترجمة
      const translatedChanges: Record<string, unknown> = {}
      const changedFields: string[] = []

      Object.keys(changes).forEach((key) => {
        const label = getFieldLabel(key)
        translatedChanges[label] = changes[key]
        changedFields.push(label)
      })

      // تحديد اسم العملية الفعلي بناءً على عدد التغييرات
      let actionName = action
      if (changedFields.length === 1 && !action.includes('حذف')) {
        actionName = `تحديث ${changedFields[0]}`
      } else if (changedFields.length > 1 && !action.includes('حذف')) {
        actionName = `تحديث متعدد (${changedFields.length} حقول)`
      }

      await supabase.from('activity_log').insert({
        entity_type: 'employee',
        entity_id: employeeId,
        action: actionName,
        details: {
          employee_name: employee?.name,
          changes: translatedChanges,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error('Error logging activity:', error)
    }
  }

  const handleDeleteEmployee = (employee: Employee & { company: Company }) => {
    setEmployeeToDelete(employee)
    setShowDeleteModal(true)
  }

  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return

    try {
      const { error } = await supabase.from('employees').delete().eq('id', employeeToDelete.id)

      if (error) {
        logger.error('Delete error:', error)
        throw error
      }

      // Log activity
      await logActivity(employeeToDelete.id, 'حذف موظف', {
        employee_name: employeeToDelete.name,
        company: employeeToDelete.company?.name,
      })

      toast.success(`تم حذف الموظف "${employeeToDelete.name}" بنجاح`)

      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('employeeUpdated'))

      // Refresh employees list
      await loadEmployees()
      setShowDeleteModal(false)
      setEmployeeToDelete(null)

      // Close card if open
      if (isCardOpen && selectedEmployee?.id === employeeToDelete.id) {
        setIsCardOpen(false)
        setSelectedEmployee(null)
      }
    } catch (error) {
      logger.error('Error deleting employee:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل في حذف الموظف'
      toast.error(errorMessage)
    }
  }

  // Bulk selection functions
  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId)
      } else {
        newSet.add(employeeId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set())
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map((emp) => emp.id)))
    }
  }

  const clearSelection = () => {
    setSelectedEmployees(new Set())
  }

  // Bulk delete function with batch processing
  const handleBulkDelete = async () => {
    if (selectedEmployees.size === 0) {
      toast.error('لم يتم تحديد أي موظف للحذف')
      return
    }

    setDeletingEmployees(true)

    try {
      const employeeIds = Array.from(selectedEmployees)
      const selectedEmployeesData = employees.filter((emp) => employeeIds.includes(emp.id))

      // Batch size - keep URL length manageable (50-100 IDs per batch)
      const batchSize = 50
      let totalDeleted = 0
      const failedBatches: string[] = []
      const totalBatches = Math.ceil(employeeIds.length / batchSize)

      // Process deletions in batches
      for (let i = 0; i < employeeIds.length; i += batchSize) {
        const batch = employeeIds.slice(i, i + batchSize)
        const currentBatch = Math.floor(i / batchSize) + 1

        try {
          const { error } = await supabase.from('employees').delete().in('id', batch)

          if (error) {
            logger.error(`Error deleting batch ${currentBatch}/${totalBatches}:`, error)
            failedBatches.push(...batch)
            continue
          }

          totalDeleted += batch.length

          // Log activity for each employee in this batch (skip if too many to avoid performance issues)
          // For large deletions, we'll log a summary instead
          if (selectedEmployeesData.length <= 100) {
            const batchEmployees = selectedEmployeesData.filter((emp) => batch.includes(emp.id))
            for (const employee of batchEmployees) {
              try {
                await logActivity(employee.id, 'حذف موظف (جماعي)', {
                  employee_name: employee.name,
                  company: employee.company?.name,
                })
              } catch {
                // Continue even if logging fails - error intentionally ignored
                logger.warn('Failed to log activity for employee:', employee.id)
              }
            }
          }
        } catch (batchError) {
          logger.error(`Error in batch ${currentBatch}/${totalBatches}:`, batchError)
          failedBatches.push(...batch)
        }
      }

      if (failedBatches.length > 0) {
        toast.error(`تم حذف ${totalDeleted} موظف، ولكن فشل حذف ${failedBatches.length} موظف`)
      } else {
        toast.success(`تم حذف ${totalDeleted} موظف بنجاح`)
      }

      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('employeeUpdated'))

      // Refresh and clear selection
      await loadEmployees()
      clearSelection()
      setShowBulkDeleteModal(false)
    } catch (error) {
      logger.error('Error bulk deleting employees:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل في حذف الموظفين'
      toast.error(errorMessage)
    } finally {
      setDeletingEmployees(false)
    }
  }

  // Bulk update residence expiry date
  const handleBulkUpdateResidence = async (newDate: string) => {
    if (selectedEmployees.size === 0) return

    try {
      const employeeIds = Array.from(selectedEmployees)
      const selectedEmployeesData = employees.filter((emp) => employeeIds.includes(emp.id))

      // Update all selected employees
      const { error } = await supabase
        .from('employees')
        .update({ residence_expiry: newDate })
        .in('id', employeeIds)

      if (error) throw error

      // Log activity for each employee
      for (const employee of selectedEmployeesData) {
        await logActivity(employee.id, 'تعديل تاريخ انتهاء الإقامة (جماعي)', {
          employee_name: employee.name,
          old_date: employee.residence_expiry,
          new_date: newDate,
        })
      }

      toast.success(`تم تحديث تاريخ انتهاء الإقامة لـ ${selectedEmployees.size} موظف`)

      // Refresh and clear selection
      await loadEmployees()
      clearSelection()
      setShowBulkResidenceModal(false)
    } catch (error) {
      logger.error('Error bulk updating residence:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'فشل في تحديث تاريخ انتهاء الإقامة'
      toast.error(errorMessage)
    }
  }

  // Bulk update insurance expiry date
  const handleBulkUpdateInsurance = async (newDate: string) => {
    if (selectedEmployees.size === 0) return

    try {
      const employeeIds = Array.from(selectedEmployees)
      const selectedEmployeesData = employees.filter((emp) => employeeIds.includes(emp.id))

      // Update all selected employees
      const { error } = await supabase
        .from('employees')
        .update({ health_insurance_expiry: newDate }) // تحديث: ending_subscription_insurance_date → health_insurance_expiry
        .in('id', employeeIds)

      if (error) throw error

      // Log activity for each employee
      for (const employee of selectedEmployeesData) {
        await logActivity(employee.id, 'تعديل تاريخ انتهاء التأمين (جماعي)', {
          employee_name: employee.name,
          old_date: employee.health_insurance_expiry, // تحديث: ending_subscription_insurance_date → health_insurance_expiry
          new_date: newDate,
        })
      }

      toast.success(`تم تحديث تاريخ انتهاء التأمين لـ ${selectedEmployees.size} موظف`)

      // Refresh and clear selection
      await loadEmployees()
      clearSelection()
      setShowBulkInsuranceModal(false)
    } catch (error) {
      logger.error('Error bulk updating insurance:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'فشل في تحديث تاريخ انتهاء التأمين'
      toast.error(errorMessage)
    }
  }

  // Bulk update contract expiry date
  const handleBulkUpdateContract = async (newDate: string) => {
    if (selectedEmployees.size === 0) return

    try {
      const employeeIds = Array.from(selectedEmployees)
      const selectedEmployeesData = employees.filter((emp) => employeeIds.includes(emp.id))

      // Update all selected employees
      const { error } = await supabase
        .from('employees')
        .update({ contract_expiry: newDate })
        .in('id', employeeIds)

      if (error) throw error

      // Log activity for each employee
      for (const employee of selectedEmployeesData) {
        await logActivity(employee.id, 'تعديل تاريخ انتهاء العقد (جماعي)', {
          employee_name: employee.name,
          old_date: employee.contract_expiry,
          new_date: newDate,
        })
      }

      toast.success(`تم تحديث تاريخ انتهاء العقد لـ ${selectedEmployees.size} موظف`)

      // Refresh and clear selection
      await loadEmployees()
      clearSelection()
      setShowBulkContractModal(false)
    } catch (error) {
      logger.error('Error bulk updating contract:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'فشل في تحديث تاريخ انتهاء العقد'
      toast.error(errorMessage)
    }
  }

  const alertsCount = employees.reduce((count, emp) => {
    return (
      count +
      (hasAlert(
        emp.contract_expiry,
        emp.hired_worker_contract_expiry,
        emp.residence_expiry,
        emp.health_insurance_expiry
      )
        ? 1
        : 0)
    )
  }, 0)

  const filteredEmployees = employees.filter((emp) => {
    const contractStatus = getStatusForField(emp.contract_expiry, 'contract')
    const hiredWorkerStatus = getStatusForField(
      emp.hired_worker_contract_expiry,
      'hired_worker_contract'
    )
    const residenceStatus = getStatusForField(emp.residence_expiry, 'residence')
    const insuranceStatus = getStatusForField(emp.health_insurance_expiry, 'health_insurance')

    // البحث الشامل في الاسم، رقم الإقامة، رقم الجواز، المهنة، والجنسية
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      emp.name.toLowerCase().includes(searchLower) ||
      emp.residence_number.toString().toLowerCase().includes(searchLower) ||
      (emp.passport_number && emp.passport_number.toLowerCase().includes(searchLower)) ||
      (emp.profession && emp.profession.toLowerCase().includes(searchLower)) ||
      (emp.nationality && emp.nationality.toLowerCase().includes(searchLower))
    const matchesResidenceNumber =
      !residenceNumberSearch ||
      emp.residence_number.toString().toLowerCase().includes(residenceNumberSearch.toLowerCase())
    const matchesCompany = !companyFilter || emp.company?.name === companyFilter
    const matchesNationality = !nationalityFilter || emp.nationality === nationalityFilter
    const matchesProfession = !professionFilter || emp.profession === professionFilter
    const matchesProject =
      !projectFilter ||
      emp.project?.name === projectFilter ||
      (emp.project_name === projectFilter && !emp.project)

    // فلترة خاصة لـ "لديه تنبيه"
    const matchesContract =
      !contractFilter ||
      (contractFilter === 'لديه تنبيه'
        ? hasAlert(
            emp.contract_expiry,
            emp.hired_worker_contract_expiry,
            emp.residence_expiry,
            emp.health_insurance_expiry
          )
        : contractStatus === contractFilter)
    const matchesHiredWorkerContract =
      !hiredWorkerContractFilter ||
      (hiredWorkerContractFilter === 'لديه تنبيه'
        ? hasAlert(
            emp.contract_expiry,
            emp.hired_worker_contract_expiry,
            emp.residence_expiry,
            emp.health_insurance_expiry
          )
        : hiredWorkerStatus === hiredWorkerContractFilter)
    const matchesResidence =
      !residenceFilter ||
      (residenceFilter === 'لديه تنبيه'
        ? hasAlert(
            emp.contract_expiry,
            emp.hired_worker_contract_expiry,
            emp.residence_expiry,
            emp.health_insurance_expiry
          )
        : residenceStatus === residenceFilter)
    const matchesInsurance =
      !healthInsuranceFilter ||
      (healthInsuranceFilter === 'لديه تنبيه'
        ? hasAlert(
            emp.contract_expiry,
            emp.hired_worker_contract_expiry,
            emp.residence_expiry,
            emp.health_insurance_expiry
          )
        : insuranceStatus === healthInsuranceFilter)

    const matchesAlertsToggle =
      !showAlertsOnly ||
      hasAlert(
        emp.contract_expiry,
        emp.hired_worker_contract_expiry,
        emp.residence_expiry,
        emp.health_insurance_expiry
      )

    return (
      matchesSearch &&
      matchesResidenceNumber &&
      matchesCompany &&
      matchesNationality &&
      matchesProfession &&
      matchesProject &&
      matchesContract &&
      matchesHiredWorkerContract &&
      matchesResidence &&
      matchesInsurance &&
      matchesAlertsToggle
    )
  })

  const hasActiveFilters =
    searchTerm ||
    residenceNumberSearch ||
    companyFilter ||
    nationalityFilter ||
    professionFilter ||
    projectFilter ||
    contractFilter ||
    hiredWorkerContractFilter ||
    residenceFilter ||
    healthInsuranceFilter ||
    showAlertsOnly // تحديث: insuranceFilter → healthInsuranceFilter

  // Calculate active filters count
  const activeFiltersCount = [
    searchTerm !== '',
    residenceNumberSearch !== '',
    companyFilter !== '',
    nationalityFilter !== '',
    professionFilter !== '',
    projectFilter !== '',
    contractFilter !== '',
    hiredWorkerContractFilter !== '',
    residenceFilter !== '',
    healthInsuranceFilter !== '', // تحديث: insuranceFilter → healthInsuranceFilter
    showAlertsOnly,
  ].filter(Boolean).length

  // Sort handling functions
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    )
  }

  // Apply sorting to filtered employees
  const sortedAndFilteredEmployees = [...filteredEmployees].sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case 'profession':
        aValue = (a.profession || '').toLowerCase()
        bValue = (b.profession || '').toLowerCase()
        break
      case 'nationality':
        aValue = (a.nationality || '').toLowerCase()
        bValue = (b.nationality || '').toLowerCase()
        break
      case 'company':
        aValue = (a.company?.name || '').toLowerCase()
        bValue = (b.company?.name || '').toLowerCase()
        break
      case 'project':
        aValue = (a.project?.name || a.project_name || '').toLowerCase()
        bValue = (b.project?.name || b.project_name || '').toLowerCase()
        break
      case 'contract_expiry':
        aValue = a.contract_expiry ? new Date(a.contract_expiry).getTime() : 0
        bValue = b.contract_expiry ? new Date(b.contract_expiry).getTime() : 0
        break
      case 'hired_worker_contract_expiry':
        aValue = a.hired_worker_contract_expiry
          ? new Date(a.hired_worker_contract_expiry).getTime()
          : 0
        bValue = b.hired_worker_contract_expiry
          ? new Date(b.hired_worker_contract_expiry).getTime()
          : 0
        break
      case 'residence_expiry':
        aValue = a.residence_expiry ? new Date(a.residence_expiry).getTime() : 0
        bValue = b.residence_expiry ? new Date(b.residence_expiry).getTime() : 0
        break
      case 'health_insurance_expiry': // تحديث: ending_subscription_insurance_date → health_insurance_expiry
        aValue = a.health_insurance_expiry ? new Date(a.health_insurance_expiry).getTime() : 0
        bValue = b.health_insurance_expiry ? new Date(b.health_insurance_expiry).getTime() : 0
        break
      default:
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
    }
  })

  // معالجة التنقل بالسهام في الجدول
  useEffect(() => {
    // لا تعمل إذا كان هناك modal مفتوح
    if (
      isCardOpen ||
      isAddModalOpen ||
      showDeleteModal ||
      showBulkDeleteModal ||
      showFiltersModal
    ) {
      return
    }

    function handleKeyDown(e: KeyboardEvent) {
      // التحقق من أن المستخدم لا يكتب في حقل إدخال
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return
      }

      const employeesList = sortedAndFilteredEmployees
      if (employeesList.length === 0) return

      let newIndex: number | null = selectedRowIndex

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (selectedRowIndex === null) {
            newIndex = 0
          } else {
            newIndex = Math.min(selectedRowIndex + 1, employeesList.length - 1)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (selectedRowIndex === null) {
            newIndex = employeesList.length - 1
          } else {
            newIndex = Math.max(selectedRowIndex - 1, 0)
          }
          break
        case 'Home':
          e.preventDefault()
          newIndex = 0
          break
        case 'End':
          e.preventDefault()
          newIndex = employeesList.length - 1
          break
        case 'Enter':
          e.preventDefault()
          if (selectedRowIndex !== null && employeesList[selectedRowIndex]) {
            handleEmployeeClick(employeesList[selectedRowIndex])
          }
          return
        default:
          return
      }

      if (newIndex !== null && newIndex !== selectedRowIndex) {
        setSelectedRowIndex(newIndex)
        // Scroll to view
        setTimeout(() => {
          const rowElement = rowRefs.current[newIndex]
          if (rowElement) {
            rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        }, 0)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedRowIndex,
    sortedAndFilteredEmployees,
    isCardOpen,
    isAddModalOpen,
    showDeleteModal,
    showBulkDeleteModal,
    showFiltersModal,
  ])

  // إعادة تعيين الصف المحدد عند تغيير الفلاتر
  useEffect(() => {
    setSelectedRowIndex(null)
  }, [
    searchTerm,
    companyFilter,
    nationalityFilter,
    professionFilter,
    projectFilter,
    contractFilter,
    residenceFilter,
    healthInsuranceFilter,
    sortField,
    sortDirection,
  ])

  // التحقق من صلاحية العرض قبل عرض الصفحة
  if (!hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-danger-500" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">غير مصرح</h2>
            <p className="text-neutral-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid">
        <PageHeader
          title="الموظفين"
          description={`عرض ${sortedAndFilteredEmployees.length} من ${employees.length} موظف${
            activeFiltersCount > 0 ? ` (${activeFiltersCount} فلتر نشط)` : ''
          }`}
          breadcrumbs={[{ label: 'الرئيسية', href: '/dashboard' }, { label: 'الموظفين' }]}
          className="mb-4"
          actions={
            <>
              <div className="app-toggle-shell">
                {!isMobileView && (
                  <button
                    onClick={() => setViewMode('table')}
                    className={`app-toggle-button ${viewMode === 'table' ? 'app-toggle-button-active' : ''}`}
                    title="عرض الشرائط"
                  >
                    <Table className="w-4 h-4" />
                    <span className="hidden sm:inline">شرائط</span>
                  </button>
                )}
                <button
                  onClick={() => setViewMode('grid')}
                  className={`app-toggle-button ${viewMode === 'grid' ? 'app-toggle-button-active' : ''}`}
                  title="عرض الكروت"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">كروت</span>
                </button>
              </div>

              {canCreate('employees') && (
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <UserPlus className="w-4 h-4" />
                  إضافة موظف
                </Button>
              )}
            </>
          }
        />

        <FilterBar
          className="mb-6"
          actions={
            <>
              <Button onClick={() => setShowFiltersModal(true)} className="relative">
                <Filter className="w-4 h-4" />
                <span>الفلاتر</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowAlertsOnly((prev) => !prev)}
                    variant="secondary"
                    className={`relative border-red-200 text-red-700 ${showAlertsOnly ? 'bg-red-50' : ''}`}
                    title="عرض الموظفين ذوي التنبيهات فقط"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">تنبيهات</span>
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {alertsCount}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-neutral-900 text-white">
                  تحسب طارئ وعاجل ومتوسط
                </TooltipContent>
              </Tooltip>

              <div className="relative">
                <Button onClick={() => setShowSortDropdown(!showSortDropdown)} variant="secondary">
                  {getSortIcon(sortField)}
                  <span className="hidden sm:inline">الترتيب</span>
                  <ArrowUpDown className="w-4 h-4" />
                </Button>

                {showSortDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSortDropdown(false)}
                    />
                    <div className="absolute left-0 z-20 mt-2 w-56 rounded-lg border border-neutral-200 bg-surface py-2 shadow-lg">
                      <div className="border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-500">
                        الترتيب حسب:
                      </div>
                      {[
                        { field: 'name' as typeof sortField, label: 'الاسم' },
                        { field: 'profession' as typeof sortField, label: 'المهنة' },
                        { field: 'nationality' as typeof sortField, label: 'الجنسية' },
                        { field: 'company' as typeof sortField, label: 'الشركة' },
                        { field: 'project' as typeof sortField, label: 'المشروع' },
                        {
                          field: 'contract_expiry' as typeof sortField,
                          label: 'تاريخ انتهاء العقد',
                        },
                        {
                          field: 'hired_worker_contract_expiry' as typeof sortField,
                          label: 'تاريخ انتهاء عقد أجير',
                        },
                        {
                          field: 'residence_expiry' as typeof sortField,
                          label: 'تاريخ انتهاء الإقامة',
                        },
                        {
                          field: 'health_insurance_expiry' as typeof sortField,
                          label: 'تاريخ انتهاء التأمين الصحي',
                        },
                      ].map(({ field, label }) => (
                        <button
                          key={field}
                          onClick={() => {
                            handleSort(field)
                            setShowSortDropdown(false)
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-right text-sm transition ${
                            sortField === field
                              ? 'bg-primary/10 text-foreground'
                              : 'text-neutral-700 hover:bg-neutral-50'
                          }`}
                        >
                          <span>{label}</span>
                          {sortField === field && getSortIcon(field)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          }
        >
          <SearchInput
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الإقامة أو رقم الجواز أو المهنة أو الجنسية..."
            wrapperClassName="min-w-[260px] flex-1"
          />
        </FilterBar>

        {/* Filters Modal */}
        {showFiltersModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity duration-[var(--motion-base)] ease-[var(--ease-out)]"
              onClick={() => setShowFiltersModal(false)}
            />

            {/* Modal Content */}
            <div className="fixed inset-0 flex items-end justify-center p-0 md:items-center md:p-4">
              <div className="w-full max-h-[92vh] max-w-4xl overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl motion-safe-enter md:rounded-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">الفلاتر والبحث</h2>
                    {activeFiltersCount > 0 && (
                      <p className="text-sm text-neutral-600 mt-1">{activeFiltersCount} فلتر نشط</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="touch-feedback rounded-lg p-2 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted"
                  >
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* البحث برقم الإقامة */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        البحث برقم الإقامة
                      </label>
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          type="text"
                          placeholder="ابحث برقم الإقامة..."
                          value={residenceNumberSearch}
                          onChange={(e) => setResidenceNumberSearch(e.target.value)}
                          className="focus-ring-brand w-full rounded-md border border-input bg-surface py-2 pr-10 pl-3 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                        />
                      </div>
                    </div>

                    {/* فلتر الشركة */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        الشركة
                      </label>
                      <div className="relative" ref={companyDropdownRef}>
                        <div className="relative">
                          <input
                            type="text"
                            value={companySearchQuery}
                            onChange={(e) => {
                              setCompanySearchQuery(e.target.value)
                              setCompanyDropdownOpen(true)
                            }}
                            onFocus={() => setCompanyDropdownOpen(true)}
                            placeholder="ابحث بالاسم أو الرقم الموحد..."
                            className="focus-ring-brand w-full rounded-md border border-input bg-surface py-2 pr-10 pl-3 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                          />
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search className="w-4 h-4 text-neutral-400" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setCompanyDropdownOpen(!isCompanyDropdownOpen)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${isCompanyDropdownOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </div>

                        {isCompanyDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-surface border border-neutral-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setCompanyFilter('')
                                setCompanySearchQuery('')
                                setCompanyDropdownOpen(false)
                              }}
                              className="w-full px-3 py-2 text-right text-sm hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none transition-colors text-neutral-600"
                            >
                              جميع الشركات
                            </button>
                            {filteredCompanies.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-neutral-500 text-center">
                                {companySearchQuery.trim()
                                  ? 'لا توجد نتائج'
                                  : 'لا توجد شركات متاحة'}
                              </div>
                            ) : (
                              filteredCompanies.map((company) => {
                                const displayText = company.unified_number
                                  ? `${company.name} (${company.unified_number})`
                                  : company.name
                                return (
                                  <button
                                    key={company.id}
                                    type="button"
                                    onClick={() => {
                                      setCompanyFilter(company.name)
                                      setCompanySearchQuery(displayText)
                                      setCompanyDropdownOpen(false)
                                    }}
                                    className="w-full px-3 py-2 text-right text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                                  >
                                    {displayText}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* فلتر الجنسية */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        الجنسية
                      </label>
                      <select
                        value={nationalityFilter}
                        onChange={(e) => setNationalityFilter(e.target.value)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="">جميع الجنسيات</option>
                        {nationalities.map((nationality) => (
                          <option key={nationality} value={nationality}>
                            {nationality}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* فلتر المهنة */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        المهنة
                      </label>
                      <select
                        value={professionFilter}
                        onChange={(e) => setProfessionFilter(e.target.value)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="">جميع المهن</option>
                        {professions.map((profession) => (
                          <option key={profession} value={profession}>
                            {profession}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* فلتر المشروع */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        المشروع
                      </label>
                      <select
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="">جميع المشاريع</option>
                        {projects.map((project) => (
                          <option key={project} value={project}>
                            {project}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* فلتر العقود */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        حالة العقد
                      </label>
                      <select
                        value={contractFilter}
                        onChange={(e) => setContractFilter(e.target.value)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="">جميع العقود</option>
                        <option value="منتهي">عقود منتهية</option>
                        <option value="طارئ">عقود طارئة</option>
                        <option value="عاجل">عقود عاجلة</option>
                        <option value="متوسط">عقود متوسطة</option>
                        <option value="ساري">عقود سارية</option>
                      </select>
                    </div>

                    {/* فلتر عقد أجير */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        حالة عقد أجير
                      </label>
                      <select
                        value={hiredWorkerContractFilter}
                        onChange={(e) => setHiredWorkerContractFilter(e.target.value)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="">جميع الحالات</option>
                        <option value="منتهي">منتهي</option>
                        <option value="طارئ">طارئ</option>
                        <option value="عاجل">عاجل</option>
                        <option value="متوسط">متوسط</option>
                        <option value="ساري">ساري</option>
                      </select>
                    </div>

                    {/* فلتر الإقامات */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        حالة الإقامة
                      </label>
                      <select
                        value={residenceFilter}
                        onChange={(e) => setResidenceFilter(e.target.value)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="">جميع الإقامات</option>
                        <option value="منتهي">إقامات منتهية</option>
                        <option value="طارئ">إقامات طارئة</option>
                        <option value="عاجل">إقامات عاجلة</option>
                        <option value="متوسط">إقامات متوسطة</option>
                        <option value="ساري">إقامات سارية</option>
                      </select>
                    </div>

                    {/* فلتر التأمين */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        حالة التأمين
                      </label>
                      <select
                        value={healthInsuranceFilter}
                        onChange={(e) => setHealthInsuranceFilter(e.target.value)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="">جميع الموظفين</option>
                        <option value="ساري">التأمين ساري</option>
                        <option value="منتهي">التأمين منتهي</option>
                        <option value="طارئ">التأمين طارئ</option>
                        <option value="عاجل">التأمين عاجل</option>
                        <option value="متوسط">التأمين متوسط</option>
                      </select>
                    </div>
                  </div>

                  {/* Active Filters Display */}
                  {hasActiveFilters && (
                    <div className="mt-6 pt-6 border-t border-neutral-200">
                      <h3 className="text-sm font-medium text-neutral-700 mb-3">الفلاتر النشطة:</h3>
                      <div className="flex flex-wrap gap-2">
                        {searchTerm && (
                          <span className="px-3 py-1.5 bg-blue-50 text-info-700 text-sm rounded-full flex items-center gap-2">
                            البحث: {searchTerm}
                            <button
                              onClick={() => setSearchTerm('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {residenceNumberSearch && (
                          <span className="px-3 py-1.5 bg-cyan-50 text-cyan-700 text-sm rounded-full flex items-center gap-2">
                            رقم الإقامة: {residenceNumberSearch}
                            <button
                              onClick={() => setResidenceNumberSearch('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {companyFilter && (
                          <span className="px-3 py-1.5 bg-green-50 text-success-700 text-sm rounded-full flex items-center gap-2">
                            الشركة: {companyFilter}
                            <button
                              onClick={() => setCompanyFilter('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {nationalityFilter && (
                          <span className="px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-full flex items-center gap-2">
                            الجنسية: {nationalityFilter}
                            <button
                              onClick={() => setNationalityFilter('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {professionFilter && (
                          <span className="px-3 py-1.5 bg-orange-50 text-warning-700 text-sm rounded-full flex items-center gap-2">
                            المهنة: {professionFilter}
                            <button
                              onClick={() => setProfessionFilter('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {projectFilter && (
                          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-full flex items-center gap-2">
                            المشروع: {projectFilter}
                            <button
                              onClick={() => setProjectFilter('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {contractFilter && (
                          <span className="px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-full flex items-center gap-2">
                            العقد: {contractFilter}
                            <button
                              onClick={() => setContractFilter('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {hiredWorkerContractFilter && (
                          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-full flex items-center gap-2">
                            عقد أجير: {hiredWorkerContractFilter}
                            <button
                              onClick={() => setHiredWorkerContractFilter('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {residenceFilter && (
                          <span className="px-3 py-1.5 bg-rose-50 text-rose-700 text-sm rounded-full flex items-center gap-2">
                            الإقامة: {residenceFilter}
                            <button
                              onClick={() => setResidenceFilter('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {healthInsuranceFilter && (
                          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm rounded-full flex items-center gap-2">
                            التأمين الصحي: {healthInsuranceFilter}
                            <button
                              onClick={() => setHealthInsuranceFilter('')}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {showAlertsOnly && (
                          <span className="px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-full flex items-center gap-2">
                            تنبيهات فقط
                            <button
                              onClick={() => setShowAlertsOnly(false)}
                              className="touch-feedback rounded-full p-0.5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-black/10"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between border-t border-border bg-muted/30 p-6">
                  <Button
                    onClick={clearFilters}
                    disabled={activeFiltersCount === 0}
                    variant="secondary"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                    مسح جميع الفلاتر
                  </Button>
                  <Button onClick={() => setShowFiltersModal(false)} size="sm">
                    تطبيق الفلاتر
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedEmployees.size > 0 && (
          <div className="app-info-block mb-3 rounded-lg p-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-foreground">
                  {selectedEmployees.size} موظف محدد
                </div>
                <Button onClick={clearSelection} variant="ghost" size="sm" className="h-8 px-2">
                  إلغاء التحديد
                </Button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  onClick={() => setShowBulkResidenceModal(true)}
                  variant="success"
                  size="sm"
                  title="تعديل تاريخ انتهاء الإقامة"
                >
                  <Calendar className="w-3 h-3" />
                  تعديل تاريخ الإقامة
                </Button>
                <Button
                  onClick={() => setShowBulkInsuranceModal(true)}
                  variant="warning"
                  size="sm"
                  title="تعديل تاريخ انتهاء التأمين"
                >
                  <Calendar className="w-3 h-3" />
                  تعديل تاريخ التأمين
                </Button>
                <Button
                  onClick={() => setShowBulkContractModal(true)}
                  variant="warning"
                  size="sm"
                  title="تعديل تاريخ انتهاء العقد"
                >
                  <Calendar className="w-3 h-3" />
                  تعديل تاريخ العقد
                </Button>
                <Button
                  onClick={() => setShowBulkDeleteModal(true)}
                  variant="destructive"
                  size="sm"
                  title="حذف الموظفين المحددين"
                >
                  <Trash2 className="w-3 h-3" />
                  حذف المحددين
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View
          <div className={employeeGridClass}>
            {sortedAndFilteredEmployees.map((employee, index) => {
              const contractDays = employee.contract_expiry
                ? getDaysRemaining(employee.contract_expiry)
                : null
              const hiredWorkerContractDays = employee.hired_worker_contract_expiry
                ? getDaysRemaining(employee.hired_worker_contract_expiry)
                : null
              const residenceDays = employee.residence_expiry
                ? getDaysRemaining(employee.residence_expiry)
                : null
              const healthInsuranceDays = employee.health_insurance_expiry
                ? getDaysRemaining(employee.health_insurance_expiry)
                : null

              // تحديد لون الحدود حسب أعلى أولوية
              const getBorderColor = () => {
                const priorities = [
                  contractDays !== null && contractDays < 0
                    ? 'critical'
                    : contractDays !== null && contractDays <= 7
                      ? 'critical'
                      : contractDays !== null && contractDays <= 30
                        ? 'medium'
                        : 'low',
                  hiredWorkerContractDays !== null && hiredWorkerContractDays < 0
                    ? 'critical'
                    : hiredWorkerContractDays !== null && hiredWorkerContractDays <= 7
                      ? 'critical'
                      : hiredWorkerContractDays !== null && hiredWorkerContractDays <= 30
                        ? 'medium'
                        : 'low',
                  residenceDays !== null && residenceDays < 0
                    ? 'critical'
                    : residenceDays !== null && residenceDays <= 7
                      ? 'critical'
                      : residenceDays !== null && residenceDays <= 30
                        ? 'medium'
                        : 'low',
                  healthInsuranceDays !== null && healthInsuranceDays < 0
                    ? 'critical'
                    : healthInsuranceDays !== null && healthInsuranceDays <= 7
                      ? 'critical'
                      : healthInsuranceDays !== null && healthInsuranceDays <= 30
                        ? 'medium'
                        : 'low',
                ]

                if (priorities.includes('critical')) return 'border-red-400'
                if (priorities.includes('medium')) return 'border-yellow-400'
                if (priorities.includes('low')) return 'border-green-400'
                return 'border-neutral-200'
              }

              // دالة للحصول على حالة التاريخ
              const getDateStatus = (days: number | null, expiredText: string = 'منتهي') => {
                if (days === null)
                  return {
                    status: 'غير محدد',
                    description: '',
                    emoji: '❌',
                    color: 'bg-neutral-100 text-neutral-600 border-neutral-200',
                  }
                if (days < 0)
                  return {
                    status: expiredText,
                    description: 'منتهي',
                    emoji: '🚨',
                    color: 'bg-red-50 text-red-700 border-red-300',
                  }
                if (days <= 7)
                  return {
                    status: 'طارئ',
                    description: `${days} يوم`,
                    emoji: '🚨',
                    color: 'bg-red-50 text-red-700 border-red-300',
                  }
                if (days <= 15)
                  return {
                    status: 'عاجل',
                    description: `${days} يوم`,
                    emoji: '🔥',
                    color: 'bg-orange-50 text-warning-700 border-orange-300',
                  }
                if (days <= 30)
                  return {
                    status: 'متوسط',
                    description: `${days} يوم`,
                    emoji: '⚠️',
                    color: 'bg-yellow-50 text-yellow-700 border-yellow-300',
                  }
                return {
                  status: 'ساري',
                  description: `${days} يوم`,
                  emoji: '✅',
                  color: 'bg-green-50 text-success-700 border-green-300',
                }
              }

              const contractStatus = getDateStatus(contractDays, 'منتهي')
              const hiredWorkerStatus = getDateStatus(hiredWorkerContractDays, 'منتهي')
              const residenceStatus = getDateStatus(residenceDays, 'منتهية')
              const insuranceStatus = getDateStatus(healthInsuranceDays, 'منتهي')

              return (
                <div
                  key={employee.id}
                  onClick={() => handleEmployeeClick(employee)}
                  className={`stagger-item group relative cursor-pointer overflow-hidden rounded-2xl border-2 ${getBorderColor()} bg-surface/95 p-3.5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-26px_rgba(14,116,144,0.65)]`}
                  style={{ '--i': Math.min(index, 11) } as CSSProperties}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400/70 via-sky-300/60 to-emerald-300/70 opacity-70 transition group-hover:opacity-100" />

                  <div className="flex items-start justify-between mb-2.5">
                    <div className="app-icon-chip scale-90">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {canEdit('employees') && (
                        <button
                          onClick={() => handleEmployeeClick(employee)}
                          className="rounded-md p-1 text-foreground-secondary transition hover:bg-primary/10"
                          title="عرض/تعديل الموظف"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete('employees') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteEmployee(employee)
                          }}
                          className="p-1 text-red-600 hover:bg-red-100 rounded-md transition"
                          title="حذف الموظف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="mb-1.5 line-clamp-1 text-base font-bold text-neutral-900">
                    {employee.name}
                  </h3>

                  <div className="app-card-meta text-[12.5px]">
                    {employee.project?.name || employee.project_name ? (
                      <div className="app-card-meta-row">
                        <span className="app-card-meta-label">المشروع:</span>
                        <span className="app-badge-brand text-[13px] font-medium">
                          {employee.project?.name || employee.project_name}
                        </span>
                      </div>
                    ) : null}
                    <div className="app-card-meta-row">
                      <span className="app-card-meta-label">الشركة:</span>
                      <span className="app-card-meta-value">
                        {employee.company?.name || '-'}
                        {employee.company?.unified_number && (
                          <span className="text-neutral-500 mr-1">
                            ({employee.company.unified_number})
                          </span>
                        )}
                      </span>
                    </div>
                    {employee.residence_number && (
                      <div className="app-card-meta-row">
                        <span className="app-card-meta-label">رقم الإقامة:</span>
                        <span className="app-card-meta-value font-mono">
                          {employee.residence_number}
                        </span>
                      </div>
                    )}
                    {employee.profession && (
                      <div className="app-card-meta-row">
                        <span className="app-card-meta-label">المهنة:</span>
                        <span className="app-card-meta-value">{employee.profession}</span>
                      </div>
                    )}
                    {employee.nationality && (
                      <div className="app-card-meta-row">
                        <span className="app-card-meta-label">الجنسية:</span>
                        <span className="app-card-meta-value">{employee.nationality}</span>
                      </div>
                    )}
                  </div>

                  {/* مربعات الحالات - grid من عمودين */}
                  <div className="pt-2.5 border-t border-neutral-200">
                    <div className="grid grid-cols-2 gap-2">
                      {/* حالة انتهاء العقد */}
                      <div>
                        <div className="mb-1 text-[12px] font-semibold text-neutral-600">
                          انتهاء العقد
                        </div>
                        {employee.contract_expiry ? (
                          <div
                            className={`rounded-lg border-2 px-2 py-1 text-xs font-medium ${contractStatus.color}`}
                          >
                            <div className="flex items-center gap-1">
                              <div className="text-xs">{contractStatus.emoji}</div>
                              <div className="flex flex-col">
                                <span className="font-bold">{contractStatus.status}</span>
                                <span className="text-xs opacity-75">
                                  {contractStatus.description}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border-2 border-neutral-200 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                            غير محدد
                          </div>
                        )}
                      </div>

                      {/* حالة انتهاء عقد أجير */}
                      <div>
                        <div className="mb-1 text-[12px] font-semibold text-neutral-600">
                          انتهاء عقد أجير
                        </div>
                        {employee.hired_worker_contract_expiry ? (
                          <div
                            className={`rounded-lg border-2 px-2 py-1 text-xs font-medium ${hiredWorkerStatus.color}`}
                          >
                            <div className="flex items-center gap-1">
                              <div className="text-xs">{hiredWorkerStatus.emoji}</div>
                              <div className="flex flex-col">
                                <span className="font-bold">{hiredWorkerStatus.status}</span>
                                <span className="text-xs opacity-75">
                                  {hiredWorkerStatus.description}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border-2 border-neutral-200 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                            غير محدد
                          </div>
                        )}
                      </div>

                      {/* حالة انتهاء الإقامة */}
                      <div>
                        <div className="mb-1 text-[12px] font-semibold text-neutral-600">
                          انتهاء الإقامة
                        </div>
                        {employee.residence_expiry ? (
                          <div
                            className={`rounded-lg border-2 px-2 py-1 text-xs font-medium ${residenceStatus.color}`}
                          >
                            <div className="flex items-center gap-1">
                              <div className="text-xs">{residenceStatus.emoji}</div>
                              <div className="flex flex-col">
                                <span className="font-bold">{residenceStatus.status}</span>
                                <span className="text-xs opacity-75">
                                  {residenceStatus.description}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border-2 border-neutral-200 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                            غير محدد
                          </div>
                        )}
                      </div>

                      {/* حالة التأمين */}
                      <div>
                        <div className="mb-1 text-[12px] font-semibold text-neutral-600">
                          حالة التأمين
                        </div>
                        {employee.health_insurance_expiry ? (
                          <div
                            className={`rounded-lg border-2 px-2 py-1 text-xs font-medium ${insuranceStatus.color}`}
                          >
                            <div className="flex items-center gap-1">
                              <div className="text-xs">{insuranceStatus.emoji}</div>
                              <div className="flex flex-col">
                                <span className="font-bold">{insuranceStatus.status}</span>
                                <span className="text-xs opacity-75">
                                  {insuranceStatus.description}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border-2 border-neutral-200 bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                            غير محدد
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* الملاحظات */}
                  <div className="pt-2.5 border-t border-neutral-200">
                    <div className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-neutral-600">
                      <FileText className="w-3.5 h-3.5" />
                      الملاحظات
                    </div>
                    <div className="min-h-[42px] whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700">
                      {employee.notes || 'لا توجد ملاحظات'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="app-data-strip flex items-center justify-between">
              <button
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground-secondary dark:text-foreground"
                title={
                  selectedEmployees.size === filteredEmployees.length
                    ? 'إلغاء تحديد الكل'
                    : 'تحديد الكل'
                }
              >
                {selectedEmployees.size === filteredEmployees.length &&
                filteredEmployees.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-info-600" />
                ) : (
                  <Square className="w-4 h-4 text-foreground-tertiary" />
                )}
                تحديد الكل
              </button>
              <span className="text-xs text-foreground-secondary dark:text-foreground-secondary">
                {sortedAndFilteredEmployees.length} نتيجة
              </span>
            </div>

            {sortedAndFilteredEmployees.map((employee, index) => {
              const contractDays = employee.contract_expiry
                ? getDaysRemaining(employee.contract_expiry)
                : null
              const residenceDays = employee.residence_expiry
                ? getDaysRemaining(employee.residence_expiry)
                : null
              const healthInsuranceDays = employee.health_insurance_expiry
                ? getDaysRemaining(employee.health_insurance_expiry)
                : null
              const isSelected = selectedRowIndex === index

              return (
                <div
                  key={employee.id}
                  ref={(el) => {
                    rowRefs.current[index] = el
                  }}
                  className={`app-data-strip ${isSelected ? 'border-blue-500/80 ring-2 ring-blue-500/20' : ''}`}
                >
                  <div className="flex min-h-fit flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleEmployeeSelection(employee.id)
                        }}
                        className="mt-1 flex h-5 w-5 items-center justify-center"
                      >
                        {selectedEmployees.has(employee.id) ? (
                          <CheckSquare className="w-4 h-4 text-info-600" />
                        ) : (
                          <Square className="w-4 h-4 text-foreground-tertiary" />
                        )}
                      </button>

                      <div className="cursor-pointer" onClick={() => handleEmployeeClick(employee)}>
                        <p className="text-sm font-semibold text-foreground dark:text-foreground">
                          {employee.name}
                        </p>
                        <p className="text-xs text-foreground-secondary dark:text-foreground-secondary">
                          {employee.profession || '-'} • {employee.nationality || '-'}
                        </p>
                        <p className="text-xs text-foreground-tertiary dark:text-foreground-tertiary">
                          {employee.company?.name || '-'}
                          {employee.company?.unified_number
                            ? ` (${employee.company.unified_number})`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 lg:max-w-[560px]">
                      <div
                        className={`rounded-xl border px-3 py-2 text-xs ${getCellBackgroundColor(contractDays)}`}
                      >
                        <p className="mb-1 text-[11px] text-foreground-tertiary">العقد</p>
                        <p className={getTextColor(contractDays)}>
                          {formatDateStatus(contractDays, 'منتهي')}
                        </p>
                      </div>
                      <div
                        className={`rounded-xl border px-3 py-2 text-xs ${getCellBackgroundColor(residenceDays)}`}
                      >
                        <p className="mb-1 text-[11px] text-foreground-tertiary">الإقامة</p>
                        <p className={getTextColor(residenceDays)}>
                          {formatDateStatus(residenceDays, 'منتهية')}
                        </p>
                      </div>
                      <div
                        className={`rounded-xl border px-3 py-2 text-xs ${getCellBackgroundColor(healthInsuranceDays)}`}
                      >
                        <p className="mb-1 text-[11px] text-foreground-tertiary">التأمين</p>
                        <p className={getTextColor(healthInsuranceDays)}>
                          {formatDateStatus(healthInsuranceDays, 'منتهي')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEmployeeClick(employee)
                        }}
                        size="sm"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض
                      </Button>
                      {canDelete('employees') && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteEmployee(employee)
                          }}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {sortedAndFilteredEmployees.length === 0 && (
              <div className="text-center py-12 text-neutral-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
                <p>لا توجد نتائج تطابق الفلاتر المحددة</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* مودال بطاقة الموظف */}
      {isCardOpen && selectedEmployee && (
        <EmployeeCard
          employee={selectedEmployee}
          onClose={handleCloseCard}
          onUpdate={handleUpdateEmployee}
          onDelete={handleDeleteEmployee}
        />
      )}

      {/* مودال إضافة موظف */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleUpdateEmployee}
      />

      {/* مودال تأكيد حذف الموظف */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-3 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">تأكيد حذف الموظف</h3>
                  <p className="text-sm text-neutral-600">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
              </div>
              <p className="text-neutral-700 mb-6">
                هل أنت متأكد من حذف الموظف "<strong>{employeeToDelete?.name}</strong>"؟
                <br />
                <span className="text-sm text-red-600 mt-2 block">
                  سيتم حذف جميع بيانات هذا الموظف نهائياً
                </span>
              </p>
              <div className="flex gap-3">
                <Button onClick={confirmDeleteEmployee} className="flex-1" variant="destructive">
                  نعم، احذف
                </Button>
                <Button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setEmployeeToDelete(null)
                  }}
                  className="flex-1"
                  variant="secondary"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال حذف جماعي */}
      {showBulkDeleteModal && (
        <BulkDeleteModal
          selectedCount={selectedEmployees.size}
          selectedEmployees={employees.filter((emp) => selectedEmployees.has(emp.id))}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteModal(false)}
          isDeleting={deletingEmployees}
        />
      )}

      {/* مودال تعديل تاريخ الإقامة */}
      {showBulkResidenceModal && (
        <BulkDateModal
          title="تعديل تاريخ انتهاء الإقامة"
          selectedCount={selectedEmployees.size}
          onConfirm={handleBulkUpdateResidence}
          onCancel={() => setShowBulkResidenceModal(false)}
        />
      )}

      {/* مودال تعديل تاريخ التأمين */}
      {showBulkInsuranceModal && (
        <BulkDateModal
          title="تعديل تاريخ انتهاء التأمين"
          selectedCount={selectedEmployees.size}
          onConfirm={handleBulkUpdateInsurance}
          onCancel={() => setShowBulkInsuranceModal(false)}
        />
      )}

      {/* مودال تعديل تاريخ العقد */}
      {showBulkContractModal && (
        <BulkDateModal
          title="تعديل تاريخ انتهاء العقد"
          selectedCount={selectedEmployees.size}
          onConfirm={handleBulkUpdateContract}
          onCancel={() => setShowBulkContractModal(false)}
        />
      )}
    </Layout>
  )
}

// مكون مودال الحذف الجماعي
function BulkDeleteModal({
  selectedCount,
  selectedEmployees,
  onConfirm,
  onCancel,
  isDeleting = false,
}: {
  selectedCount: number
  selectedEmployees: (Employee & { company: Company })[]
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}) {
  const handleConfirm = () => {
    if (!isDeleting) {
      onConfirm()
    }
  }

  const handleCancel = () => {
    if (!isDeleting) {
      onCancel()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-surface rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">تأكيد حذف الموظفين</h3>
              <p className="text-sm text-neutral-600">هذا الإجراء لا يمكن التراجع عنه</p>
            </div>
          </div>
          <p className="text-neutral-700 mb-4">
            هل أنت متأكد من حذف <strong>{selectedCount} موظف</strong>؟
            <br />
            <span className="text-sm text-red-600 mt-2 block">
              سيتم حذف جميع بيانات هؤلاء الموظفين نهائياً
            </span>
          </p>
          {isDeleting && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-info-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium">جاري حذف الموظفين، يرجى الانتظار...</span>
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto border border-neutral-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-neutral-700 mb-2">الموظفون المحددون:</p>
            <ul className="space-y-1">
              {selectedEmployees.slice(0, 50).map((emp) => (
                <li key={emp.id} className="text-sm text-neutral-600">
                  • {emp.name} {emp.company?.name && `(${emp.company.name})`}
                </li>
              ))}
              {selectedEmployees.length > 50 && (
                <li className="text-sm text-neutral-500 italic">
                  ... و {selectedEmployees.length - 50} موظف آخر
                </li>
              )}
            </ul>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleConfirm}
              disabled={isDeleting}
              className="flex-1"
              variant="destructive"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  جاري الحذف...
                </>
              ) : (
                `نعم، احذف (${selectedCount})`
              )}
            </Button>
            <Button
              onClick={handleCancel}
              disabled={isDeleting}
              className="flex-1"
              variant="secondary"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// مكون مودال تعديل التاريخ
function BulkDateModal({
  title,
  selectedCount,
  onConfirm,
  onCancel,
}: {
  title: string
  selectedCount: number
  onConfirm: (date: string) => void
  onCancel: () => void
}) {
  const [selectedDate, setSelectedDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedDate) {
      onConfirm(selectedDate)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-info-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
              <p className="text-sm text-neutral-600">{selectedCount} موظف محدد</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                التاريخ الجديد
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus-ring-brand"
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={!selectedDate} className="flex-1">
                تأكيد التعديل
              </Button>
              <Button type="button" onClick={onCancel} className="flex-1" variant="secondary">
                إلغاء
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
