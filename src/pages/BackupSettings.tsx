import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '@/components/layout/Layout'
import EmailQueueMonitor from '@/components/settings/EmailQueueMonitor'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/utils/permissions'
import { toast } from 'sonner'
import { Mail, Save, RefreshCw, Shield, Database, Info, CheckCircle, AlertTriangle, Clock, Loader2, HardDrive } from 'lucide-react'
import { enqueueEmail } from '@/lib/emailQueueService'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { triggerManualBackupAndNotify } from '@/lib/backupService'

interface EmailConfig {
  admin_email: string
  backup_email_notifications: string
  backup_notifications_enabled: boolean
}

const SETTINGS_KEYS = ['admin_email', 'backup_email_notifications', 'backup_notifications_enabled']
const DEFAULT_ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'Ahmad.alsawy159@gmail.com'

export default function BackupSettingsManagement() {
  const { user } = useAuth()
  const { canView, canEdit } = usePermissions()

  const hasViewPermission = canView('adminSettings')
  const hasEditPermission = canEdit('adminSettings') || user?.role === 'admin'

  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    admin_email: DEFAULT_ADMIN_EMAIL,
    backup_email_notifications: '',
    backup_notifications_enabled: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [, setStatsLoading] = useState(false)
  const [stats, setStats] = useState({
    sentToday: 0,
    pending: 0,
    failed: 0,
    lastSuccessTime: '' as string | ''
  })
  const [activity, setActivity] = useState<Array<{ id: string; to_emails: string[]; subject: string; status: string; created_at: string; processed_at: string | null }>>([])
  const [recipients, setRecipients] = useState<string[]>([])
  const [newRecipient, setNewRecipient] = useState('')
  const [manualBackupLoading, setManualBackupLoading] = useState(false)

  const systemPulse = useMemo(() => {
    if (!stats.lastSuccessTime) {
      return { label: 'Worker Idle', tone: 'warning' as const }
    }
    const diffMinutes = (Date.now() - new Date(stats.lastSuccessTime).getTime()) / 60000
    return diffMinutes > 10
      ? { label: 'Worker Idle', tone: 'warning' as const }
      : { label: 'System Active', tone: 'success' as const }
  }, [stats.lastSuccessTime])

  const loadEmailSettings = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', SETTINGS_KEYS)

      if (error) throw error

      const nextConfig: EmailConfig = {
        admin_email: DEFAULT_ADMIN_EMAIL,
        backup_email_notifications: '',
        backup_notifications_enabled: true
      }

      data?.forEach((row) => {
        if (row.setting_key === 'admin_email') {
          nextConfig.admin_email = (row.setting_value as string) || DEFAULT_ADMIN_EMAIL
        }
        if (row.setting_key === 'backup_email_notifications') {
          nextConfig.backup_email_notifications = (row.setting_value as string) || ''
        }
        if (row.setting_key === 'backup_notifications_enabled') {
          nextConfig.backup_notifications_enabled = Boolean(row.setting_value)
        }
      })

      setEmailConfig(nextConfig)
      const parsedRecipients = (nextConfig.backup_email_notifications || '')
        .split(/[;,]/)
        .map(s => s.trim())
        .filter(Boolean)
      setRecipients(parsedRecipients)
    } catch (error) {
      console.error('[BackupSettings] Failed to load email settings:', error)
      toast.error('تعذر تحميل إعدادات البريد الإلكتروني')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hasViewPermission) {
      setLoading(false)
      return
    }
    loadEmailSettings()
  }, [hasViewPermission, loadEmailSettings])

  const loadStatsAndActivity = useCallback(async () => {
    setStatsLoading(true)
    try {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const { count: sentTodayCount } = await supabase
        .from('email_queue')
        .select('id', { count: 'exact', head: true })
        .in('status', ['completed', 'sent'])
        .gte('created_at', startOfToday.toISOString())

      const { count: pendingCount } = await supabase
        .from('email_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: failedCount } = await supabase
        .from('email_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')

      const { data: lastSuccessArr } = await supabase
        .from('email_queue')
        .select('processed_at, completed_at, sent_at')
        .in('status', ['completed', 'sent'])
        .order('processed_at', { ascending: false })
        .limit(1)

      setStats({
        sentToday: sentTodayCount || 0,
        pending: pendingCount || 0,
        failed: failedCount || 0,
        lastSuccessTime: lastSuccessArr && lastSuccessArr[0]
          ? (lastSuccessArr[0].processed_at || lastSuccessArr[0].completed_at || lastSuccessArr[0].sent_at || '')
          : ''
      })

      const { data: recent } = await supabase
        .from('email_queue')
        .select('id, to_emails, subject, status, created_at, processed_at')
        .in('status', ['completed', 'sent', 'failed'])
        .order('created_at', { ascending: false })
        .limit(10)
      setActivity(recent || [])
    } catch (err) {
      console.warn('[BackupSettings] loadStatsAndActivity error:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatsAndActivity()
    // تحديث الإحصاءات كل 60 ثانية بدلاً من كل 10 ثواني لتقليل الضغط على الخادم
    const interval = setInterval(() => {
      loadStatsAndActivity()
    }, 60000)
    return () => clearInterval(interval)
  }, [loadStatsAndActivity])

  const addRecipient = () => {
    const email = newRecipient.trim()
    if (!email) return
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('بريد غير صالح')
      return
    }
    if (recipients.includes(email)) {
      toast.info('هذا البريد موجود بالفعل')
      return
    }
    setRecipients(prev => [...prev, email])
    setNewRecipient('')
  }

  const removeRecipient = (email: string) => {
    setRecipients(prev => prev.filter(e => e !== email))
  }

  const saveEmailSettings = async () => {
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل إعدادات البريد')
      return
    }

    setSaving(true)
    try {
      const payload = SETTINGS_KEYS.map((key) => {
        let value = emailConfig[key as keyof EmailConfig]
        if (key === 'backup_email_notifications') {
          value = recipients.join(',')
        }
        return {
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString()
        }
      })

      const { error } = await supabase
        .from('system_settings')
        .upsert(payload, { onConflict: 'setting_key' })
        .select()

      if (error) throw error

      toast.success('تم حفظ إعدادات النسخ الاحتياطي بنجاح')
      await loadEmailSettings()
    } catch (error) {
      console.error('[BackupSettings] Failed to save email settings:', error)
      toast.error('فشل حفظ إعدادات النسخ الاحتياطي')
    } finally {
      setSaving(false)
    }
  }

  const sendTestEmail = async () => {
    try {
      const admin = emailConfig.admin_email || DEFAULT_ADMIN_EMAIL
      if (!admin) {
        toast.error('لا يوجد بريد إداري محدد لإرسال الاختبار')
        return
      }
      const subject = 'اختبار مسار المراسلات - عاجل'
      const html = `<p>هذا بريد اختبار تشخيصي لتأكيد المسار.</p><p>الوقت: ${new Date().toISOString()}</p>`
      const res = await enqueueEmail({
        toEmails: [admin],
        subject,
        htmlContent: html,
        priority: 'urgent'
      })
      if (res.success) {
        toast.success('تم إرسال البريد الاختباري إلى المدير')
        await loadStatsAndActivity()
      } else {
        toast.error('فشل في إضافة البريد إلى الطابور')
      }
    } catch (err) {
      console.error('[BackupSettings] sendTestEmail error:', err)
      toast.error('حدث خطأ أثناء إرسال البريد الاختباري')
    }
  }

  const retryAllFailed = async () => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .update({ status: 'pending', retry_count: 0, error_message: null })
        .eq('status', 'failed')
      if (error) throw error
      toast.success('تمت إعادة محاولة جميع الرسائل الفاشلة')
      await loadStatsAndActivity()
    } catch (err) {
      console.error('[BackupSettings] retryAllFailed error:', err)
      toast.error('فشل في إعادة المحاولة الجماعية')
    }
  }

  const clearHistory = async () => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .delete()
        .in('status', ['completed', 'failed'])
      if (error) throw error
      toast.success('تم مسح سجل النسخ الاحتياطي (الناجحة/الفاشلة)')
      await loadStatsAndActivity()
    } catch (err) {
      console.error('[BackupSettings] clearHistory error:', err)
      toast.error('فشل في مسح السجل')
    }
  }

  const handleManualBackup = async () => {
    if (manualBackupLoading) return
    setManualBackupLoading(true)
    try {
      await triggerManualBackupAndNotify()
      toast.success('تم إطلاق النسخة الاحتياطية وسيتم إرسال الإشعارات')
      await loadStatsAndActivity()
    } catch (err) {
      console.error('[BackupSettings] manual backup error:', err)
      toast.error('فشل إطلاق النسخة الاحتياطية اليدوية')
    } finally {
      setManualBackupLoading(false)
    }
  }

  if (!hasViewPermission) {
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
      <div className="p-2 md:p-2 space-y-2" dir="rtl">
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg shadow-sm p-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Mail className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-gray-900">إعدادات النسخ الاحتياطي</h1>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${systemPulse.tone === 'success' ? 'text-green-700' : 'text-amber-700'}`}>
                  <span className={`w-2 h-2 rounded-full ${systemPulse.tone === 'success' ? 'bg-green-500' : 'bg-amber-500'}`} />
                  {systemPulse.tone === 'success' ? 'نشط' : 'عامل الانتظار'}
                </span>
              </div>
              <p className="text-[11px] text-gray-600">إدارة إعدادات النسخ الاحتياطي وإشعارات البريد الإلكتروني</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <div className="flex items-center gap-1">
              <Database className="w-4 h-4" />
              <span>system_settings</span>
            </div>
            <div className="flex items-center gap-1">
              <RefreshCw className="w-4 h-4" />
              <span>تحديث كل 10 ثوانٍ</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-semibold">المرسَل اليوم</span>
            </div>
            <div className="text-lg font-bold text-gray-800">{stats.sentToday}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-700">
              <RefreshCw className="w-4 h-4" />
              <span className="text-xs font-semibold">قيد الانتظار</span>
            </div>
            <div className="text-lg font-bold text-gray-800">{stats.pending}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-semibold">فشلت</span>
            </div>
            <div className="text-lg font-bold text-gray-800">{stats.failed}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold">آخر نجاح</span>
            </div>
            <div className="text-[12px] text-gray-800">
              {stats.lastSuccessTime ? (
                <HijriDateDisplay date={stats.lastSuccessTime}>
                  {formatDateWithHijri(stats.lastSuccessTime, true)}
                </HijriDateDisplay>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="space-y-2 lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">مراقبة قائمة الانتظار</h2>
                  <p className="text-xs text-gray-600">تحديث آلي كل 10 ثوانٍ مع إمكانية التحديث اليدوي</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={retryAllFailed} className="px-2 py-1 text-[11px] bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">إعادة محاولة الفاشلة</button>
                  <button onClick={clearHistory} className="px-2 py-1 text-[11px] bg-red-100 text-red-800 rounded hover:bg-red-200">مسح السجل</button>
                  <span className="px-2 py-1 text-[11px] bg-blue-50 text-blue-700 rounded">Realtime</span>
                </div>
              </div>
              <EmailQueueMonitor />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-bold text-gray-900">سجل النسخ الاحتياطي الأخير</h3>
                <span className="text-[11px] text-gray-500">آخر 10 سجلات</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[11px]">
                    <tr>
                      <th className="px-2.5 py-1 text-right">المستلم</th>
                      <th className="px-2.5 py-1 text-right">الموضوع</th>
                      <th className="px-2.5 py-1 text-right">الحالة</th>
                      <th className="px-2.5 py-1 text-right">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.length === 0 ? (
                      <tr><td colSpan={4} className="px-2.5 py-3 text-center text-gray-500">لا يوجد بيانات حديثة</td></tr>
                    ) : (
                      activity.map((row) => {
                        const isSuccess = row.status === 'completed' || row.status === 'sent'
                        const color = isSuccess ? 'text-green-700 bg-green-50' : row.status === 'failed' ? 'text-red-700 bg-red-50' : 'text-gray-700 bg-gray-50'
                        const label = isSuccess ? 'نجحت' : row.status === 'failed' ? 'فشلت' : row.status
                        return (
                          <tr key={row.id} className="border-t hover:bg-gray-50">
                            <td className="px-2.5 py-1">
                              <div className="flex flex-col gap-0.5">
                                {row.to_emails.slice(0, 2).map((email, idx) => (
                                  <span key={idx} className="text-[11px] font-mono">{email}</span>
                                ))}
                                {row.to_emails.length > 2 && (
                                  <span className="text-[11px] text-gray-500">+{row.to_emails.length - 2} آخر</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-1 max-w-xs truncate" title={row.subject}>{row.subject}</td>
                            <td className="px-2.5 py-1">
                              <span className={`px-2 py-0.5 rounded text-[11px] ${color}`}>{label}</span>
                            </td>
                            <td className="px-2.5 py-1 text-[10px] text-gray-700">
                              <HijriDateDisplay date={row.processed_at || row.created_at}>
                                {formatDateWithHijri(row.processed_at || row.created_at, true)}
                              </HijriDateDisplay>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">الإجراءات السريعة</h2>
                  <p className="text-xs text-gray-600">إطلاق نسخة احتياطية يدوية فوراً مع إشعارات البريد</p>
                </div>
                <HardDrive className="w-4 h-4 text-blue-600" />
              </div>
              <button
                onClick={handleManualBackup}
                disabled={manualBackupLoading}
                className="w-full md:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-60 text-xs"
              >
                {manualBackupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>إطلاق نسخة احتياطية يدوية</span>
              </button>
              <p className="text-[11px] text-gray-500 mt-1">يحترم الإعداد <strong>backup_notifications_enabled</strong> ويضمّن المسار backups/ في البريد.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">إعدادات النسخ الاحتياطي</h2>
                  <p className="text-xs text-gray-600">عناوين البريد وإشعارات النسخ الاحتياطي</p>
                </div>
                <button
                  onClick={loadEmailSettings}
                  disabled={loading}
                  className="px-2.5 py-1 text-[11px] bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  تحديث
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-100 text-[11px] text-blue-800 rounded-lg p-2.5 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">ملاحظة هامة</p>
                  <p className="leading-snug">حدود الأيام/الألوان للتنبيهات تُدار من صفحة إعدادات التنبيهات. هذه الصفحة مخصصة لإعدادات النسخ الاحتياطي فقط.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">البريد الإداري (Admin Email)</label>
                  <input
                    type="email"
                    value={emailConfig.admin_email}
                    onChange={(e) => setEmailConfig((prev) => ({ ...prev, admin_email: e.target.value }))}
                    disabled={!hasEditPermission}
                    placeholder="example@company.com"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-xs"
                  />
                  <p className="text-[11px] text-gray-500 mt-0.5">القيمة الافتراضية: {DEFAULT_ADMIN_EMAIL}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">مستلمو النسخ الاحتياطية</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {recipients.map(email => (
                      <span key={email} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] inline-flex items-center gap-1.5">
                        <span className="font-mono">{email}</span>
                        <button
                          type="button"
                          onClick={() => removeRecipient(email)}
                          disabled={!hasEditPermission}
                          className="text-blue-700 hover:text-blue-900"
                        >×</button>
                      </span>
                    ))}
                    {recipients.length === 0 && (
                      <span className="text-[11px] text-gray-500">لا يوجد مستلمون محددون</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="email"
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                      disabled={!hasEditPermission}
                      placeholder="إضافة بريد..."
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 text-xs"
                    />
                    <button
                      type="button"
                      onClick={addRecipient}
                      disabled={!hasEditPermission}
                      className="px-2.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-[11px]"
                    >إضافة</button>
                    {recipients.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRecipients([])}
                        disabled={!hasEditPermission}
                        className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-[11px]"
                      >مسح الكل</button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">يمكن إضافة عدة مستلمين، وتُحفظ مفصولة بفواصل.</p>
                </div>

                <div className="flex items-center justify-between border border-gray-200 rounded-lg p-2.5 bg-gray-50">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">تفعيل إشعارات النسخ الاحتياطي</p>
                    <p className="text-[11px] text-gray-600">تشغيل/إيقاف إرسال بريد النسخ الاحتياطي للعنوان أعلاه.</p>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <span className="mr-2 text-xs text-gray-700">{emailConfig.backup_notifications_enabled ? 'مفعّل' : 'معطّل'}</span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={emailConfig.backup_notifications_enabled}
                      onChange={(e) => setEmailConfig((prev) => ({ ...prev, backup_notifications_enabled: e.target.checked }))}
                      disabled={!hasEditPermission}
                    />
                    <div className={`w-10 h-5 rounded-full transition-all duration-200 ${emailConfig.backup_notifications_enabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <div className={`h-4 w-4 bg-white rounded-full shadow transform transition-transform duration-200 ${emailConfig.backup_notifications_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-gray-100">
                <button
                  onClick={saveEmailSettings}
                  disabled={saving || !hasEditPermission}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5 text-xs"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">الصحة والاختبار</h2>
                  <p className="text-xs text-gray-600">أرسل بريد اختبار عاجل للتحقق من المسار كاملاً</p>
                </div>
                <button
                  onClick={sendTestEmail}
                  className="px-2.5 py-1 text-[11px] bg-green-600 text-white rounded hover:bg-green-700"
                >إرسال بريد اختبار</button>
              </div>
              <div className="bg-blue-50 border border-blue-100 text-[11px] text-blue-800 rounded-lg p-2.5 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">ملاحظة هامة</p>
                  <p className="leading-snug">حدود الأيام/الألوان للتنبيهات تُدار من صفحة إعدادات التنبيهات. هذه الصفحة تختص بإعدادات النسخ الاحتياطي فقط.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
