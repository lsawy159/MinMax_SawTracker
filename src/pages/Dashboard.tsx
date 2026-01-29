import { useEffect, useState, useMemo } from 'react'
import { supabase, Employee, Company } from '@/lib/supabase'
import { Users, Building2, AlertTriangle, Calendar, XCircle, Clock, ArrowRight, MapPin, Bell, TrendingUp, FileText, Shield, LayoutDashboard } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import { differenceInDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { 
  enrichEmployeeAlertsWithCompanyData,
  getEmployeeNotificationThresholdsPublic,
  DEFAULT_EMPLOYEE_THRESHOLDS,
  type EmployeeAlert
} from '@/utils/employeeAlerts'
import { alertCache } from '@/utils/alertCache'
import type { Alert } from '@/components/alerts/AlertCard'
import { getStatusThresholds, DEFAULT_STATUS_THRESHOLDS } from '@/utils/autoCompanyStatus'
import { usePermissions } from '@/utils/permissions'

interface Stats {
  totalEmployees: number
  totalCompanies: number
  fullCompanies: number
  companiesWithFewSlots: number
  totalAvailableSlots: number
  totalContractSlots: number
  avgEmployeesPerCompany: number
  utilizationRate: number
  // إحصائيات العقود (5 فئات)
  expiredContracts: number
  urgentContracts: number
  highContracts: number
  mediumContracts: number
  validContracts: number
  // إحصائيات الإقامات (5 فئات)
  expiredResidences: number
  urgentResidences: number
  highResidences: number
  mediumResidences: number
  validResidences: number
  // إحصائيات التأمين الصحي (5 فئات)
  expiredInsurance: number
  urgentInsurance: number
  highInsurance: number
  mediumInsurance: number
  validInsurance: number
  // إحصائيات عقد أجير (5 فئات)
  expiredHiredWorkerContracts: number
  urgentHiredWorkerContracts: number
  highHiredWorkerContracts: number
  mediumHiredWorkerContracts: number
  validHiredWorkerContracts: number
  // إحصائيات السجل التجاري (5 فئات)
  expiredCommercialReg: number
  urgentCommercialReg: number
  highCommercialReg: number
  mediumCommercialReg: number
  validCommercialReg: number
  // إحصائيات اشتراك قوى (5 فئات)
  expiredPower: number
  urgentPower: number
  highPower: number
  mediumPower: number
  validPower: number
  // إحصائيات اشتراك مقيم (5 فئات)
  expiredMoqeem: number
  urgentMoqeem: number
  highMoqeem: number
  mediumMoqeem: number
  validMoqeem: number
}

export default function Dashboard() {
  const { canView } = usePermissions()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [companyThresholds, setCompanyThresholds] = useState(DEFAULT_STATUS_THRESHOLDS)
  const [employeeThresholds, setEmployeeThresholds] = useState(DEFAULT_EMPLOYEE_THRESHOLDS)
  const [companyAlerts, setCompanyAlerts] = useState<Alert[]>([])
  const [employeeAlerts, setEmployeeAlerts] = useState<EmployeeAlert[]>([])
  const [activeTab, setActiveTab] = useState<'companies' | 'employees'>('companies')
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
    // إحصائيات العقود (5 فئات)
    expiredContracts: 0,
    urgentContracts: 0,
    highContracts: 0,
    mediumContracts: 0,
    validContracts: 0,
    // إحصائيات الإقامات (5 فئات)
    expiredResidences: 0,
    urgentResidences: 0,
    highResidences: 0,
    mediumResidences: 0,
    validResidences: 0,
    // إحصائيات التأمين الصحي (5 فئات)
    expiredInsurance: 0,
    urgentInsurance: 0,
    highInsurance: 0,
    mediumInsurance: 0,
    validInsurance: 0,
    // إحصائيات عقد أجير (5 فئات)
    expiredHiredWorkerContracts: 0,
    urgentHiredWorkerContracts: 0,
    highHiredWorkerContracts: 0,
    mediumHiredWorkerContracts: 0,
    validHiredWorkerContracts: 0,
    // إحصائيات السجل التجاري (5 فئات)
    expiredCommercialReg: 0,
    urgentCommercialReg: 0,
    highCommercialReg: 0,
    mediumCommercialReg: 0,
    validCommercialReg: 0,
    // إحصائيات اشتراك قوى (5 فئات)
    expiredPower: 0,
    urgentPower: 0,
    highPower: 0,
    mediumPower: 0,
    validPower: 0,
    // إحصائيات اشتراك مقيم (5 فئات)
    expiredMoqeem: 0,
    urgentMoqeem: 0,
    highMoqeem: 0,
    mediumMoqeem: 0,
    validMoqeem: 0
  })

  useEffect(() => {
    // Load critical data first (basic stats)
    fetchBasicData()
    loadReadAlerts()
    
    // استماع لأحداث تحديث البيانات لتحديث الإحصائيات
    const handleCompanyUpdated = () => {
      alertCache.invalidateCompanyAlerts() // إبطال cache المؤسسات
      fetchBasicData()
    }
    
    const handleEmployeeUpdated = () => {
      alertCache.invalidateEmployeeAlerts() // إبطال cache الموظفين
      fetchBasicData()
    }
    
    window.addEventListener('companyUpdated', handleCompanyUpdated)
    window.addEventListener('employeeUpdated', handleEmployeeUpdated)
    
    // Cleanup
    return () => {
      window.removeEventListener('companyUpdated', handleCompanyUpdated)
      window.removeEventListener('employeeUpdated', handleEmployeeUpdated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load secondary data (alerts) after basic data is loaded
  useEffect(() => {
    if (!loading && employees.length > 0 && companies.length > 0) {
      // Use requestIdleCallback for non-critical work
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window.requestIdleCallback as (callback: IdleRequestCallback, options?: IdleRequestOptions) => number)(
          () => {
            fetchSecondaryData()
          },
          { timeout: 2000 }
        )
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          fetchSecondaryData()
        }, 100)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, employees.length, companies.length])

  // جلب التنبيهات المقروءة من قاعدة البيانات
  const loadReadAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('read_alerts')
        .select('alert_id')
        .eq('user_id', user.id)

      if (error) throw error
    } catch (error) {
      console.error('خطأ في جلب التنبيهات المقروءة:', error)
    }
  }

  // Phase 1: Load basic data and stats (critical)
  const fetchBasicData = async () => {
    try {
      setLoading(true)

      // Fetch employees, companies، والإعدادات في آن واحد
      const [employeesResult, companiesResult, companyThresholdsData, employeeThresholdsData] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('companies').select('*'),
        getStatusThresholds(),
        getEmployeeNotificationThresholdsPublic()
      ])

      if (employeesResult.error) throw employeesResult.error
      if (companiesResult.error) throw companiesResult.error

      const employeesData = employeesResult.data || []
      const companiesData = companiesResult.data || []
      
      setEmployees(employeesData)
      setCompanies(companiesData)
      setCompanyThresholds(companyThresholdsData)
      setEmployeeThresholds(employeeThresholdsData)

      if (employeesData.length > 0 && companiesData.length > 0) {
        // Calculate basic stats immediately (critical)
        const calculatedStats = await calculateStats(
          employeesData,
          companiesData,
          companyThresholdsData,
          employeeThresholdsData
        )
        setStats(calculatedStats)
      }
    } catch (error) {
      console.error('خطأ في جلب البيانات الأساسية:', error)
    } finally {
      setLoading(false)
    }
  }

  // Phase 2: Load alerts (non-critical, can be deferred)
  const fetchSecondaryData = () => {
    try {
      // Generate alerts asynchronously (non-blocking) using cache
      // Using setTimeout to defer execution and avoid blocking the main thread
      setTimeout(async () => {
        if (employees.length > 0 && companies.length > 0) {
          // توليد تنبيهات المؤسسات باستخدام Cache
          const companyAlertsGenerated = await alertCache.getCompanyAlerts(companies)
          setCompanyAlerts(companyAlertsGenerated)
          
          // توليد تنبيهات الموظفين باستخدام Cache
          const employeeAlertsGenerated = await alertCache.getEmployeeAlerts(employees, companies)
          const enrichedEmployeeAlerts = enrichEmployeeAlertsWithCompanyData(employeeAlertsGenerated, companies)
          setEmployeeAlerts(enrichedEmployeeAlerts)
        }
      }, 0)
    } catch (error) {
      console.error('خطأ في جلب البيانات الثانوية:', error)
    }
  }

  // دالة مساعدة لحساب الفئات الخمس لأي تاريخ انتهاء
  const calculateFiveCategories = (
    expiryDate: string | null | undefined,
    today: Date,
    thresholds: { urgent: number; high: number; medium: number }
  ) => {
    if (!expiryDate) {
      return { expired: 0, urgent: 0, high: 0, medium: 0, valid: 0 }
    }
    
    // إعادة تعيين الوقت لضمان المقارنة الصحيحة
    const expiry = new Date(expiryDate)
    const todayNormalized = new Date(today)
    todayNormalized.setHours(0, 0, 0, 0)
    expiry.setHours(0, 0, 0, 0)
    
    const diff = differenceInDays(expiry, todayNormalized)
    
    if (diff < 0) {
      return { expired: 1, urgent: 0, high: 0, medium: 0, valid: 0 }
    } else if (diff <= thresholds.urgent) {
      return { expired: 0, urgent: 1, high: 0, medium: 0, valid: 0 }
    } else if (diff <= thresholds.high) {
      return { expired: 0, urgent: 0, high: 1, medium: 0, valid: 0 }
    } else if (diff <= thresholds.medium) {
      return { expired: 0, urgent: 0, high: 0, medium: 1, valid: 0 }
    } else {
      return { expired: 0, urgent: 0, high: 0, medium: 0, valid: 1 }
    }
  }

  const calculateStats = async (
    employees: Employee[],
    companies: Company[],
    companyThresholdsInput = companyThresholds,
    employeeThresholdsInput = employeeThresholds
  ) => {
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
    
    // حساب إحصائيات العقود (5 فئات)
    let expiredContracts = 0, urgentContracts = 0, highContracts = 0, mediumContracts = 0, validContracts = 0
    employees.forEach(emp => {
      const cats = calculateFiveCategories(emp.contract_expiry, today, {
        urgent: employeeThresholdsInput.contract_urgent_days,
        high: employeeThresholdsInput.contract_high_days,
        medium: employeeThresholdsInput.contract_medium_days
      })
      expiredContracts += cats.expired
      urgentContracts += cats.urgent
      highContracts += cats.high
      mediumContracts += cats.medium
      validContracts += cats.valid
    })

    // حساب إحصائيات الإقامات (5 فئات)
    let expiredResidences = 0, urgentResidences = 0, highResidences = 0, mediumResidences = 0, validResidences = 0
    employees.forEach(emp => {
      const cats = calculateFiveCategories(emp.residence_expiry, today, {
        urgent: employeeThresholdsInput.residence_urgent_days,
        high: employeeThresholdsInput.residence_high_days,
        medium: employeeThresholdsInput.residence_medium_days
      })
      expiredResidences += cats.expired
      urgentResidences += cats.urgent
      highResidences += cats.high
      mediumResidences += cats.medium
      validResidences += cats.valid
    })

    // حساب إحصائيات التأمين الصحي (5 فئات)
    let expiredInsurance = 0, urgentInsurance = 0, highInsurance = 0, mediumInsurance = 0, validInsurance = 0
    employees.forEach(emp => {
      const cats = calculateFiveCategories(emp.health_insurance_expiry, today, {
        urgent: employeeThresholdsInput.health_insurance_urgent_days,
        high: employeeThresholdsInput.health_insurance_high_days,
        medium: employeeThresholdsInput.health_insurance_medium_days
      })
      expiredInsurance += cats.expired
      urgentInsurance += cats.urgent
      highInsurance += cats.high
      mediumInsurance += cats.medium
      validInsurance += cats.valid
    })

    // حساب إحصائيات عقد أجير (5 فئات)
    let expiredHiredWorkerContracts = 0, urgentHiredWorkerContracts = 0, highHiredWorkerContracts = 0, mediumHiredWorkerContracts = 0, validHiredWorkerContracts = 0
    employees.forEach(emp => {
      const cats = calculateFiveCategories(emp.hired_worker_contract_expiry, today, {
        urgent: employeeThresholdsInput.hired_worker_contract_urgent_days,
        high: employeeThresholdsInput.hired_worker_contract_high_days,
        medium: employeeThresholdsInput.hired_worker_contract_medium_days
      })
      expiredHiredWorkerContracts += cats.expired
      urgentHiredWorkerContracts += cats.urgent
      highHiredWorkerContracts += cats.high
      mediumHiredWorkerContracts += cats.medium
      validHiredWorkerContracts += cats.valid
    })

    // حساب إحصائيات السجل التجاري (5 فئات)
    let expiredCommercialReg = 0, urgentCommercialReg = 0, highCommercialReg = 0, mediumCommercialReg = 0, validCommercialReg = 0
    companies.forEach(company => {
      const cats = calculateFiveCategories(company.commercial_registration_expiry, today, {
        urgent: companyThresholdsInput.commercial_reg_urgent_days,
        high: companyThresholdsInput.commercial_reg_high_days,
        medium: companyThresholdsInput.commercial_reg_medium_days
      })
      expiredCommercialReg += cats.expired
      urgentCommercialReg += cats.urgent
      highCommercialReg += cats.high
      mediumCommercialReg += cats.medium
      validCommercialReg += cats.valid
    })

    // حساب إحصائيات اشتراك قوى (5 فئات)
    let expiredPower = 0, urgentPower = 0, highPower = 0, mediumPower = 0, validPower = 0
    companies.forEach(company => {
      const cats = calculateFiveCategories(company.ending_subscription_power_date, today, {
        urgent: companyThresholdsInput.power_subscription_urgent_days,
        high: companyThresholdsInput.power_subscription_high_days,
        medium: companyThresholdsInput.power_subscription_medium_days
      })
      expiredPower += cats.expired
      urgentPower += cats.urgent
      highPower += cats.high
      mediumPower += cats.medium
      validPower += cats.valid
    })

    // حساب إحصائيات اشتراك مقيم (5 فئات)
    let expiredMoqeem = 0, urgentMoqeem = 0, highMoqeem = 0, mediumMoqeem = 0, validMoqeem = 0
    companies.forEach(company => {
      const cats = calculateFiveCategories(company.ending_subscription_moqeem_date, today, {
        urgent: companyThresholdsInput.moqeem_subscription_urgent_days,
        high: companyThresholdsInput.moqeem_subscription_high_days,
        medium: companyThresholdsInput.moqeem_subscription_medium_days
      })
      expiredMoqeem += cats.expired
      urgentMoqeem += cats.urgent
      highMoqeem += cats.high
      mediumMoqeem += cats.medium
      validMoqeem += cats.valid
    })

    return {
      totalEmployees,
      totalCompanies,
      fullCompanies,
      companiesWithFewSlots,
      totalAvailableSlots,
      totalContractSlots,
      avgEmployeesPerCompany,
      utilizationRate,
      // إحصائيات العقود (5 فئات)
      expiredContracts,
      urgentContracts,
      highContracts,
      mediumContracts,
      validContracts,
      // إحصائيات الإقامات (5 فئات)
      expiredResidences,
      urgentResidences,
      highResidences,
      mediumResidences,
      validResidences,
      // إحصائيات التأمين الصحي (5 فئات)
      expiredInsurance,
      urgentInsurance,
      highInsurance,
      mediumInsurance,
      validInsurance,
      // إحصائيات عقد أجير (5 فئات)
      expiredHiredWorkerContracts,
      urgentHiredWorkerContracts,
      highHiredWorkerContracts,
      mediumHiredWorkerContracts,
      validHiredWorkerContracts,
      // إحصائيات السجل التجاري (5 فئات)
      expiredCommercialReg,
      urgentCommercialReg,
      highCommercialReg,
      mediumCommercialReg,
      validCommercialReg,
      // إحصائيات اشتراك قوى (5 فئات)
      expiredPower,
      urgentPower,
      highPower,
      mediumPower,
      validPower,
      // إحصائيات اشتراك مقيم (5 فئات)
      expiredMoqeem,
      urgentMoqeem,
      highMoqeem,
      mediumMoqeem,
      validMoqeem
    }
  }



  // حساب التنبيهات الطارئة والعاجلة للمؤسسات (urgent + high)
  const companyUrgentAndHighAlerts = useMemo(() => 
    companyAlerts.filter(a => a.priority === 'urgent' || a.priority === 'high').length,
    [companyAlerts]
  )

  // حساب التنبيهات الطارئة والعاجلة للموظفين (urgent + high)
  const employeeUrgentAndHighAlerts = useMemo(() => 
    employeeAlerts.filter(a => a.priority === 'urgent' || a.priority === 'high').length,
    [employeeAlerts]
  )

  // التحقق من الصلاحية دون إرجاع مبكر للحفاظ على ترتيب الـ Hooks
  const unauthorized = !canView('dashboard')

  return (
    <Layout>
      {unauthorized ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <LayoutDashboard className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      ) : (
      <div className="p-2.5">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* الكروت الإحصائية الرئيسية */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              {/* كرت عدد المؤسسات */}
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-3 text-white hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-xs mb-0.5">عدد المؤسسات</p>
                    <p className="text-xl font-bold">{stats.totalCompanies}</p>
                    <p className="text-green-100 text-xs mt-1">مؤسسة مسجلة</p>
                  </div>
                  <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* كرت عدد الموظفين */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-3 text-white hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-xs mb-0.5">عدد الموظفين</p>
                    <p className="text-xl font-bold">{stats.totalEmployees}</p>
                    <p className="text-blue-100 text-xs mt-1">موظف مسجل</p>
                  </div>
                  <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* كرت تنبيهات المؤسسات الطارئة والعاجلة */}
              <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-lg shadow-md p-3 text-white hover:shadow-lg transition-all duration-200 cursor-pointer" onClick={() => navigate('/alerts?tab=companies')}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-xs mb-0.5">تنبيهات المؤسسات</p>
                    <p className="text-xl font-bold">{companyUrgentAndHighAlerts}</p>
                    <p className="text-red-100 text-xs mt-1">طارئة وعاجلة</p>
                  </div>
                  <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-white/80 text-xs">
                  <span>عرض التفاصيل</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* كرت تنبيهات الموظفين الطارئة والعاجلة */}
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-md p-3 text-white hover:shadow-lg transition-all duration-200 cursor-pointer" onClick={() => navigate('/alerts?tab=employees')}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-xs mb-0.5">تنبيهات الموظفين</p>
                    <p className="text-xl font-bold">{employeeUrgentAndHighAlerts}</p>
                    <p className="text-purple-100 text-xs mt-1">طارئة وعاجلة</p>
                  </div>
                  <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                    <Bell className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-white/80 text-xs">
                  <span>عرض التفاصيل</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* نظام التبويبات */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3">
              {/* شريط التبويبات */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('companies')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition ${
                    activeTab === 'companies'
                      ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>المؤسسات</span>
                </button>
                <button
                  onClick={() => setActiveTab('employees')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium transition ${
                    activeTab === 'employees'
                      ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>الموظفين</span>
                </button>
              </div>

              {/* محتوى التبويبات */}
              <div className="p-3">
                {activeTab === 'companies' ? (
                  <div className="space-y-3">
                    {/* إحصائيات عامة للمؤسسات */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-2.5 border border-green-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-green-700">مؤسسات مكتملة</span>
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        </div>
                        <p className="text-lg font-bold text-green-900">{stats.fullCompanies}</p>
                        <p className="text-xs text-green-600 mt-0.5">لا يمكن إضافة موظفين</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2.5 border border-blue-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-blue-700">أماكن شاغرة</span>
                          <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <p className="text-lg font-bold text-blue-900">{stats.totalAvailableSlots}</p>
                        <p className="text-xs text-blue-600 mt-0.5">مكان متاح للإضافة</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-2.5 border border-purple-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-purple-700">معدل الاستفادة</span>
                          <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
                        </div>
                        <p className="text-lg font-bold text-purple-900">{stats.utilizationRate}%</p>
                        <p className="text-xs text-purple-600 mt-0.5">من السعة المتاحة</p>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-2.5 border border-gray-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-700">متوسط الموظفين</span>
                          <Users className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          {stats.totalCompanies > 0 ? Math.round(stats.totalEmployees / stats.totalCompanies) : 0}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">لكل مؤسسة</p>
                      </div>
                    </div>

                    {/* مربعات الإحصائيات في تنسيق 2×2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* إحصائيات السجل التجاري */}
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-3 border border-orange-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-orange-600" />
                          إحصائيات السجل التجاري
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">منتهية</span>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.expiredCommercialReg}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">طارئة</span>
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.urgentCommercialReg}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {companyThresholds.commercial_reg_urgent_days} أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.highCommercialReg}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {companyThresholds.commercial_reg_high_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.mediumCommercialReg}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{companyThresholds.commercial_reg_medium_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.validCommercialReg}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من {companyThresholds.commercial_reg_medium_days} يوم</p>
                          </div>
                        </div>
                      </div>

                      {/* إحصائيات اشتراك قوى */}
                      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 border border-cyan-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-cyan-600" />
                          إحصائيات اشتراك قوى
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                          <div className="bg-white rounded-lg p-2.5 border border-cyan-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">منتهية</span>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.expiredPower}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-cyan-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">طارئة</span>
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.urgentPower}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {companyThresholds.power_subscription_urgent_days} أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-cyan-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.highPower}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {companyThresholds.power_subscription_high_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-cyan-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.mediumPower}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{companyThresholds.power_subscription_medium_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-cyan-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.validPower}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من {companyThresholds.power_subscription_medium_days} يوم</p>
                          </div>
                        </div>
                      </div>

                      {/* إحصائيات اشتراك مقيم */}
                      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-3 border border-teal-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-teal-600" />
                          إحصائيات اشتراك مقيم
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                          <div className="bg-white rounded-lg p-2.5 border border-teal-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">منتهية</span>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.expiredMoqeem}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-teal-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">طارئة</span>
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.urgentMoqeem}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {companyThresholds.moqeem_subscription_urgent_days} أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-teal-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.highMoqeem}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {companyThresholds.moqeem_subscription_high_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-teal-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.mediumMoqeem}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{companyThresholds.moqeem_subscription_medium_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-teal-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.validMoqeem}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من {companyThresholds.moqeem_subscription_medium_days} يوم</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* قائمة مختصرة بالمؤسسات */}
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          المؤسسات الأخيرة
                        </h3>
                        <button
                          onClick={() => navigate('/companies')}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
                        >
                          عرض الكل
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {companies.slice(0, 5).map((company) => {
                          const employeesInCompany = employees.filter(emp => emp.company_id === company.id).length
                          const maxEmployees = company.max_employees || 4
                          const availableSlots = Math.max(0, maxEmployees - employeesInCompany)
                          return (
                            <div
                              key={company.id}
                              onClick={() => navigate(`/companies?id=${company.id}`)}
                              className="bg-white rounded-lg p-2.5 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-xs text-gray-900">{company.name}</p>
                                  <p className="text-xs text-gray-600">
                                    {employeesInCompany} / {maxEmployees} موظف
                                  </p>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  availableSlots === 0 
                                    ? 'bg-red-100 text-red-700' 
                                    : availableSlots <= 2 
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {availableSlots === 0 ? 'مكتمل' : `${availableSlots} مكان متاح`}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {companies.length === 0 && (
                          <div className="text-center py-5 text-gray-500 text-xs">
                            لا توجد مؤسسات مسجلة
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* مربعات الإحصائيات في تنسيق 2×2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* إحصائيات العقود */}
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          إحصائيات العقود
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                          <div className="bg-white rounded-lg p-2.5 border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">منتهية</span>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.expiredContracts}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">طارئة</span>
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.urgentContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {employeeThresholds.contract_urgent_days} أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.highContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {employeeThresholds.contract_high_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.mediumContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{employeeThresholds.contract_medium_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.validContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من {employeeThresholds.contract_medium_days} يوم</p>
                          </div>
                        </div>
                      </div>

                      {/* إحصائيات الإقامات */}
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-purple-600" />
                          إحصائيات الإقامات
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                          <div className="bg-white rounded-lg p-2.5 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">منتهية</span>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.expiredResidences}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">طارئة</span>
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.urgentResidences}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {employeeThresholds.residence_urgent_days} أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.highResidences}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {employeeThresholds.residence_high_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.mediumResidences}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{employeeThresholds.residence_medium_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.validResidences}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من {employeeThresholds.residence_medium_days} يوم</p>
                          </div>
                        </div>
                      </div>

                      {/* إحصائيات التأمين الصحي */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-green-600" />
                          إحصائيات التأمين الصحي
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">منتهية</span>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.expiredInsurance}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">طارئة</span>
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.urgentInsurance}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {employeeThresholds.health_insurance_urgent_days} أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.highInsurance}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {employeeThresholds.health_insurance_high_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.mediumInsurance}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{employeeThresholds.health_insurance_medium_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.validInsurance}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من {employeeThresholds.health_insurance_medium_days} يوم</p>
                          </div>
                        </div>
                      </div>

                      {/* إحصائيات عقد أجير */}
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                          إحصائيات عقد أجير
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                          <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">منتهية</span>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.expiredHiredWorkerContracts}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">طارئة</span>
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.urgentHiredWorkerContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {employeeThresholds.hired_worker_contract_urgent_days} أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.highHiredWorkerContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال {employeeThresholds.hired_worker_contract_high_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.mediumHiredWorkerContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{employeeThresholds.hired_worker_contract_medium_days} يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.validHiredWorkerContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من {employeeThresholds.hired_worker_contract_medium_days} يوم</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* قائمة مختصرة بالموظفين */}
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                          الموظفين الأخيرين
                        </h3>
                        <button
                          onClick={() => navigate('/employees')}
                          className="text-purple-600 hover:text-purple-800 text-xs font-medium flex items-center gap-1"
                        >
                          عرض الكل
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {employees.slice(0, 5).map((employee) => {
                          const company = companies.find(c => c.id === employee.company_id)
                          return (
                            <div
                              key={employee.id}
                              onClick={() => navigate(`/employees?id=${employee.id}`)}
                              className="bg-white rounded-lg p-2.5 border border-gray-200 hover:border-purple-300 hover:shadow-sm transition cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-xs text-gray-900">{employee.name}</p>
                                  <p className="text-xs text-gray-600">
                                    {employee.profession} - {company?.name || 'غير معروف'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">{employee.nationality}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {employees.length === 0 && (
                          <div className="text-center py-5 text-gray-500 text-xs">
                            لا يوجد موظفين مسجلين
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>




          </>
        )}
      </div>
      )}
    </Layout>
  )
}