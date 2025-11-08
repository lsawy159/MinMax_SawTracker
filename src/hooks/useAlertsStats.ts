import { useState, useEffect, useCallback } from 'react'
import { supabase, Company, Employee } from '../lib/supabase'
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
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set())

  // جلب التنبيهات المقروءة من قاعدة البيانات
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

  useEffect(() => {
    fetchAlertsStats()
    
    // الاستماع لحدث تحديث التنبيه كمقروء
    const handleAlertMarkedAsRead = () => {
      fetchAlertsStats()
    }
    
    window.addEventListener('alertMarkedAsRead', handleAlertMarkedAsRead)
    
    return () => {
      window.removeEventListener('alertMarkedAsRead', handleAlertMarkedAsRead)
    }
  }, [])

  const fetchAlertsStats = async () => {
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

      // توليد تنبيهات المؤسسات
      const companyAlerts = generateCompanyAlertsSync(companies)
      
      // توليد تنبيهات الموظفين
      const employeeAlertsGenerated = generateEmployeeAlerts(employees, companies)
      const employeeAlerts = enrichEmployeeAlertsWithCompanyData(employeeAlertsGenerated, companies)

      // تصفية التنبيهات المقروءة
      const unreadCompanyAlerts = companyAlerts.filter(alert => !readAlertsSet.has(alert.id))
      const unreadEmployeeAlerts = employeeAlerts.filter(alert => !readAlertsSet.has(alert.id))

      // حساب الإحصائيات (فقط غير المقروءة)
      const companyUrgentAlerts = unreadCompanyAlerts.filter(alert => alert.priority === 'urgent').length
      const employeeUrgentAlerts = unreadEmployeeAlerts.filter(alert => alert.priority === 'urgent').length
      const commercialRegAlerts = unreadCompanyAlerts.filter(alert => alert.type === 'commercial_registration').length
      const insuranceAlerts = unreadCompanyAlerts.filter(alert => alert.type === 'insurance_subscription').length
      const contractAlerts = unreadEmployeeAlerts.filter(alert => alert.type === 'contract_expiry').length
      const residenceAlerts = unreadEmployeeAlerts.filter(alert => alert.type === 'residence_expiry').length

      const stats: AlertsStats = {
        total: unreadCompanyAlerts.length + unreadEmployeeAlerts.length,
        urgent: companyUrgentAlerts + employeeUrgentAlerts,
        companyAlerts: unreadCompanyAlerts.length,
        companyUrgent: companyUrgentAlerts,
        employeeAlerts: unreadEmployeeAlerts.length,
        employeeUrgent: employeeUrgentAlerts,
        commercialRegAlerts,
        insuranceAlerts,
        contractAlerts,
        residenceAlerts
      }

      setAlertsStats(stats)
    } catch (error) {
      console.error('خطأ في جلب إحصائيات التنبيهات:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshStats = useCallback(() => {
    fetchAlertsStats()
  }, [])

  // دالة لتحديث التنبيه كمقروء محلياً
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
  }, [])

  return {
    alertsStats,
    loading,
    refreshStats,
    markAlertAsRead
  }
}