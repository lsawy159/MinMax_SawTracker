import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { generateCompanyAlertsSync } from '../utils/alerts'
import { generateEmployeeAlerts, enrichEmployeeAlertsWithCompanyData } from '../utils/employeeAlerts'

export interface AlertsStats {
  total: number
  urgent: number
  companyAlerts: number
  companyUrgent: number
  employeeAlerts: number
  employeeUrgent: number
  commercialRegAlerts: number
  insuranceAlerts: number
  contractAlerts: number
  residenceAlerts: number
}

export function useAlertsStats() {
  const [alertsStats, setAlertsStats] = useState<AlertsStats>({
    total: 0,
    urgent: 0,
    companyAlerts: 0,
    companyUrgent: 0,
    employeeAlerts: 0,
    employeeUrgent: 0,
    commercialRegAlerts: 0,
    insuranceAlerts: 0,
    contractAlerts: 0,
    residenceAlerts: 0
  })
  const [loading, setLoading] = useState(true)
  const [, setReadAlerts] = useState<Set<string>>(new Set())

  // [MODIFIED] أعدنا دالة جلب المقروء
  const loadReadAlerts = useCallback(async () => {
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
      return readAlertIds
    } catch (error) {
      console.error('خطأ في جلب التنبيهات المقروءة:', error)
      return new Set<string>()
    }
  }, [])

  // [MODIFIED] تم تعديل الدالة الرئيسية لتطبيق المنطق المزدوج
  const fetchAlertsStats = useCallback(async () => {
    try {
      setLoading(true)

      // جلب التنبيهات المقروءة أولاً
      const readAlertsSet = await loadReadAlerts()

      // جلب البيانات من قاعدة البيانات
      const [companiesResult, employeesResult] = await Promise.all([
        supabase.from('companies').select('*'),
        supabase.from('employees').select('*')
      ])

      if (companiesResult.error) throw companiesResult.error
      if (employeesResult.error) throw employeesResult.error

      const companies = companiesResult.data || []
      const employees = employeesResult.data || []

      // --- الخطوة 1: توليد القوائم الكاملة (لشارات "المؤسسات" و "الموظفين") ---
      const companyAlerts = await generateCompanyAlertsSync(companies)
      const employeeAlertsGenerated = await generateEmployeeAlerts(employees, companies)
      const employeeAlerts = enrichEmployeeAlertsWithCompanyData(employeeAlertsGenerated, companies)

      // --- الخطوة 2: توليد القوائم "غير المقروءة" (لشارة "التنبيهات") - فقط urgent و high ---
      const unreadCompanyAlerts = companyAlerts.filter(alert => 
        !readAlertsSet.has(alert.id) && (alert.priority === 'urgent' || alert.priority === 'high')
      )
      const unreadEmployeeAlerts = employeeAlerts.filter(alert => 
        !readAlertsSet.has(alert.id) && (alert.priority === 'urgent' || alert.priority === 'high')
      )

      // --- الخطوة 3: حساب الإحصائيات (المنطق المزدوج) ---

      // إحصائيات "المشاكل" (لشارات المؤسسات والموظفين - تتجاهل المقروء) - فقط urgent و high
      const companyProblemAlerts = companyAlerts.filter(alert => 
        alert.priority === 'urgent' || alert.priority === 'high'
      ).length
      // Badge المؤسسات: الحالات العاجلة والعالية (urgent/high) فقط للأنواع المحددة
      const companyProblemUrgent = companyAlerts.filter(alert => 
        (alert.priority === 'urgent' || alert.priority === 'high') && (
          alert.type === 'commercial_registration_expiry' ||
          alert.type === 'social_insurance_expiry' ||
          alert.type === 'power_subscription_expiry' ||
          alert.type === 'moqeem_subscription_expiry'
        )
      ).length
      
      const employeeProblemAlerts = employeeAlerts.filter(alert => 
        alert.priority === 'urgent' || alert.priority === 'high'
      ).length
      // Badge الموظفين: الحالات العاجلة والعالية (urgent/high) فقط للأنواع المحددة
      const employeeProblemUrgent = employeeAlerts.filter(alert => 
        (alert.priority === 'urgent' || alert.priority === 'high') && (
          alert.type === 'contract_expiry' ||
          alert.type === 'residence_expiry' ||
          alert.type === 'health_insurance_expiry' ||
          alert.type === 'hired_worker_contract_expiry'
        )
      ).length
      
  const commercialRegAlerts = companyAlerts.filter(alert => alert.type === 'commercial_registration_expiry').length
      const insuranceAlerts = companyAlerts.filter(alert => alert.type === 'social_insurance_expiry').length
      const contractAlerts = employeeAlerts.filter(alert => alert.type === 'contract_expiry').length
      const residenceAlerts = employeeAlerts.filter(alert => alert.type === 'residence_expiry').length

      // إحصائيات "غير المقروء" (لشارة التنبيهات الرئيسية - تعتمد على المقروء) - فقط urgent و high
      const totalUnread = unreadCompanyAlerts.length + unreadEmployeeAlerts.length
      const urgentUnread = unreadCompanyAlerts.filter(alert => 
        alert.priority === 'urgent' || alert.priority === 'high'
      ).length + unreadEmployeeAlerts.filter(alert => 
        alert.priority === 'urgent' || alert.priority === 'high'
      ).length

      const stats: AlertsStats = {
        // [MODIFIED] total و urgent أصبحت لـ "غير المقروء"
        total: totalUnread,
        urgent: urgentUnread,
        
        // [MODIFIED] companyAlerts و employeeAlerts أصبحت لـ "كل المشاكل"
        companyAlerts: companyProblemAlerts,
        companyUrgent: companyProblemUrgent,
        employeeAlerts: employeeProblemAlerts,
        employeeUrgent: employeeProblemUrgent,

        // هذه الإحصائيات التفصيلية يجب أن تعكس "كل المشاكل" أيضاً
        commercialRegAlerts: commercialRegAlerts,
        insuranceAlerts: insuranceAlerts,
        contractAlerts: contractAlerts,
        residenceAlerts: residenceAlerts
      }

      setAlertsStats(stats)
    } catch (error) {
      console.error('خطأ في جلب إحصائيات التنبيهات:', error)
    } finally {
      setLoading(false)
    }
  }, [loadReadAlerts]) // [MODIFIED] أعدنا الاعتمادية

  useEffect(() => {
    fetchAlertsStats()
    
    // [MODIFIED] أعدنا المستمع، ليقوم بتحديث شارة "التنبيهات"
    const handleAlertMarkedAsRead = () => {
      fetchAlertsStats()
    }
    
    // إضافة مستمعين لتحديثات الموظفين والمؤسسات
    const handleEmployeeUpdated = () => {
      fetchAlertsStats()
    }
    
    const handleCompanyUpdated = () => {
      fetchAlertsStats()
    }
    
    window.addEventListener('alertMarkedAsRead', handleAlertMarkedAsRead)
    window.addEventListener('employeeUpdated', handleEmployeeUpdated)
    window.addEventListener('companyUpdated', handleCompanyUpdated)
    
    return () => {
      window.removeEventListener('alertMarkedAsRead', handleAlertMarkedAsRead)
      window.removeEventListener('employeeUpdated', handleEmployeeUpdated)
      window.removeEventListener('companyUpdated', handleCompanyUpdated)
    }
  }, [fetchAlertsStats])

  const refreshStats = useCallback(() => {
    fetchAlertsStats()
  }, [fetchAlertsStats])

  // [MODIFIED] أعدنا هذه الدالة
  const markAlertAsRead = useCallback((alertId: string) => {
    setReadAlerts(prev => {
      const newSet = new Set(prev)
      newSet.add(alertId)
      return newSet
    })
    // إعادة حساب الإحصائيات بعد تحديث readAlerts
    setTimeout(() => {
      fetchAlertsStats()
    }, 100)
  }, [fetchAlertsStats])

  return {
    alertsStats,
    loading,
    refreshStats,
    markAlertAsRead // [MODIFIED] أعدنا إرجاعها
  }
}