import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, Employee } from '@/lib/supabase'
import { logger } from '@/utils/logger'

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, company:companies(*), project:projects(*)')
        .order('created_at', { ascending: false })
      
      if (error) {
        logger.error('Error fetching employees:', error)
        throw error
      }
      return data as Employee[]
    },
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (employee: Partial<Employee>) => {
      const { data, error } = await supabase
        .from('employees')
        .insert([employee])
        .select()
        .single()
      
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
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id)
      
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

