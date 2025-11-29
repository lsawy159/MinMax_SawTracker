import { useEffect, useState } from 'react'
import { supabase, Employee, Company, Project } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import EmployeeCard from '@/components/employees/EmployeeCard'
import AddEmployeeModal from '@/components/employees/AddEmployeeModal'
import { Search, Calendar, AlertCircle, X, UserPlus, CheckSquare, Square, Trash2, Edit, Eye, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export default function Employees() {
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
  const [residenceFilter, setResidenceFilter] = useState<string>('')
  const [healthInsuranceFilter, setHealthInsuranceFilter] = useState<string>('')  // تحديث: insuranceFilter → healthInsuranceFilter
  
  const [companies, setCompanies] = useState<string[]>([])
  const [companiesWithIds, setCompaniesWithIds] = useState<Array<{ id: string; name: string }>>([])
  const [nationalities, setNationalities] = useState<string[]>([])
  const [professions, setProfessions] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])
  
  // حالة المودال
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { company: Company; project?: Project }) | null>(null)
  const [isCardOpen, setIsCardOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // حالة التعديل السريع - تم إزالتها
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<(Employee & { company: Company }) | null>(null)
  
  // Bulk selection states
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  
  // Bulk action modals
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [showBulkResidenceModal, setShowBulkResidenceModal] = useState(false)
  const [showBulkInsuranceModal, setShowBulkInsuranceModal] = useState(false)
  const [showBulkContractModal, setShowBulkContractModal] = useState(false)

  // Filter modal and sort states
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  
  // Sort states
  const [sortField, setSortField] = useState<'name' | 'profession' | 'nationality' | 'company' | 'contract_expiry' | 'residence_expiry' | 'health_insurance_expiry'>('name')  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    loadEmployees()
    handleUrlParams()
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [searchTerm, residenceNumberSearch, companyFilter, nationalityFilter, professionFilter, projectFilter, contractFilter, residenceFilter, healthInsuranceFilter])  // تحديث: insuranceFilter → healthInsuranceFilter

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
      case 'expired-contracts':
        setContractFilter('منتهية')
        break
      case 'expired-residences':
        setResidenceFilter('منتهية')
        break
      case 'expired-insurance':
        setHealthInsuranceFilter('منتهي')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'urgent-contracts':
        setContractFilter('تنتهي خلال 30 يوم')
        break
      case 'urgent-residences':
        setResidenceFilter('تنتهي خلال 30 يوم')
        break
      case 'expiring-insurance-30':
        setHealthInsuranceFilter('ينتهي خلال 30 يوم')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'expiring-insurance-60':
        setHealthInsuranceFilter('ينتهي خلال 60 يوم')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'expiring-insurance-90':
        setHealthInsuranceFilter('ينتهي خلال 90 يوم')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
      case 'active-insurance':
        setHealthInsuranceFilter('ساري')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
        break
    }
  }

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, company:companies(*), project:projects(*)')
        .order('name')

      if (error) throw error
      
      const employeesData = data || []
      setEmployees(employeesData)
      
      // استخراج القوائم الفريدة للفلاتر
      const uniqueCompanies = [...new Set(employeesData.map(e => e.company?.name).filter(Boolean))] as string[]
      const uniqueNationalities = [...new Set(employeesData.map(e => e.nationality).filter(Boolean))] as string[]
      const uniqueProfessions = [...new Set(employeesData.map(e => e.profession).filter(Boolean))] as string[]
      
      // بناء قائمة المؤسسات مع IDs
      const companiesMap = new Map<string, string>()
      employeesData.forEach(emp => {
        if (emp.company?.id && emp.company?.name) {
          companiesMap.set(emp.company.id, emp.company.name)
        }
      })
      const companiesWithIdsList = Array.from(companiesMap.entries()).map(([id, name]) => ({ id, name }))
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
      
      setCompanies(uniqueCompanies.sort())
      setNationalities(uniqueNationalities.sort())
      setProfessions(uniqueProfessions.sort())
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysRemaining = (date: string) => {
    return differenceInDays(new Date(date), new Date())
  }

  const getContractStatus = (contractExpiry: string | null) => {
    if (!contractExpiry) return 'بدون عقد'
    const days = getDaysRemaining(contractExpiry)
    if (days < 0) return 'منتهية'
    if (days <= 30) return 'تنتهي خلال 30 يوم'
    if (days <= 90) return 'تنتهي خلال 90 يوم'
    return 'ساري'
  }

  const getResidenceStatus = (residenceExpiry: string) => {
    const days = getDaysRemaining(residenceExpiry)
    if (days < 0) return 'منتهية'
    if (days <= 7) return 'تنتهي خلال 7 أيام'
    if (days <= 15) return 'تنتهي خلال 15 يوم'
    if (days <= 30) return 'تنتهي خلال 30 يوم'
    if (days <= 90) return 'تنتهي خلال 90 يوم'
    return 'ساري'
  }

  const getHealthInsuranceStatus = (healthInsuranceExpiry: string | null | undefined) => {  // تحديث: getInsuranceStatus → getHealthInsuranceStatus
    if (!healthInsuranceExpiry) return 'ساري'
    const days = getDaysRemaining(healthInsuranceExpiry)
    if (days < 0) return 'منتهي'
    if (days <= 30) return 'ينتهي خلال 30 يوم'
    if (days <= 60) return 'ينتهي خلال 60 يوم'
    if (days <= 90) return 'ينتهي خلال 90 يوم'
    return 'ساري'
  }

  const getStatusColor = (days: number | null) => {
    // إذا كان null (لا يوجد تاريخ انتهاء)، يعتبر ساري
    if (days === null) return 'text-green-600 bg-green-50'
    // منتهي أو أقل من أو يساوي 7 أيام: أحمر (طارئ)
    if (days < 0) return 'text-red-600 bg-red-50'
    if (days <= 7) return 'text-red-600 bg-red-50'
    // 8-15 يوم: برتقالي (عاجل)
    if (days <= 15) return 'text-orange-600 bg-orange-50'
    // 16-30 يوم: أصفر (تحذير)
    if (days <= 30) return 'text-yellow-600 bg-yellow-50'
    // أكثر من 30 يوم: أخضر (ساري)
    return 'text-green-600 bg-green-50'
  }

  const clearFilters = () => {
    setSearchTerm('')
    setResidenceNumberSearch('')
    setCompanyFilter('')
    setNationalityFilter('')
    setProfessionFilter('')
    setProjectFilter('')
    setContractFilter('')
    setResidenceFilter('')
    setHealthInsuranceFilter('')  // تحديث: setInsuranceFilter → setHealthInsuranceFilter
    navigate('/employees')
  }

  const handleEmployeeClick = (employee: Employee & { company: Company }) => {
    setSelectedEmployee(employee)
    setIsCardOpen(true)
  }

  const handleCloseCard = () => {
    setIsCardOpen(false)
    setSelectedEmployee(null)
  }

  const handleUpdateEmployee = async () => {
    // إعادة تحميل قائمة الموظفين بعد التحديث
    await loadEmployees()
  }

  // تم إزالة دوال التعديل السريع
  
  const logActivity = async (employeeId: string, action: string, changes: any) => {
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
      console.error('Error logging activity:', error)
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
        console.error('Delete error:', error)
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
    } catch (error: any) {
      console.error('Error deleting employee:', error)
      toast.error(error.message || 'فشل في حذف الموظف')
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

  // Bulk delete function
  const handleBulkDelete = async () => {
    if (selectedEmployees.size === 0) return

    try {
      const employeeIds = Array.from(selectedEmployees)
      const selectedEmployeesData = employees.filter(emp => employeeIds.includes(emp.id))

      // Delete all selected employees
      const { error } = await supabase
        .from('employees')
        .delete()
        .in('id', employeeIds)

      if (error) throw error

      // Log activity for each employee
      for (const employee of selectedEmployeesData) {
        await logActivity(employee.id, 'حذف موظف (جماعي)', {
          employee_name: employee.name,
          company: employee.company?.name
        })
      }

      toast.success(`تم حذف ${selectedEmployees.size} موظف بنجاح`)
      
      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('employeeUpdated'))
      
      // Refresh and clear selection
      await loadEmployees()
      clearSelection()
      setShowBulkDeleteModal(false)
    } catch (error: any) {
      console.error('Error bulk deleting employees:', error)
      toast.error(error.message || 'فشل في حذف الموظفين')
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
    } catch (error: any) {
      console.error('Error bulk updating residence:', error)
      toast.error(error.message || 'فشل في تحديث تاريخ انتهاء الإقامة')
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
    } catch (error: any) {
      console.error('Error bulk updating insurance:', error)
      toast.error(error.message || 'فشل في تحديث تاريخ انتهاء التأمين')
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
    } catch (error: any) {
      console.error('Error bulk updating contract:', error)
      toast.error(error.message || 'فشل في تحديث تاريخ انتهاء العقد')
    }
  }

  const filteredEmployees = employees.filter(emp => {
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
    const matchesContract = !contractFilter || getContractStatus(emp.contract_expiry) === contractFilter
    const matchesResidence = !residenceFilter || getResidenceStatus(emp.residence_expiry) === residenceFilter
    const matchesInsurance = !healthInsuranceFilter || getHealthInsuranceStatus(emp.health_insurance_expiry) === healthInsuranceFilter  // تحديث: insuranceFilter → healthInsuranceFilter, ending_subscription_insurance_date → health_insurance_expiry
    
    return matchesSearch && matchesResidenceNumber && matchesCompany && matchesNationality && matchesProfession && matchesProject && matchesContract && matchesResidence && matchesInsurance
  })

  const hasActiveFilters = searchTerm || residenceNumberSearch || companyFilter || nationalityFilter || professionFilter || projectFilter || contractFilter || residenceFilter || healthInsuranceFilter  // تحديث: insuranceFilter → healthInsuranceFilter

  // Calculate active filters count
  const activeFiltersCount = [
    searchTerm !== '',
    residenceNumberSearch !== '',
    companyFilter !== '',
    nationalityFilter !== '',
    professionFilter !== '',
    projectFilter !== '',
    contractFilter !== '',
    residenceFilter !== '',
    healthInsuranceFilter !== ''  // تحديث: insuranceFilter → healthInsuranceFilter
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
    let aValue: any
    let bValue: any

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
      case 'contract_expiry':
        aValue = a.contract_expiry ? new Date(a.contract_expiry).getTime() : 0
        bValue = b.contract_expiry ? new Date(b.contract_expiry).getTime() : 0
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
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            إضافة موظف
          </button>
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
                      { field: 'contract_expiry' as typeof sortField, label: 'تاريخ انتهاء العقد' },
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
                      <select
                        value={companyFilter}
                        onChange={(e) => setCompanyFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">جميع الشركات</option>
                        {companies.map(company => (
                          <option key={company} value={company}>{company}</option>
                        ))}
                      </select>
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
                        <option value="منتهية">عقود منتهية</option>
                        <option value="تنتهي خلال 30 يوم">عقود خلال 30 يوم</option>
                        <option value="ساري">عقود سارية</option>
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
                        <option value="منتهية">إقامات منتهية</option>
                        <option value="تنتهي خلال 7 أيام">إقامات خلال 7 أيام</option>
                        <option value="تنتهي خلال 15 يوم">إقامات خلال 15 يوم</option>
                        <option value="تنتهي خلال 30 يوم">إقامات خلال 30 يوم</option>
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
                        <option value="ينتهي خلال 30 يوم">ينتهي خلال 30 يوم</option>
                        <option value="ينتهي خلال 60 يوم">ينتهي خلال 60 يوم</option>
                        <option value="ينتهي خلال 90 يوم">ينتهي خلال 90 يوم</option>
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
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
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
                  {sortedAndFilteredEmployees.map((employee) => {
                    const contractDays = employee.contract_expiry ? getDaysRemaining(employee.contract_expiry) : null
                    const hiredWorkerContractDays = employee.hired_worker_contract_expiry ? getDaysRemaining(employee.hired_worker_contract_expiry) : null
                    const residenceDays = getDaysRemaining(employee.residence_expiry)
                    const healthInsuranceDays = employee.health_insurance_expiry ? getDaysRemaining(employee.health_insurance_expiry) : null

                    return (
                      <tr 
                        key={employee.id} 
                        className="hover:bg-gray-50 transition"
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
                          {employee.name}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {employee.profession}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {employee.nationality}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {employee.company?.name}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {employee.project_name ? (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                              {employee.project_name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs font-mono text-gray-900 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {employee.residence_number}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <HijriDateDisplay date={employee.birth_date}>
                            {formatDateShortWithHijri(employee.birth_date)}
                          </HijriDateDisplay>
                        </td>
                        <td 
                          className="px-3 py-2 text-xs text-gray-700 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <HijriDateDisplay date={employee.joining_date}>
                            {formatDateShortWithHijri(employee.joining_date)}
                          </HijriDateDisplay>
                        </td>
                        <td 
                          className="px-3 py-2 text-xs font-medium text-gray-900 cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          {employee.salary ? `${employee.salary.toLocaleString()} ريال` : <span className="text-gray-400">غير محدد</span>}
                        </td>
                        <td 
                          className="px-3 py-2 text-xs cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-700">
                              {employee.contract_expiry ? (
                                <HijriDateDisplay date={employee.contract_expiry}>
                                  {formatDateShortWithHijri(employee.contract_expiry)}
                                </HijriDateDisplay>
                              ) : '-'}
                            </span>
                            {employee.contract_expiry && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 w-fit ${getStatusColor(contractDays)}`}>
                                <Calendar className="w-2.5 h-2.5" />
                                {contractDays !== null && contractDays < 0 ? 'منتهي' : contractDays !== null ? `${contractDays} يوم` : '-'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td 
                          className="px-3 py-2 text-xs cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-700">
                              {employee.hired_worker_contract_expiry ? (
                                <HijriDateDisplay date={employee.hired_worker_contract_expiry}>
                                  {formatDateShortWithHijri(employee.hired_worker_contract_expiry)}
                                </HijriDateDisplay>
                              ) : '-'}
                            </span>
                            {employee.hired_worker_contract_expiry && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 w-fit ${getStatusColor(hiredWorkerContractDays)}`}>
                                <Calendar className="w-2.5 h-2.5" />
                                {hiredWorkerContractDays !== null && hiredWorkerContractDays < 0 ? 'منتهي' : hiredWorkerContractDays !== null ? `${hiredWorkerContractDays} يوم` : '-'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td 
                          className="px-3 py-2 text-xs cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-700">
                              <HijriDateDisplay date={employee.residence_expiry}>
                                {formatDateShortWithHijri(employee.residence_expiry)}
                              </HijriDateDisplay>
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 w-fit ${getStatusColor(residenceDays)}`}>
                              <Calendar className="w-2.5 h-2.5" />
                              {residenceDays < 0 ? 'منتهية' : `${residenceDays} يوم`}
                            </span>
                          </div>
                        </td>
                        <td 
                          className="px-3 py-2 text-xs cursor-pointer"
                          onClick={() => handleEmployeeClick(employee)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-700">
                              {healthInsuranceDays === null ? 'لا يوجد' : (
                                <HijriDateDisplay date={employee.health_insurance_expiry!}>
                                  {formatDateShortWithHijri(employee.health_insurance_expiry!)}
                                </HijriDateDisplay>
                              )}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 w-fit ${getStatusColor(healthInsuranceDays)}`}>
                              <Calendar className="w-2.5 h-2.5" />
                              {healthInsuranceDays === null 
                                ? 'لا يوجد' 
                                : healthInsuranceDays < 0 
                                  ? 'منتهي' 
                                  : `${healthInsuranceDays} يوم`}
                            </span>
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
  onCancel 
}: { 
  selectedCount: number
  selectedEmployees: (Employee & { company: Company })[]
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
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
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">الموظفون المحددون:</p>
            <ul className="space-y-1">
              {selectedEmployees.map(emp => (
                <li key={emp.id} className="text-sm text-gray-600">
                  • {emp.name} {emp.company?.name && `(${emp.company.name})`}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
            >
              نعم، احذف ({selectedCount})
            </button>
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition"
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
