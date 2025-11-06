import { useState, useEffect } from 'react'
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

  useEffect(() => {
    fetchAlertsStats()
  }, [])

  const fetchAlertsStats = async () => {
    try {
      setLoading(true)

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

      // حساب الإحصائيات
      const companyUrgentAlerts = companyAlerts.filter(alert => alert.priority === 'urgent').length
      const employeeUrgentAlerts = employeeAlerts.filter(alert => alert.priority === 'urgent').length
      const commercialRegAlerts = companyAlerts.filter(alert => alert.type === 'commercial_registration').length
      const insuranceAlerts = companyAlerts.filter(alert => alert.type === 'insurance_subscription').length
      const contractAlerts = employeeAlerts.filter(alert => alert.type === 'contract_expiry').length
      const residenceAlerts = employeeAlerts.filter(alert => alert.type === 'residence_expiry').length

      const stats: AlertsStats = {
        total: companyAlerts.length + employeeAlerts.length,
        urgent: companyUrgentAlerts + employeeUrgentAlerts,
        companyAlerts: companyAlerts.length,
        companyUrgent: companyUrgentAlerts,
        employeeAlerts: employeeAlerts.length,
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

  const refreshStats = () => {
    fetchAlertsStats()
  }

  return {
    alertsStats,
    loading,
    refreshStats
  }
}