import { cn } from '@/lib/utils'
import { StatusBadgeProps } from '@/types'

/**
 * Unified Status Badge Component
 * Replaces 20+ inline badge implementations across the app
 * Ensures consistent styling and semantic color coding
 */
export function StatusBadge({
  status,
  label,
  className
}: StatusBadgeProps) {
  const statusColors = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    expired: 'bg-gray-100 text-gray-600'
  }

  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        statusColors[status],
        className
      )}
    >
      {label}
    </span>
  )
}

/**
 * Role Badge (for user roles)
 * Specific styling for admin/manager/user roles
 */
export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    manager: 'bg-blue-100 text-blue-700',
    user: 'bg-gray-100 text-gray-700'
  }

  const label: Record<string, string> = {
    admin: 'مدير',
    manager: 'مسؤول',
    user: 'مستخدم'
  }

  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        roleColors[role] || roleColors.user,
        className
      )}
    >
      {label[role] || role}
    </span>
  )
}
