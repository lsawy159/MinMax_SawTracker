import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import UnifiedSettings from '@/components/settings/UnifiedSettings'
import { Settings, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePermissions } from '@/utils/permissions'

export default function AlertSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { canView, canEdit } = usePermissions()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (!user) {
        navigate('/login')
        return
      }

      if (!canView('centralizedSettings')) {
        navigate('/dashboard')
        return
      }

      setIsLoading(false)
    } catch (err) {
      console.error('AlertSettings error:', err)
      setError('حدث خطأ أثناء تحميل الصفحة')
      setIsLoading(false)
    }
  }, [user, canView, navigate])

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-14 h-14 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">خطأ</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (isLoading || !user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">جاري التحميل...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!canView('centralizedSettings')) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-14 h-14 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">إعدادات التنبيهات</h1>
              <p className="text-gray-600 mt-1">إدارة جميع إعدادات التنبيهات: الحالات، الحدود، والألوان</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <UnifiedSettings isReadOnly={!canEdit('centralizedSettings')} />
      </div>
    </Layout>
  )
}
