import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import UnifiedSettings from '@/components/settings/UnifiedSettings'
import { Settings } from 'lucide-react'
import { useEffect } from 'react'

export default function CentralizedSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // التحقق من صلاحيات المستخدم
    if (!user) {
      navigate('/login')
      return
    }

    // السماح للمديرين فقط
    if (user.role !== 'admin') {
      navigate('/dashboard')
    }
  }, [user, navigate])

  if (user?.role !== 'admin') {
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
              <h1 className="text-3xl font-bold text-gray-900">الإعدادات المركزية الموحدة</h1>
              <p className="text-gray-600 mt-1">إدارة جميع إعدادات النظام: الحالات، التنبيهات، والألوان</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <UnifiedSettings />
      </div>
    </Layout>
  )
}
