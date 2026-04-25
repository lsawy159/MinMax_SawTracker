import { useQuery } from '@tanstack/react-query'
import { Project, supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching projects:', error)
        throw error
      }

      return data as Project[]
    },
  })
}