import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePermissions, PermissionMatrix } from '@/utils/permissions'
import { Shield } from 'lucide-react'
import Layout from '@/components/layout/Layout'

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
  showMessage = true
}: PermissionProtectedRouteProps) {
  const { hasPermission } = usePermissions()

  // التحقق من الصلاحية
  const hasAccess = hasPermission(section, action)

  // إذا لم يكن لديه الصلاحية
  if (!hasAccess) {
    // إذا كان showMessage = true، عرض رسالة "غير مصرح"
    if (showMessage) {
      return (
        <Layout>
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
              <p className="text-gray-600">
                عذراً، ليس لديك صلاحية {action === 'view' ? 'لعرض' : action === 'create' ? 'لإنشاء' : action === 'edit' ? 'لتعديل' : 'لحذف'} هذا القسم.
              </p>
              <button
                onClick={() => window.history.back()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                العودة
              </button>
            </div>
          </div>
        </Layout>
      )
    }

    // إذا كان showMessage = false، إعادة توجيه
    return <Navigate to={redirectTo} replace />
  }

  // إذا كان لديه الصلاحية، عرض المحتوى
  return <>{children}</>
}

