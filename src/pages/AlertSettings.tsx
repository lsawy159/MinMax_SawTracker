import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import UnifiedSettings from '@/components/settings/UnifiedSettings'
import { Settings } from 'lucide-react'
import { useEffect } from 'react'
import { usePermissions } from '@/utils/permissions'

export default function AlertSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { canView, canEdit } = usePermissions()

  useEffect(() => {
    // التحقق من صلاحيات المستخدم
    if (!user) {
      navigate('/login')
      return
    }

    // السماح فقط للمستخدمين الذين يملكون صلاحية العرض
    if (!canView('centralizedSettings')) {
      navigate('/dashboard')
    }
  }, [user, navigate, canView])

  if (!canView('centralizedSettings')) {
    return null
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
