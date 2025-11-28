import { useEffect, useState, useMemo } from 'react'
import { supabase, Employee, Company } from '@/lib/supabase'
import { Users, Building2, AlertTriangle, Calendar, XCircle, Clock, ArrowRight, MapPin, Bell, TrendingUp, FileText, Shield } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import { differenceInDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { AlertCard, Alert } from '@/components/alerts/AlertCard'
import { 
  calculateCommercialRegistrationStatus, 
  calculateSocialInsuranceStatus,
  calculatePowerSubscriptionStatus,
  calculateMoqeemSubscriptionStatus,
  calculateCompanyStatusStats,
  calculatePowerStats,
  calculateMoqeemStats
} from '@/utils/autoCompanyStatus'
import { 
  generateCompanyAlertsSync,
  getAlertsStats, 
  getUrgentAlerts, 
  filterAlertsByType,
  getNotificationThresholds,
  type Company as CompanyAlertType
} from '@/utils/alerts'
import { 
  generateEmployeeAlerts, 
  enrichEmployeeAlertsWithCompanyData,
  getEmployeeAlertsStats,
  getUrgentEmployeeAlerts,
  filterEmployeeAlertsByType,
  type EmployeeAlert
} from '@/utils/employeeAlerts'

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
  urgent7Contracts: number
  urgent30Contracts: number
  medium45Contracts: number
  valid45PlusContracts: number
  // إحصائيات الإقامات (5 فئات)
  expiredResidences: number
  urgent7Residences: number
  urgent30Residences: number
  medium45Residences: number
  valid45PlusResidences: number
  // إحصائيات التأمين الصحي (5 فئات)
  expiredInsurance: number
  urgent7Insurance: number
  urgent30Insurance: number
  medium45Insurance: number
  valid45PlusInsurance: number
  // إحصائيات عقد أجير (5 فئات)
  expiredHiredWorkerContracts: number
  urgent7HiredWorkerContracts: number
  urgent30HiredWorkerContracts: number
  medium45HiredWorkerContracts: number
  valid45PlusHiredWorkerContracts: number
  // إحصائيات السجل التجاري (5 فئات)
  expiredCommercialReg: number
  urgent7CommercialReg: number
  urgent30CommercialReg: number
  medium45CommercialReg: number
  valid45PlusCommercialReg: number
  // إحصائيات التأمينات الاجتماعية (5 فئات)
  expiredInsuranceSocial: number
  urgent7InsuranceSocial: number
  urgent30InsuranceSocial: number
  medium45InsuranceSocial: number
  valid45PlusInsuranceSocial: number
  // إحصائيات اشتراك قوى (5 فئات)
  expiredPower: number
  urgent7Power: number
  urgent30Power: number
  medium45Power: number
  valid45PlusPower: number
  // إحصائيات اشتراك مقيم (5 فئات)
  expiredMoqeem: number
  urgent7Moqeem: number
  urgent30Moqeem: number
  medium45Moqeem: number
  valid45PlusMoqeem: number
}

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSecondary, setLoadingSecondary] = useState(true)
  const [companyAlerts, setCompanyAlerts] = useState<Alert[]>([])
  const [employeeAlerts, setEmployeeAlerts] = useState<EmployeeAlert[]>([])
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set())
  const [showAlerts, setShowAlerts] = useState(false)
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
    urgent7Contracts: 0,
    urgent30Contracts: 0,
    medium45Contracts: 0,
    valid45PlusContracts: 0,
    // إحصائيات الإقامات (5 فئات)
    expiredResidences: 0,
    urgent7Residences: 0,
    urgent30Residences: 0,
    medium45Residences: 0,
    valid45PlusResidences: 0,
    // إحصائيات التأمين الصحي (5 فئات)
    expiredInsurance: 0,
    urgent7Insurance: 0,
    urgent30Insurance: 0,
    medium45Insurance: 0,
    valid45PlusInsurance: 0,
    // إحصائيات عقد أجير (5 فئات)
    expiredHiredWorkerContracts: 0,
    urgent7HiredWorkerContracts: 0,
    urgent30HiredWorkerContracts: 0,
    medium45HiredWorkerContracts: 0,
    valid45PlusHiredWorkerContracts: 0,
    // إحصائيات السجل التجاري (5 فئات)
    expiredCommercialReg: 0,
    urgent7CommercialReg: 0,
    urgent30CommercialReg: 0,
    medium45CommercialReg: 0,
    valid45PlusCommercialReg: 0,
    // إحصائيات التأمينات الاجتماعية (5 فئات)
    expiredInsuranceSocial: 0,
    urgent7InsuranceSocial: 0,
    urgent30InsuranceSocial: 0,
    medium45InsuranceSocial: 0,
    valid45PlusInsuranceSocial: 0,
    // إحصائيات اشتراك قوى (5 فئات)
    expiredPower: 0,
    urgent7Power: 0,
    urgent30Power: 0,
    medium45Power: 0,
    valid45PlusPower: 0,
    // إحصائيات اشتراك مقيم (5 فئات)
    expiredMoqeem: 0,
    urgent7Moqeem: 0,
    urgent30Moqeem: 0,
    medium45Moqeem: 0,
    valid45PlusMoqeem: 0
  })

  useEffect(() => {
    // Load critical data first (basic stats)
    fetchBasicData()
    loadReadAlerts()
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

  // Phase 1: Load basic data and stats (critical)
  const fetchBasicData = async () => {
    try {
      setLoading(true)

      // Fetch employees and companies in parallel
      const [employeesResult, companiesResult] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('companies').select('*')
      ])

      if (employeesResult.error) throw employeesResult.error
      if (companiesResult.error) throw companiesResult.error

      const employeesData = employeesResult.data || []
      const companiesData = companiesResult.data || []

      setEmployees(employeesData)
      setCompanies(companiesData)

      if (employeesData.length > 0 && companiesData.length > 0) {
        // Calculate basic stats immediately (critical)
        const calculatedStats = await calculateStats(employeesData, companiesData)
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
      setLoadingSecondary(true)

      // Generate alerts asynchronously (non-blocking)
      // Using setTimeout to defer execution and avoid blocking the main thread
      setTimeout(async () => {
        if (employees.length > 0 && companies.length > 0) {
          // توليد تنبيهات المؤسسات
          const companyAlertsGenerated = await generateCompanyAlertsSync(companies)
          setCompanyAlerts(companyAlertsGenerated)
          
          // توليد تنبيهات الموظفين
          const employeeAlertsGenerated = await generateEmployeeAlerts(employees, companies)
          const enrichedEmployeeAlerts = enrichEmployeeAlertsWithCompanyData(employeeAlertsGenerated, companies)
          setEmployeeAlerts(enrichedEmployeeAlerts)
        }
        setLoadingSecondary(false)
      }, 0)
    } catch (error) {
      console.error('خطأ في جلب البيانات الثانوية:', error)
      setLoadingSecondary(false)
    }
  }

  // دالة مساعدة لحساب الفئات الخمس لأي تاريخ انتهاء
  const calculateFiveCategories = (expiryDate: string | null | undefined, today: Date) => {
    if (!expiryDate) {
      return { expired: 0, urgent7: 0, urgent30: 0, medium45: 0, valid45Plus: 0 }
    }
    const diff = differenceInDays(new Date(expiryDate), today)
    if (diff < 0) {
      return { expired: 1, urgent7: 0, urgent30: 0, medium45: 0, valid45Plus: 0 }
    } else if (diff <= 7) {
      return { expired: 0, urgent7: 1, urgent30: 0, medium45: 0, valid45Plus: 0 }
    } else if (diff <= 30) {
      return { expired: 0, urgent7: 0, urgent30: 1, medium45: 0, valid45Plus: 0 }
    } else if (diff <= 45) {
      return { expired: 0, urgent7: 0, urgent30: 0, medium45: 1, valid45Plus: 0 }
    } else {
      return { expired: 0, urgent7: 0, urgent30: 0, medium45: 0, valid45Plus: 1 }
    }
  }

  const calculateStats = async (employees: Employee[], companies: Company[]) => {
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
    let expiredContracts = 0, urgent7Contracts = 0, urgent30Contracts = 0, medium45Contracts = 0, valid45PlusContracts = 0
    employees.forEach(emp => {
      const cats = calculateFiveCategories(emp.contract_expiry, today)
      expiredContracts += cats.expired
      urgent7Contracts += cats.urgent7
      urgent30Contracts += cats.urgent30
      medium45Contracts += cats.medium45
      valid45PlusContracts += cats.valid45Plus
    })

    // حساب إحصائيات الإقامات (5 فئات)
    let expiredResidences = 0, urgent7Residences = 0, urgent30Residences = 0, medium45Residences = 0, valid45PlusResidences = 0
    employees.forEach(emp => {
      const cats = calculateFiveCategories(emp.residence_expiry, today)
      expiredResidences += cats.expired
      urgent7Residences += cats.urgent7
      urgent30Residences += cats.urgent30
      medium45Residences += cats.medium45
      valid45PlusResidences += cats.valid45Plus
    })

    // حساب إحصائيات التأمين الصحي (5 فئات)
    let expiredInsurance = 0, urgent7Insurance = 0, urgent30Insurance = 0, medium45Insurance = 0, valid45PlusInsurance = 0
    employees.forEach(emp => {
      const cats = calculateFiveCategories(emp.health_insurance_expiry, today)
      expiredInsurance += cats.expired
      urgent7Insurance += cats.urgent7
      urgent30Insurance += cats.urgent30
      medium45Insurance += cats.medium45
      valid45PlusInsurance += cats.valid45Plus
    })

    // حساب إحصائيات عقد أجير (5 فئات)
    let expiredHiredWorkerContracts = 0, urgent7HiredWorkerContracts = 0, urgent30HiredWorkerContracts = 0, medium45HiredWorkerContracts = 0, valid45PlusHiredWorkerContracts = 0
    employees.forEach(emp => {
      const cats = calculateFiveCategories(emp.hired_worker_contract_expiry, today)
      expiredHiredWorkerContracts += cats.expired
      urgent7HiredWorkerContracts += cats.urgent7
      urgent30HiredWorkerContracts += cats.urgent30
      medium45HiredWorkerContracts += cats.medium45
      valid45PlusHiredWorkerContracts += cats.valid45Plus
    })

    // حساب إحصائيات المؤسسات مع النظام الجديد (يشمل جميع الحالات)
    const companyStatusStats = calculateCompanyStatusStats(companies.map(c => ({
      id: c.id,
      name: c.name,
      commercial_registration_expiry: c.commercial_registration_expiry,
      social_insurance_expiry: c.social_insurance_expiry,
      ending_subscription_power_date: c.ending_subscription_power_date,
      ending_subscription_moqeem_date: c.ending_subscription_moqeem_date
    })))

    // حساب إحصائيات اشتراك قوى
    const powerStats = calculatePowerStats(companies.map(c => ({
      ending_subscription_power_date: c.ending_subscription_power_date
    })))

    // حساب إحصائيات اشتراك مقيم
    const moqeemStats = calculateMoqeemStats(companies.map(c => ({
      ending_subscription_moqeem_date: c.ending_subscription_moqeem_date
    })))

    // حساب إحصائيات السجل التجاري (5 فئات)
    let expiredCommercialReg = 0, urgent7CommercialReg = 0, urgent30CommercialReg = 0, medium45CommercialReg = 0, valid45PlusCommercialReg = 0
    companies.forEach(company => {
      const cats = calculateFiveCategories(company.commercial_registration_expiry, today)
      expiredCommercialReg += cats.expired
      urgent7CommercialReg += cats.urgent7
      urgent30CommercialReg += cats.urgent30
      medium45CommercialReg += cats.medium45
      valid45PlusCommercialReg += cats.valid45Plus
    })

    // حساب إحصائيات التأمينات الاجتماعية (5 فئات)
    let expiredInsuranceSocial = 0, urgent7InsuranceSocial = 0, urgent30InsuranceSocial = 0, medium45InsuranceSocial = 0, valid45PlusInsuranceSocial = 0
    companies.forEach(company => {
      const cats = calculateFiveCategories(company.social_insurance_expiry, today)
      expiredInsuranceSocial += cats.expired
      urgent7InsuranceSocial += cats.urgent7
      urgent30InsuranceSocial += cats.urgent30
      medium45InsuranceSocial += cats.medium45
      valid45PlusInsuranceSocial += cats.valid45Plus
    })

    // حساب إحصائيات اشتراك قوى (5 فئات)
    let expiredPower = 0, urgent7Power = 0, urgent30Power = 0, medium45Power = 0, valid45PlusPower = 0
    companies.forEach(company => {
      const cats = calculateFiveCategories(company.ending_subscription_power_date, today)
      expiredPower += cats.expired
      urgent7Power += cats.urgent7
      urgent30Power += cats.urgent30
      medium45Power += cats.medium45
      valid45PlusPower += cats.valid45Plus
    })

    // حساب إحصائيات اشتراك مقيم (5 فئات)
    let expiredMoqeem = 0, urgent7Moqeem = 0, urgent30Moqeem = 0, medium45Moqeem = 0, valid45PlusMoqeem = 0
    companies.forEach(company => {
      const cats = calculateFiveCategories(company.ending_subscription_moqeem_date, today)
      expiredMoqeem += cats.expired
      urgent7Moqeem += cats.urgent7
      urgent30Moqeem += cats.urgent30
      medium45Moqeem += cats.medium45
      valid45PlusMoqeem += cats.valid45Plus
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
      urgent7Contracts,
      urgent30Contracts,
      medium45Contracts,
      valid45PlusContracts,
      // إحصائيات الإقامات (5 فئات)
      expiredResidences,
      urgent7Residences,
      urgent30Residences,
      medium45Residences,
      valid45PlusResidences,
      // إحصائيات التأمين الصحي (5 فئات)
      expiredInsurance,
      urgent7Insurance,
      urgent30Insurance,
      medium45Insurance,
      valid45PlusInsurance,
      // إحصائيات عقد أجير (5 فئات)
      expiredHiredWorkerContracts,
      urgent7HiredWorkerContracts,
      urgent30HiredWorkerContracts,
      medium45HiredWorkerContracts,
      valid45PlusHiredWorkerContracts,
      // إحصائيات السجل التجاري (5 فئات)
      expiredCommercialReg,
      urgent7CommercialReg,
      urgent30CommercialReg,
      medium45CommercialReg,
      valid45PlusCommercialReg,
      // إحصائيات التأمينات الاجتماعية (5 فئات)
      expiredInsuranceSocial,
      urgent7InsuranceSocial,
      urgent30InsuranceSocial,
      medium45InsuranceSocial,
      valid45PlusInsuranceSocial,
      // إحصائيات اشتراك قوى (5 فئات)
      expiredPower,
      urgent7Power,
      urgent30Power,
      medium45Power,
      valid45PlusPower,
      // إحصائيات اشتراك مقيم (5 فئات)
      expiredMoqeem,
      urgent7Moqeem,
      urgent30Moqeem,
      medium45Moqeem,
      valid45PlusMoqeem
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
      
      // إعادة تحميل الإحصائيات لتحديث العدد في شريط التنقل
      window.dispatchEvent(new CustomEvent('alertMarkedAsRead', { detail: { alertId } }))
    } catch (error) {
      console.error('خطأ في حفظ التنبيه كمقروء:', error)
    }
  }

  // Memoize filtered alerts to avoid recalculation
  const unreadCompanyAlerts = useMemo(() => 
    companyAlerts.filter(alert => !readAlerts.has(alert.id)),
    [companyAlerts, readAlerts]
  )
  
  const unreadEmployeeAlerts = useMemo(() => 
    employeeAlerts.filter(alert => !readAlerts.has(alert.id)),
    [employeeAlerts, readAlerts]
  )

  // Memoize alert statistics to avoid recalculation
  const companyAlertsStats = useMemo(() => getAlertsStats(unreadCompanyAlerts), [unreadCompanyAlerts])
  const companyUrgentAlerts = useMemo(() => getUrgentAlerts(unreadCompanyAlerts), [unreadCompanyAlerts])
  const commercialRegAlerts = useMemo(() => 
    filterAlertsByType(unreadCompanyAlerts, 'commercial_registration'),
    [unreadCompanyAlerts]
  )
  const insuranceAlerts = useMemo(() => 
    filterAlertsByType(unreadCompanyAlerts, 'social_insurance_expiry'),
    [unreadCompanyAlerts]
  )
  
  // Memoize detailed company statistics
  const commercialRegExpired = useMemo(() => 
    commercialRegAlerts.filter(a => a.days_remaining !== undefined && a.days_remaining < 0).length,
    [commercialRegAlerts]
  )
  const commercialRegUrgent = useMemo(() => 
    commercialRegAlerts.filter(a => a.priority === 'urgent').length,
    [commercialRegAlerts]
  )
  const insuranceExpired = useMemo(() => 
    insuranceAlerts.filter(a => a.days_remaining !== undefined && a.days_remaining < 0).length,
    [insuranceAlerts]
  )
  const insuranceUrgent = useMemo(() => 
    insuranceAlerts.filter(a => a.priority === 'urgent').length,
    [insuranceAlerts]
  )

  // Memoize employee alert statistics
  const employeeAlertsStats = useMemo(() => 
    getEmployeeAlertsStats(unreadEmployeeAlerts),
    [unreadEmployeeAlerts]
  )
  const employeeUrgentAlerts = useMemo(() => 
    getUrgentEmployeeAlerts(unreadEmployeeAlerts),
    [unreadEmployeeAlerts]
  )
  const contractAlerts = useMemo(() => 
    filterEmployeeAlertsByType(unreadEmployeeAlerts, 'contract_expiry'),
    [unreadEmployeeAlerts]
  )
  const residenceAlerts = useMemo(() => 
    filterEmployeeAlertsByType(unreadEmployeeAlerts, 'residence_expiry'),
    [unreadEmployeeAlerts]
  )

  // Memoize total alerts
  const totalAlerts = useMemo(() => 
    companyAlertsStats.total + employeeAlertsStats.total,
    [companyAlertsStats.total, employeeAlertsStats.total]
  )
  const totalUrgentAlerts = useMemo(() => 
    companyAlertsStats.urgent + employeeAlertsStats.urgent,
    [companyAlertsStats.urgent, employeeAlertsStats.urgent]
  )

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

  return (
    <Layout>
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
                            <p className="text-lg font-bold text-red-600">{stats.urgent7CommercialReg}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 7 أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.urgent30CommercialReg}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 30 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.medium45CommercialReg}</p>
                            <p className="text-xs text-gray-500 mt-0.5">45 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.valid45PlusCommercialReg}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من 45 يوم</p>
                          </div>
                        </div>
                      </div>

                      {/* إحصائيات التأمينات */}
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-200">
                        <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-indigo-600" />
                          إحصائيات التأمينات الاجتماعية
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-1.5">
                          <div className="bg-white rounded-lg p-2.5 border border-indigo-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">منتهية</span>
                              <XCircle className="w-3 h-3 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.expiredInsuranceSocial}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-indigo-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">طارئة</span>
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            </div>
                            <p className="text-lg font-bold text-red-600">{stats.urgent7InsuranceSocial}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 7 أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-indigo-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.urgent30InsuranceSocial}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 30 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-indigo-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.medium45InsuranceSocial}</p>
                            <p className="text-xs text-gray-500 mt-0.5">45 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-indigo-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.valid45PlusInsuranceSocial}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من 45 يوم</p>
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
                            <p className="text-lg font-bold text-red-600">{stats.urgent7Power}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 7 أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-cyan-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.urgent30Power}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 30 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-cyan-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.medium45Power}</p>
                            <p className="text-xs text-gray-500 mt-0.5">45 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-cyan-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.valid45PlusPower}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من 45 يوم</p>
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
                            <p className="text-lg font-bold text-red-600">{stats.urgent7Moqeem}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 7 أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-teal-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.urgent30Moqeem}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 30 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-teal-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.medium45Moqeem}</p>
                            <p className="text-xs text-gray-500 mt-0.5">45 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-teal-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.valid45PlusMoqeem}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من 45 يوم</p>
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
                            <p className="text-lg font-bold text-red-600">{stats.urgent7Contracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 7 أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.urgent30Contracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 30 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.medium45Contracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">45 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.valid45PlusContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من 45 يوم</p>
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
                            <p className="text-lg font-bold text-red-600">{stats.urgent7Residences}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 7 أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.urgent30Residences}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 30 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.medium45Residences}</p>
                            <p className="text-xs text-gray-500 mt-0.5">45 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.valid45PlusResidences}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من 45 يوم</p>
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
                            <p className="text-lg font-bold text-red-600">{stats.urgent7Insurance}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 7 أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.urgent30Insurance}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 30 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.medium45Insurance}</p>
                            <p className="text-xs text-gray-500 mt-0.5">45 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-green-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.valid45PlusInsurance}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من 45 يوم</p>
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
                            <p className="text-lg font-bold text-red-600">{stats.urgent7HiredWorkerContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 7 أيام</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">عاجل</span>
                              <Clock className="w-3 h-3 text-orange-500" />
                            </div>
                            <p className="text-lg font-bold text-orange-600">{stats.urgent30HiredWorkerContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">خلال 30 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">متوسط</span>
                              <Calendar className="w-3 h-3 text-yellow-500" />
                            </div>
                            <p className="text-lg font-bold text-yellow-600">{stats.medium45HiredWorkerContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">45 يوم</p>
                          </div>
                          <div className="bg-white rounded-lg p-2.5 border border-amber-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">ساري</span>
                              <Shield className="w-3 h-3 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-green-600">{stats.valid45PlusHiredWorkerContracts}</p>
                            <p className="text-xs text-gray-500 mt-0.5">أكثر من 45 يوم</p>
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


            {/* قسم التنبيهات */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-red-100 rounded-lg">
                    <Bell className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">تنبيهات النظام</h2>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {totalAlerts > 0 ? `${totalAlerts} تنبيه - ${totalUrgentAlerts} عاجل` : 'لا توجد تنبيهات حالياً'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {companyAlertsStats.total} مؤسسة | {employeeAlertsStats.total} موظف
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {showAlerts ? 'إخفاء التنبيهات' : 'عرض التنبيهات'}
                </button>
              </div>

              {/* إحصائيات التنبيهات */}
              {totalAlerts > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-1.5 mb-2">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                    <div className="text-base font-bold text-gray-900">{totalAlerts}</div>
                    <div className="text-xs text-gray-600">إجمالي التنبيهات</div>
                  </div>
                  <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-2">
                    <div className="text-base font-bold text-red-600">{totalUrgentAlerts}</div>
                    <div className="text-xs text-red-700">عاجل</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-2">
                    <div className="text-base font-bold text-yellow-600">{companyAlertsStats.medium + employeeAlertsStats.medium}</div>
                    <div className="text-xs text-yellow-700">متوسط</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-2">
                    <div className="text-base font-bold text-blue-600">{companyAlertsStats.total}</div>
                    <div className="text-xs text-blue-700">مؤسسات</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg shadow-sm border border-purple-200 p-2">
                    <div className="text-base font-bold text-purple-600">{employeeAlertsStats.total}</div>
                    <div className="text-xs text-purple-700">موظفين</div>
                  </div>
                  <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-2">
                    <div className="text-base font-bold text-green-600">{commercialRegAlerts.length}</div>
                    <div className="text-xs text-green-700">سجل تجاري</div>
                  </div>
                </div>
              )}

              {/* عرض التنبيهات */}
              {showAlerts && (
                <div className="space-y-3">
                  {totalAlerts === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <h3 className="text-xs font-medium text-gray-900 mb-1">لا توجد تنبيهات</h3>
                      <p className="text-xs text-gray-600">
                        جميع مؤسساتك وموظفيك محدثون ولا يحتاجون إلى إجراءات فورية
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* التنبيهات العاجلة للمؤسسات */}
                      {companyUrgentAlerts.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-red-900 mb-1.5 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            تنبيهات عاجلة للمؤسسات ({companyUrgentAlerts.length})
                          </h3>
                          <div className="space-y-1.5">
                            {companyUrgentAlerts.slice(0, 2).map((alert) => (
                              <AlertCard
                                key={alert.id}
                                alert={alert}
                                onViewCompany={handleViewCompany}
                                onShowCompanyCard={handleViewCompany}
                                onMarkAsRead={handleMarkAsRead}
                                isRead={readAlerts.has(alert.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* التنبيهات العاجلة للموظفين */}
                      {employeeUrgentAlerts.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-orange-900 mb-1.5 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            تنبيهات عاجلة للموظفين ({employeeUrgentAlerts.length})
                          </h3>
                          <div className="space-y-1.5">
                            {employeeUrgentAlerts.slice(0, 2).map((alert) => (
                              <div key={alert.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                                {/* سيتم استبدال هذا بـ EmployeeAlertCard لاحقاً */}
                                <div className="flex items-center gap-2">
                                  <div className="p-1 rounded-lg bg-orange-100 text-orange-600">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-xs text-orange-900">{alert.title}</h4>
                                    <p className="text-xs text-gray-600">{alert.employee.name} - {alert.employee.profession}</p>
                                    <p className="text-xs text-gray-500">{alert.company.name}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ملخص التنبيهات حسب النوع */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                        {commercialRegAlerts.length > 0 && (
                          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-600" />
                              <h4 className="font-semibold text-xs text-gray-900">السجل التجاري</h4>
                            </div>
                            <p className="text-xs text-gray-600">
                              {commercialRegAlerts.length} مؤسسة تحتاج إلى تجديد السجل التجاري
                            </p>
                          </div>
                        )}

                        {insuranceAlerts.length > 0 && (
                          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-green-600" />
                              <h4 className="font-semibold text-xs text-gray-900">اشتراك التأمينات الاجتماعية</h4>
                            </div>
                            <p className="text-xs text-gray-600">
                              {insuranceAlerts.length} مؤسسة تحتاج إلى تجديد اشتراك التأمينات الاجتماعية
                            </p>
                          </div>
                        )}

                        {contractAlerts.length > 0 && (
                          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />
                              <h4 className="font-semibold text-xs text-gray-900">عقود الموظفين</h4>
                            </div>
                            <p className="text-xs text-gray-600">
                              {contractAlerts.length} موظف يحتاج إلى تجديد العقد
                            </p>
                          </div>
                        )}

                        {residenceAlerts.length > 0 && (
                          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              <h4 className="font-semibold text-xs text-gray-900">إقامات الموظفين</h4>
                            </div>
                            <p className="text-xs text-gray-600">
                              {residenceAlerts.length} موظف يحتاج إلى تجديد الإقامة
                            </p>
                          </div>
                        )}
                      </div>

                      {/* أزرار عرض المزيد */}
                      {(companyAlerts.length > companyUrgentAlerts.length || employeeAlerts.length > employeeUrgentAlerts.length) && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {companyAlerts.length > companyUrgentAlerts.length && (
                            <button
                              onClick={() => navigate('/companies?tab=alerts')}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center justify-center gap-1 p-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                            >
                              عرض جميع تنبيهات المؤسسات ({companyAlertsStats.total})
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {employeeAlerts.length > employeeUrgentAlerts.length && (
                            <button
                              onClick={() => navigate('/employees?tab=alerts')}
                              className="text-purple-600 hover:text-purple-800 text-xs font-medium flex items-center justify-center gap-1 p-2 border border-purple-200 rounded-lg hover:bg-purple-50 transition"
                            >
                              عرض جميع تنبيهات الموظفين ({employeeAlertsStats.total})
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </Layout>
  )
}