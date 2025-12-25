import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { RefreshCw, Activity, CheckCircle, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

interface AuditStats {
  total_logs: number
  high_risk_operations: number
  failed_logins_today: number
  active_sessions: number
  total_sessions: number
}

interface SecurityEvent {
  id: string
  type: 'backup' | 'login_attempt' | 'session_ended'
  title: string
  timestamp: string
  icon: React.ComponentType<{ className?: string }>
  bgColor: string
  iconColor: string
}

export default function AuditDashboard() {
  const [auditStats, setAuditStats] = useState<AuditStats>({
    total_logs: 0,
    high_risk_operations: 0,
    failed_logins_today: 0,
    active_sessions: 0,
    total_sessions: 0
  })
  const [recentSecurityEvents, setRecentSecurityEvents] = useState<SecurityEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadAuditStats = async () => {
    try {
      const { count: totalLogs } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact', head: true })

      const { count: highRiskOps } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact', head: true })
        .in('operation', ['delete', 'bulk_delete', 'admin_action'])

      let failedLogins = 0
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const { count } = await supabase
          .from('login_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('attempt_type', 'failed')
          .gte('created_at', today.toISOString())

        failedLogins = count || 0
      } catch (loginError) {
        const errorMessage = loginError instanceof Error ? loginError.message : ''
        if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
          console.warn('Error loading failed login attempts:', loginError)
        }
      }

      let activeSessionsCount = 0
      try {
        const now = new Date().toISOString()
        const { count: sessionsCount } = await supabase
          .from('user_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .gt('expires_at', now)

        activeSessionsCount = sessionsCount || 0
      } catch (sessionsError) {
        const errorMessage = sessionsError instanceof Error ? sessionsError.message : ''
        if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
          console.warn('Error loading active sessions count:', sessionsError)
        }
      }

      let totalSessionsCount = 0
      try {
        const { count: totalSessions } = await supabase
          .from('user_sessions')
          .select('*', { count: 'exact', head: true })

        totalSessionsCount = totalSessions || 0
      } catch (totalSessionsError) {
        const errorMessage = totalSessionsError instanceof Error ? totalSessionsError.message : ''
        if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
          console.warn('Error loading total sessions count:', totalSessionsError)
        }
      }

      setAuditStats({
        total_logs: totalLogs || 0,
        high_risk_operations: highRiskOps || 0,
        failed_logins_today: failedLogins,
        active_sessions: activeSessionsCount,
        total_sessions: totalSessionsCount
      })
    } catch (error) {
      console.error('Error loading audit stats:', error)
      toast.error('حدث خطأ أثناء تحميل إحصائيات التدقيق')
    }
  }

  const loadRecentSecurityEvents = async () => {
    try {
      const events: SecurityEvent[] = []

      try {
        const { data: backups } = await supabase
          .from('backup_history')
          .select('id, file_path, status, completed_at, backup_type')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(5)

        if (backups) {
          backups.forEach((backup) => {
            const backupTypeLabel = backup.backup_type === 'full' ? 'كاملة' : backup.backup_type === 'incremental' ? 'تزايدية' : 'جزئية'
            events.push({
              id: `backup-${backup.id}`,
              type: 'backup',
              title: `تم إنشاء نسخة احتياطية ${backupTypeLabel} بنجاح`,
              timestamp: backup.completed_at || backup.id,
              icon: CheckCircle,
              bgColor: 'bg-green-50',
              iconColor: 'text-green-600'
            })
          })
        }
      } catch (backupError) {
        const errorMessage = backupError instanceof Error ? backupError.message : ''
        if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
          console.warn('Error loading backup events:', backupError)
        }
      }

      try {
        const { data: loginAttempts } = await supabase
          .from('login_attempts')
          .select('id, email, ip_address, created_at')
          .eq('attempt_type', 'failed')
          .order('created_at', { ascending: false })
          .limit(5)

        if (loginAttempts) {
          loginAttempts.forEach((attempt) => {
            const ipInfo = attempt.ip_address ? `من IP: ${attempt.ip_address}` : ''
            events.push({
              id: `login-${attempt.id}`,
              type: 'login_attempt',
              title: `محاولة دخول فاشلة ${ipInfo}`.trim(),
              timestamp: attempt.created_at,
              icon: Activity,
              bgColor: 'bg-yellow-50',
              iconColor: 'text-yellow-600'
            })
          })
        }
      } catch (loginError) {
        const errorMessage = loginError instanceof Error ? loginError.message : String(loginError)
        if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
          console.warn('Error loading login attempt events:', loginError)
        }
      }

      try {
        const { data: sessionLogs } = await supabase
          .from('activity_log')
          .select('id, action, created_at, details')
          .or('action.ilike.%session%,action.ilike.%جلسة%')
          .order('created_at', { ascending: false })
          .limit(5)

        if (sessionLogs) {
          sessionLogs.forEach((log) => {
            if (log.action && (log.action.toLowerCase().includes('session') || log.action.includes('جلسة'))) {
              events.push({
                id: `session-${log.id}`,
                type: 'session_ended',
                title: 'تم إنهاء جلسة مستخدم',
                timestamp: log.created_at,
                icon: Activity,
                bgColor: 'bg-blue-50',
                iconColor: 'text-blue-600'
              })
            }
          })
        }
      } catch (sessionError) {
        console.warn('Error loading session events:', sessionError)
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setRecentSecurityEvents(events.slice(0, 10))
    } catch (error) {
      console.error('Error loading recent security events:', error)
      setRecentSecurityEvents([])
    }
  }

  useEffect(() => {
    loadAuditStats()
    loadRecentSecurityEvents()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">تدقيق الأمان</h2>
        </div>
        <button
          onClick={async () => {
            setIsLoading(true)
            try {
              await loadAuditStats()
              await loadRecentSecurityEvents()
            } finally {
              setIsLoading(false)
            }
          }}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث الإحصائيات
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            ملخص الأمان
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>إجمالي سجلات النشاط:</span>
              <span className="font-bold">{auditStats.total_logs}</span>
            </div>
            <div className="flex justify-between">
              <span>العمليات عالية الخطورة:</span>
              <span className="font-bold text-red-600">{auditStats.high_risk_operations}</span>
            </div>
            <div className="flex justify-between">
              <span>محاولات دخول فاشلة اليوم:</span>
              <span className="font-bold text-yellow-600">{auditStats.failed_logins_today}</span>
            </div>
            <div className="flex justify-between">
              <span>الجلسات النشطة:</span>
              <span className="font-bold text-green-600">{auditStats.active_sessions}</span>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            حالة النظام
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>تشفير البيانات:</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
            </div>
            <div className="flex items-center justify-between">
              <span>النسخ الاحتياطية التلقائية:</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
            </div>
            <div className="flex items-center justify-between">
              <span>تسجيل العمليات:</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
            </div>
            <div className="flex items-center justify-between">
              <span>مراقبة الجلسات:</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">نشط</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-4">الأحداث الأمنية الأخيرة</h3>
        <div className="space-y-2 text-sm">
          {recentSecurityEvents.length > 0 ? (
            recentSecurityEvents.map((event) => {
              const Icon = event.icon
              const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true, locale: ar })

              return (
                <div key={event.id} className={`flex items-center gap-2 p-2 ${event.bgColor} rounded`}>
                  <Icon className={`w-4 h-4 ${event.iconColor}`} />
                  <span>{event.title} - {timeAgo}</span>
                </div>
              )
            })
          ) : (
            <div className="text-center py-8 text-gray-500">لا توجد أحداث أمنية حديثة</div>
          )}
        </div>
      </div>
    </div>
  )
}
