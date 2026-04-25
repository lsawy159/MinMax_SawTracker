import React from 'react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton'
  count?: number
  className?: string
}

export function LoadingState({ variant = 'spinner', count = 1, className }: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="h-4 w-2/3 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="space-y-2">
              <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-3 w-5/6 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-400" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          جاري التحميل...
        </p>
      </div>
    </div>
  )
}
