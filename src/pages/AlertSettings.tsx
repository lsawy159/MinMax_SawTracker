import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import UnifiedSettings from '@/components/settings/UnifiedSettings'
import { Settings, Shield, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePermissions } from '@/utils/permissions'

export default function AlertSettings() {
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [hasPermission, setHasPermission] = useState(false)
  const [canEditSettings, setCanEditSettings] = useState(false)
  const [isSendingDigest, setIsSendingDigest] = useState(false)
  const [digestMessage, setDigestMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // يجب استدعاء hooks دائماً في أعلى المكوّن - لا conditional
  const permissions = usePermissions()

  useEffect(() => {
    const checkAccess = async () => {
      try {
        if (!user) {
          navigate('/login')
          return
        }

        // تحقق بديل من الصلاحيات
        const canViewSettings = permissions?.canView('centralizedSettings') || user.role === 'admin'
        const canEditPerm = permissions?.canEdit('centralizedSettings') || user.role === 'admin'

        if (!canViewSettings) {
          navigate('/dashboard')
          return
        }

        setHasPermission(true)
        setCanEditSettings(canEditPerm)
        setIsLoading(false)
      } catch (err) {
        console.error('AlertSettings access check error:', err)
        // في حالة الخطأ، اسمح بالعرض للمدير على الأقل
        if (user?.role === 'admin') {
          setHasPermission(true)
          setCanEditSettings(true)
        }
        setIsLoading(false)
      }
    }
    checkAccess()
  }, [user, navigate, permissions])

  const handleSendDigestNow = async () => {
    try {
      setIsSendingDigest(true)
      setDigestMessage(null)

      // التحقق من وجود جلسة نشطة
      if (!session?.access_token) {
        setDigestMessage({
          type: 'error',
          text: 'تم انقطاع الجلسة. يرجى تحديث الصفحة وتسجيل الدخول مجدداً.'
        })
        setIsSendingDigest(false)
        return
      }

      const response = await fetch(
        'https://vpxazxzekkkepfjchjly.supabase.co/functions/v1/send-daily-excel-digest',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ manual: true })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`${response.statusText}: ${errorText}`)
      }

      const result = await response.json()
      setDigestMessage({
        type: 'success',
        text: `تم إرسال البريد بنجاح! (${result.message || 'تم إرسال التنبيهات'})`
      })
    } catch (err) {
      console.error('Error sending digest:', err)
      setDigestMessage({
        type: 'error',
        text: `خطأ في إرسال البريد: ${err instanceof Error ? err.message : 'حاول مرة أخرى'}`
      })
    } finally {
      setIsSendingDigest(false)
    }
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

  if (!hasPermission) {
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

        {/* Send Digest Section */}
        <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-blue-100 rounded-lg mt-1">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">إرسال بريد التنبيهات</h2>
                <p className="text-gray-600 text-sm mt-1">
                  أرسل جميع التنبيهات الحالية غير المحلولة إلى بريدك الإداري الآن
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  البريد سيُرسل تلقائياً كل يوم الساعة 03:00 صباحاً مع جميع التنبيهات النشطة
                </p>
              </div>
            </div>
            <button
              onClick={handleSendDigestNow}
              disabled={isSendingDigest}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition whitespace-nowrap"
            >
              {isSendingDigest ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  جاري الإرسال...
                </span>
              ) : (
                'إرسال الآن'
              )}
            </button>
          </div>

          {/* Message */}
          {digestMessage && (
            <div className={`mt-4 p-3 rounded-lg ${
              digestMessage.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <p className="text-sm">{digestMessage.text}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <UnifiedSettings isReadOnly={!canEditSettings} />
      </div>
    </Layout>
  )
}
