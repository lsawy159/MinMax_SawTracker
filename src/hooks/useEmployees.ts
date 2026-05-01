import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, Employee, Company, Project } from '@/lib/supabase'
import { logger } from '@/utils/logger'

interface PaginationOptions {
  page?: number
  size?: number
}

export function useEmployees(options?: PaginationOptions) {
  const page = options?.page || 0
  const size = options?.size || 50

  return useQuery({
    queryKey: ['employees', page, size],
    queryFn: async () => {
      const from = page * size
      const to = from + size - 1

      const { data, error } = await supabase
        .from('employees')
        .select(
          'id,company_id,name,profession,nationality,birth_date,phone,passport_number,residence_number,joining_date,contract_expiry,hired_worker_contract_expiry,residence_expiry,project_id,project_name,bank_account,residence_image_url,health_insurance_expiry,salary,notes,additional_fields,is_deleted,deleted_at,created_at,updated_at, company:companies(id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_number,commercial_registration_status,additional_fields,ending_subscription_power_date,ending_subscription_moqeem_date,employee_count,max_employees,notes,exemptions,company_type,created_at,updated_at), project:projects(id,name,description,status,created_at,updated_at)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        logger.error('Error fetching employees:', error)
        throw error
      }
      return data as unknown as (Employee & { company: Company; project?: Project })[]
    },
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (employee: Partial<Employee>) => {
      const { data, error } = await supabase.from('employees').insert([employee]).select().single()

      if (error) {
        logger.error('Error creating employee:', error)
        throw error
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Employee> & { id: string }) => {
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        logger.error('Error updating employee:', error)
        throw error
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)

      if (error) {
        logger.error('Error deleting employee:', error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}
