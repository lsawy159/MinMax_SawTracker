import { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'

interface PermissionGuardProps {
  children: ReactNode
  permissions: string[]
  mode?: 'all' | 'any'
  fallback?: ReactNode
  showMessage?: boolean
}

export default function PermissionGuard({
  children,
  permissions,
  mode = 'all',
  fallback,
  showMessage = true,
}: PermissionGuardProps) {
  const { checkPermissions, hasAnyPermission } = usePermissions()

  const hasAccess = mode === 'all' ? checkPermissions(permissions) : hasAnyPermission(permissions)

  if (hasAccess) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (!showMessage) {
    return null
  }

  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center">
      <div>
        <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-danger-500" />
        <h2 className="mb-2 text-xl font-bold text-slate-900">غير مصرح</h2>
        <p className="text-sm text-slate-600">عذرًا، ليس لديك الصلاحيات المطلوبة لعرض هذا القسم.</p>
      </div>
    </div>
  )
}
