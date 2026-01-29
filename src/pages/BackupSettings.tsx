import { useCallback, useEffect, useMemo, useState } from 'react'
import Layout from '@/components/layout/Layout'
import EmailQueueMonitor from '@/components/settings/EmailQueueMonitor'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/utils/permissions'
import { toast } from 'sonner'
import {
  Mail, Save, RefreshCw, Shield, Info, CheckCircle, AlertTriangle,
  Loader2, HardDrive, Download, Trash2, Database, Settings as SettingsIcon,
  Eye
} from 'lucide-react'
import { enqueueEmail } from '@/lib/emailQueueService'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { triggerManualBackupAndNotify } from '@/lib/backupService'
import { logger } from '@/utils/logger'

interface EmailConfig {
  admin_email: string
  backup_email_notifications: string
  backup_notifications_enabled: boolean
}

interface BackupRecord {
  id: string
  backup_type: string
  file_path: string
  file_size: number
  compression_ratio: number
  status: string
  started_at: string
  completed_at: string
  error_message?: string
  tables_included?: string[]
}

interface SecuritySetting {
  id: string
  setting_key: string
  setting_value: string | number | boolean | Record<string, unknown> | null
  description: string
  setting_type?: 'text' | 'number' | 'boolean' | 'select' | 'time'
  options?: Array<string | number | { label: string; value: string | number }>
  updated_at: string
}

type TabType = 'general' | 'email' | 'backup-history' | 'security'

const SETTINGS_KEYS = ['admin_email', 'backup_email_notifications', 'backup_notifications_enabled', 'backup_queue_refresh_interval']
const DEFAULT_ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'Ahmad.alsawy159@gmail.com'

const REFRESH_OPTIONS = [
  { value: 30000, label: '30 ثانية' },
  { value: 60000, label: 'دقيقة واحدة' },
  { value: 120000, label: 'دقيقتان' },
  { value: 300000, label: '5 دقائق' },
  { value: 0, label: 'تعطيل التحديث التلقائي' }
]

