import { useEffect, useState } from 'react'
import { supabase, Employee, Company } from '@/lib/supabase'
import { AlertCard, Alert } from '@/components/alerts/AlertCard'
import { EmployeeAlertCard, EmployeeAlert } from '@/components/alerts/EmployeeAlertCard'
import { generateCompanyAlertsSync, getAlertsStats, filterAlertsByPriority } from '@/utils/alerts'
import {
  generateEmployeeAlerts,
  enrichEmployeeAlertsWithCompanyData,
  getEmployeeAlertsStats,
  filterEmployeeAlertsByPriority,
} from '@/utils/employeeAlerts'
import { Bell, AlertTriangle, Building2, Users, X, CheckCircle2, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CompanyCard from '@/components/companies/CompanyCard'
import CompanyModal from '@/components/companies/CompanyModal'
import EmployeeCard from '@/components/employees/EmployeeCard'
import { usePermissions } from '@/utils/permissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { FilterBar } from '@/components/ui/FilterBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

interface AlertsProps {
  initialTab?: 'companies' | 'employees' | 'all'
  initialFilter?: 'all' | 'urgent' | 'high' | 'medium' | 'low'
}

export default function Alerts({ initialTab = 'all', initialFilter = 'all' }: AlertsProps) {
  const { canView } = usePermissions()
  // Reserved for future use: employees state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companyAlerts, setCompanyAlerts] = useState<Alert[]>([])
  const [employeeAlerts, setEmployeeAlerts] = useState<EmployeeAlert[]>([])
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'companies' | 'employees' | 'all'>(initialTab)

  // [NEW] تبويب لـ "جديد" و "مقروء"
  const [readFilterTab, setReadFilterTab] = useState<'new' | 'read'>('new')

  const [activeFilter, setActiveFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>(
    initialFilter
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [showCompanyCard, setShowCompanyCard] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEmployeeCard, setShowEmployeeCard] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<
    (Employee & { company: Company }) | null
  >(null)
  const navigate = useNavigate()
  // شبكة خاصة بكروت التنبيهات - أعرض من الكروت العادية لاستيعاب المحتوى
  const ALERT_GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3'
  const alertGridClass = ALERT_GRID_CLASS

  useEffect(() => {
    fetchData()
    loadReadAlerts()
  }, [])

  // التحقق من صلاحية العرض - بعد جميع الـ hooks
  if (!canView('alerts')) {
    return (
      <>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-danger-500" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">غير مصرح</h2>
            <p className="text-neutral-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </>
    )
  }

  // جلب التنبيهات المقروءة من قاعدة البيانات
  const loadReadAlerts = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('read_alerts')
        .select('alert_id')
        .eq('user_id', user.id)

      if (error) throw error

      const readAlertIds = new Set(data?.map((r) => r.alert_id) || [])
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
        .select(
          'id,company_id,name,profession,nationality,birth_date,phone,passport_number,residence_number,joining_date,contract_expiry,residence_expiry,project_name,bank_account,residence_image_url,salary,health_insurance_expiry,additional_fields,created_at,updated_at,notes,hired_worker_contract_expiry,project_id,is_deleted,deleted_at'
        )

      if (employeesError) throw employeesError

      // جلب المؤسسات
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(
          'id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_expiry,ending_subscription_power_date,ending_subscription_moqeem_date,ending_subscription_insurance_date,commercial_registration_status,social_insurance_status,current_employees,max_employees,additional_fields,created_at,updated_at,notes,exemptions,social_insurance_number,company_type,employee_count'
        )

      if (companiesError) throw companiesError

      setEmployees(employeesData || [])
      setCompanies(companiesData || [])

      if (employeesData && companiesData) {
        // توليد تنبيهات المؤسسات
        const companyAlertsGenerated = await generateCompanyAlertsSync(companiesData)
        setCompanyAlerts(companyAlertsGenerated)

        // توليد تنبيهات الموظفين
        const employeeAlertsGenerated = await generateEmployeeAlerts(employeesData, companiesData)
        const enrichedEmployeeAlerts = enrichEmployeeAlertsWithCompanyData(
          employeeAlertsGenerated,
          companiesData
        )
        setEmployeeAlerts(enrichedEmployeeAlerts)
      }
    } catch (error) {
      console.error('خطأ في جلب البيانات:', error)
    } finally {
      setLoading(false)
    }
  }

  // Reserved for future use: handleViewCompany function
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleViewCompany = (companyId: string) => {
    navigate(`/companies?id=${companyId}`)
  }

  const handleShowCompanyCard = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId)
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
        .select(
          'id,company_id,name,profession,nationality,birth_date,phone,passport_number,residence_number,joining_date,contract_expiry,residence_expiry,project_name,bank_account,residence_image_url,salary,health_insurance_expiry,additional_fields,created_at,updated_at,notes,hired_worker_contract_expiry,project_id,is_deleted,deleted_at'
        )
        .eq('id', employeeId)
        .single()

      if (employeeError) throw employeeError

      if (employeeData) {
        // جلب بيانات المؤسسة المرتبطة بالموظف
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select(
            'id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_expiry,ending_subscription_power_date,ending_subscription_moqeem_date,ending_subscription_insurance_date,commercial_registration_status,social_insurance_status,current_employees,max_employees,additional_fields,created_at,updated_at,notes,exemptions,social_insurance_number,company_type,employee_count'
          )
          .eq('id', employeeData.company_id)
          .single()

        if (companyError) throw companyError

        if (companyData) {
          // إعداد بيانات الموظف مع المؤسسة
          const employeeWithCompany = {
            ...employeeData,
            company: companyData,
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
        .select(
          'id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_expiry,ending_subscription_power_date,ending_subscription_moqeem_date,ending_subscription_insurance_date,commercial_registration_status,social_insurance_status,current_employees,max_employees,additional_fields,created_at,updated_at,notes,exemptions,social_insurance_number,company_type,employee_count'
        )
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        console.error('المستخدم غير مسجل دخول')
        return
      }

      // حفظ التنبيه كمقروء في قاعدة البيانات
      const { error } = await supabase.from('read_alerts').upsert(
        {
          user_id: user.id,
          alert_id: alertId,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,alert_id',
        }
      )

      if (error) throw error

      // تحديث حالة التنبيه محلياً
      setReadAlerts((prev) => new Set([...prev, alertId]))

      // [MODIFIED] أعدنا هذا السطر لتحديث شارة "التنبيهات"
      window.dispatchEvent(new CustomEvent('alertMarkedAsRead', { detail: { alertId } }))
    } catch (error) {
      console.error('خطأ في حفظ التنبيه كمقروء:', error)
    }
  }

  // [NEW] دالة لتمييز كل التنبيهات "الجديدة" كمقروءة
  const handleMarkAllAsRead = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        console.error('المستخدم غير مسجل دخول')
        return
      }

      // 1. جمع كل الـ IDs غير المقروءة
      const unreadCompanyAlertIds = companyAlerts
        .filter((alert) => !readAlerts.has(alert.id))
        .map((alert) => alert.id)

      const unreadEmployeeAlertIds = employeeAlerts
        .filter((alert) => !readAlerts.has(alert.id))
        .map((alert) => alert.id)

      const allUnreadIds = [...unreadCompanyAlertIds, ...unreadEmployeeAlertIds]

      if (allUnreadIds.length === 0) return

      // 2. تحضير السجلات للإرسال
      const recordsToUpsert = allUnreadIds.map((alertId) => ({
        user_id: user.id,
        alert_id: alertId,
        read_at: new Date().toISOString(),
      }))

      // 3. إرسالها إلى قاعدة البيانات
      const { error } = await supabase.from('read_alerts').upsert(recordsToUpsert, {
        onConflict: 'user_id,alert_id',
      })

      if (error) throw error

      // 4. تحديث الحالة المحلية
      setReadAlerts((prev) => new Set([...prev, ...allUnreadIds]))

      // 5. [MODIFIED] أعدنا هذا السطر لتحديث شارة "التنبيهات"
      window.dispatchEvent(new CustomEvent('alertMarkedAsRead'))
    } catch (error) {
      console.error('خطأ في حفظ جميع التنبيهات كمقروءة:', error)
    }
  }

  // دالة لإعادة تنبيه واحد إلى غير مقروء
  const handleMarkAsUnread = async (alertId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
      setReadAlerts((prev) => {
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        console.error('المستخدم غير مسجل دخول')
        return
      }

      // 1. جمع كل الـ IDs المقروءة
      const readCompanyAlertIds = companyAlerts
        .filter((alert) => readAlerts.has(alert.id))
        .map((alert) => alert.id)

      const readEmployeeAlertIds = employeeAlerts
        .filter((alert) => readAlerts.has(alert.id))
        .map((alert) => alert.id)

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
  const unreadCompanyAlerts = companyAlerts.filter(
    (alert) =>
      !readAlerts.has(alert.id) && (alert.priority === 'urgent' || alert.priority === 'high')
  )
  const unreadEmployeeAlerts = employeeAlerts.filter(
    (alert) =>
      !readAlerts.has(alert.id) && (alert.priority === 'urgent' || alert.priority === 'high')
  )

  const companyAlertsStats = getAlertsStats(unreadCompanyAlerts)
  const employeeAlertsStats = getEmployeeAlertsStats(unreadEmployeeAlerts)
  const totalAlerts = companyAlertsStats.total + employeeAlertsStats.total
  const totalUrgentAlerts = companyAlertsStats.urgent + employeeAlertsStats.urgent

  // [MODIFIED] فلترة التنبيهات بناءً على التبويب "جديد" أو "مقروء"
  const getFilteredCompanyAlerts = () => {
    // 1. ابدأ بجميع تنبيهات المؤسسات - فلترة لعرض urgent و high فقط
    let filtered = companyAlerts.filter(
      (alert) => alert.priority === 'urgent' || alert.priority === 'high'
    )

    // 2. فلتر الأولوية (إذا كان المستخدم يريد فلترة إضافية)
    if (activeFilter !== 'all') {
      filtered = filterAlertsByPriority(filtered, activeFilter)
    }

    // 3. فلتر البحث
    if (searchTerm) {
      filtered = filtered.filter(
        (alert) =>
          alert.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          alert.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 4. [NEW] فلتر المقروء/غير المقروء
    if (readFilterTab === 'new') {
      filtered = filtered.filter((alert) => !readAlerts.has(alert.id))
    } else {
      filtered = filtered.filter((alert) => readAlerts.has(alert.id))
    }

    return filtered
  }

  // [MODIFIED] فلترة التنبيهات بناءً على التبويب "جديد" أو "مقروء"
  const getFilteredEmployeeAlerts = () => {
    // 1. ابدأ بجميع تنبيهات الموظفين - فلترة لعرض urgent و high فقط
    let filtered = employeeAlerts.filter(
      (alert) => alert.priority === 'urgent' || alert.priority === 'high'
    )

    // 2. فلتر الأولوية (إذا كان المستخدم يريد فلترة إضافية)
    if (activeFilter !== 'all') {
      filtered = filterEmployeeAlertsByPriority(filtered, activeFilter)
    }

    // 3. فلتر البحث
    if (searchTerm) {
      filtered = filtered.filter(
        (alert) =>
          alert.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          alert.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          alert.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 4. [NEW] فلتر المقروء/غير المقروء
    if (readFilterTab === 'new') {
      filtered = filtered.filter((alert) => !readAlerts.has(alert.id))
    } else {
      filtered = filtered.filter((alert) => readAlerts.has(alert.id))
    }

    return filtered
  }

  const filteredCompanyAlerts = getFilteredCompanyAlerts()
  const filteredEmployeeAlerts = getFilteredEmployeeAlerts()

  // [NEW] حساب عدد المقروءة (لأجل تبويب "مقروء")
  const readCompanyAlertsCount = companyAlerts.filter((alert) => readAlerts.has(alert.id)).length
  const readEmployeeAlertsCount = employeeAlerts.filter((alert) => readAlerts.has(alert.id)).length
  const totalReadAlerts = readCompanyAlertsCount + readEmployeeAlertsCount

  if (loading) {
    return (
      <>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="app-page app-tech-grid">
        <PageHeader
          title="التنبيهات"
          description={`عرض ذكي للتنبيهات بحسب الأولوية وحالة القراءة. الحالي: ${totalAlerts} جديد و ${totalReadAlerts} مقروء.`}
          breadcrumbs={[{ label: 'الرئيسية', href: '/dashboard' }, { label: 'التنبيهات' }]}
          className="mb-6"
        />

        {/* إحصائيات سريعة (تبقى كما هي، تعرض غير المقروء فقط لهذه الصفحة) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
          <div className="app-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-tertiary mb-1">إجمالي التنبيهات</p>
                <p className="text-3xl font-bold text-foreground">{totalAlerts}</p>
              </div>
              <div className="app-icon-chip">
                <Bell className="w-7 h-7" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 mb-1">تنبيهات طارئة وعاجلة</p>
                <p className="text-3xl font-bold text-red-600">{totalUrgentAlerts}</p>
              </div>
              <div className="rounded-xl bg-red-100 p-3 text-red-600">
                <AlertTriangle className="w-7 h-7" />
              </div>
            </div>
          </div>

          <div className="app-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-tertiary mb-1">تنبيهات المؤسسات</p>
                <p className="text-3xl font-bold text-foreground">{companyAlertsStats.total}</p>
              </div>
              <div className="app-icon-chip">
                <Building2 className="w-7 h-7" />
              </div>
            </div>
          </div>

          <div className="app-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-tertiary mb-1">تنبيهات الموظفين</p>
                <p className="text-3xl font-bold text-foreground">{employeeAlertsStats.total}</p>
              </div>
              <div className="rounded-xl bg-surface-secondary p-3 text-foreground-secondary">
                <Users className="w-7 h-7" />
              </div>
            </div>
          </div>
        </div>

        {/* فلاتر البحث والتنقل */}
        <div className="app-panel mb-8 p-6">
          {/* تبويبات (المؤسسات / الموظفين) */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="app-toggle-shell w-fit">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'all' ? 'app-tab-button-active' : 'app-tab-button'
                }`}
              >
                الكل ({totalAlerts})
              </button>
              <button
                onClick={() => setActiveTab('companies')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'companies' ? 'app-tab-button-active' : 'app-tab-button'
                }`}
              >
                المؤسسات ({companyAlertsStats.total})
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'employees' ? 'app-tab-button-active' : 'app-tab-button'
                }`}
              >
                الموظفين ({employeeAlertsStats.total})
              </button>
            </div>

            {/* البحث والفلاتر */}
            <FilterBar>
              <SearchInput
                type="text"
                placeholder="البحث في التنبيهات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                wrapperClassName="min-w-[220px] flex-1"
              />

              <Select
                value={activeFilter}
                onValueChange={(value) =>
                  setActiveFilter(value as 'all' | 'urgent' | 'high' | 'medium' | 'low')
                }
              >
                <SelectTrigger className="min-w-[220px]">
                  <SelectValue placeholder="جميع الأولويات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأولويات (طارئ وعاجل)</SelectItem>
                  <SelectItem value="urgent">طارئ</SelectItem>
                  <SelectItem value="high">عاجل</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="low">طفيف</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>
          </div>

          {/* [NEW] تبويبات (جديد / مقروء) */}
          <div className="border-t border-neutral-200 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="app-toggle-shell w-full sm:w-auto">
                <button
                  onClick={() => setReadFilterTab('new')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors w-1/2 sm:w-auto ${
                    readFilterTab === 'new' ? 'app-toggle-button-active' : 'app-toggle-button'
                  }`}
                >
                  تنبيهات جديدة ({totalAlerts})
                </button>
                <button
                  onClick={() => setReadFilterTab('read')}
                  className={`px-6 py-2 rounded-md font-medium transition-colors w-1/2 sm:w-auto ${
                    readFilterTab === 'read' ? 'app-toggle-button-active' : 'app-toggle-button'
                  }`}
                >
                  مقروءة ({totalReadAlerts})
                </button>
              </div>

              {/* [NEW] زر تم الاطلاع على الكل */}
              {readFilterTab === 'new' && totalAlerts > 0 && (
                <Button onClick={handleMarkAllAsRead} variant="success">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>تم الاطلاع على الكل</span>
                </Button>
              )}

              {/* [NEW] زر إعادة الكل إلى غير مقروء */}
              {readFilterTab === 'read' && totalReadAlerts > 0 && (
                <Button onClick={handleMarkAllAsUnread} variant="secondary">
                  <Mail className="w-5 h-5" />
                  <span>إعادة الكل إلى غير مقروء</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* عرض التنبيهات (مقسّمة الآن) */}
        <div className="space-y-8">
          {/* تنبيهات المؤسسات */}
          {(activeTab === 'all' || activeTab === 'companies') &&
            filteredCompanyAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Building2 className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-neutral-900">تنبيهات المؤسسات</h2>
                  <span className="rounded-full bg-primary/15 px-2 py-1 text-sm font-medium text-foreground">
                    {filteredCompanyAlerts.length}
                  </span>
                </div>
                <div className={alertGridClass}>
                  {filteredCompanyAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
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
          {(activeTab === 'all' || activeTab === 'employees') &&
            filteredEmployeeAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Users className="w-6 h-6 text-foreground-secondary" />
                  <h2 className="text-xl font-bold text-neutral-900">تنبيهات الموظفين</h2>
                  <span className="rounded-full bg-surface-secondary px-2 py-1 text-sm font-medium text-foreground-secondary">
                    {filteredEmployeeAlerts.length}
                  </span>
                </div>
                <div className={alertGridClass}>
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
          {filteredCompanyAlerts.length === 0 && filteredEmployeeAlerts.length === 0 && (
            <div className="bg-surface rounded-xl shadow-sm border border-neutral-200 p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                {searchTerm
                  ? 'لا توجد نتائج'
                  : readFilterTab === 'new'
                    ? 'لا توجد تنبيهات جديدة'
                    : 'لا توجد تنبيهات مقروءة'}
              </h3>
              <p className="text-neutral-600">
                {searchTerm
                  ? `لم يتم العثور على تنبيهات تحتوي على "${searchTerm}"`
                  : readFilterTab === 'new'
                    ? 'جميع مؤسساتك وموظفيك محدثون ولا يحتاجون إلى إجراءات فورية'
                    : 'لم تقم بالاطلاع على أي تنبيهات بعد'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* كارت المؤسسة المنبثق (لا تغيير) */}
      {showCompanyCard && selectedCompany && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/55 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="app-modal-surface max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="app-modal-header flex items-center justify-between px-6 py-4">
              <h2 className="text-xl font-bold text-neutral-900">تفاصيل المؤسسة</h2>
              <Button onClick={() => setShowCompanyCard(false)} variant="ghost" size="icon">
                <X className="w-6 h-6 text-neutral-500" />
              </Button>
            </div>

            {/* Company Card */}
            <div className="p-6">
              <CompanyCard
                company={{
                  ...selectedCompany,
                  employee_count: 0,
                  available_slots: 0,
                  max_employees: selectedCompany.max_employees || 4,
                }}
                onEdit={handleEditCompany}
                onDelete={() => {}} // يمكن إضافة وظيفة حذف إذا لزم الأمر
                getAvailableSlotsColor={(slots) =>
                  slots > 0 ? 'text-success-600' : 'text-red-600'
                }
                getAvailableSlotsTextColor={(slots) =>
                  slots > 0 ? 'text-success-600' : 'text-red-600'
                }
                getAvailableSlotsText={(slots) => `متاح: ${slots} أماكن`}
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
    </>
  )
}
