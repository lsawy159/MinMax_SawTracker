import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  icon?: ReactNode
  title?: string
  message: string
  retry?: () => void
  className?: string
}

export function ErrorState({
  icon,
  title = 'حدث خطأ',
  message,
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-danger-200 bg-danger-50 px-6 py-12 text-center dark:border-danger-900/30 dark:bg-danger-950/20',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-100 text-danger-600 dark:bg-danger-900/40 dark:text-danger-400">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold text-danger-900 dark:text-danger-200">{title}</h3>
      <p className="mb-6 text-sm text-danger-700 dark:text-danger-300">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="inline-flex items-center justify-center rounded-md bg-danger-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-700 dark:bg-danger-700 dark:hover:bg-danger-600"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}