export default function BackupSettingsPage() {
  const { user } = useAuth()
  const permissions = usePermissions()

  const hasViewPermission = permissions?.canView('adminSettings') || user?.role === 'admin'
  const hasEditPermission = permissions?.canEdit('adminSettings') || user?.role === 'admin'

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('general')

  // Email Config State
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    admin_email: DEFAULT_ADMIN_EMAIL,
    backup_email_notifications: '',
    backup_notifications_enabled: true
  })
  const [recipients, setRecipients] = useState<string[]>([])
  const [newRecipient, setNewRecipient] = useState('')

  // Refresh Interval State
  const [refreshInterval, setRefreshInterval] = useState(120000)
  // const [refreshLoading, setRefreshLoading] = useState(false)

  // Email Queue Stats
  const [stats, setStats] = useState({
    sentToday: 0,
    pending: 0,
    failed: 0,
    lastSuccessTime: '' as string | ''
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activity, setActivity] = useState<Array<{ id: string; to_emails: string[]; subject: string; status: string; created_at: string; processed_at: string | null }>>([])

  // Backup History State
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)

  // Security Settings State
  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>([])
  const [securityLoading, setSecurityLoading] = useState(false)

  // Loading & Saving States
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [manualBackupLoading, setManualBackupLoading] = useState(false)
  const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null)

  const systemPulse = useMemo(() => {
    if (!stats.lastSuccessTime) {
      return { label: 'عامل الانتظار', tone: 'warning' as const }
    }
    const diffMinutes = (Date.now() - new Date(stats.lastSuccessTime).getTime()) / 60000
    return diffMinutes > 10
      ? { label: 'عامل الانتظار', tone: 'warning' as const }
      : { label: 'نشط', tone: 'success' as const }
  }, [stats.lastSuccessTime])

  // ============================================================================
  // EMAIL CONFIGURATION FUNCTIONS
  // ============================================================================

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

      let interval = 120000
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
        if (row.setting_key === 'backup_queue_refresh_interval') {
          interval = Number(row.setting_value) || 120000
        }
      })

      setEmailConfig(nextConfig)
      setRefreshInterval(interval)
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

  const saveEmailSettings = async () => {
    if (!hasEditPermission) {
      toast.error('ليس لديك صلاحية لتعديل إعدادات البريد')
      return
    }

    setSaving(true)
    try {
      const payload = SETTINGS_KEYS.map((key) => {
        let value: string | number | boolean = emailConfig[key as keyof EmailConfig]
        if (key === 'backup_email_notifications') {
          value = recipients.join(',')
        }
        if (key === 'backup_queue_refresh_interval') {
          value = refreshInterval
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

      toast.success('تم حفظ جميع الإعدادات بنجاح')
      await loadEmailSettings()
    } catch (error) {
      console.error('[BackupSettings] Failed to save email settings:', error)
      toast.error('فشل حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

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

  // ============================================================================
  // EMAIL QUEUE & STATS FUNCTIONS
  // ============================================================================

  const loadStatsAndActivity = useCallback(async () => {
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
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'email') {
      loadStatsAndActivity()
    }

    if (refreshInterval === 0) return

    const interval = setInterval(() => {
      if (activeTab === 'email') {
        loadStatsAndActivity()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval, activeTab, loadStatsAndActivity])

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
        toast.success('تم إضافة البريد الاختباري إلى قائمة الانتظار بنجاح - سيتم الإرسال قريباً')
        await loadStatsAndActivity()
      } else {
        // رسالة خطأ أكثر تفصيلاً
        const errorMsg = res.error || 'فشل في إضافة البريد إلى الطابور'
        console.error('[BackupSettings] Enqueue error:', res.error)
        toast.error(`فشل: ${errorMsg}`)
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

  // ============================================================================
  // BACKUP HISTORY FUNCTIONS
  // ============================================================================

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true)
    try {
      const { data, error } = await supabase
        .from('backup_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Backup] Error loading backups:', error)
        toast.error('فشل في تحميل قائمة النسخ الاحتياطية')
        return
      }

      setBackups(data || [])
      logger.debug('[Backup] Backups loaded successfully, count:', data?.length || 0)
    } catch (error) {
      console.error('[Backup] Error in loadBackups:', error)
      toast.error('حدث خطأ أثناء تحميل النسخ الاحتياطية')
    } finally {
      setBackupsLoading(false)
    }
  }, [])

  const handleManualBackup = async () => {
    if (manualBackupLoading) return
    setManualBackupLoading(true)
    try {
      await triggerManualBackupAndNotify()
      toast.success('تم إطلاق النسخة الاحتياطية بنجاح')
      await loadBackups()
      await loadStatsAndActivity()
    } catch (err) {
      console.error('[BackupSettings] manual backup error:', err)
      toast.error('فشل إطلاق النسخة الاحتياطية اليدوية')
    } finally {
      setManualBackupLoading(false)
    }
  }

  const downloadBackup = async (fileName: string) => {
    setDownloadingBackup(fileName)
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .download(fileName)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)

      toast.success(`تم تحميل ${fileName} بنجاح`)
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('فشل تحميل النسخة الاحتياطية')
    } finally {
      setDownloadingBackup(null)
    }
  }

  const deleteBackup = async (backupId: string, filePath: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه النسخة الاحتياطية؟')) return

    try {
      // حذف من التخزين
      const { error: storageError } = await supabase.storage
        .from('backups')
        .remove([filePath])

      if (storageError) console.warn('[Backup] Storage deletion warning:', storageError)

      // حذف من قاعدة البيانات
      const { error: dbError } = await supabase
        .from('backup_history')
        .delete()
        .eq('id', backupId)

      if (dbError) throw dbError

      setBackups(prev => prev.filter(b => b.id !== backupId))
      toast.success('تم حذف النسخة الاحتياطية بنجاح')
    } catch (err) {
      console.error('[Backup] Delete error:', err)
      toast.error('فشل حذف النسخة الاحتياطية')
    }
  }

  // ============================================================================
  // SECURITY SETTINGS FUNCTIONS
  // ============================================================================

  const loadSecuritySettings = useCallback(async () => {
    setSecurityLoading(true)
    try {
      const { data, error } = await supabase
        .from('security_settings')
        .select('*')
        .order('setting_key')

      if (error) throw error

      const disallowedKeys = new Set([
        'admin_email',
        'backup_email_notifications',
        'backup_notifications_enabled',
        'backup_email_recipients'
      ])

      const filtered = data?.filter(s => !disallowedKeys.has(s.setting_key)) || []
      setSecuritySettings(filtered)
    } catch (error) {
      console.error('Error loading security settings:', error)
      toast.error('فشل تحميل إعدادات الأمان')
    } finally {
      setSecurityLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'security') {
      loadSecuritySettings()
    }
  }, [activeTab, loadSecuritySettings])

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
                <HardDrive className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">إدارة النسخ الاحتياطية والأمان</h1>
                <p className="text-blue-100 mt-1">لوحة تحكم متكاملة للنسخ الاحتياطية والبريد الإلكتروني وإعدادات الأمان</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
              systemPulse.tone === 'success'
                ? 'bg-green-500/20 text-green-100'
                : 'bg-yellow-500/20 text-yellow-100'
            }`}>
              <span className={`w-3 h-3 rounded-full ${
                systemPulse.tone === 'success' ? 'bg-green-400' : 'bg-yellow-400'
              } animate-pulse`} />
              {systemPulse.label}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'general', label: 'الإعدادات العامة', icon: SettingsIcon },
              { id: 'email', label: 'إدارة البريد والإشعارات', icon: Mail },
              { id: 'backup-history', label: 'سجل النسخ الاحتياطية', icon: Database },
              { id: 'security', label: 'إعدادات الأمان', icon: Shield }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-semibold transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">المرسل اليوم</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">{stats.sentToday}</p>
                    </div>
                    <CheckCircle className="w-12 h-12 text-blue-200" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">قيد الانتظار</p>
                      <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
                    </div>
                    <RefreshCw className="w-12 h-12 text-yellow-200" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">رسائل فاشلة</p>
                      <p className="text-3xl font-bold text-red-600 mt-2">{stats.failed}</p>
                    </div>
                    <AlertTriangle className="w-12 h-12 text-red-200" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div>
                    <p className="text-sm text-gray-600">آخر عملية نجحت</p>
                    <p className="text-sm font-mono text-gray-800 mt-2 truncate">
                      {stats.lastSuccessTime ? (
                        <HijriDateDisplay date={stats.lastSuccessTime}>
                          {formatDateWithHijri(stats.lastSuccessTime, true)}
                        </HijriDateDisplay>
                      ) : (
                        '-'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">الإجراءات السريعة</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={handleManualBackup}
                    disabled={manualBackupLoading}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-60 font-semibold"
                  >
                    {manualBackupLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <HardDrive className="w-5 h-5" />
                    )}
                    {manualBackupLoading ? 'جاري إنشاء النسخة...' : 'نسخة احتياطية يدوية'}
                  </button>
                  <button
                    onClick={sendTestEmail}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    <Mail className="w-5 h-5" />
                    بريد اختبار
                  </button>
                  <button
                    onClick={retryAllFailed}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold"
                  >
                    <RefreshCw className="w-5 h-5" />
                    إعادة محاولة الفاشلة
                  </button>
                </div>
              </div>

              {/* Refresh Interval Control */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">تحكم التحديث التلقائي</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      فترة التحديث التلقائي لمراقبة البريد
                    </label>
                    <select
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      disabled={!hasEditPermission}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    >
                      {REFRESH_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-600 mt-2">
                      كلما قلّ الرقم، كلما كانت التحديثات أسرع لكن تزيد ضغط الخادم
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">💡 ملاحظة:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>الحد الأدنى: 30 ثانية</li>
                        <li>الحد الأقصى: 5 دقائق</li>
                        <li>إذا اخترت "تعطيل"، سيتوقف التحديث التلقائي</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMAIL TAB */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              {/* Email Queue Monitor */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">مراقبة قائمة الانتظار</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      تحديث آلي {refreshInterval === 0 ? 'معطّل' : `كل ${Math.round(refreshInterval / 1000)} ثانية`}
                    </p>
                  </div>
                  <button
                    onClick={clearHistory}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-semibold text-sm"
                  >
                    مسح السجل
                  </button>
                </div>
                <EmailQueueMonitor />
              </div>

              {/* Email Configuration */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إعدادات البريد الإلكتروني</h2>

                <div className="space-y-4">
                  {/* Admin Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإداري</label>
                    <input
                      type="email"
                      value={emailConfig.admin_email}
                      onChange={(e) => setEmailConfig(prev => ({ ...prev, admin_email: e.target.value }))}
                      disabled={!hasEditPermission}
                      placeholder="admin@yourdomain.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                    />
                  </div>

                  {/* Recipients */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">مستلمو إشعارات النسخ الاحتياطية</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {recipients.map(email => (
                        <span
                          key={email}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
                        >
                          {email}
                          <button
                            onClick={() => removeRecipient(email)}
                            disabled={!hasEditPermission}
                            className="text-blue-600 hover:text-blue-900 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        disabled={!hasEditPermission}
                        placeholder="أضف بريد جديد..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                      <button
                        onClick={addRecipient}
                        disabled={!hasEditPermission}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  {/* Enable/Disable Notifications */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">تفعيل إشعارات النسخ الاحتياطية</p>
                        <p className="text-xs text-gray-600 mt-1">إرسال/إيقاف البريد الإلكتروني عند إتمام النسخة الاحتياطية</p>
                      </div>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailConfig.backup_notifications_enabled}
                          onChange={(e) => setEmailConfig(prev => ({
                            ...prev,
                            backup_notifications_enabled: e.target.checked
                          }))}
                          disabled={!hasEditPermission}
                          className="sr-only"
                        />
                        <div className={`w-12 h-6 rounded-full transition-all duration-200 ${
                          emailConfig.backup_notifications_enabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}>
                          <div className={`h-5 w-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                            emailConfig.backup_notifications_enabled ? 'translate-x-6' : 'translate-x-0.5'
                          }`} />
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={saveEmailSettings}
                      disabled={saving || !hasEditPermission}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-60 font-semibold"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BACKUP HISTORY TAB */}
          {activeTab === 'backup-history' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">سجل النسخ الاحتياطية</h2>
                    <p className="text-sm text-gray-600 mt-1">جميع النسخ الاحتياطية المحفوظة مع إمكانية التحميل والحذف</p>
                  </div>
                  <button
                    onClick={loadBackups}
                    disabled={backupsLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${backupsLoading ? 'animate-spin' : ''}`} />
                    تحديث
                  </button>
                </div>

                {backupsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">لا توجد نسخ احتياطية بعد</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">النوع</th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">الحجم</th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">الحالة</th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">التاريخ</th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {backups.map(backup => (
                          <tr key={backup.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                {backup.backup_type === 'full' ? 'كاملة' : backup.backup_type === 'incremental' ? 'تزايدية' : 'يدوية'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-900 font-mono">
                              {backup.file_size ? `${(backup.file_size / 1024).toFixed(2)} KB` : '-'}
                            </td>
                            <td className="px-6 py-4">
                              {backup.status === 'completed' ? (
                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">✓ مكتملة</span>
                              ) : backup.status === 'failed' ? (
                                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">✕ فاشلة</span>
                              ) : (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">⏳ جاري</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-600 text-xs">
                              <HijriDateDisplay date={backup.completed_at || backup.started_at}>
                                {formatDateWithHijri(backup.completed_at || backup.started_at, true)}
                              </HijriDateDisplay>
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                              <button
                                onClick={() => downloadBackup(backup.file_path)}
                                disabled={downloadingBackup === backup.file_path}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition disabled:opacity-60 text-xs font-semibold"
                              >
                                {downloadingBackup === backup.file_path ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                                تحميل
                              </button>
                              <button
                                onClick={() => deleteBackup(backup.id, backup.file_path)}
                                className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-xs font-semibold"
                              >
                                <Trash2 className="w-4 h-4" />
                                حذف
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">إعدادات الأمان</h2>

                {securityLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : securitySettings.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">لا توجد إعدادات أمان متاحة</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {securitySettings.map(setting => (
                      <div key={setting.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-900">{setting.setting_key}</p>
                        <p className="text-xs text-gray-600 mt-1">{setting.description}</p>
                        <p className="text-xs text-gray-500 mt-2 font-mono">
                          {typeof setting.setting_value === 'object'
                            ? JSON.stringify(setting.setting_value, null, 2)
                            : String(setting.setting_value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
