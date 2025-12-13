import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase, Employee, Company, Project } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import EmployeeCard from '@/components/employees/EmployeeCard'
import AddEmployeeModal from '@/components/employees/AddEmployeeModal'
import { Search, Calendar, AlertCircle, X, UserPlus, CheckSquare, Square, Trash2, Edit2, Eye, Filter, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, LayoutGrid, Table, User, FileText, Shield } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { usePermissions } from '@/utils/permissions'
import { logger } from '@/utils/logger'
import { getEmployeeNotificationThresholdsPublic, type EmployeeNotificationThresholds } from '@/utils/employeeAlerts'

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
  hired_worker_contract_medium_days: 30
}

export default function Employees() {
  const { canView, canCreate, canEdit, canDelete } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<(Employee & { company: Company; project?: Project })[]>([])
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
  const [healthInsuranceFilter, setHealthInsuranceFilter] = useState<string>('')  // تحديث: insuranceFilter → healthInsuranceFilter
  const [showAlertsOnly, setShowAlertsOnly] = useState(false)
  
  const [companiesWithIds, setCompaniesWithIds] = useState<Array<{ id: string; name: string; unified_number?: number }>>([])
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [isCompanyDropdownOpen, setCompanyDropdownOpen] = useState(false)
  const [nationalities, setNationalities] = useState<string[]>([])
  const [professions, setProfessions] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [colorThresholds, setColorThresholds] = useState<EmployeeNotificationThresholds | null>(null)
  
  // حالة المودال
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { company: Company; project?: Project }) | null>(null)
  const [isCardOpen, setIsCardOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  
  // حالة التنقل بالسهام
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  // حالة نوع العرض
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  // حالة التعديل السريع - تم إزالتها
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<(Employee & { company: Company }) | null>(null)
  
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
  const [sortField, setSortField] = useState<'name' | 'profession' | 'nationality' | 'company' | 'project' | 'contract_expiry' | 'hired_worker_contract_expiry' | 'residence_expiry' | 'health_insurance_expiry'>('name')  // تحديث: إضافة عقد أجير + المشروع + ending_subscription_insurance_date → health_insurance_expiry
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*, company:companies(*), project:projects(*)')
        .order('name')

      if (error) throw error
      
      const employeesData = data || []
      setEmployees(employeesData)
      
      // استخراج القوائم الفريدة للفلاتر
      // Reserved for future use: uniqueCompanies
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const uniqueCompanies = [...new Set(employeesData.map(e => e.company?.name).filter(Boolean))] as string[]
      const uniqueNationalities = [...new Set(employeesData.map(e => e.nationality).filter(Boolean))] as string[]
      const uniqueProfessions = [...new Set(employeesData.map(e => e.profession).filter(Boolean))] as string[]
      
      // بناء قائمة المؤسسات مع IDs و unified_number
      const companiesMap = new Map<string, { name: string; unified_number?: number }>()
      employeesData.forEach(emp => {
        if (emp.company?.id && emp.company?.name) {
          if (!companiesMap.has(emp.company.id)) {
            companiesMap.set(emp.company.id, {
              name: emp.company.name,
              unified_number: emp.company.unified_number
            })
          }
        }
      })
      const companiesWithIdsList = Array.from(companiesMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        unified_number: data.unified_number
      }))
      setCompaniesWithIds(companiesWithIdsList.sort((a, b) => a.name.localeCompare(b.name)))
      
      // تحميل المشاريع من جدول projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (!projectsError && projectsData) {
        const projectNames = projectsData.map(p => p.name).filter(Boolean)
        setProjects(projectNames.sort())
      } else {
        // Fallback: استخراج من project_name القديم إذا فشل تحميل المشاريع
        const uniqueProjects = [...new Set(employeesData.map(e => e.project?.name || e.project_name).filter(Boolean))] as string[]
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
      const company = companiesWithIds.find(c => c.id === companyId)
      if (company && companyFilter !== company.name) {
        setCompanyFilter(company.name)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companiesWithIds, location.search])

  // Clear selection when filters change
  useEffect(() => {
    setSelectedEmployees(new Set())
  }, [searchTerm, residenceNumberSearch, companyFilter, nationalityFilter, professionFilter, projectFilter, contractFilter, hiredWorkerContractFilter, residenceFilter, healthInsuranceFilter, showAlertsOnly])  // تحديث: insuranceFilter → healthInsuranceFilter

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target as Node)) {
        setCompanyDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // تحديث نص البحث عند تغيير الشركة المختارة
  useEffect(() => {
    if (companyFilter && companiesWithIds.length > 0) {
      const selectedCompany = companiesWithIds.find(c => c.name === companyFilter)
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
  const filteredCompanies = companiesWithIds.filter(company => {
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
        setHealthInsuranceFilter('منتهي')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'urgent-contracts':
        setContractFilter('طارئ')
        break
      case 'urgent-residences':
        setResidenceFilter('طارئ')
        break
      case 'expiring-insurance-30':
        setHealthInsuranceFilter('طارئ')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'expiring-insurance-60':
        setHealthInsuranceFilter('متوسط')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'expiring-insurance-90':
        setHealthInsuranceFilter('ساري')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'active-insurance':
        setHealthInsuranceFilter('ساري')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
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
    const urgentDays = thresholds[`${fieldType}_urgent_days` as keyof EmployeeNotificationThresholds] as number
    const highDays = thresholds[`${fieldType}_high_days` as keyof EmployeeNotificationThresholds] as number
    const mediumDays = thresholds[`${fieldType}_medium_days` as keyof EmployeeNotificationThresholds] as number

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
      getStatusForField(healthInsuranceExpiry, 'health_insurance')
    ]

    // يعتبر تنبيه إذا كانت الحالة منتهية أو ضمن نطاق طارئ/عاجل/متوسط
    return statuses.some(status => ['منتهي', 'طارئ', 'عاجل', 'متوسط'].includes(status))
  }

  const getStatusColor = (
    days: number | null,
    thresholds: EmployeeNotificationThresholds | null,
    fieldType: 'residence' | 'contract' | 'health_insurance' | 'hired_worker_contract' = 'residence'
  ) => {
    // إذا كان null (لا يوجد تاريخ انتهاء)، يعتبر ساري
    if (days === null) return 'text-green-600 bg-green-50'

    const resolvedThresholds = thresholds || COLOR_THRESHOLD_FALLBACK

    const urgentDays = resolvedThresholds[`${fieldType}_urgent_days` as keyof EmployeeNotificationThresholds] as number
    const highDays = resolvedThresholds[`${fieldType}_high_days` as keyof EmployeeNotificationThresholds] as number
    const mediumDays = resolvedThresholds[`${fieldType}_medium_days` as keyof EmployeeNotificationThresholds] as number

    // منتهي أو أقل من أو يساوي الحد الطارئ: أحمر (طارئ)
    if (days < 0) return 'text-red-600 bg-red-50'
    if (days <= urgentDays) return 'text-red-600 bg-red-50'
    // بين الطارئ والعاجل: برتقالي (عاجل)
    if (days <= highDays) return 'text-orange-600 bg-orange-50'
    // بين العاجل والمتوسط: أصفر (تحذير)
    if (days <= mediumDays) return 'text-yellow-600 bg-yellow-50'
    // أكثر من المتوسط: أخضر (ساري)
    return 'text-green-600 bg-green-50'
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
    if (days === null) return 'text-gray-700'
    // منتهي: لون أحمر
    if (days < 0) return 'text-red-600'
    return 'text-gray-700'
  }

  // دالة لتقليص النصوص
  const truncateText = (text: string | number | null | undefined, maxLength: number): string => {
    if (text === null || text === undefined) return '-'
    // تحويل القيمة إلى نص
    const textStr = String(text)
    if (textStr.length <= maxLength) return textStr
    return textStr.substring(0, maxLength)
  }

  // دالة لتقليص الأرقام
  const truncateNumber = (num: number | null | undefined, maxDigits: number): string => {
    if (!num) return '-'
    const numStr = num.toString()
    if (numStr.length <= maxDigits) return numStr
    return numStr.substring(0, maxDigits)
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
    setHealthInsuranceFilter('')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
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

  // تم إزالة دوال التعديل السريع
  
  const logActivity = async (employeeId: string, action: string, changes: Record<string, unknown>) => {
    try {
      const employee = employees.find(e => e.id === employeeId)
      await supabase
        .from('activity_log')
        .insert({
          entity_type: 'employee',
          entity_id: employeeId,
          action: action,
          details: {
            employee_name: employee?.name,
            changes: changes,
            timestamp: new Date().toISOString()
          }
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
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeToDelete.id)

      if (error) {
        logger.error('Delete error:', error)
        throw error
      }

      // Log activity
      await logActivity(employeeToDelete.id, 'حذف موظف', {
        employee_name: employeeToDelete.name,
        company: employeeToDelete.company?.name
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
    setSelectedEmployees(prev => {
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
      setSelectedEmployees(new Set(filteredEmployees.map(emp => emp.id)))
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
      const selectedEmployeesData = employees.filter(emp => employeeIds.includes(emp.id))
      
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
          const { error } = await supabase
            .from('employees')
            .delete()
            .in('id', batch)

          if (error) {
            logger.error(`Error deleting batch ${currentBatch}/${totalBatches}:`, error)
            failedBatches.push(...batch)
            continue
          }

          totalDeleted += batch.length
          
          // Log activity for each employee in this batch (skip if too many to avoid performance issues)
          // For large deletions, we'll log a summary instead
          if (selectedEmployeesData.length <= 100) {
            const batchEmployees = selectedEmployeesData.filter(emp => batch.includes(emp.id))
            for (const employee of batchEmployees) {
              try {
                await logActivity(employee.id, 'حذف موظف (جماعي)', {
                  employee_name: employee.name,
                  company: employee.company?.name
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
      const selectedEmployeesData = employees.filter(emp => employeeIds.includes(emp.id))

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
          new_date: newDate
        })
      }

      toast.success(`تم تحديث تاريخ انتهاء الإقامة لـ ${selectedEmployees.size} موظف`)
      
      // Refresh and clear selection
      await loadEmployees()
      clearSelection()
      setShowBulkResidenceModal(false)
    } catch (error) {
      logger.error('Error bulk updating residence:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل في تحديث تاريخ انتهاء الإقامة'
      toast.error(errorMessage)
    }
  }

  // Bulk update insurance expiry date
  const handleBulkUpdateInsurance = async (newDate: string) => {
    if (selectedEmployees.size === 0) return

    try {
      const employeeIds = Array.from(selectedEmployees)
      const selectedEmployeesData = employees.filter(emp => employeeIds.includes(emp.id))

      // Update all selected employees
      const { error } = await supabase
        .from('employees')
        .update({ health_insurance_expiry: newDate })  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
        .in('id', employeeIds)

      if (error) throw error

      // Log activity for each employee
      for (const employee of selectedEmployeesData) {
        await logActivity(employee.id, 'تعديل تاريخ انتهاء التأمين (جماعي)', {
          employee_name: employee.name,
          old_date: employee.health_insurance_expiry,  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
          new_date: newDate
        })
      }

      toast.success(`تم تحديث تاريخ انتهاء التأمين لـ ${selectedEmployees.size} موظف`)
      
      // Refresh and clear selection
      await loadEmployees()
      clearSelection()
      setShowBulkInsuranceModal(false)
    } catch (error) {
      logger.error('Error bulk updating insurance:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل في تحديث تاريخ انتهاء التأمين'
      toast.error(errorMessage)
    }
  }

  // Bulk update contract expiry date
  const handleBulkUpdateContract = async (newDate: string) => {
    if (selectedEmployees.size === 0) return

    try {
      const employeeIds = Array.from(selectedEmployees)
      const selectedEmployeesData = employees.filter(emp => employeeIds.includes(emp.id))

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
          new_date: newDate
        })
      }

      toast.success(`تم تحديث تاريخ انتهاء العقد لـ ${selectedEmployees.size} موظف`)
      
      // Refresh and clear selection
      await loadEmployees()
      clearSelection()
      setShowBulkContractModal(false)
    } catch (error) {
      logger.error('Error bulk updating contract:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل في تحديث تاريخ انتهاء العقد'
      toast.error(errorMessage)
    }
  }

  const alertsCount = employees.reduce((count, emp) => {
    return count + (hasAlert(emp.contract_expiry, emp.hired_worker_contract_expiry, emp.residence_expiry, emp.health_insurance_expiry) ? 1 : 0)
  }, 0)

  const filteredEmployees = employees.filter(emp => {
    const contractStatus = getStatusForField(emp.contract_expiry, 'contract')
    const hiredWorkerStatus = getStatusForField(emp.hired_worker_contract_expiry, 'hired_worker_contract')
    const residenceStatus = getStatusForField(emp.residence_expiry, 'residence')
    const insuranceStatus = getStatusForField(emp.health_insurance_expiry, 'health_insurance')

    // البحث الشامل في الاسم، رقم الإقامة، رقم الجواز، المهنة، والجنسية
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = !searchTerm || (
      emp.name.toLowerCase().includes(searchLower) ||
      emp.residence_number.toString().toLowerCase().includes(searchLower) ||
      (emp.passport_number && emp.passport_number.toLowerCase().includes(searchLower)) ||
      (emp.profession && emp.profession.toLowerCase().includes(searchLower)) ||
      (emp.nationality && emp.nationality.toLowerCase().includes(searchLower))
    )
    const matchesResidenceNumber = !residenceNumberSearch || emp.residence_number.toString().toLowerCase().includes(residenceNumberSearch.toLowerCase())
    const matchesCompany = !companyFilter || emp.company?.name === companyFilter
    const matchesNationality = !nationalityFilter || emp.nationality === nationalityFilter
    const matchesProfession = !professionFilter || emp.profession === professionFilter
    const matchesProject = !projectFilter || emp.project?.name === projectFilter || (emp.project_name === projectFilter && !emp.project)
    
    // فلترة خاصة لـ "لديه تنبيه"
    const matchesContract = !contractFilter || (
      contractFilter === 'لديه تنبيه' 
        ? hasAlert(emp.contract_expiry, emp.hired_worker_contract_expiry, emp.residence_expiry, emp.health_insurance_expiry)
        : contractStatus === contractFilter
    )
    const matchesHiredWorkerContract = !hiredWorkerContractFilter || (
      hiredWorkerContractFilter === 'لديه تنبيه'
        ? hasAlert(emp.contract_expiry, emp.hired_worker_contract_expiry, emp.residence_expiry, emp.health_insurance_expiry)
        : hiredWorkerStatus === hiredWorkerContractFilter
    )
    const matchesResidence = !residenceFilter || (
      residenceFilter === 'لديه تنبيه'
        ? hasAlert(emp.contract_expiry, emp.hired_worker_contract_expiry, emp.residence_expiry, emp.health_insurance_expiry)
        : residenceStatus === residenceFilter
    )
    const matchesInsurance = !healthInsuranceFilter || (
      healthInsuranceFilter === 'لديه تنبيه'
        ? hasAlert(emp.contract_expiry, emp.hired_worker_contract_expiry, emp.residence_expiry, emp.health_insurance_expiry)
        : insuranceStatus === healthInsuranceFilter
    )

    const matchesAlertsToggle = !showAlertsOnly || hasAlert(emp.contract_expiry, emp.hired_worker_contract_expiry, emp.residence_expiry, emp.health_insurance_expiry)
    
    return matchesSearch && matchesResidenceNumber && matchesCompany && matchesNationality && matchesProfession && matchesProject && matchesContract && matchesHiredWorkerContract && matchesResidence && matchesInsurance && matchesAlertsToggle
  })

  const hasActiveFilters = searchTerm || residenceNumberSearch || companyFilter || nationalityFilter || professionFilter || projectFilter || contractFilter || hiredWorkerContractFilter || residenceFilter || healthInsuranceFilter || showAlertsOnly  // تحديث: insuranceFilter → healthInsuranceFilter

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
    healthInsuranceFilter !== '',  // تحديث: insuranceFilter → healthInsuranceFilter
    showAlertsOnly
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
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
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
        aValue = a.hired_worker_contract_expiry ? new Date(a.hired_worker_contract_expiry).getTime() : 0
        bValue = b.hired_worker_contract_expiry ? new Date(b.hired_worker_contract_expiry).getTime() : 0
        break
      case 'residence_expiry':
        aValue = a.residence_expiry ? new Date(a.residence_expiry).getTime() : 0
        bValue = b.residence_expiry ? new Date(b.residence_expiry).getTime() : 0
        break
      case 'health_insurance_expiry':  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
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
    if (isCardOpen || isAddModalOpen || showDeleteModal || showBulkDeleteModal || showFiltersModal) {
      return
    }

    function handleKeyDown(e: KeyboardEvent) {
      // التحقق من أن المستخدم لا يكتب في حقل إدخال
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
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
  }, [selectedRowIndex, sortedAndFilteredEmployees, isCardOpen, isAddModalOpen, showDeleteModal, showBulkDeleteModal, showFiltersModal])

  // إعادة تعيين الصف المحدد عند تغيير الفلاتر
  useEffect(() => {
    setSelectedRowIndex(null)
  }, [searchTerm, companyFilter, nationalityFilter, professionFilter, projectFilter, contractFilter, residenceFilter, healthInsuranceFilter, sortField, sortDirection])

  // التحقق من صلاحية العرض قبل عرض الصفحة
  if (!hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header with Actions */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">الموظفين</h1>
            <p className="text-sm text-gray-600">
              عرض {sortedAndFilteredEmployees.length} من {employees.length} موظف
              {activeFiltersCount > 0 && (
                <span className="mr-2 text-blue-600 font-medium">
                  ({activeFiltersCount} فلتر نشط)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 border border-gray-300">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 text-sm ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="عرض الجدول"
              >
                <Table className="w-4 h-4" />
                <span className="hidden sm:inline">جدول</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 text-sm ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="عرض الكروت"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">كروت</span>
              </button>
            </div>
            
            {canCreate('employees') && (
              <>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  إضافة موظف
                </button>
              </>
            )}
          </div>
        </div>

        {/* Compact Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الإقامة أو رقم الجواز أو المهنة أو الجنسية..."
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter Button with Badge */}
            <button
              onClick={() => setShowFiltersModal(true)}
              className="relative px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              <span>الفلاتر</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Alerts quick filter */}
            <button
              onClick={() => setShowAlertsOnly(prev => !prev)}
              className={`relative px-4 py-2 rounded-md border transition flex items-center gap-2 ${showAlertsOnly ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'}`}
              title="عرض الموظفين ذوي التنبيهات فقط"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline">تنبيهات</span>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {alertsCount}
              </span>
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition flex items-center gap-2 border border-gray-300"
              >
                {getSortIcon(sortField)}
                <span className="hidden sm:inline">الترتيب</span>
                <ArrowUpDown className="w-4 h-4" />
              </button>

              {/* Sort Dropdown Menu */}
              {showSortDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortDropdown(false)}
                  />
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-2">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
                      الترتيب حسب:
                    </div>
                    {[
                      { field: 'name' as typeof sortField, label: 'الاسم' },
                      { field: 'profession' as typeof sortField, label: 'المهنة' },
                      { field: 'nationality' as typeof sortField, label: 'الجنسية' },
                      { field: 'company' as typeof sortField, label: 'الشركة' },
                      { field: 'project' as typeof sortField, label: 'المشروع' },
                      { field: 'contract_expiry' as typeof sortField, label: 'تاريخ انتهاء العقد' },
                      { field: 'hired_worker_contract_expiry' as typeof sortField, label: 'تاريخ انتهاء عقد أجير' },
                      { field: 'residence_expiry' as typeof sortField, label: 'تاريخ انتهاء الإقامة' },
                      { field: 'health_insurance_expiry' as typeof sortField, label: 'تاريخ انتهاء التأمين الصحي' }
                    ].map(({ field, label }) => (
                      <button
                        key={field}
                        onClick={() => {
                          handleSort(field)
                          setShowSortDropdown(false)
                        }}
                        className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-50 transition flex items-center justify-between ${
                          sortField === field ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
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
          </div>
        </div>

        {/* Filters Modal */}
        {showFiltersModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowFiltersModal(false)}
            />
            
            {/* Modal Content */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">الفلاتر والبحث</h2>
                    {activeFiltersCount > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {activeFiltersCount} فلتر نشط
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* البحث برقم الإقامة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">البحث برقم الإقامة</label>
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="ابحث برقم الإقامة..."
                          value={residenceNumberSearch}
                          onChange={(e) => setResidenceNumberSearch(e.target.value)}
                          className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* فلتر الشركة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">الشركة</label>
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
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search className="w-4 h-4 text-gray-400" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setCompanyDropdownOpen(!isCompanyDropdownOpen)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                        
                        {isCompanyDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setCompanyFilter('')
                                setCompanySearchQuery('')
                                setCompanyDropdownOpen(false)
                              }}
                              className="w-full px-3 py-2 text-right text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors text-gray-600"
                            >
                              جميع الشركات
                            </button>
                            {filteredCompanies.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                {companySearchQuery.trim() ? 'لا توجد نتائج' : 'لا توجد شركات متاحة'}
                              </div>
                            ) : (
                              filteredCompanies.map(company => {
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">الجنسية</label>
                      <select
                        value={nationalityFilter}
                        onChange={(e) => setNationalityFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">جميع الجنسيات</option>
                        {nationalities.map(nationality => (
                          <option key={nationality} value={nationality}>{nationality}</option>
                        ))}
                      </select>
                    </div>

                    {/* فلتر المهنة */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">المهنة</label>
                      <select
                        value={professionFilter}
                        onChange={(e) => setProfessionFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">جميع المهن</option>
                        {professions.map(profession => (
                          <option key={profession} value={profession}>{profession}</option>
                        ))}
                      </select>
                    </div>

                    {/* فلتر المشروع */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">المشروع</label>
                      <select
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">جميع المشاريع</option>
                        {projects.map(project => (
                          <option key={project} value={project}>{project}</option>
                        ))}
                      </select>
                    </div>

                    {/* فلتر العقود */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">حالة العقد</label>
                      <select
                        value={contractFilter}
                        onChange={(e) => setContractFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">حالة عقد أجير</label>
                      <select
                        value={hiredWorkerContractFilter}
                        onChange={(e) => setHiredWorkerContractFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">حالة الإقامة</label>
                      <select
                        value={residenceFilter}
                        onChange={(e) => setResidenceFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">حالة التأمين</label>
                      <select
                        value={healthInsuranceFilter}
                        onChange={(e) => setHealthInsuranceFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">الفلاتر النشطة:</h3>
                      <div className="flex flex-wrap gap-2">
                        {searchTerm && (
                          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full flex items-center gap-2">
                            البحث: {searchTerm}
                            <button
                              onClick={() => setSearchTerm('')}
                              className="hover:bg-blue-100 rounded-full p-0.5"
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
                              className="hover:bg-cyan-100 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {companyFilter && (
                          <span className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-full flex items-center gap-2">
                            الشركة: {companyFilter}
                            <button
                              onClick={() => setCompanyFilter('')}
                              className="hover:bg-green-100 rounded-full p-0.5"
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
                              className="hover:bg-purple-100 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {professionFilter && (
                          <span className="px-3 py-1.5 bg-orange-50 text-orange-700 text-sm rounded-full flex items-center gap-2">
                            المهنة: {professionFilter}
                            <button
                              onClick={() => setProfessionFilter('')}
                              className="hover:bg-orange-100 rounded-full p-0.5"
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
                              className="hover:bg-indigo-100 rounded-full p-0.5"
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
                              className="hover:bg-red-100 rounded-full p-0.5"
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
                              className="hover:bg-indigo-100 rounded-full p-0.5"
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
                              className="hover:bg-rose-100 rounded-full p-0.5"
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
                              className="hover:bg-emerald-100 rounded-full p-0.5"
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
                              className="hover:bg-red-100 rounded-full p-0.5"
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
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={clearFilters}
                    disabled={activeFiltersCount === 0}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <X className="w-4 h-4" />
                    مسح جميع الفلاتر
                  </button>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    تطبيق الفلاتر
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedEmployees.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-xs font-medium">
                  {selectedEmployees.size} موظف محدد
                </div>
                <button
                  onClick={clearSelection}
                  className="text-xs text-gray-600 hover:text-gray-900 underline"
                >
                  إلغاء التحديد
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setShowBulkResidenceModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-xs font-medium"
                  title="تعديل تاريخ انتهاء الإقامة"
                >
                  <Calendar className="w-3 h-3" />
                  تعديل تاريخ الإقامة
                </button>
                <button
                  onClick={() => setShowBulkInsuranceModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition text-xs font-medium"
                  title="تعديل تاريخ انتهاء التأمين"
                >
                  <Calendar className="w-3 h-3" />
                  تعديل تاريخ التأمين
                </button>
                <button
                  onClick={() => setShowBulkContractModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition text-xs font-medium"
                  title="تعديل تاريخ انتهاء العقد"
                >
                  <Calendar className="w-3 h-3" />
                  تعديل تاريخ العقد
                </button>
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-xs font-medium"
                  title="حذف الموظفين المحددين"
                >
                  <Trash2 className="w-3 h-3" />
                  حذف المحددين
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {sortedAndFilteredEmployees.map((employee) => {
              const contractDays = employee.contract_expiry ? getDaysRemaining(employee.contract_expiry) : null
              const hiredWorkerContractDays = employee.hired_worker_contract_expiry ? getDaysRemaining(employee.hired_worker_contract_expiry) : null
              const residenceDays = employee.residence_expiry ? getDaysRemaining(employee.residence_expiry) : null
              const healthInsuranceDays = employee.health_insurance_expiry ? getDaysRemaining(employee.health_insurance_expiry) : null

              // تحديد لون الحدود حسب أعلى أولوية
              const getBorderColor = () => {
                const priorities = [
                  contractDays !== null && contractDays < 0 ? 'critical' : contractDays !== null && contractDays <= 7 ? 'critical' : contractDays !== null && contractDays <= 30 ? 'medium' : 'low',
                  hiredWorkerContractDays !== null && hiredWorkerContractDays < 0 ? 'critical' : hiredWorkerContractDays !== null && hiredWorkerContractDays <= 7 ? 'critical' : hiredWorkerContractDays !== null && hiredWorkerContractDays <= 30 ? 'medium' : 'low',
                  residenceDays !== null && residenceDays < 0 ? 'critical' : residenceDays !== null && residenceDays <= 7 ? 'critical' : residenceDays !== null && residenceDays <= 30 ? 'medium' : 'low',
                  healthInsuranceDays !== null && healthInsuranceDays < 0 ? 'critical' : healthInsuranceDays !== null && healthInsuranceDays <= 7 ? 'critical' : healthInsuranceDays !== null && healthInsuranceDays <= 30 ? 'medium' : 'low'
                ]
                
                if (priorities.includes('critical')) return 'border-red-400'
                if (priorities.includes('medium')) return 'border-yellow-400'
                if (priorities.includes('low')) return 'border-green-400'
                return 'border-gray-200'
              }

              // دالة للحصول على حالة التاريخ
              const getDateStatus = (days: number | null, expiredText: string = 'منتهي') => {
                if (days === null) return { status: 'غير محدد', description: '', emoji: '❌', color: 'bg-gray-100 text-gray-600 border-gray-200' }
                if (days < 0) return { status: expiredText, description: 'منتهي', emoji: '🚨', color: 'bg-red-50 text-red-700 border-red-300' }
                if (days <= 7) return { status: 'حرج', description: `${days} يوم`, emoji: '🚨', color: 'bg-red-50 text-red-700 border-red-300' }
                if (days <= 15) return { status: 'عاجل', description: `${days} يوم`, emoji: '🔥', color: 'bg-orange-50 text-orange-700 border-orange-300' }
                if (days <= 30) return { status: 'متوسط', description: `${days} يوم`, emoji: '⚠️', color: 'bg-yellow-50 text-yellow-700 border-yellow-300' }
                return { status: 'ساري', description: `${days} يوم`, emoji: '✅', color: 'bg-green-50 text-green-700 border-green-300' }
              }

              const contractStatus = getDateStatus(contractDays, 'منتهي')
              const hiredWorkerStatus = getDateStatus(hiredWorkerContractDays, 'منتهي')
              const residenceStatus = getDateStatus(residenceDays, 'منتهية')
              const insuranceStatus = getDateStatus(healthInsuranceDays, 'منتهي')

              return (
                <div
                  key={employee.id}
                  onClick={() => handleEmployeeClick(employee)}
                  className={`bg-white rounded-xl shadow-sm border-2 ${getBorderColor()} p-4 hover:shadow-md transition relative cursor-pointer`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {canEdit('employees') && (
                        <button
                          onClick={() => handleEmployeeClick(employee)}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded-md transition"
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

                  <h3 className="text-base font-bold text-gray-900 mb-2">{employee.name}</h3>

                  <div className="space-y-1.5 text-xs mb-3">
                    {employee.project?.name || employee.project_name ? (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">المشروع:</span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                          {employee.project?.name || employee.project_name}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <span className="text-gray-600">الشركة:</span>
                      <span className="font-medium text-gray-900 text-left">
                        {employee.company?.name || '-'}
                        {employee.company?.unified_number && (
                          <span className="text-gray-500 mr-1">({employee.company.unified_number})</span>
                        )}
                      </span>
                    </div>
                    {employee.residence_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">رقم الإقامة:</span>
                        <span className="font-mono text-gray-900">{employee.residence_number}</span>
                      </div>
                    )}
                    {employee.profession && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">المهنة:</span>
                        <span className="font-medium text-gray-900">{employee.profession}</span>
                      </div>
                    )}
                    {employee.nationality && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">الجنسية:</span>
                        <span className="font-medium text-gray-900">{employee.nationality}</span>
                      </div>
                    )}
                  </div>

                  {/* مربعات الحالات - grid من عمودين */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-2">
                      {/* حالة انتهاء العقد */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">انتهاء العقد</div>
                        {employee.contract_expiry ? (
                          <div className={`px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${contractStatus.color}`}>
                            <div className="flex items-center gap-1">
                              <div className="text-sm">{contractStatus.emoji}</div>
                              <div className="flex flex-col">
                                <span className="font-bold">{contractStatus.status}</span>
                                <span className="text-xs opacity-75">{contractStatus.description}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                            غير محدد
                          </div>
                        )}
                      </div>

                      {/* حالة انتهاء عقد أجير */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">انتهاء عقد أجير</div>
                        {employee.hired_worker_contract_expiry ? (
                          <div className={`px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${hiredWorkerStatus.color}`}>
                            <div className="flex items-center gap-1">
                              <div className="text-sm">{hiredWorkerStatus.emoji}</div>
                              <div className="flex flex-col">
                                <span className="font-bold">{hiredWorkerStatus.status}</span>
                                <span className="text-xs opacity-75">{hiredWorkerStatus.description}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                            غير محدد
                          </div>
                        )}
                      </div>

                      {/* حالة انتهاء الإقامة */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">انتهاء الإقامة</div>
                        {employee.residence_expiry ? (
                          <div className={`px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${residenceStatus.color}`}>
                            <div className="flex items-center gap-1">
                              <div className="text-sm">{residenceStatus.emoji}</div>
                              <div className="flex flex-col">
                                <span className="font-bold">{residenceStatus.status}</span>
                                <span className="text-xs opacity-75">{residenceStatus.description}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                            غير محدد
                          </div>
                        )}
                      </div>

                      {/* حالة التأمين */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">حالة التأمين</div>
                        {employee.health_insurance_expiry ? (
                          <div className={`px-2 py-1.5 rounded-lg text-xs font-medium border-2 ${insuranceStatus.color}`}>
                            <div className="flex items-center gap-1">
                              <div className="text-sm">{insuranceStatus.emoji}</div>
                              <div className="flex flex-col">
                                <span className="font-bold">{insuranceStatus.status}</span>
                                <span className="text-xs opacity-75">{insuranceStatus.description}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-2 border-gray-200">
                            غير محدد
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* الملاحظات */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      الملاحظات
                    </div>
                    <div className="px-3 py-2 rounded-lg text-xs bg-gray-50 text-gray-700 border border-gray-200 whitespace-pre-wrap min-h-[50px]">
                      {employee.notes || 'لا توجد ملاحظات'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Table View
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" ref={tableRef}>
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center justify-center w-4 h-4"
                        title={selectedEmployees.size === filteredEmployees.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                      >
                        {selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">الاسم</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">المهنة</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">الجنسية</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">الشركة</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">المشروع</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">رقم الإقامة</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">تاريخ الميلاد</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">تاريخ الالتحاق</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">الراتب</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">انتهاء العقد</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">انتهاء عقد أجير</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">انتهاء الإقامة</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase">حالة التأمين</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedAndFilteredEmployees.map((employee, index) => {
                    const contractDays = employee.contract_expiry ? getDaysRemaining(employee.contract_expiry) : null
                    const hiredWorkerContractDays = employee.hired_worker_contract_expiry ? getDaysRemaining(employee.hired_worker_contract_expiry) : null
                    const residenceDays = employee.residence_expiry ? getDaysRemaining(employee.residence_expiry) : null
                    const healthInsuranceDays = employee.health_insurance_expiry ? getDaysRemaining(employee.health_insurance_expiry) : null
                    const isSelected = selectedRowIndex === index

                    return (
                      <tr 
                        key={employee.id} 
                        ref={(el) => { rowRefs.current[index] = el }}
                        className={`hover:bg-gray-50 transition ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                      >
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleEmployeeSelection(employee.id)
                            }}
                            className="flex items-center justify-center w-4 h-4"
                          >
                            {selectedEmployees.has(employee.id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td 
                          className="px-3 py-2 text-xs font-medium text-gray-900 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {truncateText(employee.name, 17)}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {truncateText(employee.profession, 10)}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {truncateText(employee.nationality, 10)}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {(() => {
                            const companyName = employee.company?.name || ''
                            const unifiedNumber = employee.company?.unified_number
                            // أخذ أول 3 كلمات من اسم الشركة
                            const words = companyName.split(' ').slice(0, 3).join(' ')
                            const displayText = unifiedNumber 
                              ? `${words}${companyName.split(' ').length > 3 ? '...' : ''} (${unifiedNumber})`
                              : words
                            return displayText || '-'
                          })()}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {employee.project?.name || employee.project_name ? (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                              {truncateText(employee.project?.name || employee.project_name, 20)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs font-mono text-gray-900 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {truncateText(employee.residence_number, 10)}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <HijriDateDisplay date={employee.birth_date}>
                            {truncateText(formatDateShortWithHijri(employee.birth_date), 10)}
                          </HijriDateDisplay>
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <HijriDateDisplay date={employee.joining_date}>
                            {truncateText(formatDateShortWithHijri(employee.joining_date), 10)}
                          </HijriDateDisplay>
                        </td>
                        <td 
                          className="px-3 py-2 text-xs font-medium text-gray-900 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {employee.salary ? truncateNumber(employee.salary, 5) : '-'}
                        </td>
                        <td 
                          className={`px-3 py-2 text-xs cursor-pointer text-center ${getCellBackgroundColor(contractDays)}`}
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className={getTextColor(contractDays)}>
                              {employee.contract_expiry ? (
                                <HijriDateDisplay date={employee.contract_expiry}>
                                  {truncateText(formatDateShortWithHijri(employee.contract_expiry), 10)}
                                </HijriDateDisplay>
                              ) : '-'}
                            </span>
                            {employee.contract_expiry && (
                              <span className={`text-xs ${getStatusColor(contractDays, colorThresholds, 'contract')}`}>
                                {formatDateStatus(contractDays, 'منتهي')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td 
                          className={`px-3 py-2 text-xs cursor-pointer text-center ${getCellBackgroundColor(hiredWorkerContractDays)}`}
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className={getTextColor(hiredWorkerContractDays)}>
                              {employee.hired_worker_contract_expiry ? (
                                <HijriDateDisplay date={employee.hired_worker_contract_expiry}>
                                  {truncateText(formatDateShortWithHijri(employee.hired_worker_contract_expiry), 10)}
                                </HijriDateDisplay>
                              ) : '-'}
                            </span>
                            {employee.hired_worker_contract_expiry && (
                              <span className={`text-xs ${getStatusColor(hiredWorkerContractDays, colorThresholds, 'hired_worker_contract')}`}>
                                {formatDateStatus(hiredWorkerContractDays, 'منتهي')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td 
                          className={`px-3 py-2 text-xs cursor-pointer text-center ${getCellBackgroundColor(residenceDays)}`}
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className={getTextColor(residenceDays)}>
                              {employee.residence_expiry ? (
                                <HijriDateDisplay date={employee.residence_expiry}>
                                  {truncateText(formatDateShortWithHijri(employee.residence_expiry), 10)}
                                </HijriDateDisplay>
                              ) : '-'}
                            </span>
                            {employee.residence_expiry && (
                              <span className={`text-xs ${getStatusColor(residenceDays, colorThresholds, 'residence')}`}>
                                {formatDateStatus(residenceDays, 'منتهية')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td 
                          className={`px-3 py-2 text-xs cursor-pointer text-center ${getCellBackgroundColor(healthInsuranceDays)}`}
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className={getTextColor(healthInsuranceDays)}>
                              {employee.health_insurance_expiry ? (
                                <HijriDateDisplay date={employee.health_insurance_expiry}>
                                  {truncateText(formatDateShortWithHijri(employee.health_insurance_expiry), 10)}
                                </HijriDateDisplay>
                              ) : '-'}
                            </span>
                            {employee.health_insurance_expiry && (
                              <span className={`text-xs ${getStatusColor(healthInsuranceDays, colorThresholds, 'health_insurance')}`}>
                                {formatDateStatus(healthInsuranceDays, 'منتهي')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEmployeeClick(employee)
                              }}
                              className="flex items-center gap-0.5 px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition"
                              title="عرض التفاصيل وتعديل البيانات"
                            >
                              <Eye className="w-3 h-3" />
                              عرض
                            </button>
                            {canDelete('employees') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteEmployee(employee)  // تحديث: تمرير employee كامل بدلاً من employee.id
                                }}
                                className="flex items-center gap-0.5 px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
                                title="حذف الموظف"
                              >
                                <Trash2 className="w-3 h-3" />
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {sortedAndFilteredEmployees.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-3 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">تأكيد حذف الموظف</h3>
                  <p className="text-sm text-gray-600">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                هل أنت متأكد من حذف الموظف "<strong>{employeeToDelete?.name}</strong>"؟
                <br />
                <span className="text-sm text-red-600 mt-2 block">
                  سيتم حذف جميع بيانات هذا الموظف نهائياً
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmDeleteEmployee}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
                >
                  نعم، احذف
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setEmployeeToDelete(null)
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال حذف جماعي */}
      {showBulkDeleteModal && (
        <BulkDeleteModal
          selectedCount={selectedEmployees.size}
          selectedEmployees={employees.filter(emp => selectedEmployees.has(emp.id))}
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
  isDeleting = false
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={handleCancel}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">تأكيد حذف الموظفين</h3>
              <p className="text-sm text-gray-600">هذا الإجراء لا يمكن التراجع عنه</p>
            </div>
          </div>
          <p className="text-gray-700 mb-4">
            هل أنت متأكد من حذف <strong>{selectedCount} موظف</strong>؟
            <br />
            <span className="text-sm text-red-600 mt-2 block">
              سيتم حذف جميع بيانات هؤلاء الموظفين نهائياً
            </span>
          </p>
          {isDeleting && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium">جاري حذف الموظفين، يرجى الانتظار...</span>
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">الموظفون المحددون:</p>
            <ul className="space-y-1">
              {selectedEmployees.slice(0, 50).map(emp => (
                <li key={emp.id} className="text-sm text-gray-600">
                  • {emp.name} {emp.company?.name && `(${emp.company.name})`}
                </li>
              ))}
              {selectedEmployees.length > 50 && (
                <li className="text-sm text-gray-500 italic">
                  ... و {selectedEmployees.length - 50} موظف آخر
                </li>
              )}
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={isDeleting}
              className={`flex-1 px-4 py-2 rounded-md transition flex items-center justify-center gap-2 ${
                isDeleting
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  جاري الحذف...
                </>
              ) : (
                `نعم، احذف (${selectedCount})`
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isDeleting}
              className={`flex-1 px-4 py-2 rounded-md transition ${
                isDeleting
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              إلغاء
            </button>
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
  onCancel 
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">{selectedCount} موظف محدد</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                التاريخ الجديد
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!selectedDate}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                تأكيد التعديل
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
