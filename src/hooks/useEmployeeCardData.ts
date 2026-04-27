import { useState, useEffect } from 'react'
import { supabase, Company, Project } from '@/lib/supabase'
import { logger } from '@/utils/logger'

interface UseEmployeeCardDataResult {
  companies: Company[]
  projects: Project[]
  isLoading: boolean
}

export function useEmployeeCardData(): UseEmployeeCardDataResult {
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([loadCompanies(), loadProjects()])
      } finally {
        setIsLoading(false)
      }
    }
    void loadData()
  }, [])

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(
          'id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_expiry,ending_subscription_power_date,ending_subscription_moqeem_date,ending_subscription_insurance_date,commercial_registration_status,social_insurance_status,current_employees,max_employees,additional_fields,created_at,updated_at,notes,exemptions,social_insurance_number,company_type,employee_count'
        )
        .order('name')

      if (error) throw error
      setCompanies(data || [])
    } catch (error) {
      logger.error('Error loading companies:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id,name,description,status,created_at,updated_at')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      logger.error('Error loading projects:', error)
    }
  }

  return {
    companies,
    projects,
    isLoading,
  }
}
