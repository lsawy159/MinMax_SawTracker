import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import { Settings, Shield } from 'lucide-react'

export default function AdminSettings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard')
    }
  }, [user, navigate])

  if (user?.role !== 'admin') {
    return null
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="app-icon-chip p-3">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">إعدادات النظام</h1>
              <p className="mt-1 text-neutral-600">إدارة الإعدادات العامة</p>
            </div>
          </div>
        </div>

        <div className="app-panel p-6">
          <div className="py-12 text-center text-neutral-500">
            <Shield className="mx-auto mb-4 h-16 w-16 text-neutral-400" />
            <h3 className="mb-2 text-lg font-medium text-neutral-700">الإعدادات العامة</h3>
            <p className="text-sm">سيتم إضافة المزيد من الإعدادات قريباً</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
