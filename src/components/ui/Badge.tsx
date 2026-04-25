/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'touch-feedback inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-[transform,background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--easing-standard)] focus:outline-none',
  {
    variants: {
      variant: {
        default:
          'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300',
        neutral:
          'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
        success:
          'border-success-500/20 bg-success-50 text-success-700 dark:border-success-700/30 dark:bg-success-900/20 dark:text-success-300',
        warning:
          'border-warning-500/20 bg-warning-50 text-warning-700 dark:border-warning-700/30 dark:bg-warning-900/20 dark:text-warning-300',
        danger:
          'border-danger-500/20 bg-danger-50 text-danger-700 dark:border-danger-700/30 dark:bg-danger-900/20 dark:text-danger-300',
        info: 'border-info-500/20 bg-info-50 text-info-700 dark:border-info-700/30 dark:bg-info-900/20 dark:text-info-300',
        outline:
          'border-neutral-300 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
