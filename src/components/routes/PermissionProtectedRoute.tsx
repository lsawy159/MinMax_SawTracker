import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { PermissionMatrix } from '@/utils/permissions'
import { Shield } from 'lucide-react'
import Layout from '@/components/layout/Layout'
import PermissionGuard from '@/components/PermissionGuard'

interface PermissionProtectedRouteProps {
  children: ReactNode
  section: keyof PermissionMatrix
  action: string
  redirectTo?: string
  showMessage?: boolean
}

/**
 * Component لحماية Routes بناءً على الصلاحيات
 * يتحقق من صلاحية المستخدم قبل عرض الصفحة
 */
export default function PermissionProtectedRoute({
  children,
  section,
  action,
  redirectTo = '/dashboard',
  showMessage = true,
}: PermissionProtectedRouteProps) {
  const permissionKey = `${section}.${action}`

  if (!showMessage) {
    return (
      <PermissionGuard
        permissions={[permissionKey]}
        showMessage={false}
        fallback={<Navigate to={redirectTo} replace />}
      >
        {children}
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard
      permissions={[permissionKey]}
      fallback={
        <Layout>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-danger-500" />
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">غير مصرح</h2>
              <p className="text-neutral-600">
                عذراً، ليس لديك صلاحية{' '}
                {action === 'view'
                  ? 'لعرض'
                  : action === 'create'
                    ? 'لإنشاء'
                    : action === 'edit'
                      ? 'لتعديل'
                      : 'لحذف'}{' '}
                هذا القسم.
              </p>
              <button onClick={() => window.history.back()} className="app-button-primary mt-4">
                العودة
              </button>
            </div>
          </div>
        </Layout>
      }
    >
      {children}
    </PermissionGuard>
  )
}
