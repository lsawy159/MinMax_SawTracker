import { useEffect, useState } from 'react'
import { supabase, Employee, Company } from '../lib/supabase'
import Layout from '../components/layout/Layout'
import EmployeeCard from '../components/employee/EmployeeCard'
import AddEmployeeModal from '../components/employees/AddEmployeeModal'
import { Search, Calendar, AlertCircle, X, UserPlus } from 'lucide-react'
import { differenceInDays, format } from 'date-fns'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export default function Employees() {
  const location = useLocation()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<(Employee & { company: Company })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [residenceNumberSearch, setResidenceNumberSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('')
  const [nationalityFilter, setNationalityFilter] = useState<string>('')
  const [professionFilter, setProfessionFilter] = useState<string>('')
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [contractFilter, setContractFilter] = useState<string>('')
  const [residenceFilter, setResidenceFilter] = useState<string>('')
  const [insuranceFilter, setInsuranceFilter] = useState<string>('')
  
  const [companies, setCompanies] = useState<string[]>([])
  const [nationalities, setNationalities] = useState<string[]>([])
  const [professions, setProfessions] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])
  
  // حالة المودال
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { company: Company }) | null>(null)
  const [isCardOpen, setIsCardOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // حالة التعديل السريع - تم إزالتها
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [employeeToDelete, setEmployeeToDelete] = useState<(Employee & { company: Company }) | null>(null)

  useEffect(() => {
    loadEmployees()
    handleUrlParams()
  }, [])

  const handleUrlParams = () => {
    const params = new URLSearchParams(location.search)
    const filter = params.get('filter')
    
    switch (filter) {
      case 'expired-contracts':
        setContractFilter('منتهية')
        break
      case 'expired-residences':
        setResidenceFilter('منتهية')
        break
      case 'expired-insurance':
        setInsuranceFilter('منتهي')
        break
      case 'urgent-contracts':
        setContractFilter('تنتهي خلال 30 يوم')
        break
      case 'urgent-residences':
        setResidenceFilter('تنتهي خلال 30 يوم')
        break
      case 'expiring-insurance-30':
        setInsuranceFilter('ينتهي خلال 30 يوم')
        break
      case 'expiring-insurance-60':
        setInsuranceFilter('ينتهي خلال 60 يوم')
        break
      case 'expiring-insurance-90':
        setInsuranceFilter('ينتهي خلال 90 يوم')
        break
      case 'active-insurance':
        setInsuranceFilter('ساري')
        break
    }
  }

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, company:companies(*)')
        .order('name')

      if (error) throw error
      
      const employeesData = data || []
      setEmployees(employeesData)
      
      // استخراج القوائم الفريدة للفلاتر
      const uniqueCompanies = [...new Set(employeesData.map(e => e.company?.name).filter(Boolean))] as string[]
      const uniqueNationalities = [...new Set(employeesData.map(e => e.nationality).filter(Boolean))] as string[]
      const uniqueProfessions = [...new Set(employeesData.map(e => e.profession).filter(Boolean))] as string[]
      const uniqueProjects = [...new Set(employeesData.map(e => e.project_name).filter(Boolean))] as string[]
      
      setCompanies(uniqueCompanies.sort())
      setNationalities(uniqueNationalities.sort())
      setProfessions(uniqueProfessions.sort())
      setProjects(uniqueProjects.sort())
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
    return 'سارية أكثر من 90 يوم'
  }

  const getResidenceStatus = (residenceExpiry: string) => {
    const days = getDaysRemaining(residenceExpiry)
    if (days < 0) return 'منتهية'
    if (days <= 7) return 'تنتهي خلال 7 أيام'
    if (days <= 15) return 'تنتهي خلال 15 يوم'
    if (days <= 30) return 'تنتهي خلال 30 يوم'
    if (days <= 90) return 'تنتهي خلال 90 يوم'
    return 'سارية أكثر من 90 يوم'
  }

  const getInsuranceStatus = (insuranceExpiry: string | null | undefined) => {
    if (!insuranceExpiry) return 'ساري'
    const days = getDaysRemaining(insuranceExpiry)
    if (days < 0) return 'منتهي'
    if (days <= 30) return 'ينتهي خلال 30 يوم'
    if (days <= 60) return 'ينتهي خلال 60 يوم'
    if (days <= 90) return 'ينتهي خلال 90 يوم'
    return 'ساري'
  }

  const getStatusColor = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-50'
    if (days <= 30) return 'text-orange-600 bg-orange-50'
    if (days <= 90) return 'text-yellow-600 bg-yellow-50'
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
    setInsuranceFilter('')
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
        .from('activity_logs')
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

      if (error) throw error

      // Log activity
      await logActivity(employeeToDelete.id, 'حذف موظف', {
        employee_name: employeeToDelete.name,
        company: employeeToDelete.company?.name
      })

      // Refresh employees list
      loadEmployees()
      setShowDeleteModal(false)
      setEmployeeToDelete(null)
      
      // Close card if open
      if (isCardOpen && selectedEmployee?.id === employeeToDelete.id) {
        setIsCardOpen(false)
        setSelectedEmployee(null)
      }
    } catch (error) {
      console.error('Error deleting employee:', error)
      toast.error('فشل في حذف الموظف')
    }
  }

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesResidenceNumber = !residenceNumberSearch || emp.residence_number.toString().toLowerCase().includes(residenceNumberSearch.toLowerCase())
    const matchesCompany = !companyFilter || emp.company?.name === companyFilter
    const matchesNationality = !nationalityFilter || emp.nationality === nationalityFilter
    const matchesProfession = !professionFilter || emp.profession === professionFilter
    const matchesProject = !projectFilter || emp.project_name === projectFilter
    const matchesContract = !contractFilter || getContractStatus(emp.contract_expiry) === contractFilter
    const matchesResidence = !residenceFilter || getResidenceStatus(emp.residence_expiry) === residenceFilter
    const matchesInsurance = !insuranceFilter || getInsuranceStatus(emp.ending_subscription_insurance_date) === insuranceFilter
    
    return matchesSearch && matchesResidenceNumber && matchesCompany && matchesNationality && matchesProfession && matchesProject && matchesContract && matchesResidence && matchesInsurance
  })

  const hasActiveFilters = searchTerm || residenceNumberSearch || companyFilter || nationalityFilter || professionFilter || projectFilter || contractFilter || residenceFilter || insuranceFilter

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">إدارة الموظفين</h1>
            <div className="text-sm text-gray-600 mt-1">
              عرض <span className="font-bold text-blue-600">{filteredEmployees.length}</span> من أصل <span className="font-bold">{employees.length}</span> موظف
            </div>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm font-medium"
          >
            <UserPlus className="w-5 h-5" />
            إضافة موظف
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* البحث بالاسم */}
            <div>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث بالاسم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* البحث برقم الإقامة */}
            <div>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="البحث برقم الإقامة..."
                  value={residenceNumberSearch}
                  onChange={(e) => setResidenceNumberSearch(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* فلتر الشركة */}
            <div>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع الشركات</option>
                {companies.map(company => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>

            {/* فلتر الجنسية */}
            <div>
              <select
                value={nationalityFilter}
                onChange={(e) => setNationalityFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع الجنسيات</option>
                {nationalities.map(nationality => (
                  <option key={nationality} value={nationality}>{nationality}</option>
                ))}
              </select>
            </div>

            {/* فلتر المهنة */}
            <div>
              <select
                value={professionFilter}
                onChange={(e) => setProfessionFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع المهن</option>
                {professions.map(profession => (
                  <option key={profession} value={profession}>{profession}</option>
                ))}
              </select>
            </div>

            {/* فلتر المشروع */}
            <div>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع المشاريع</option>
                {projects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>

            {/* فلتر العقود */}
            <div>
              <select
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع العقود</option>
                <option value="منتهية">عقود منتهية</option>
                <option value="تنتهي خلال 30 يوم">عقود خلال 30 يوم</option>
                <option value="سارية أكثر من 90 يوم">عقود سارية +90 يوم</option>
              </select>
            </div>

            {/* فلتر الإقامات */}
            <div>
              <select
                value={residenceFilter}
                onChange={(e) => setResidenceFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">جميع الإقامات</option>
                <option value="منتهية">إقامات منتهية</option>
                <option value="تنتهي خلال 7 أيام">إقامات خلال 7 أيام</option>
                <option value="تنتهي خلال 15 يوم">إقامات خلال 15 يوم</option>
                <option value="تنتهي خلال 30 يوم">إقامات خلال 30 يوم</option>
                <option value="سارية أكثر من 90 يوم">إقامات سارية +90 يوم</option>
              </select>
            </div>

            {/* فلتر التأمين */}
            <div>
              <select
                value={insuranceFilter}
                onChange={(e) => setInsuranceFilter(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
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

          {/* زر مسح الفلاتر */}
          {hasActiveFilters && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
                مسح جميع الفلاتر
              </button>
              <div className="flex gap-2 flex-wrap">
                {searchTerm && (
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                    البحث: {searchTerm}
                  </span>
                )}
                {residenceNumberSearch && (
                  <span className="px-3 py-1 bg-cyan-50 text-cyan-700 text-xs rounded-full">
                    رقم الإقامة: {residenceNumberSearch}
                  </span>
                )}
                {companyFilter && (
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                    الشركة: {companyFilter}
                  </span>
                )}
                {nationalityFilter && (
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                    الجنسية: {nationalityFilter}
                  </span>
                )}
                {professionFilter && (
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 text-xs rounded-full">
                    المهنة: {professionFilter}
                  </span>
                )}
                {projectFilter && (
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                    المشروع: {projectFilter}
                  </span>
                )}
                {contractFilter && (
                  <span className="px-3 py-1 bg-red-50 text-red-700 text-xs rounded-full">
                    العقد: {contractFilter}
                  </span>
                )}
                {residenceFilter && (
                  <span className="px-3 py-1 bg-rose-50 text-rose-700 text-xs rounded-full">
                    الإقامة: {residenceFilter}
                  </span>
                )}
                {insuranceFilter && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                    التأمين: {insuranceFilter}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الاسم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">المهنة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الجنسية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الشركة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">المشروع</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">رقم الإقامة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">تاريخ الميلاد</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">تاريخ الالتحاق</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">الراتب</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">انتهاء العقد</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">انتهاء الإقامة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">حالة التأمين</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => {
                    const contractDays = employee.contract_expiry ? getDaysRemaining(employee.contract_expiry) : null
                    const residenceDays = getDaysRemaining(employee.residence_expiry)
                    const insuranceDays = employee.ending_subscription_insurance_date ? getDaysRemaining(employee.ending_subscription_insurance_date) : null

                    return (
                      <tr 
                        key={employee.id} 
                        className="hover:bg-gray-50 transition cursor-pointer"
                        onClick={() => handleEmployeeClick(employee)}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {employee.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{employee.profession}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{employee.nationality}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{employee.company?.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {employee.project_name ? (
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                              {employee.project_name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{employee.residence_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{format(new Date(employee.birth_date), 'yyyy-MM-dd')}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{format(new Date(employee.joining_date), 'yyyy-MM-dd')}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {employee.salary ? `${employee.salary.toLocaleString()} ريال` : <span className="text-gray-400">غير محدد</span>}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-700">
                              {employee.contract_expiry ? format(new Date(employee.contract_expiry), 'yyyy-MM-dd') : '-'}
                            </span>
                            {employee.contract_expiry && (
                              <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 w-fit ${getStatusColor(contractDays!)}`}>
                                <Calendar className="w-3 h-3" />
                                {contractDays! < 0 ? 'منتهي' : `${contractDays} يوم`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-700">
                              {format(new Date(employee.residence_expiry), 'yyyy-MM-dd')}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 w-fit ${getStatusColor(residenceDays)}`}>
                              <Calendar className="w-3 h-3" />
                              {residenceDays < 0 ? 'منتهية' : `${residenceDays} يوم`}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-700">
                              {insuranceDays === null ? 'لا يوجد' : format(new Date(employee.ending_subscription_insurance_date!), 'yyyy-MM-dd')}
                            </span>
                            {insuranceDays !== null && (
                              <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 w-fit ${
                                insuranceDays < 0 ? 'text-red-600 bg-red-50' :
                                insuranceDays <= 30 ? 'text-yellow-600 bg-yellow-50' :
                                insuranceDays <= 60 ? 'text-orange-600 bg-orange-50' :
                                'text-green-600 bg-green-50'
                              }`}>
                                <Calendar className="w-3 h-3" />
                                {insuranceDays < 0 ? 'منتهي' : insuranceDays <= 30 ? `خلال ${insuranceDays} يوم` : 'ساري'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEmployeeClick(employee)
                              }}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition"
                              title="عرض التفاصيل وتعديل البيانات"
                            >
                              <UserPlus className="w-3 h-3" />
                              عرض
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteEmployee(employee)
                              }}
                              className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
                              title="حذف الموظف"
                            >
                              <X className="w-3 h-3" />
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
            {filteredEmployees.length === 0 && (
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
    </Layout>
  )
}
