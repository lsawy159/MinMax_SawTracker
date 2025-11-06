import { useEffect, useState } from 'react'
import { supabase, Employee, Company } from '../lib/supabase'
import { Users, Building2, AlertTriangle, Calendar, XCircle, Clock, ArrowRight, MapPin, Bell } from 'lucide-react'
import Layout from '../components/layout/Layout'
import { differenceInDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { AlertCard, Alert } from '../components/alerts/AlertCard'
import { 
  calculateCommercialRegistrationStatus, 
  calculateInsuranceSubscriptionStatus,
  calculateCompanyStatusStats
} from '../utils/autoCompanyStatus'
import { 
  generateCompanyAlertsSync,
  getAlertsStats, 
  getUrgentAlerts, 
  filterAlertsByType,
  type Company as CompanyAlertType
} from '../utils/alerts'
import { 
  generateEmployeeAlerts, 
  enrichEmployeeAlertsWithCompanyData,
  getEmployeeAlertsStats,
  getUrgentEmployeeAlerts,
  filterEmployeeAlertsByType,
  type EmployeeAlert
} from '../utils/employeeAlerts'

interface Stats {
  totalEmployees: number
  totalCompanies: number
  fullCompanies: number
  companiesWithFewSlots: number
  totalAvailableSlots: number
  totalContractSlots: number
  avgEmployeesPerCompany: number
  utilizationRate: number
  activeInsurance: number
  expiredInsurance: number
  expiringInsurance30: number
  expiringInsurance60: number
  expiringInsurance90: number
  expiredContracts: number
  urgentContracts: number
  expiringContracts: number
  expiredResidences: number
  urgentResidences: number
  expiringResidences: number
  // إحصائيات المؤسسات الجديدة
  commercialRegValid: number
  commercialRegCritical: number
  commercialRegMedium: number
  insuranceValid: number
  insuranceCritical: number
  insuranceMedium: number
}

const Dashboard = () => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companyAlerts, setCompanyAlerts] = useState<Alert[]>([])
  const [employeeAlerts, setEmployeeAlerts] = useState<EmployeeAlert[]>([])
  const [showAlerts, setShowAlerts] = useState(false)
  const navigate = useNavigate()

  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    totalCompanies: 0,
    fullCompanies: 0,
    companiesWithFewSlots: 0,
    totalAvailableSlots: 0,
    totalContractSlots: 0,
    avgEmployeesPerCompany: 0,
    utilizationRate: 0,
    activeInsurance: 0,
    expiredInsurance: 0,
    expiringInsurance30: 0,
    expiringInsurance60: 0,
    expiringInsurance90: 0,
    expiredContracts: 0,
    urgentContracts: 0,
    expiringContracts: 0,
    expiredResidences: 0,
    urgentResidences: 0,
    expiringResidences: 0,
    // إحصائيات المؤسسات الجديدة
    commercialRegValid: 0,
    commercialRegCritical: 0,
    commercialRegMedium: 0,
    insuranceValid: 0,
    insuranceCritical: 0,
    insuranceMedium: 0
  })

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
        const calculatedStats = calculateStats(employeesData, companiesData)
        setStats(calculatedStats)
        
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

  const calculateStats = (employees: Employee[], companies: Company[]) => {
    const today = new Date()
    
    // حساب إحصائيات الموظفين
    const totalEmployees = employees.length
    
    // حساب إحصائيات المؤسسات
    const totalCompanies = companies.length
    let fullCompanies = 0
    let companiesWithFewSlots = 0
    let totalAvailableSlots = 0
    let totalContractSlots = 0
    
    companies.forEach(company => {
      const employeesInCompany = employees.filter(emp => emp.company_id === company.id).length
      const maxEmployees = company.max_employees || 4
      const availableSlots = Math.max(0, maxEmployees - employeesInCompany)
      const contractSlots = company.max_employees || 4
      
      totalAvailableSlots += availableSlots
      totalContractSlots += contractSlots
      
      if (availableSlots === 0) {
        fullCompanies++
      }
      
      if (availableSlots <= 2) {
        companiesWithFewSlots++
      }
    })
    
    const avgEmployeesPerCompany = totalCompanies > 0 ? Math.round(totalEmployees / totalCompanies) : 0
    const utilizationRate = totalContractSlots > 0 ? Math.round(((totalContractSlots - totalAvailableSlots) / totalContractSlots) * 100) : 0
    
    // حساب إحصائيات العقود
    const expiredContracts = employees.filter(emp => {
      if (!emp.contract_expiry) return false
      const diff = differenceInDays(new Date(emp.contract_expiry), today)
      return diff < 0
    }).length

    // عقود عاجلة (30 يوم أو أقل، لكن ليست منتهية)
    const urgentContracts = employees.filter(emp => {
      if (!emp.contract_expiry) return false
      const diff = differenceInDays(new Date(emp.contract_expiry), today)
      return diff >= 0 && diff <= 30
    }).length

    // عقود منتهية قريباً (90 يوم أو أقل)
    const expiringContracts = employees.filter(emp => {
      if (!emp.contract_expiry) return false
      const diff = differenceInDays(new Date(emp.contract_expiry), today)
      return diff >= 0 && diff <= 90
    }).length

    // إقامات منتهية (أقل من 0)
    const expiredResidences = employees.filter(emp => {
      if (!emp.residence_expiry) return false
      const diff = differenceInDays(new Date(emp.residence_expiry), today)
      return diff < 0
    }).length

    // إقامات عاجلة (30 يوم أو أقل، لكن ليست منتهية)
    const urgentResidences = employees.filter(emp => {
      if (!emp.residence_expiry) return false
      const diff = differenceInDays(new Date(emp.residence_expiry), today)
      return diff >= 0 && diff <= 30
    }).length

    // إقامات منتهية قريباً (90 يوم أو أقل)
    const expiringResidences = employees.filter(emp => {
      if (!emp.residence_expiry) return false
      const diff = differenceInDays(new Date(emp.residence_expiry), today)
      return diff >= 0 && diff <= 90
    }).length

    // حساب إحصائيات التأمين
    const activeInsurance = employees.filter(emp => {
      if (!emp.ending_subscription_insurance_date) return true
      const diff = differenceInDays(new Date(emp.ending_subscription_insurance_date), today)
      return diff >= 0
    }).length

    // تأمين منتهي (أقل من 0)
    const expiredInsurance = employees.filter(emp => {
      if (!emp.ending_subscription_insurance_date) return false
      const diff = differenceInDays(new Date(emp.ending_subscription_insurance_date), today)
      return diff < 0
    }).length

    // تأمين ينتهي خلال 30 يوم (لكن ليس منتهي)
    const expiringInsurance30 = employees.filter(emp => {
      if (!emp.ending_subscription_insurance_date) return false
      const diff = differenceInDays(new Date(emp.ending_subscription_insurance_date), today)
      return diff >= 0 && diff <= 30
    }).length

    // تأمين ينتهي خلال 60 يوم
    const expiringInsurance60 = employees.filter(emp => {
      if (!emp.ending_subscription_insurance_date) return false
      const diff = differenceInDays(new Date(emp.ending_subscription_insurance_date), today)
      return diff >= 0 && diff <= 60
    }).length

    // تأمين ينتهي خلال 90 يوم
    const expiringInsurance90 = employees.filter(emp => {
      if (!emp.ending_subscription_insurance_date) return false
      const diff = differenceInDays(new Date(emp.ending_subscription_insurance_date), today)
      return diff >= 0 && diff <= 90
    }).length

    // حساب إحصائيات المؤسسات مع النظام الجديد
    const companyStatusStats = calculateCompanyStatusStats(companies.map(c => ({
      id: c.id,
      name: c.name,
      commercial_registration_expiry: c.commercial_registration_expiry,
      insurance_subscription_expiry: c.insurance_subscription_expiry
    })))

    return {
      totalEmployees,
      totalCompanies,
      fullCompanies,
      companiesWithFewSlots,
      totalAvailableSlots,
      totalContractSlots,
      avgEmployeesPerCompany,
      utilizationRate,
      activeInsurance,
      expiredInsurance,
      expiringInsurance30,
      expiringInsurance60,
      expiringInsurance90,
      expiredContracts,
      urgentContracts,
      expiringContracts,
      expiredResidences,
      urgentResidences,
      expiringResidences,
      // إحصائيات المؤسسات الجديدة
      commercialRegValid: companyStatusStats.commercialRegStats.valid,
      commercialRegCritical: companyStatusStats.commercialRegStats.critical + companyStatusStats.commercialRegStats.expired,
      commercialRegMedium: companyStatusStats.commercialRegStats.medium,
      insuranceValid: companyStatusStats.insuranceStats.valid,
      insuranceCritical: companyStatusStats.insuranceStats.critical + companyStatusStats.insuranceStats.expired,
      insuranceMedium: companyStatusStats.insuranceStats.medium
    }
  }

  // دوال التنبيهات
  const handleViewCompany = (companyId: string) => {
    navigate(`/companies?id=${companyId}`)
  }

  const handleRenewAction = (alertId: string) => {
    // العثور على التنبيه للحصول على معرف المؤسسة
    const alert = companyAlerts.find(a => a.id === alertId)
    if (alert) {
      navigate(`/companies?id=${alert.company.id}&action=renew`)
    }
  }

  const handleMarkAsRead = (alertId: string) => {
    // تحديث حالة التنبيه كمقروء (يمكن حفظه في قاعدة البيانات لاحقاً)
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

  // إحصائيات التنبيهات
  const companyAlertsStats = getAlertsStats(companyAlerts)
  const companyUrgentAlerts = getUrgentAlerts(companyAlerts)
  const commercialRegAlerts = filterAlertsByType(companyAlerts, 'commercial_registration')
  const insuranceAlerts = filterAlertsByType(companyAlerts, 'insurance_subscription')
  
  // إحصائيات مفصلة للمؤسسات
  const commercialRegExpired = commercialRegAlerts.filter(a => a.days_remaining !== undefined && a.days_remaining < 0).length
  const commercialRegUrgent = commercialRegAlerts.filter(a => a.priority === 'urgent').length
  const insuranceExpired = insuranceAlerts.filter(a => a.days_remaining !== undefined && a.days_remaining < 0).length
  const insuranceUrgent = insuranceAlerts.filter(a => a.priority === 'urgent').length

  // إحصائيات تنبيهات الموظفين
  const employeeAlertsStats = getEmployeeAlertsStats(employeeAlerts)
  const employeeUrgentAlerts = getUrgentEmployeeAlerts(employeeAlerts)
  const contractAlerts = filterEmployeeAlertsByType(employeeAlerts, 'contract_expiry')
  const residenceAlerts = filterEmployeeAlertsByType(employeeAlerts, 'residence_expiry')

  // إجمالي التنبيهات
  const totalAlerts = companyAlertsStats.total + employeeAlertsStats.total
  const totalUrgentAlerts = companyAlertsStats.urgent + employeeAlertsStats.urgent

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">لوحة القيادة</h1>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">إجمالي الموظفين</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalEmployees}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">إجمالي المؤسسات</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalCompanies}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Building2 className="w-8 h-8 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">الأماكن الشاغرة</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.totalAvailableSlots}</p>
                    <p className="text-xs text-gray-500">مكان متاح للإضافة</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <MapPin className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition" onClick={() => navigate('/companies')}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">مؤسسات مكتملة</p>
                    <p className="text-3xl font-bold text-red-600">{stats.fullCompanies}</p>
                    <p className="text-xs text-gray-500">لا يمكن إضافة موظفين</p>
                  </div>
                  <div className="bg-red-100 p-3 rounded-lg">
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-red-600 text-xs">
                  <span>عرض المؤسسات</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">إحصائيات التأمين</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <span className="text-gray-700">تأمين ساري</span>
                    <span className="text-xl font-bold text-green-600">{stats.activeInsurance}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                    <span className="text-gray-700">تأمين منتهي</span>
                    <span className="text-xl font-bold text-red-600">{stats.expiredInsurance}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                    <span className="text-gray-700">ينتهي خلال 30 يوم</span>
                    <span className="text-xl font-bold text-yellow-600">{stats.expiringInsurance30}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">إحصائيات العقود</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                    <span className="text-gray-700">عقود منتهية</span>
                    <span className="text-xl font-bold text-red-600">{stats.expiredContracts}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                    <span className="text-gray-700">عقود عاجلة</span>
                    <span className="text-xl font-bold text-yellow-600">{stats.urgentContracts}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                    <span className="text-gray-700">ينتهي خلال 90 يوم</span>
                    <span className="text-xl font-bold text-orange-600">{stats.expiringContracts}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">إحصائيات الإقامات</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                    <span className="text-gray-700">إقامات منتهية</span>
                    <span className="text-xl font-bold text-red-600">{stats.expiredResidences}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                    <span className="text-gray-700">إقامات عاجلة</span>
                    <span className="text-xl font-bold text-yellow-600">{stats.urgentResidences}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                    <span className="text-gray-700">ينتهي خلال 90 يوم</span>
                    <span className="text-xl font-bold text-orange-600">{stats.expiringResidences}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* إحصائيات مفصلة للمؤسسات المنتهية ومنتهية قريباً */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-600" />
                إحصائيات مؤسسات منتهية ومنتهية قريباً
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-red-800">سجل تجاري منتهي</h3>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-600">{commercialRegExpired}</div>
                  <p className="text-xs text-red-700 mt-1">يحتاج تجديد فوري</p>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-orange-800">سجل تجاري عاجل</h3>
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{commercialRegUrgent}</div>
                  <p className="text-xs text-orange-700 mt-1">ينتهي خلال 30 يوم</p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-purple-800">تأمين منتهي</h3>
                    <AlertTriangle className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-2xl font-bold text-purple-600">{insuranceExpired}</div>
                  <p className="text-xs text-purple-700 mt-1">يحتاج تجديد فوري</p>
                </div>

                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-indigo-800">تأمين عاجل</h3>
                    <Clock className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-bold text-indigo-600">{insuranceUrgent}</div>
                  <p className="text-xs text-indigo-700 mt-1">ينتهي خلال 30 يوم</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">نظرة عامة</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">متوسط الموظفين لكل مؤسسة</span>
                  <span className="text-xl font-bold text-blue-600">
                    {stats.totalCompanies > 0 ? Math.round(stats.totalEmployees / stats.totalCompanies) : 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <span className="text-gray-700">إجمالي الأماكن الشاغرة</span>
                  <span className="text-xl font-bold text-blue-600">
                    {stats.totalAvailableSlots} مكان
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">معدل الاستفادة من المؤسسات</span>
                  <span className="text-xl font-bold text-green-600">{stats.utilizationRate}%</span>
                </div>
              </div>
            </div>

            {/* قسم التنبيهات */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <Bell className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">تنبيهات النظام</h2>
                    <p className="text-gray-600 mt-1">
                      {totalAlerts > 0 ? `${totalAlerts} تنبيه - ${totalUrgentAlerts} عاجل` : 'لا توجد تنبيهات حالياً'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {companyAlertsStats.total} مؤسسة | {employeeAlertsStats.total} موظف
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {showAlerts ? 'إخفاء التنبيهات' : 'عرض التنبيهات'}
                </button>
              </div>

              {/* إحصائيات التنبيهات */}
              {totalAlerts > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-gray-900">{totalAlerts}</div>
                    <div className="text-sm text-gray-600">إجمالي التنبيهات</div>
                  </div>
                  <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-4">
                    <div className="text-2xl font-bold text-red-600">{totalUrgentAlerts}</div>
                    <div className="text-sm text-red-700">عاجل</div>
                  </div>
                  <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-4">
                    <div className="text-2xl font-bold text-yellow-600">{companyAlertsStats.medium + employeeAlertsStats.medium}</div>
                    <div className="text-sm text-yellow-700">متوسط</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
                    <div className="text-2xl font-bold text-blue-600">{companyAlertsStats.total}</div>
                    <div className="text-sm text-blue-700">مؤسسات</div>
                  </div>
                  <div className="bg-purple-50 rounded-xl shadow-sm border border-purple-200 p-4">
                    <div className="text-2xl font-bold text-purple-600">{employeeAlertsStats.total}</div>
                    <div className="text-sm text-purple-700">موظفين</div>
                  </div>
                  <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4">
                    <div className="text-2xl font-bold text-green-600">{commercialRegAlerts.length}</div>
                    <div className="text-sm text-green-700">سجل تجاري</div>
                  </div>
                </div>
              )}

              {/* عرض التنبيهات */}
              {showAlerts && (
                <div className="space-y-6">
                  {totalAlerts === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                      <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد تنبيهات</h3>
                      <p className="text-gray-600">
                        جميع مؤسساتك وموظفيك محدثون ولا يحتاجون إلى إجراءات فورية
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* التنبيهات العاجلة للمؤسسات */}
                      {companyUrgentAlerts.length > 0 && (
                        <div>
                          <h3 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            تنبيهات عاجلة للمؤسسات ({companyUrgentAlerts.length})
                          </h3>
                          <div className="space-y-3">
                            {companyUrgentAlerts.slice(0, 2).map((alert) => (
                              <AlertCard
                                key={alert.id}
                                alert={alert}
                                onViewCompany={handleViewCompany}
                                onShowCompanyCard={handleViewCompany}
                                onMarkAsRead={handleMarkAsRead}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* التنبيهات العاجلة للموظفين */}
                      {employeeUrgentAlerts.length > 0 && (
                        <div>
                          <h3 className="text-lg font-bold text-orange-900 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            تنبيهات عاجلة للموظفين ({employeeUrgentAlerts.length})
                          </h3>
                          <div className="space-y-3">
                            {employeeUrgentAlerts.slice(0, 2).map((alert) => (
                              <div key={alert.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                {/* سيتم استبدال هذا بـ EmployeeAlertCard لاحقاً */}
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                                    <AlertTriangle className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-orange-900">{alert.title}</h4>
                                    <p className="text-sm text-gray-600">{alert.employee.name} - {alert.employee.profession}</p>
                                    <p className="text-sm text-gray-500">{alert.company.name}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ملخص التنبيهات حسب النوع */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {commercialRegAlerts.length > 0 && (
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <Building2 className="w-5 h-5 text-blue-600" />
                              <h4 className="font-semibold text-gray-900">السجل التجاري</h4>
                            </div>
                            <p className="text-sm text-gray-600">
                              {commercialRegAlerts.length} مؤسسة تحتاج إلى تجديد السجل التجاري
                            </p>
                          </div>
                        )}

                        {insuranceAlerts.length > 0 && (
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <AlertTriangle className="w-5 h-5 text-green-600" />
                              <h4 className="font-semibold text-gray-900">اشتراك التأمين</h4>
                            </div>
                            <p className="text-sm text-gray-600">
                              {insuranceAlerts.length} مؤسسة تحتاج إلى تجديد اشتراك التأمين
                            </p>
                          </div>
                        )}

                        {contractAlerts.length > 0 && (
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <AlertTriangle className="w-5 h-5 text-purple-600" />
                              <h4 className="font-semibold text-gray-900">عقود الموظفين</h4>
                            </div>
                            <p className="text-sm text-gray-600">
                              {contractAlerts.length} موظف يحتاج إلى تجديد العقد
                            </p>
                          </div>
                        )}

                        {residenceAlerts.length > 0 && (
                          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                              <h4 className="font-semibold text-gray-900">إقامات الموظفين</h4>
                            </div>
                            <p className="text-sm text-gray-600">
                              {residenceAlerts.length} موظف يحتاج إلى تجديد الإقامة
                            </p>
                          </div>
                        )}
                      </div>

                      {/* أزرار عرض المزيد */}
                      {(companyAlerts.length > companyUrgentAlerts.length || employeeAlerts.length > employeeUrgentAlerts.length) && (
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {companyAlerts.length > companyUrgentAlerts.length && (
                            <button
                              onClick={() => navigate('/companies?tab=alerts')}
                              className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1 p-3 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                            >
                              عرض جميع تنبيهات المؤسسات ({companyAlertsStats.total})
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}

                          {employeeAlerts.length > employeeUrgentAlerts.length && (
                            <button
                              onClick={() => navigate('/employees?tab=alerts')}
                              className="text-purple-600 hover:text-purple-800 font-medium flex items-center justify-center gap-1 p-3 border border-purple-200 rounded-lg hover:bg-purple-50 transition"
                            >
                              عرض جميع تنبيهات الموظفين ({employeeAlertsStats.total})
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div 
                className="bg-red-50 border-r-4 border-red-600 p-4 rounded-lg cursor-pointer hover:bg-red-100 transition"
                onClick={() => navigate('/employees?filter=expiredInsurance')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-900">تأمين منتهي</p>
                      <p className="text-xs text-red-700">يحتاج تحديث فوري</p>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-red-600">{stats.expiredInsurance}</div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-red-600 text-xs">
                  <span>عرض الموظفين</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              <div 
                className="bg-orange-50 border-r-4 border-orange-600 p-4 rounded-lg cursor-pointer hover:bg-orange-100 transition"
                onClick={() => navigate('/employees?filter=expiringInsurance30')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg">
                      <Clock className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-orange-900">تأمين ينتهي قريباً</p>
                      <p className="text-xs text-orange-700">ينتهي خلال 30 يوم</p>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-orange-600">{stats.expiringInsurance30}</div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-orange-600 text-xs">
                  <span>عرض الموظفين</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* إجمالي الأماكن المتاحة */}
              {stats.totalAvailableSlots > 0 && (
                <div 
                  className="bg-green-50 border-r-4 border-green-600 p-4 rounded-lg cursor-pointer hover:bg-green-100 transition"
                  onClick={() => navigate('/companies')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <MapPin className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-900">أماكن متاحة</p>
                        <p className="text-xs text-green-700">يمكن إضافة موظفين جدد</p>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-green-600">{stats.totalAvailableSlots}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-green-600 text-xs">
                    <span>عرض المؤسسات</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

export default Dashboard