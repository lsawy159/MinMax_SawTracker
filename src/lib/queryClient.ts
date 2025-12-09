import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 دقائق
      gcTime: 10 * 60 * 1000, // 10 دقائق (كان cacheTime في الإصدارات القديمة)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

