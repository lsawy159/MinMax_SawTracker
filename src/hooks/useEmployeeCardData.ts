import { useState, useEffect } from 'react'
import { supabase, CustomField, Company, Project } from '@/lib/supabase'
import { logger } from '@/utils/logger'

interface UseEmployeeCardDataResult {
  customFields: CustomField[]
  companies: Company[]
  projects: Project[]
  isLoading: boolean
}

export function useEmployeeCardData(): UseEmployeeCardDataResult {
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([loadCustomFields(), loadCompanies(), loadProjects()])
      } finally {
        setIsLoading(false)
      }
    }
    void loadData()
  }, [])

  const loadCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('id,entity_type,field_name,field_label,field_type,field_options,is_required,is_active,display_order,created_at,updated_at')
        .eq('entity_type', 'employee')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setCustomFields(data || [])
    } catch (error) {
      logger.error('Error loading custom fields:', error)
    }
  }

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_expiry,ending_subscription_power_date,ending_subscription_moqeem_date,ending_subscription_insurance_date,commercial_registration_status,social_insurance_status,current_employees,max_employees,additional_fields,created_at,updated_at,notes,exemptions,social_insurance_number,company_type,employee_count')
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
    customFields,
    companies,
    projects,
    isLoading,
  }
}
