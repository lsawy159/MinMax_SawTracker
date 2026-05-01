// T-302: Dashboard statistics hook using dashboard_stats RPC
// Replaces useState pattern with React Query for efficient server state management

import { useQuery } from '@tanstack/react-query'
import { useSupabase } from '@/contexts/SupabaseContext'

interface DashboardStats {
  companies_count: number
  employees_count: number
  projects_count: number
  alerts: Record<string, number>
  recent_employees: Array<{
    id: string
    name: string
    email: string
    company_id: string
    position?: string
    status?: string
  }>
  timestamp: string
}

export function useDashboardStats() {
  const { supabase } = useSupabase()

  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_stats')

      if (error) {
        throw new Error(error.message || 'Failed to fetch dashboard stats')
      }

      return data
    },
    staleTime: 60 * 1000, // 60 seconds cache
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: 2,
  })
}
