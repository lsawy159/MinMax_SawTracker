import { cn } from '@/lib/utils'
import { LoadingSpinnerProps } from '@/types'

/**
 * Unified Loading Spinner Component
 * Replaces 5 different inline spinner implementations across the app
 * Ensures consistent brand color (primary) and sizing
 */
export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  }

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-b-2 border-primary',
        sizeClasses[size],
        className
      )}
      aria-label="جاري التحميل"
    />
  )
}

/**
 * Page-level Loading Component
 * Used when entire page is loading
 */
export function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <LoadingSpinner size="lg" />
    </div>
  )
}

/**
 * Inline Loading Component
 * Used for smaller sections or lists
 */
export function InlineLoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner size="md" />
    </div>
  )
}
