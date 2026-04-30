import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { enrichEmployeeAlertsWithCompanyData } from '../utils/employeeAlerts'
import { alertCache } from '../utils/alertCache'

export interface AlertsStats {
  total: number
  urgent: number
  companyAlerts: number
  companyUrgent: number
  employeeAlerts: number
  employeeUrgent: number
  commercialRegAlerts: number
  contractAlerts: number
  residenceAlerts: number
}

async function fetchAlertsStatsQuery(): Promise<AlertsStats> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return {
        total: 0,
        urgent: 0,
        companyAlerts: 0,
        companyUrgent: 0,
        employeeAlerts: 0,
        employeeUrgent: 0,
        commercialRegAlerts: 0,
        contractAlerts: 0,
        residenceAlerts: 0,
      }
    }

    const { data: readAlertsData, error: readError } = await supabase
      .from('read_alerts')
      .select('alert_id')
      .eq('user_id', user.id)

    if (readError) throw readError
    const readAlertsSet = new Set(readAlertsData?.map((r) => r.alert_id) || [])

    const [companiesResult, employeesResult] = await Promise.all([
      supabase.from('companies').select(
        'id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_expiry,ending_subscription_power_date,ending_subscription_moqeem_date,ending_subscription_insurance_date,commercial_registration_status,social_insurance_status,current_employees,max_employees,additional_fields,created_at,updated_at,notes,exemptions,social_insurance_number,company_type,employee_count'
      ),
      supabase.from('employees').select(
        'id,company_id,name,profession,nationality,birth_date,phone,passport_number,residence_number,joining_date,contract_expiry,residence_expiry,project_name,bank_account,residence_image_url,salary,health_insurance_expiry,additional_fields,created_at,updated_at,notes,hired_worker_contract_expiry,project_id,is_deleted,deleted_at'
      ),
    ])

    if (companiesResult.error) throw companiesResult.error
    if (employeesResult.error) throw employeesResult.error

    const companies = companiesResult.data || []
    const employees = employeesResult.data || []

    const companyAlerts = await alertCache.getCompanyAlerts(companies)
    const employeeAlertsGenerated = await alertCache.getEmployeeAlerts(employees, companies)
    const employeeAlerts = enrichEmployeeAlertsWithCompanyData(employeeAlertsGenerated, companies)

    const unreadCompanyAlerts = companyAlerts.filter(
      (alert) =>
        !readAlertsSet.has(alert.id) && (alert.priority === 'urgent' || alert.priority === 'high')
    )
    const unreadEmployeeAlerts = employeeAlerts.filter(
      (alert) =>
        !readAlertsSet.has(alert.id) && (alert.priority === 'urgent' || alert.priority === 'high')
    )

    const companyProblemAlerts = companyAlerts.filter(
      (alert) => alert.priority === 'urgent' || alert.priority === 'high'
    ).length
    const companyProblemUrgent = companyAlerts.filter(
      (alert) =>
        (alert.priority === 'urgent' || alert.priority === 'high') &&
        (alert.type === 'commercial_registration_expiry' ||
          alert.type === 'power_subscription_expiry' ||
          alert.type === 'moqeem_subscription_expiry')
    ).length

    const employeeProblemAlerts = employeeAlerts.filter(
      (alert) => alert.priority === 'urgent' || alert.priority === 'high'
    ).length
    const employeeProblemUrgent = employeeAlerts.filter(
      (alert) =>
        (alert.priority === 'urgent' || alert.priority === 'high') &&
        (alert.type === 'contract_expiry' ||
          alert.type === 'residence_expiry' ||
          alert.type === 'health_insurance_expiry' ||
          alert.type === 'hired_worker_contract_expiry')
    ).length

    return {
      total: unreadCompanyAlerts.length + unreadEmployeeAlerts.length,
      urgent: unreadCompanyAlerts.filter(
        (a) => a.priority === 'urgent' || a.priority === 'high'
      ).length + unreadEmployeeAlerts.filter((a) => a.priority === 'urgent' || a.priority === 'high').length,
      companyAlerts: companyProblemAlerts,
      companyUrgent: companyProblemUrgent,
      employeeAlerts: employeeProblemAlerts,
      employeeUrgent: employeeProblemUrgent,
      commercialRegAlerts: companyAlerts.filter(
        (alert) => alert.type === 'commercial_registration_expiry'
      ).length,
      contractAlerts: employeeAlerts.filter((alert) => alert.type === 'contract_expiry').length,
      residenceAlerts: employeeAlerts.filter((alert) => alert.type === 'residence_expiry').length,
    }
  } catch (error) {
    console.error('خطأ في جلب إحصائيات التنبيهات:', error)
    throw error
  }
}

export function useAlertsStats() {
  const queryClient = useQueryClient()
  const { data: alertsStats = {
    total: 0,
    urgent: 0,
    companyAlerts: 0,
    companyUrgent: 0,
    employeeAlerts: 0,
    employeeUrgent: 0,
    commercialRegAlerts: 0,
    contractAlerts: 0,
    residenceAlerts: 0,
  }, isLoading: loading } = useQuery<AlertsStats>({
    queryKey: ['alerts-stats'],
    queryFn: fetchAlertsStatsQuery,
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 2,
  })

  const refreshStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['alerts-stats'] })
  }, [queryClient])

  const markAlertAsRead = useCallback(
    async (alertId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('read_alerts')
        .insert({
          user_id: user.id,
          alert_id: alertId,
        })
        .select()

      refreshStats()
    },
    [refreshStats]
  )

  return {
    alertsStats,
    loading,
    refreshStats,
    markAlertAsRead,
  }
}
