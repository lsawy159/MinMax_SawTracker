import { useEffect, useState } from 'react'
import { supabase, Employee, Company } from '@/lib/supabase'
import { AlertCard, Alert } from '@/components/alerts/AlertCard'
import { EmployeeAlertCard, EmployeeAlert } from '@/components/alerts/EmployeeAlertCard'
import { 
  generateCompanyAlertsSync,
  getAlertsStats, 
  getUrgentAlerts, 
  filterAlertsByType,
  filterAlertsByPriority
} from '@/utils/alerts'
import { 
  generateEmployeeAlerts, 
  enrichEmployeeAlertsWithCompanyData,
  getEmployeeAlertsStats,
  getUrgentEmployeeAlerts,
  filterEmployeeAlertsByType,
  filterEmployeeAlertsByPriority
} from '@/utils/employeeAlerts'
import { Bell, Filter, Search, AlertTriangle, Building2, Users, Calendar, Clock, X, CheckCircle2, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import CompanyCard from '@/components/companies/CompanyCard'
import CompanyModal from '@/components/companies/CompanyModal'
import EmployeeCard from '@/components/employees/EmployeeCard'
import { usePermissions } from '@/utils/permissions'

interface AlertsProps {
  initialTab?: 'companies' | 'employees' | 'all'
  initialFilter?: 'all' | 'urgent' | 'high' | 'medium' | 'low'
}

export default function Alerts({ initialTab = 'all', initialFilter = 'all' }: AlertsProps) {
  const { canView } = usePermissions()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companyAlerts, setCompanyAlerts] = useState<Alert[]>([])
  const [employeeAlerts, setEmployeeAlerts] = useState<EmployeeAlert[]>([])
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'companies' | 'employees' | 'all'>(initialTab)
  
  // [NEW] تبويب لـ "جديد" و "مقروء"
  const [readFilterTab, setReadFilterTab] = useState<'new' | 'read'>('new')
  
  const [activeFilter, setActiveFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>(initialFilter)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCompanyCard, setShowCompanyCard] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEmployeeCard, setShowEmployeeCard] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { company: Company }) | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
    loadReadAlerts()
  }, [])

  // التحقق من صلاحية العرض - بعد جميع الـ hooks
  if (!canView('alerts')) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  // جلب التنبيهات المقروءة من قاعدة البيانات
  const loadReadAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('read_alerts')
        .select('alert_id')
        .eq('user_id', user.id)

      if (error) throw error

      const readAlertIds = new Set(data?.map(r => r.alert_id) || [])
      setReadAlerts(readAlertIds)
    } catch (error) {
      console.error('خطأ في جلب التنبيهات المقروءة:', error)
    }
  }

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
        const companyAlertsGenerated = await generateCompanyAlertsSync(companiesData)
        setCompanyAlerts(companyAlertsGenerated)
        
        // توليد تنبيهات الموظفين
        const employeeAlertsGenerated = await generateEmployeeAlerts(employeesData, companiesData)
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

  const handleViewEmployee = async (employeeId: string) => {
    try {
      // جلب بيانات الموظف من قاعدة البيانات
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single()

      if (employeeError) throw employeeError

      if (employeeData) {
        // جلب بيانات المؤسسة المرتبطة بالموظف
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', employeeData.company_id)
          .single()

        if (companyError) throw companyError

        if (companyData) {
          // إعداد بيانات الموظف مع المؤسسة
          const employeeWithCompany = {
            ...employeeData,
            company: companyData
          } as Employee & { company: Company }

          setSelectedEmployee(employeeWithCompany)
          setShowEmployeeCard(true)
        }
      }
    } catch (error) {
      console.error('خطأ في جلب بيانات الموظف:', error)
    }
  }

  const handleCloseEmployeeCard = () => {
    setShowEmployeeCard(false)
    setSelectedEmployee(null)
  }

  const handleUpdateEmployee = async () => {
    // إعادة جلب البيانات بعد التحديث
    await fetchData()
  }

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company)
    setShowEditModal(true)
    // إغلاق modal عرض المؤسسة عند فتح modal التعديل
    setShowCompanyCard(false)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setSelectedCompany(null)
  }

  const handleEditModalSuccess = async () => {
    // إعادة جلب البيانات بعد التعديل
    await fetchData()
    // إعادة جلب بيانات المؤسسة المحددة لتحديثها
    if (selectedCompany) {
      const { data: updatedCompany, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', selectedCompany.id)
        .single()
      
      if (!error && updatedCompany) {
        setSelectedCompany(updatedCompany)
        // إعادة فتح modal عرض المؤسسة مع البيانات المحدثة
        setShowCompanyCard(true)
      }
    }
    // إغلاق modal التعديل
    setShowEditModal(false)
    // إرسال event لتحديث إحصائيات التنبيهات
    window.dispatchEvent(new CustomEvent('companyUpdated'))
  }

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('المستخدم غير مسجل دخول')
        return
      }

      // حفظ التنبيه كمقروء في قاعدة البيانات
      const { error } = await supabase
        .from('read_alerts')
        .upsert({
          user_id: user.id,
          alert_id: alertId,
          read_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,alert_id'
        })

      if (error) throw error

      // تحديث حالة التنبيه محلياً
      setReadAlerts(prev => new Set([...prev, alertId]))
      
      // [MODIFIED] أعدنا هذا السطر لتحديث شارة "التنبيهات"
      window.dispatchEvent(new CustomEvent('alertMarkedAsRead', { detail: { alertId } }))
    } catch (error) {
      console.error('خطأ في حفظ التنبيه كمقروء:', error)
    }
  }

  // [NEW] دالة لتمييز كل التنبيهات "الجديدة" كمقروءة
  const handleMarkAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('المستخدم غير مسجل دخول')
        return
      }

      // 1. جمع كل الـ IDs غير المقروءة
      const unreadCompanyAlertIds = companyAlerts
        .filter(alert => !readAlerts.has(alert.id))
        .map(alert => alert.id)
      
      const unreadEmployeeAlertIds = employeeAlerts
        .filter(alert => !readAlerts.has(alert.id))
        .map(alert => alert.id)

      const allUnreadIds = [...unreadCompanyAlertIds, ...unreadEmployeeAlertIds]
      
      if (allUnreadIds.length === 0) return

      // 2. تحضير السجلات للإرسال
      const recordsToUpsert = allUnreadIds.map(alertId => ({
        user_id: user.id,
        alert_id: alertId,
        read_at: new Date().toISOString()
      }))

      // 3. إرسالها إلى قاعدة البيانات
      const { error } = await supabase
        .from('read_alerts')
        .upsert(recordsToUpsert, {
          onConflict: 'user_id,alert_id'
        })

      if (error) throw error

      // 4. تحديث الحالة المحلية
      setReadAlerts(prev => new Set([...prev, ...allUnreadIds]))

      // 5. [MODIFIED] أعدنا هذا السطر لتحديث شارة "التنبيهات"
      window.dispatchEvent(new CustomEvent('alertMarkedAsRead'))
    } catch (error) {
      console.error('خطأ في حفظ جميع التنبيهات كمقروءة:', error)
    }
  }

  // دالة لإعادة تنبيه واحد إلى غير مقروء
  const handleMarkAsUnread = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('المستخدم غير مسجل دخول')
        return
      }

      // حذف السجل من جدول read_alerts
      const { error } = await supabase
        .from('read_alerts')
        .delete()
        .eq('user_id', user.id)
        .eq('alert_id', alertId)

      if (error) throw error

      // تحديث حالة التنبيه محلياً
      setReadAlerts(prev => {
        const newSet = new Set(prev)
        newSet.delete(alertId)
        return newSet
      })
      
      // تحديث الإحصائيات
      window.dispatchEvent(new CustomEvent('alertMarkedAsRead'))
    } catch (error) {
      console.error('خطأ في إعادة التنبيه إلى غير مقروء:', error)
    }
  }

  // دالة لإعادة جميع التنبيهات المقروءة إلى غير مقروءة
  const handleMarkAllAsUnread = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('المستخدم غير مسجل دخول')
        return
      }

      // 1. جمع كل الـ IDs المقروءة
      const readCompanyAlertIds = companyAlerts
        .filter(alert => readAlerts.has(alert.id))
        .map(alert => alert.id)
      
      const readEmployeeAlertIds = employeeAlerts
        .filter(alert => readAlerts.has(alert.id))
        .map(alert => alert.id)

      const allReadIds = [...readCompanyAlertIds, ...readEmployeeAlertIds]
      
      if (allReadIds.length === 0) return

      // 2. حذف جميع السجلات المقروءة من قاعدة البيانات
      const { error } = await supabase
        .from('read_alerts')
        .delete()
        .eq('user_id', user.id)
        .in('alert_id', allReadIds)

      if (error) throw error

      // 3. تحديث الحالة المحلية
      setReadAlerts(new Set())

      // 4. تحديث الإحصائيات
      window.dispatchEvent(new CustomEvent('alertMarkedAsRead'))
    } catch (error) {
      console.error('خطأ في إعادة جميع التنبيهات إلى غير مقروءة:', error)
    }
  }


  // إحصائيات التنبيهات (فقط غير المقروءة و urgent/high) - هذه خاصة بالصفحة الداخلية
  const unreadCompanyAlerts = companyAlerts.filter(alert => 
    !readAlerts.has(alert.id) && (alert.priority === 'urgent' || alert.priority === 'high')
  )
  const unreadEmployeeAlerts = employeeAlerts.filter(alert => 
    !readAlerts.has(alert.id) && (alert.priority === 'urgent' || alert.priority === 'high')
  )

  const companyAlertsStats = getAlertsStats(unreadCompanyAlerts)
  const employeeAlertsStats = getEmployeeAlertsStats(unreadEmployeeAlerts)
  const totalAlerts = companyAlertsStats.total + employeeAlertsStats.total
  const totalUrgentAlerts = companyAlertsStats.urgent + employeeAlertsStats.urgent


  // [MODIFIED] فلترة التنبيهات بناءً على التبويب "جديد" أو "مقروء"
  const getFilteredCompanyAlerts = () => {
    // 1. ابدأ بجميع تنبيهات المؤسسات - فلترة لعرض urgent و high فقط
    let filtered = companyAlerts.filter(alert => 
      alert.priority === 'urgent' || alert.priority === 'high'
    )

    // 2. فلتر الأولوية (إذا كان المستخدم يريد فلترة إضافية)
    if (activeFilter !== 'all') {
      filtered = filterAlertsByPriority(filtered, activeFilter)
    }

    // 3. فلتر البحث
    if (searchTerm) {
      filtered = filtered.filter(alert => 
        alert.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 4. [NEW] فلتر المقروء/غير المقروء
    if (readFilterTab === 'new') {
      filtered = filtered.filter(alert => !readAlerts.has(alert.id))
    } else {
      filtered = filtered.filter(alert => readAlerts.has(alert.id))
    }

    return filtered
  }

  // [MODIFIED] فلترة التنبيهات بناءً على التبويب "جديد" أو "مقروء"
  const getFilteredEmployeeAlerts = () => {
    // 1. ابدأ بجميع تنبيهات الموظفين - فلترة لعرض urgent و high فقط
    let filtered = employeeAlerts.filter(alert => 
      alert.priority === 'urgent' || alert.priority === 'high'
    )

    // 2. فلتر الأولوية (إذا كان المستخدم يريد فلترة إضافية)
    if (activeFilter !== 'all') {
      filtered = filterEmployeeAlertsByPriority(filtered, activeFilter)
    }

    // 3. فلتر البحث
    if (searchTerm) {
      filtered = filtered.filter(alert => 
        alert.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 4. [NEW] فلتر المقروء/غير المقروء
    if (readFilterTab === 'new') {
      filtered = filtered.filter(alert => !readAlerts.has(alert.id))
    } else {
      filtered = filtered.filter(alert => readAlerts.has(alert.id))
    }

    return filtered
  }

  const filteredCompanyAlerts = getFilteredCompanyAlerts()
  const filteredEmployeeAlerts = getFilteredEmployeeAlerts()

  // [NEW] حساب عدد المقروءة (لأجل تبويب "مقروء")
  const readCompanyAlertsCount = companyAlerts.filter(alert => readAlerts.has(alert.id)).length
  const readEmployeeAlertsCount = employeeAlerts.filter(alert => readAlerts.has(alert.id)).length
  const totalReadAlerts = readCompanyAlertsCount + readEmployeeAlertsCount

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
        {/* إحصائيات سريعة (تبقى كما هي، تعرض غير المقروء فقط لهذه الصفحة) */}
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
                <p className="text-sm text-red-700 mb-1">تنبيهات طارئة وعاجلة</p>
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
          {/* تبويبات (المؤسسات / الموظفين) */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
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
                <option value="all">جميع الأولويات (طارئ وعاجل)</option>
                <option value="urgent">طارئ</option>
                <option value="high">عاجل</option>
                <option value="medium">متوسط</option>
                <option value="low">طفيف</option>
              </select>
            </div>
          </div>

          {/* [NEW] تبويبات (جديد / مقروء) */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex border border-gray-300 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => setReadFilterTab('new')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors w-1/2 sm:w-auto ${
                    readFilterTab === 'new' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  تنبيهات جديدة ({totalAlerts})
                </button>
                <button
                  onClick={() => setReadFilterTab('read')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors w-1/2 sm:w-auto ${
                    readFilterTab === 'read' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  مقروءة ({totalReadAlerts})
                </button>
              </div>

              {/* [NEW] زر تم الاطلاع على الكل */}
              {readFilterTab === 'new' && totalAlerts > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center justify-center gap-2 px-4 py-2 border border-transparent rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>تم الاطلاع على الكل</span>
                </button>
              )}
              
              {/* [NEW] زر إعادة الكل إلى غير مقروء */}
              {readFilterTab === 'read' && totalReadAlerts > 0 && (
                <button
                  onClick={handleMarkAllAsUnread}
                  className="flex items-center justify-center gap-2 px-4 py-2 border border-transparent rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                >
                  <Mail className="w-5 h-5" />
                  <span>إعادة الكل إلى غير مقروء</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* عرض التنبيهات (مقسّمة الآن) */}
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
                    onMarkAsUnread={handleMarkAsUnread}
                    isRead={readAlerts.has(alert.id)} // [MODIFIED] تمرير حالة القراءة للبطاقة
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
                    onMarkAsRead={handleMarkAsRead}
                    onMarkAsUnread={handleMarkAsUnread}
                    isRead={readAlerts.has(alert.id)} // [MODIFIED] تمرير حالة القراءة للبطاقة
                  />
                ))}
              </div>
            </div>
          )}

          {/* لا توجد نتائج */}
          {(filteredCompanyAlerts.length === 0 && filteredEmployeeAlerts.length === 0) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm 
                  ? 'لا توجد نتائج' 
                  : (readFilterTab === 'new' ? 'لا توجد تنبيهات جديدة' : 'لا توجد تنبيهات مقروءة')
                }
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? `لم يتم العثور على تنبيهات تحتوي على "${searchTerm}"`
                  : (readFilterTab === 'new' 
                      ? 'جميع مؤسساتك وموظفيك محدثون ولا يحتاجون إلى إجراءات فورية'
                      : 'لم تقم بالاطلاع على أي تنبيهات بعد'
                    )
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* كارت المؤسسة المنبثق (لا تغيير) */}
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
                onEdit={handleEditCompany}
                onDelete={() => {}} // يمكن إضافة وظيفة حذف إذا لزم الأمر
                getAvailableSlotsColor={(slots) => slots > 0 ? 'text-green-600' : 'text-red-600'}
                getAvailableSlotsTextColor={(slots) => slots > 0 ? 'text-green-600' : 'text-red-600'}
                getAvailableSlotsText={(slots, maxEmployees) => `متاح: ${slots} من ${maxEmployees}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* كارت الموظف المنبثق */}
      {showEmployeeCard && selectedEmployee && (
        <EmployeeCard
          employee={selectedEmployee}
          onClose={handleCloseEmployeeCard}
          onUpdate={handleUpdateEmployee}
        />
      )}

      {/* Modal تعديل المؤسسة */}
      {showEditModal && (
        <CompanyModal
          isOpen={showEditModal}
          company={selectedCompany}
          onClose={handleCloseEditModal}
          onSuccess={handleEditModalSuccess}
        />
      )}
      </Layout>
  )
}