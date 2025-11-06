import { useEffect, useState } from 'react'
import { supabase, Employee, Company } from '../lib/supabase'
import { AlertCard, Alert } from '../components/alerts/AlertCard'
import { EmployeeAlertCard, EmployeeAlert } from '../components/alerts/EmployeeAlertCard'
import { 
  generateCompanyAlertsSync,
  getAlertsStats, 
  getUrgentAlerts, 
  filterAlertsByType,
  filterAlertsByPriority
} from '../utils/alerts'
import { 
  generateEmployeeAlerts, 
  enrichEmployeeAlertsWithCompanyData,
  getEmployeeAlertsStats,
  getUrgentEmployeeAlerts,
  filterEmployeeAlertsByType,
  filterEmployeeAlertsByPriority
} from '../utils/employeeAlerts'
import { Bell, Filter, Search, AlertTriangle, Building2, Users, Calendar, Clock, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import CompanyCard from '../components/companies/CompanyCard'

interface AlertsPageProps {
  initialTab?: 'companies' | 'employees' | 'all'
  initialFilter?: 'all' | 'urgent' | 'medium' | 'low'
}

const AlertsPage = ({ initialTab = 'all', initialFilter = 'all' }: AlertsPageProps) => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companyAlerts, setCompanyAlerts] = useState<Alert[]>([])
  const [employeeAlerts, setEmployeeAlerts] = useState<EmployeeAlert[]>([])
  const [activeTab, setActiveTab] = useState<'companies' | 'employees' | 'all'>(initialTab)
  const [activeFilter, setActiveFilter] = useState<'all' | 'urgent' | 'medium' | 'low'>(initialFilter)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCompanyCard, setShowCompanyCard] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // جلب الموظفين
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')

      if (employeesError) throw employeesError

      // جلب المؤسسات
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')

      if (companiesError) throw companiesError

      setEmployees(employeesData || [])
      setCompanies(companiesData || [])

      if (employeesData && companiesData) {
        // توليد تنبيهات المؤسسات
        const companyAlertsGenerated = generateCompanyAlertsSync(companiesData)
        setCompanyAlerts(companyAlertsGenerated)
        
        // توليد تنبيهات الموظفين
        const employeeAlertsGenerated = generateEmployeeAlerts(employeesData, companiesData)
        const enrichedEmployeeAlerts = enrichEmployeeAlertsWithCompanyData(employeeAlertsGenerated, companiesData)
        setEmployeeAlerts(enrichedEmployeeAlerts)
      }
    } catch (error) {
      console.error('خطأ في جلب البيانات:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewCompany = (companyId: string) => {
    navigate(`/companies?id=${companyId}`)
  }

  const handleShowCompanyCard = (companyId: string) => {
    const company = companies.find(c => c.id === companyId)
    if (company) {
      setSelectedCompany(company)
      setShowCompanyCard(true)
    }
  }

  const handleViewEmployee = (employeeId: string) => {
    navigate(`/employees?id=${employeeId}`)
  }

  const handleRenewAction = (alertId: string) => {
    // يمكن تحديد المعالج المناسب حسب نوع التنبيه
    navigate('/companies?action=renew')
  }

  const handleMarkAsRead = (alertId: string) => {
    setCompanyAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert } : alert
      )
    )
    setEmployeeAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert } : alert
      )
    )
  }

  // فلترة التنبيهات
  const getFilteredCompanyAlerts = () => {
    let filtered = companyAlerts

    if (activeFilter !== 'all') {
      filtered = filterAlertsByPriority(filtered, activeFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(alert => 
        alert.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }

  const getFilteredEmployeeAlerts = () => {
    let filtered = employeeAlerts

    if (activeFilter !== 'all') {
      filtered = filterEmployeeAlertsByPriority(filtered, activeFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(alert => 
        alert.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }

  // إحصائيات التنبيهات
  const companyAlertsStats = getAlertsStats(companyAlerts)
  const employeeAlertsStats = getEmployeeAlertsStats(employeeAlerts)
  const totalAlerts = companyAlertsStats.total + employeeAlertsStats.total
  const totalUrgentAlerts = companyAlertsStats.urgent + employeeAlertsStats.urgent

  const filteredCompanyAlerts = getFilteredCompanyAlerts()
  const filteredEmployeeAlerts = getFilteredEmployeeAlerts()

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">إدارة التنبيهات</h1>
          <p className="text-gray-600">
            عرض وإدارة جميع تنبيهات انتهاء الصلاحية للمؤسسات والموظفين
          </p>
        </div>

        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي التنبيهات</p>
                <p className="text-3xl font-bold text-gray-900">{totalAlerts}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Bell className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 mb-1">تنبيهات عاجلة</p>
                <p className="text-3xl font-bold text-red-600">{totalUrgentAlerts}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">تنبيهات المؤسسات</p>
                <p className="text-3xl font-bold text-blue-600">{companyAlertsStats.total}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">تنبيهات الموظفين</p>
                <p className="text-3xl font-bold text-purple-600">{employeeAlertsStats.total}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* فلاتر البحث والتنقل */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* تبويبات */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'all' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                الكل ({totalAlerts})
              </button>
              <button
                onClick={() => setActiveTab('companies')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'companies' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                المؤسسات ({companyAlertsStats.total})
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'employees' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                الموظفين ({employeeAlertsStats.total})
              </button>
            </div>

            {/* البحث والفلاتر */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* البحث */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="البحث في التنبيهات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* فلتر الأولوية */}
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">جميع الأولويات</option>
                <option value="urgent">عاجل</option>
                <option value="medium">متوسط</option>
                <option value="low">طفيف</option>
              </select>
            </div>
          </div>
        </div>

        {/* عرض التنبيهات */}
        <div className="space-y-8">
          {/* تنبيهات المؤسسات */}
          {(activeTab === 'all' || activeTab === 'companies') && filteredCompanyAlerts.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">تنبيهات المؤسسات</h2>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                  {filteredCompanyAlerts.length}
                </span>
              </div>
              <div className="space-y-4">
                {filteredCompanyAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onViewCompany={handleViewCompany}
                    onShowCompanyCard={handleShowCompanyCard}
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))}
              </div>
            </div>
          )}

          {/* تنبيهات الموظفين */}
          {(activeTab === 'all' || activeTab === 'employees') && filteredEmployeeAlerts.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-900">تنبيهات الموظفين</h2>
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm font-medium">
                  {filteredEmployeeAlerts.length}
                </span>
              </div>
              <div className="space-y-4">
                {filteredEmployeeAlerts.map((alert) => (
                  <EmployeeAlertCard
                    key={alert.id}
                    alert={alert}
                    onViewEmployee={handleViewEmployee}
                    onViewCompany={handleViewCompany}
                    onRenewAction={handleRenewAction}
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))}
              </div>
            </div>
          )}

          {/* لا توجد نتائج */}
          {((activeTab === 'all' && totalAlerts === 0) ||
            (activeTab === 'companies' && filteredCompanyAlerts.length === 0) ||
            (activeTab === 'employees' && filteredEmployeeAlerts.length === 0)) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'لا توجد نتائج' : 'لا توجد تنبيهات'}
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? `لم يتم العثور على تنبيهات تحتوي على "${searchTerm}"`
                  : 'جميع مؤسساتك وموظفيك محدثون ولا يحتاجون إلى إجراءات فورية'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* كارت المؤسسة المنبثق */}
      {showCompanyCard && selectedCompany && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">تفاصيل المؤسسة</h2>
              <button
                onClick={() => setShowCompanyCard(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            
            {/* Company Card */}
            <div className="p-6">
              <CompanyCard
                company={{
                  ...selectedCompany,
                  employee_count: 0,
                  available_slots: 0,
                  max_employees: selectedCompany.max_employees || 4
                }}
                onEdit={() => navigate(`/companies?id=${selectedCompany.id}&action=edit`)}
                onDelete={() => {}} // يمكن إضافة وظيفة حذف إذا لزم الأمر
                getAvailableSlotsColor={(slots) => slots > 0 ? 'text-green-600' : 'text-red-600'}
                getAvailableSlotsTextColor={(slots) => slots > 0 ? 'text-green-600' : 'text-red-600'}
                getAvailableSlotsText={(slots, maxEmployees) => `متاح: ${slots} من ${maxEmployees}`}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default AlertsPage