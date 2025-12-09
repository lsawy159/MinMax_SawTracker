import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/layout/Layout'
import { Shield, Database, Key, Users, Activity, Settings, Download, Trash2, RefreshCw, AlertTriangle, AlertCircle, CheckCircle, Save, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/utils/logger'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'
import { getErrorMessage, getErrorStatus, getInputValue } from '@/utils/errorHandling'

interface SecuritySetting {
  id: string
  setting_key: string
  setting_value: string | number | boolean | Record<string, unknown> | null
  description: string
  setting_type?: 'text' | 'number' | 'boolean' | 'select' | 'time'
  options?: Array<string | number | { label: string; value: string | number }>
  updated_at: string
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

interface UserSession {
  id: string
  user_id: string
  device_info: Record<string, unknown>
  ip_address: string
  location: string
  last_activity: string
  created_at: string
  logged_out_at?: string
  is_active: boolean
  users?: {
    id: string
    email: string
    full_name: string
  }
}

interface EmailQueueItem {
  id: string
  to_emails: string[]
  subject: string
  html_content: string
  text_content: string | null
  attachments: Array<{ filename: string; content: string; contentType?: string }>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  retry_count: number
  max_retries: number
  error_message: string | null
  created_at: string
  processed_at: string | null
  completed_at: string | null
}

export default function SecurityManagement() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'settings' | 'backups' | 'sessions' | 'audit'>('settings')
  const [isLoading, setIsLoading] = useState(false)
  
  // --- [BEGIN FIX] ---
  // تم نقل جميع الـ Hooks (useState, useEffect, useCallback) إلى هنا
  // قبل الـ return الشرطي الخاص بالـ admin
  
  // Security Settings
  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>([])
  const [settingsValues, setSettingsValues] = useState<Record<string, string | number | boolean | Record<string, unknown> | null>>({})
  const [savingSetting, setSavingSetting] = useState<string | null>(null)
  const [showAddSettingModal, setShowAddSettingModal] = useState(false)
  const [newSetting, setNewSetting] = useState({
    setting_key: '',
    setting_value: '',
    description: '',
    setting_type: 'text' as 'text' | 'number' | 'boolean' | 'select' | 'time',
    options: ''
  })
  const [isAddingSetting, setIsAddingSetting] = useState(false)
  
  // Backups
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isPollingBackup, setIsPollingBackup] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedBackupForEmail, setSelectedBackupForEmail] = useState<BackupRecord | null>(null)
  const [emailRecipients, setEmailRecipients] = useState<string>('')
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [savedEmailRecipients, setSavedEmailRecipients] = useState<string[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [backupToDelete, setBackupToDelete] = useState<{ id: string; filePath: string; fileName: string } | null>(null)
  const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set())
  const [isDeletingBackups, setIsDeletingBackups] = useState(false)
  
  // Email Queue
  const [emailQueue, setEmailQueue] = useState<EmailQueueItem[]>([])
  const [isLoadingEmailQueue, setIsLoadingEmailQueue] = useState(false)
  
  // Sessions
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([])
  const [sessionHistory, setSessionHistory] = useState<UserSession[]>([])
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [isDeletingSessions, setIsDeletingSessions] = useState(false)

  // Audit Stats
  const [auditStats, setAuditStats] = useState({
    total_logs: 0,
    high_risk_operations: 0,
    failed_logins_today: 0,
    active_sessions: 0,
    total_sessions: 0 // إجمالي سجلات الجلسات (نشطة ومنتهية)
  })

  // Recent Security Events
  interface SecurityEvent {
    id: string
    type: 'backup' | 'login_attempt' | 'session_ended'
    title: string
    timestamp: string
    icon: React.ComponentType<{ className?: string }>
    bgColor: string
    iconColor: string
  }
  const [recentSecurityEvents, setRecentSecurityEvents] = useState<SecurityEvent[]>([])

  // Email Queue functions - يجب تعريفها قبل loadData
  const loadEmailQueue = useCallback(async () => {
    setIsLoadingEmailQueue(true)
    try {
      const { data, error } = await supabase
        .from('email_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Email Queue] Error loading queue:', error)
        // إذا كان الجدول غير موجود، لا نعرض خطأ
        if (error.message?.includes('not found') || error.message?.includes('schema cache')) {
          setEmailQueue([])
          return
        }
        throw error
      }

      setEmailQueue(data || [])
      logger.debug('[Email Queue] Queue loaded successfully, count:', data?.length || 0)
    } catch (error) {
      console.error('[Email Queue] Error loading queue:', error)
      setEmailQueue([])
    } finally {
      setIsLoadingEmailQueue(false)
    }
  }, [])

  const retryFailedEmail = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .update({
          status: 'pending',
          retry_count: 0,
          error_message: null
        })
        .eq('id', emailId)
        .eq('status', 'failed')

      if (error) {
        throw error
      }

      toast.success('تمت إعادة إضافة البريد إلى قائمة الانتظار')
      await loadEmailQueue()
    } catch (error) {
      console.error('[Email Queue] Error retrying email:', error)
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
      toast.error('فشل في إعادة المحاولة: ' + errorMessage)
    }
  }

  // [FIX] تم تغليف loadData بـ useCallback لجعلها مستقرة
  // هذا يمنع إعادة إنشائها مع كل render ويجعلها آمنة للاستخدام في useEffect
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      if (activeTab === 'settings') {
        await loadSecuritySettings()
      } else if (activeTab === 'backups') {
        await loadBackups()
        await loadEmailQueue()
      } else if (activeTab === 'sessions') {
        await loadActiveSessions()
        await loadSessionHistory()
        await loadAuditStats() // تحميل الإحصائيات لتحديث إجمالي سجلات الجلسات
      } else if (activeTab === 'audit') {
        // تحميل الجلسات النشطة أولاً لأن loadAuditStats تعتمد عليها
        await loadActiveSessions()
        await loadAuditStats()
        await loadRecentSecurityEvents()
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]) // [FIX] أضفنا activeTab كاعتمادية لأن loadData تعتمد عليها

  useEffect(() => {
    loadData()
  }, [activeTab, loadData]) // [FIX] تم إضافة loadData إلى مصفوفة الاعتماديات

  // Auto-refresh email queue every 10 seconds when on backups tab
  useEffect(() => {
    if (activeTab !== 'backups') return

    const interval = setInterval(() => {
      loadEmailQueue()
    }, 10000) // كل 10 ثوانٍ

    return () => clearInterval(interval)
  }, [activeTab, loadEmailQueue])
  
  // --- [END FIX] ---

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، هذه الصفحة متاحة للمديرين فقط.</p>
          </div>
        </div>
      </Layout>
    )
  }
  
  // تم نقل الـ Hooks للأعلى

  const loadSecuritySettings = async () => {
    const { data } = await supabase
      .from('security_settings')
      .select('*')
      .order('setting_key')
    
    if (data) {
      setSecuritySettings(data)
      // تهيئة القيم من البيانات المحملة
      const initialValues: Record<string, string | number | boolean | Record<string, unknown> | null> = {}
      data.forEach(setting => {
        // إذا كانت القيمة JSON معقدة (object أو array)، نحولها إلى string للعرض
        if (typeof setting.setting_value === 'object' && setting.setting_value !== null) {
          initialValues[setting.setting_key] = JSON.stringify(setting.setting_value, null, 2)
        } else {
          initialValues[setting.setting_key] = setting.setting_value
        }
      })
      setSettingsValues(initialValues)
      
      // تحميل الإيميلات المحفوظة
      const emailSetting = data.find(s => s.setting_key === 'backup_email_recipients')
      if (emailSetting) {
        try {
          let recipients: string | string[] | Record<string, unknown> = emailSetting.setting_value as string | string[] | Record<string, unknown>
          
          // إذا كانت string، نحاول parse JSON فقط إذا كانت تبدو كـ JSON
          if (typeof recipients === 'string') {
            const trimmed = recipients.trim()
            // التحقق إذا كانت تبدو كـ JSON array أو object
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
                (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
              try {
                recipients = JSON.parse(trimmed)
              } catch {
                // إذا فشل، نعتبرها string عادي (إيميل واحد أو قائمة مفصولة بفواصل)
                recipients = trimmed.split(',').map((e: string) => e.trim()).filter((e: string) => e)
              }
            } else {
              // إذا كانت string عادي (ليس JSON)، نعتبرها قائمة مفصولة بفواصل
              recipients = trimmed.split(',').map((e: string) => e.trim()).filter((e: string) => e)
            }
          }
          
          // التحقق إذا كانت array
          if (Array.isArray(recipients) && recipients.length > 0) {
            setSavedEmailRecipients(recipients)
            setEmailRecipients(recipients.join(', '))
          } else if (typeof recipients === 'string' && recipients.trim().includes('@')) {
            // إذا كانت إيميل واحد فقط
            setSavedEmailRecipients([recipients])
            setEmailRecipients(recipients)
          }
        } catch (e) {
          console.warn('خطأ في قراءة الإيميلات المحفوظة:', e)
        }
      }
    }
  }

  const loadBackups = async () => {
    try {
      logger.debug('[Backup] Loading backups...')
      const { data, error } = await supabase
        .from('backup_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20)
      
      if (error) {
        console.error('[Backup] Error loading backups:', error)
        toast.error('فشل في تحميل قائمة النسخ الاحتياطية')
        return
      }
      
      if (data) {
        setBackups(data)
        logger.debug('[Backup] Backups loaded successfully, count:', data.length)
      }
    } catch (error) {
      console.error('[Backup] Error in loadBackups:', error)
      toast.error('حدث خطأ أثناء تحميل النسخ الاحتياطية')
    }
  }

  const loadActiveSessions = async () => {
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          *,
          users (
            id,
            email,
            full_name
          )
        `)
        .eq('is_active', true)
        .gt('expires_at', now)
        .order('last_activity', { ascending: false })
      
      if (error) {
        console.error('Error loading active sessions:', error)
        // إذا كان الجدول غير موجود، نستخدم مصفوفة فارغة
        if (error.message?.includes('not found') || error.message?.includes('schema cache')) {
          setActiveSessions([])
          return
        }
        throw error
      }
      
      setActiveSessions(data || [])
    } catch (error) {
      console.error('Error loading active sessions:', error)
      setActiveSessions([])
    }
  }

  const loadSessionHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          *,
          users (
            id,
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100) // جلب آخر 100 جلسة
      
      if (error) {
        console.error('Error loading session history:', error)
        // إذا كان الجدول غير موجود، نستخدم مصفوفة فارغة
        if (error.message?.includes('not found') || error.message?.includes('schema cache')) {
          setSessionHistory([])
          return
        }
        throw error
      }
      
      setSessionHistory(data || [])
    } catch (error) {
      console.error('Error loading session history:', error)
      setSessionHistory([])
    }
  }

  const loadAuditStats = async () => {
    try {
      // إحصائيات سجل النشاط
      const { count: totalLogs } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact', head: true })

      // العمليات عالية الخطورة
      const { count: highRiskOps } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact', head: true })
        .in('operation', ['delete', 'bulk_delete', 'admin_action'])

      // محاولات الدخول الفاشلة اليوم
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
        // إذا كان الجدول غير موجود، نتخطاه بهدوء
        const errorMessage = loginError instanceof Error ? loginError.message : ''
        if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
          console.warn('Error loading failed login attempts:', loginError)
        }
      }

      // عدد الجلسات النشطة
      let activeSessionsCount = activeSessions.length
      try {
        const now = new Date().toISOString()
        const { count: sessionsCount } = await supabase
          .from('user_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .gt('expires_at', now)
        
        activeSessionsCount = sessionsCount || 0
      } catch (sessionsError) {
        // إذا كان الجدول غير موجود، نستخدم القيمة من state
        const errorMessage = sessionsError instanceof Error ? sessionsError.message : ''
        if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
          console.warn('Error loading active sessions count:', sessionsError)
        }
      }

      // إجمالي سجلات الجلسات (جميع الجلسات: نشطة ومنتهية)
      let totalSessionsCount = 0
      try {
        const { count: totalSessions } = await supabase
          .from('user_sessions')
          .select('*', { count: 'exact', head: true })
        
        totalSessionsCount = totalSessions || 0
      } catch (totalSessionsError) {
        // إذا كان الجدول غير موجود، نتخطاه بهدوء
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
    }
  }

  const loadRecentSecurityEvents = async () => {
    try {
      const events: SecurityEvent[] = []

      // جلب النسخ الاحتياطية الناجحة (آخر 5)
      try {
        const { data: backups } = await supabase
          .from('backup_history')
          .select('id, file_path, status, completed_at, backup_type')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(5)

        if (backups) {
          backups.forEach((backup) => {
            const backupTypeLabel = backup.backup_type === 'full' ? 'كاملة' 
              : backup.backup_type === 'incremental' ? 'تزايدية' 
              : 'جزئية'
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

      // جلب محاولات الدخول الفاشلة (آخر 5)
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
              icon: AlertTriangle,
              bgColor: 'bg-yellow-50',
              iconColor: 'text-yellow-600'
            })
          })
        }
      } catch (loginError: unknown) {
        const errorMessage = loginError instanceof Error ? loginError.message : String(loginError)
        if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
          console.warn('Error loading login attempt events:', loginError)
        }
      }

      // جلب الجلسات المنتهية من activity_log (آخر 5)
      try {
        const { data: sessionLogs } = await supabase
          .from('activity_log')
          .select('id, action, created_at, details')
          .or('action.ilike.%session%,action.ilike.%جلسة%')
          .order('created_at', { ascending: false })
          .limit(5)

        if (sessionLogs) {
          sessionLogs.forEach((log) => {
            // التحقق من أن السجل يتعلق بإنهاء جلسة
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
        // تجاهل الأخطاء إذا كان الجدول غير موجود
        console.warn('Error loading session events:', sessionError)
      }

      // ترتيب الأحداث حسب التاريخ (الأحدث أولاً)
      events.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime()
        const dateB = new Date(b.timestamp).getTime()
        return dateB - dateA
      })

      // أخذ آخر 10 أحداث فقط
      setRecentSecurityEvents(events.slice(0, 10))
    } catch (error) {
      console.error('Error loading recent security events:', error)
      setRecentSecurityEvents([])
    }
  }

  const addNewSetting = async () => {
    if (!newSetting.setting_key.trim()) {
      toast.error('يرجى إدخال مفتاح الإعداد')
      return
    }

    setIsAddingSetting(true)
    try {
      // تحويل القيمة حسب النوع
      let finalValue: string | number | boolean | Record<string, unknown> | null = newSetting.setting_value
      
      if (newSetting.setting_type === 'boolean') {
        finalValue = newSetting.setting_value === 'true' || newSetting.setting_value === '1'
      } else if (newSetting.setting_type === 'number') {
        finalValue = parseFloat(newSetting.setting_value) || 0
      } else if (typeof newSetting.setting_value === 'string' && (newSetting.setting_value.trim().startsWith('{') || newSetting.setting_value.trim().startsWith('['))) {
        try {
          finalValue = JSON.parse(newSetting.setting_value)
        } catch {
          finalValue = newSetting.setting_value
        }
      }

      // تحويل options إذا كانت موجودة
      let optionsArray: string[] = []
      if (newSetting.setting_type === 'select' && newSetting.options) {
        optionsArray = newSetting.options.split(',').map(o => o.trim()).filter(o => o)
      }

      const { error } = await supabase
        .from('security_settings')
        .insert({
          setting_key: newSetting.setting_key.trim(),
          setting_value: finalValue,
          category: 'security',
          description: newSetting.description || null,
          setting_type: newSetting.setting_type,
          options: optionsArray.length > 0 ? optionsArray : null
        })

      if (error) throw error
      
      toast.success('تم إضافة الإعداد بنجاح')
      setShowAddSettingModal(false)
      setNewSetting({
        setting_key: '',
        setting_value: '',
        description: '',
        setting_type: 'text',
        options: ''
      })
      await loadSecuritySettings()
    } catch (error) {
      console.error('Error adding setting:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل في إضافة الإعداد'
      toast.error(errorMessage)
    } finally {
      setIsAddingSetting(false)
    }
  }

  const updateSecuritySetting = async (settingKey: string, newValue: string | number | boolean | Record<string, unknown> | null) => {
    setSavingSetting(settingKey)
    try {
      // إذا كانت القيمة string وتبدو كـ JSON، نحاول تحويلها
      let finalValue = newValue
      if (typeof newValue === 'string' && (newValue.trim().startsWith('{') || newValue.trim().startsWith('['))) {
        try {
          finalValue = JSON.parse(newValue)
        } catch {
          // إذا فشل التحويل، نستخدم القيمة كما هي
          finalValue = newValue
        }
      }

      const { error } = await supabase
        .from('security_settings')
        .update({
          setting_value: finalValue,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', settingKey)

      if (error) throw error
      
      toast.success('تم تحديث الإعداد بنجاح')
      await loadSecuritySettings()
    } catch (error) {
      console.error('Error updating setting:', error)
      toast.error('فشل في تحديث الإعداد')
    } finally {
      setSavingSetting(null)
    }
  }

  const updateSettingValue = (settingKey: string, value: string | number | boolean | Record<string, unknown> | null) => {
    setSettingsValues(prev => ({
      ...prev,
      [settingKey]: value
    }))
  }

  // دالة لتحديد نوع الإعداد تلقائياً من القيمة
  const detectSettingType = (value: unknown): 'text' | 'number' | 'boolean' | 'select' | 'time' => {
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string') {
      // التحقق إذا كانت time format
      if (/^\d{2}:\d{2}$/.test(value)) return 'time'
      return 'text'
    }
    // إذا كانت object أو array، نستخدم textarea
    return 'text'
  }

  // دالة لعرض حقل الإدخال المناسب
  const renderSettingInput = (setting: SecuritySetting) => {
    const settingType = setting.setting_type || detectSettingType(setting.setting_value)
    const value = settingsValues[setting.setting_key] ?? setting.setting_value

    switch (settingType) {
      case 'text':
        // إذا كانت القيمة object أو array، نستخدم textarea
        if (typeof setting.setting_value === 'object' && setting.setting_value !== null) {
          return (
            <textarea
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="أدخل القيمة بتنسيق JSON..."
            />
          )
        }
        return (
          <input
            type="text"
            value={getInputValue(value)}
            onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={getInputValue(value)}
            onChange={(e) => updateSettingValue(setting.setting_key, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      case 'boolean':
        return (
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateSettingValue(setting.setting_key, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="mr-2 text-sm text-gray-600">
              {value ? 'مفعل' : 'معطل'}
            </span>
          </label>
        )

      case 'select':
        return (
          <select
            value={getInputValue(value)}
            onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {setting.options && setting.options.length > 0 ? (
              setting.options.map((option: string | number | { label: string; value: string | number }) => {
                const optionValue = typeof option === 'object' ? option.value : option
                const optionLabel = typeof option === 'object' ? option.label : option
                return (
                  <option key={String(optionValue)} value={String(optionValue)}>{String(optionLabel)}</option>
                )
              })
            ) : (
              <option value="">اختر خياراً</option>
            )}
          </select>
        )

      case 'time':
        return (
          <input
            type="time"
            value={getInputValue(value)}
            onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      default:
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => updateSettingValue(setting.setting_key, e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="أدخل القيمة..."
          />
        )
    }
  }

  // دالة polling للتحقق من حالة النسخ الاحتياطي
  const pollBackupStatus = async (backupId: string, maxAttempts: number = 60): Promise<BackupRecord | null> => {
    let attempts = 0
    const pollInterval = 3000 // 3 ثواني
    
    while (attempts < maxAttempts) {
      try {
        const { data: backup, error } = await supabase
          .from('backup_history')
          .select('*')
          .eq('id', backupId)
          .single()
        
        if (error) {
          console.error('[Backup] Error polling backup status:', error)
          attempts++
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          continue
        }
        
        if (backup) {
          if (backup.status === 'completed') {
            logger.debug('[Backup] Backup completed successfully:', backup.id)
            return backup
          } else if (backup.status === 'failed') {
            console.error('[Backup] Backup failed:', backup.error_message)
            throw new Error(backup.error_message || 'فشل في إنشاء النسخة الاحتياطية')
          }
          // إذا كانت الحالة 'in_progress'، نستمر في polling
        }
        
        attempts++
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      } catch (error) {
        if (error.message && error.message.includes('فشل')) {
          throw error
        }
        console.error('[Backup] Error in polling:', error)
        attempts++
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }
    
    // إذا وصلنا هنا، يعني انتهى الوقت المحدد
    console.warn('[Backup] Polling timeout after', maxAttempts, 'attempts')
    return null
  }

  const createBackup = async () => {
    setIsCreatingBackup(true)
    let timeoutOccurred = false
    
    try {
      logger.debug('[Backup] Starting backup creation...')
      
      // إنشاء timeout promise (120 ثانية)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          timeoutOccurred = true
          reject(new Error('TIMEOUT'))
        }, 120000) // 120 ثانية
      })
      
      // إنشاء promise للطلب
      const backupPromise = supabase.functions.invoke('automated-backup', {
        body: { backup_type: 'manual' }
      })
      
      // استخدام Promise.race للانتظار بين الطلب والtimeout
      let response: { data?: unknown; error?: unknown } | undefined
      try {
        response = await Promise.race([backupPromise, timeoutPromise]) as { data?: unknown; error?: unknown }
        logger.debug('[Backup] Response received:', { data: response?.data, error: response?.error, dataType: typeof response?.data })
      } catch (raceError: unknown) {
        const raceErrorMessage = getErrorMessage(raceError)
        if (raceErrorMessage === 'TIMEOUT' || timeoutOccurred) {
          console.warn('[Backup] Request timeout after 120 seconds, starting polling...')
          timeoutOccurred = true
          
          // البحث عن آخر نسخة احتياطية بدأت مؤخراً
          const { data: recentBackups, error: dbError } = await supabase
            .from('backup_history')
            .select('*')
            .eq('backup_type', 'manual')
            .order('started_at', { ascending: false })
            .limit(1)
          
          if (dbError) {
            console.error('[Backup] Error checking database:', dbError)
            toast.warning('استغرق إنشاء النسخة الاحتياطية وقتاً طويلاً. يرجى التحقق من قائمة النسخ الاحتياطية.')
            return
          }
          
          if (recentBackups && recentBackups.length > 0) {
            const latestBackup = recentBackups[0]
            const backupAge = Date.now() - new Date(latestBackup.started_at).getTime()
            
            // إذا كانت النسخة بدأت خلال آخر 3 دقائق، نبدأ polling
            if (backupAge < 180000) {
              logger.debug('[Backup] Found recent backup, starting polling:', latestBackup.id)
              
              // بدء polling
              setIsPollingBackup(true)
              toast.info('جاري التحقق من حالة النسخة الاحتياطية...', { duration: 5000 })
              
              try {
                const completedBackup = await pollBackupStatus(latestBackup.id, 60) // 60 محاولة × 3 ثواني = 3 دقائق
                
                if (completedBackup) {
                  toast.success('تم إنشاء النسخة الاحتياطية بنجاح')
                  
                  // تحميل النسخ
                  await loadBackups()
                } else {
                  toast.warning('استغرق إنشاء النسخة الاحتياطية وقتاً طويلاً. يرجى التحقق من قائمة النسخ الاحتياطية.')
                  await loadBackups()
                }
              } catch (pollError: unknown) {
                const errorMessage = pollError instanceof Error ? pollError.message : 'حدث خطأ أثناء التحقق من حالة النسخة الاحتياطية'
                console.error('[Backup] Error during polling:', pollError)
                toast.error(errorMessage)
                await loadBackups()
              } finally {
                setIsPollingBackup(false)
              }
              
              return // الخروج من الدالة
            }
          }
          
          // إذا لم نجد نسخة حديثة، نعرض رسالة timeout
          toast.warning('استغرق إنشاء النسخة الاحتياطية وقتاً طويلاً. يرجى التحقق من قائمة النسخ الاحتياطية.')
          
          // محاولة تحميل النسخ على أي حال
          try {
            await loadBackups()
          } catch (loadError) {
            console.error('[Backup] Error loading backups after timeout:', loadError)
          }
          
          return // الخروج من الدالة
        } else {
          // خطأ آخر غير timeout
          throw raceError
        }
      }

      const { data, error } = response

      if (error) {
        console.error('[Backup] Error from function:', error)
        throw error
      }

      // معالجة الاستجابة - قد تكون string أو object
      let responseData = data
      if (typeof data === 'string') {
        try {
          responseData = JSON.parse(data)
          logger.debug('[Backup] Parsed string response:', responseData)
        } catch (parseError) {
          console.error('[Backup] Failed to parse response:', parseError)
          throw new Error('استجابة غير صحيحة من الخادم')
        }
      }

      if (responseData && typeof responseData === 'object' && 'success' in responseData && (responseData as { success: unknown }).success) {
        logger.debug('[Backup] Backup created successfully:', responseData)
        
        // إضافة delay صغير لضمان ظهور الرسالة
        await new Promise(resolve => setTimeout(resolve, 100))
        toast.success('تم إنشاء النسخة الاحتياطية بنجاح')
        
        // إضافة delay صغير للسماح بإنشاء السجل في قاعدة البيانات
        await new Promise(resolve => setTimeout(resolve, 400))
        
        // محاولة تحميل النسخ الاحتياطية مع retry mechanism
        let retries = 3
        let loaded = false
        
        while (retries > 0 && !loaded) {
          try {
            logger.debug(`[Backup] Loading backups (attempt ${4 - retries}/3)...`)
            await loadBackups()
            
            // التحقق من وجود النسخة الجديدة في القائمة
            await new Promise(resolve => setTimeout(resolve, 300))
            const { data: latestBackups } = await supabase
              .from('backup_history')
              .select('id')
              .order('started_at', { ascending: false })
              .limit(1)
            
            if (latestBackups && latestBackups.length > 0) {
              logger.debug('[Backup] Latest backup found:', latestBackups[0].id)
              // إعادة تحميل القائمة مرة أخرى للتأكد
              await loadBackups()
              loaded = true
            } else {
              logger.debug('[Backup] Backup not found yet, retrying...')
              retries--
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000))
              }
            }
          } catch (loadError) {
            console.error('[Backup] Error loading backups:', loadError)
            retries--
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }
        
        if (!loaded) {
          console.warn('[Backup] Could not load backup list after retries, but backup was created successfully')
          // إعادة تحميل القائمة مرة أخيرة
          try {
            await loadBackups()
          } catch (finalError) {
            console.error('[Backup] Final load attempt failed:', finalError)
          }
        }
      } else {
        let firstErrorMessage = ''
        if (responseData && typeof responseData === 'object' && 'error' in responseData) {
          firstErrorMessage = (responseData as { error: unknown }).error as string || 'فشل في إنشاء النسخة الاحتياطية'
        } else {
          firstErrorMessage = 'فشل في إنشاء النسخة الاحتياطية'
        }
        console.error('[Backup] Backup creation failed:', firstErrorMessage)
        throw new Error(firstErrorMessage)
      }
    } catch (error: unknown) {
      let errorMessage = getErrorMessage(error)
      console.error('[Backup] Error creating backup:', error)
      
      // إذا كان الخطأ timeout، لا نعرض رسالة خطأ إضافية (تم عرضها بالفعل)
      const errorMessageForCheck = error instanceof Error ? error.message : String(error)
      if (errorMessageForCheck === 'TIMEOUT' || timeoutOccurred) {
        // تم التعامل مع timeout بالفعل
        return
      }
      
      // معالجة خطأ 546 من Edge Function - قد تكون النسخة تم إنشاؤها رغم الخطأ
      const errorStatus = getErrorStatus(error)
      if (errorStatus === 546 || errorMessageForCheck.includes('546')) {
        console.warn('[Backup] Edge Function returned 546, checking database for backup...')
        
        // التحقق من قاعدة البيانات مباشرة
        try {
          const { data: recentBackups } = await supabase
            .from('backup_history')
            .select('*')
            .eq('backup_type', 'manual')
            .order('started_at', { ascending: false })
            .limit(1)
          
          if (recentBackups && recentBackups.length > 0) {
            const latestBackup = recentBackups[0]
            const backupAge = Date.now() - new Date(latestBackup.started_at).getTime()
            
            // إذا كانت النسخة تم إنشاؤها خلال آخر 3 دقائق، نعتبرها النسخة الجديدة
            if (backupAge < 180000) {
              logger.debug('[Backup] Found recent backup despite 546 error:', latestBackup.id)
              
              // إضافة delay صغير لضمان ظهور الرسالة
              await new Promise(resolve => setTimeout(resolve, 100))
              toast.success('تم إنشاء النسخة الاحتياطية بنجاح (تم التحقق من قاعدة البيانات)')
              
              // إضافة delay آخر قبل تحميل القائمة
              await new Promise(resolve => setTimeout(resolve, 300))
              
              try {
                await loadBackups()
              } catch (loadError) {
                console.error('[Backup] Error loading backups after 546 check:', loadError)
              }
              
              return // الخروج من الدالة بنجاح
            }
          }
        } catch (dbCheckError) {
          console.error('[Backup] Error checking database after 546:', dbCheckError)
        }
        
        // إذا لم نجد نسخة، نعرض رسالة خطأ
        toast.error('حدث خطأ في إنشاء النسخة الاحتياطية. يرجى التحقق من قائمة النسخ الاحتياطية.')
        return
      }
      
      errorMessage = getErrorMessage(error)
      toast.error(errorMessage)
    } finally {
      logger.debug('[Backup] Setting isCreatingBackup to false')
      // ضمان تنفيذ finally دائماً
      setIsCreatingBackup(false)
      // إعادة تعيين حالة polling في حالة عدم اكتمالها
      if (isPollingBackup) {
        setIsPollingBackup(false)
      }
    }
  }

  const openDeleteModal = (backupId: string, filePath: string, fileName: string) => {
    setBackupToDelete({ id: backupId, filePath, fileName })
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setBackupToDelete(null)
    setSelectedBackups(new Set())
  }

  // دوال إدارة التحديد
  const toggleBackupSelection = (backupId: string) => {
    setSelectedBackups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(backupId)) {
        newSet.delete(backupId)
      } else {
        newSet.add(backupId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedBackups.size === backups.length) {
      setSelectedBackups(new Set())
    } else {
      setSelectedBackups(new Set(backups.map(b => b.id)))
    }
  }

  const openBulkDeleteModal = () => {
    if (selectedBackups.size === 0) return
    
    // إنشاء كائن وهمي للحذف المتعدد
    setBackupToDelete({ 
      id: Array.from(selectedBackups).join(','), 
      filePath: '', 
      fileName: `${selectedBackups.size} نسخة احتياطية` 
    })
    setShowDeleteModal(true)
  }

  const deleteBackup = async () => {
    if (!backupToDelete) return

    const { id: backupId, filePath } = backupToDelete
    const isBulkDelete = backupId.includes(',')

    try {
      setIsDeletingBackups(true)
      
      if (isBulkDelete) {
        // حذف متعدد
        const backupIds = backupId.split(',')
        logger.debug('[Backup] Starting bulk deletion:', { count: backupIds.length, backupIds })
        
        // الحصول على معلومات النسخ المحددة
        const backupsToDelete = backups.filter(b => backupIds.includes(b.id))
        
        let successCount = 0
        let failCount = 0
        const filePaths: string[] = []

        // حذف الملفات من Storage
        for (const backup of backupsToDelete) {
          try {
            const { error: storageError } = await supabase.storage
              .from('backups')
              .remove([backup.file_path])

            if (storageError && !storageError.message?.includes('not found') && !storageError.message?.includes('Object not found')) {
              console.warn(`[Backup] Failed to delete file from storage: ${backup.file_path}`, storageError)
            } else {
              filePaths.push(backup.file_path)
            }
          } catch (err) {
            console.warn(`[Backup] Error deleting file from storage: ${backup.file_path}`, err)
          }
        }

        // حذف السجلات من قاعدة البيانات
        const { error: dbError, count } = await supabase
          .from('backup_history')
          .delete({ count: 'exact' })
          .in('id', backupIds)

        if (dbError) {
          console.error('[Backup] Database bulk deletion error:', dbError)
          throw dbError
        }

        successCount = count || 0
        failCount = backupIds.length - successCount

        if (successCount > 0) {
          toast.success(`تم حذف ${successCount} نسخة احتياطية بنجاح`)
        }
        if (failCount > 0) {
          toast.warning(`فشل في حذف ${failCount} نسخة احتياطية`)
        }
      } else {
        // حذف واحد (الكود الأصلي)
        logger.debug('[Backup] Starting deletion:', { backupId, filePath })
        
        // حذف الملف من Storage (إذا كان موجوداً)
        try {
          const { error: storageError } = await supabase.storage
            .from('backups')
            .remove([filePath])

          if (storageError) {
            // إذا كان الملف غير موجود، لا نعتبره خطأ حرج
            if (storageError.message?.includes('not found') || storageError.message?.includes('Object not found')) {
              console.warn('[Backup] File not found in storage (may have been deleted already):', storageError.message)
              // نعتبره نجح لأن الملف غير موجود أصلاً
            } else {
              throw storageError
            }
          } else {
            logger.debug('[Backup] File deleted from storage successfully')
          }
        } catch (storageErr: unknown) {
          // إذا كان الملف غير موجود، نتابع الحذف من قاعدة البيانات
          const storageErrorMessage = storageErr instanceof Error ? storageErr.message : String(storageErr)
          if (storageErrorMessage.includes('not found') || storageErrorMessage.includes('Object not found')) {
            console.warn('[Backup] File not found in storage, continuing with database deletion')
          } else {
            throw storageErr
          }
        }

        // حذف السجل من قاعدة البيانات
        const { error: dbError, count } = await supabase
          .from('backup_history')
          .delete({ count: 'exact' })
          .eq('id', backupId)

        if (dbError) {
          console.error('[Backup] Database deletion error:', dbError)
          throw dbError
        }

        // التحقق من نجاح الحذف - استخدام count بدلاً من dbData
        if (count === 0) {
          console.warn('[Backup] No record found to delete (may have been deleted already)')
          toast.warning('النسخة الاحتياطية غير موجودة أو تم حذفها مسبقاً')
        } else {
          logger.debug('[Backup] Backup deleted successfully from database, count:', count)
          toast.success('تم حذف النسخة الاحتياطية بنجاح')
        }
      }

      // إغلاق الـ modal
      closeDeleteModal()

      // إعادة تحميل القائمة
      await loadBackups()
    } catch (error: unknown) {
      let errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف'
      console.error('[Backup] Error deleting backup:', error)
      if (!errorMessage || errorMessage === 'حدث خطأ غير معروف') {
        errorMessage = 'فشل في حذف النسخة الاحتياطية'
      }
      toast.error(`فشل في حذف النسخة الاحتياطية: ${errorMessage}`)
    } finally {
      setIsDeletingBackups(false)
    }
  }

  const downloadBackup = async (filePath: string) => {
    try {
      logger.debug('[Backup] Starting download:', filePath)
      const { data, error } = await supabase.storage
        .from('backups')
        .download(filePath)

      if (error) {
        console.error('[Backup] Download error:', error)
        throw error
      }

      if (!data) {
        throw new Error('الملف غير موجود')
      }

      // إنشاء رابط التحميل
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = filePath
      link.click()
      URL.revokeObjectURL(url)

      logger.debug('[Backup] Download completed successfully')
      toast.success('تم تحميل النسخة الاحتياطية')
    } catch (error: unknown) {
      let errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف'
      console.error('[Backup] Error downloading backup:', error)
      if (!errorMessage || errorMessage === 'حدث خطأ غير معروف') {
        errorMessage = 'فشل في تحميل النسخة الاحتياطية'
      }
      toast.error(errorMessage)
    }
  }

  const openEmailModal = (backup: BackupRecord) => {
    setSelectedBackupForEmail(backup)
    setShowEmailModal(true)
    // تحميل الإيميلات المحفوظة إذا كانت موجودة
    if (savedEmailRecipients.length > 0) {
      setEmailRecipients(savedEmailRecipients.join(', '))
    }
  }

  const sendBackupByEmail = async () => {
    if (!selectedBackupForEmail) return

    // التحقق من وجود إيميلات
    const emails = emailRecipients
      .split(',')
      .map(e => e.trim())
      .filter(e => e && e.includes('@'))

    if (emails.length === 0) {
      toast.error('يرجى إدخال عنوان بريد إلكتروني واحد على الأقل')
      return
    }

    setIsSendingEmail(true)
    
    try {
      logger.debug('[Email Queue] Adding email to queue for backup:', selectedBackupForEmail.file_path)
      
      // إنشاء رابط تحميل موقّع (صالح لمدة سنة واحدة)
      let downloadUrl = ''
      
      try {
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from('backups')
          .createSignedUrl(selectedBackupForEmail.file_path, 60 * 60 * 24 * 365) // سنة واحدة (365 يوم)

        if (!urlError && signedUrlData) {
          downloadUrl = signedUrlData.signedUrl
          logger.debug('[Email Queue] Download URL created successfully')
        } else {
          console.warn('[Email Queue] Could not create download URL:', urlError?.message || urlError)
          // لا نرمي خطأ هنا، سنرسل البريد بدون رابط
        }
      } catch (urlCreateError: unknown) {
        const urlErrorMessage = urlCreateError instanceof Error ? urlCreateError.message : String(urlCreateError)
        console.warn('[Email Queue] Error creating download URL (non-critical):', urlErrorMessage)
        // لا نرمي خطأ هنا، سنرسل البريد بدون رابط
      }
      
      const date = new Date(selectedBackupForEmail.started_at).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })
      const fileSizeMB = ((selectedBackupForEmail.file_size || 0) / (1024 * 1024)).toFixed(2)

      // بناء محتوى البريد
      const htmlContent = `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2563eb;">نسخة احتياطية من SawTracker</h2>
          <p><strong>اسم الملف:</strong> ${selectedBackupForEmail.file_path}</p>
          <p><strong>نوع النسخة:</strong> ${selectedBackupForEmail.backup_type === 'full' ? 'كاملة' : selectedBackupForEmail.backup_type === 'incremental' ? 'تزايدية' : selectedBackupForEmail.backup_type === 'manual' ? 'يدوي' : 'جزئية'}</p>
          <p><strong>حجم الملف:</strong> ${fileSizeMB} MB</p>
          <p><strong>تاريخ الإنشاء:</strong> ${date}</p>
          <p><strong>عدد الجداول:</strong> ${selectedBackupForEmail.tables_included?.length || 0}</p>
          ${downloadUrl ? `
            <p style="margin-top: 20px;">
              <a href="${downloadUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                تحميل النسخة الاحتياطية
              </a>
            </p>
            <p style="margin-top: 10px; color: #666; font-size: 12px;">
              ملاحظة: هذا الرابط صالح لمدة سنة واحدة (365 يوم). يمكنك استخدامه لتحميل النسخة الاحتياطية.
            </p>
          ` : `
            <p style="margin-top: 20px; color: #ef4444; font-size: 14px;">
              ⚠️ تعذر إنشاء رابط تحميل. يمكنك تحميل النسخة الاحتياطية من صفحة إدارة الأمان.
            </p>
          `}
        </div>
      `

      const textContent = `نسخة احتياطية - ${selectedBackupForEmail.file_path}\nتاريخ الإنشاء: ${date}\nحجم الملف: ${fileSizeMB} MB${downloadUrl ? `\nرابط التحميل (صالح لمدة سنة): ${downloadUrl}` : '\n⚠️ تعذر إنشاء رابط تحميل.'}`

      // إضافة سجل في email_queue
      const { data: queueItem, error: queueError } = await supabase
        .from('email_queue')
        .insert({
          to_emails: emails,
          subject: `نسخة احتياطية - ${selectedBackupForEmail.file_path}`,
          html_content: htmlContent,
          text_content: textContent,
          attachments: [],
          status: 'pending',
          priority: 0,
          retry_count: 0,
          max_retries: 3
        })
        .select()
        .single()

      if (queueError) {
        console.error('[Email Queue] Error adding to queue:', queueError)
        throw new Error('فشل في إضافة البريد إلى قائمة الانتظار: ' + queueError.message)
      }

      logger.debug('[Email Queue] Email added to queue successfully:', queueItem?.id)
      toast.success(`تمت إضافة البريد إلى قائمة الانتظار. سيتم إرساله قريباً إلى ${emails.length} عنوان بريد إلكتروني`)
      
      // تحديث قائمة البريد
      await loadEmailQueue()
      
      // إغلاق الـ modal
      setShowEmailModal(false)
      setEmailRecipients('')
      setSelectedBackupForEmail(null)
      
    } catch (error: unknown) {
      let errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير معروف'
      console.error('[Email Queue] Error adding email to queue:', error)
      if (!errorMessage || errorMessage === 'حدث خطأ غير معروف') {
        errorMessage = 'فشل في إضافة البريد إلى قائمة الانتظار'
      }
      toast.error(errorMessage)
    } finally {
      setIsSendingEmail(false)
    }
  }

  const terminateSession = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من إنهاء هذه الجلسة؟')) return

    try {
      // إنهاء الجلسة فعلياً في قاعدة البيانات
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          logged_out_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (error) {
        throw error
      }

      // تحديث الحالة المحلية
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId))
      
      // إعادة تحميل سجل الجلسات إذا كان محملاً
      if (sessionHistory.length > 0) {
        await loadSessionHistory()
      }
      
      toast.success('تم إنهاء الجلسة بنجاح')
    } catch (error) {
      console.error('Error terminating session:', error)
      toast.error('فشل في إنهاء الجلسة')
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return

    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) {
        throw error
      }

      // تحديث الحالة المحلية
      setSessionHistory(prev => prev.filter(s => s.id !== sessionId))
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId))
      setSelectedSessions(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionId)
        return newSet
      })
      
      toast.success('تم حذف الجلسة بنجاح')
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('فشل في حذف الجلسة')
    }
  }

  const deleteSelectedSessions = async () => {
    if (selectedSessions.size === 0) {
      toast.warning('لم يتم تحديد أي جلسات للحذف')
      return
    }

    if (!confirm(`هل أنت متأكد من حذف ${selectedSessions.size} جلسة؟`)) return

    setIsDeletingSessions(true)
    try {
      const sessionIds = Array.from(selectedSessions)
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .in('id', sessionIds)

      if (error) {
        throw error
      }

      // تحديث الحالة المحلية
      setSessionHistory(prev => prev.filter(s => !selectedSessions.has(s.id)))
      setActiveSessions(prev => prev.filter(s => !selectedSessions.has(s.id)))
      setSelectedSessions(new Set())
      
      toast.success(`تم حذف ${sessionIds.length} جلسة بنجاح`)
    } catch (error) {
      console.error('Error deleting sessions:', error)
      toast.error('فشل في حذف الجلسات')
    } finally {
      setIsDeletingSessions(false)
    }
  }

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId)
      } else {
        newSet.add(sessionId)
      }
      return newSet
    })
  }

  const toggleAllSessions = () => {
    if (selectedSessions.size === sessionHistory.length) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(sessionHistory.map(s => s.id)))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return formatDateWithHijri(dateString, true)
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Shield className="w-8 h-8 text-red-600" />
            إدارة الأمان والنسخ الاحتياطية
          </h1>
          <p className="text-gray-600">إدارة شاملة لأمان النظام والحماية والنسخ الاحتياطية</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">إجمالي السجلات</p>
                <p className="text-2xl font-bold">{auditStats.total_logs}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">عمليات عالية الخطورة</p>
                <p className="text-2xl font-bold">{auditStats.high_risk_operations}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Key className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">فشل دخول اليوم</p>
                <p className="text-2xl font-bold">{auditStats.failed_logins_today}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">الجلسات النشطة</p>
                <p className="text-2xl font-bold">{auditStats.active_sessions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">إجمالي سجلات الجلسات</p>
                <p className="text-2xl font-bold">{auditStats.total_sessions}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border rounded-lg">
          <div className="border-b">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                إعدادات الأمان
              </button>
              <button
                onClick={() => setActiveTab('backups')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'backups'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Database className="w-4 h-4 inline mr-2" />
                النسخ الاحتياطية
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'sessions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                الجلسات النشطة
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                إحصائيات التدقيق
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Security Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">إعدادات الأمان</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddSettingModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      إضافة إعداد
                    </button>
                    <button
                      onClick={loadSecuritySettings}
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      تحديث
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {securitySettings.map((setting) => (
                    <div key={setting.id} className="border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{setting.setting_key.replace(/_/g, ' ')}</h3>
                          {setting.description && (
                            <p className="text-gray-600 text-sm mt-1">{setting.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          آخر تحديث: <HijriDateDisplay date={setting.updated_at}>
                            {formatDate(setting.updated_at)}
                          </HijriDateDisplay>
                        </span>
                      </div>
                      
                      <div className="mb-3">
                        {renderSettingInput(setting)}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t">
                        <button
                          onClick={() => updateSecuritySetting(setting.setting_key, settingsValues[setting.setting_key] ?? setting.setting_value)}
                          disabled={savingSetting === setting.setting_key || isLoading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                        >
                          {savingSetting === setting.setting_key ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              جاري الحفظ...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              حفظ
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {securitySettings.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p className="mb-4">لا توجد إعدادات أمان حالياً</p>
                      <p className="text-sm text-gray-400 mb-4">يمكنك إضافة إعدادات جديدة من الزر أدناه</p>
                      <button
                        onClick={() => setShowAddSettingModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2 mx-auto"
                      >
                        <Save className="w-4 h-4" />
                        إضافة إعداد جديد
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Backups Tab */}
            {activeTab === 'backups' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    النسخ الاحتياطية
                    {selectedBackups.size > 0 && (
                      <span className="mr-2 text-sm font-normal text-gray-600">
                        ({selectedBackups.size} محددة)
                      </span>
                    )}
                  </h2>
                  <div className="flex gap-2">
                    {selectedBackups.size > 0 && (
                      <button
                        onClick={openBulkDeleteModal}
                        disabled={isDeletingBackups}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <Trash2 className={`w-4 h-4 ${isDeletingBackups ? 'animate-spin' : ''}`} />
                        حذف المحددة ({selectedBackups.size})
                      </button>
                    )}
                    <button
                      onClick={loadBackups}
                      disabled={isLoading}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      تحديث
                    </button>
                    <button
                      onClick={createBackup}
                      disabled={isCreatingBackup || isPollingBackup}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <Database className={`w-4 h-4 ${(isCreatingBackup || isPollingBackup) ? 'animate-spin' : ''}`} />
                      {isPollingBackup ? 'جاري التحقق من حالة النسخة...' : isCreatingBackup ? 'جاري إنشاء النسخة...' : 'إنشاء نسخة احتياطية'}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-right w-12">
                          <input
                            type="checkbox"
                            checked={backups.length > 0 && selectedBackups.size === backups.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            title="تحديد الكل"
                          />
                        </th>
                        <th className="px-4 py-2 text-right">النوع</th>
                        <th className="px-4 py-2 text-right">اسم الملف</th>
                        <th className="px-4 py-2 text-right">الحجم</th>
                        <th className="px-4 py-2 text-right">نسبة الضغط</th>
                        <th className="px-4 py-2 text-right">الحالة</th>
                        <th className="px-4 py-2 text-right">تاريخ الإنشاء</th>
                        <th className="px-4 py-2 text-right">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => (
                        <tr key={backup.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={selectedBackups.has(backup.id)}
                              onChange={() => toggleBackupSelection(backup.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              backup.backup_type === 'manual' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {backup.backup_type === 'manual' ? 'يدوي' : 'تلقائي'}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{backup.file_path}</td>
                          <td className="px-4 py-2">{formatFileSize(backup.file_size)}</td>
                          <td className="px-4 py-2">{backup.compression_ratio?.toFixed(1)}%</td>
                          <td className="px-4 py-2">
                            <span className={`flex items-center gap-1 ${
                              backup.status === 'completed' ? 'text-green-600' : 
                              backup.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                              {backup.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                              {backup.status === 'failed' && <AlertTriangle className="w-4 h-4" />}
                              {backup.status === 'completed' ? 'مكتمل' : 
                               backup.status === 'failed' ? 'فشل' : 'قيد التنفيذ'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <HijriDateDisplay date={backup.started_at}>
                              {formatDate(backup.started_at)}
                            </HijriDateDisplay>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              {backup.status === 'completed' && (
                                <>
                                  <button
                                    onClick={() => downloadBackup(backup.file_path)}
                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                    title="تحميل"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openEmailModal(backup)}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    title="إرسال بالبريد"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openDeleteModal(backup.id, backup.file_path, backup.file_path)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Email Queue Section */}
                <div className="mt-8 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      قائمة انتظار البريد الإلكتروني
                    </h3>
                    <button
                      onClick={loadEmailQueue}
                      disabled={isLoadingEmailQueue}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingEmailQueue ? 'animate-spin' : ''}`} />
                      تحديث
                    </button>
                  </div>

                  {emailQueue.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      لا توجد بريد في قائمة الانتظار
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-right">الإيميلات المستلمة</th>
                            <th className="px-4 py-2 text-right">الموضوع</th>
                            <th className="px-4 py-2 text-right">الحالة</th>
                            <th className="px-4 py-2 text-right">تاريخ الإنشاء</th>
                            <th className="px-4 py-2 text-right">تاريخ المعالجة</th>
                            <th className="px-4 py-2 text-right">المحاولات</th>
                            <th className="px-4 py-2 text-right">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emailQueue.map((item) => {
                            const getStatusColor = (status: string) => {
                              switch (status) {
                                case 'pending':
                                  return 'text-yellow-600 bg-yellow-50'
                                case 'processing':
                                  return 'text-blue-600 bg-blue-50'
                                case 'completed':
                                  return 'text-green-600 bg-green-50'
                                case 'failed':
                                  return 'text-red-600 bg-red-50'
                                default:
                                  return 'text-gray-600 bg-gray-50'
                              }
                            }

                            const getStatusIcon = (status: string) => {
                              switch (status) {
                                case 'pending':
                                  return '🟡'
                                case 'processing':
                                  return '🔵'
                                case 'completed':
                                  return '🟢'
                                case 'failed':
                                  return '🔴'
                                default:
                                  return '⚪'
                              }
                            }

                            const getStatusText = (status: string) => {
                              switch (status) {
                                case 'pending':
                                  return 'قيد الانتظار'
                                case 'processing':
                                  return 'قيد المعالجة'
                                case 'completed':
                                  return 'نجح'
                                case 'failed':
                                  return 'فشل'
                                default:
                                  return status
                              }
                            }

                            return (
                              <tr key={item.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-2">
                                  <div className="flex flex-col gap-1">
                                    {item.to_emails.slice(0, 2).map((email, idx) => (
                                      <span key={idx} className="text-xs font-mono">{email}</span>
                                    ))}
                                    {item.to_emails.length > 2 && (
                                      <span className="text-xs text-gray-500">+{item.to_emails.length - 2} آخر</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2 max-w-xs truncate" title={item.subject}>
                                  {item.subject}
                                </td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 w-fit ${getStatusColor(item.status)}`}>
                                    <span>{getStatusIcon(item.status)}</span>
                                    {getStatusText(item.status)}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <HijriDateDisplay date={item.created_at}>
                                    {formatDate(item.created_at)}
                                  </HijriDateDisplay>
                                </td>
                                <td className="px-4 py-2">
                                  {item.processed_at ? (
                                    <HijriDateDisplay date={item.processed_at}>
                                      {formatDate(item.processed_at)}
                                    </HijriDateDisplay>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    item.retry_count >= item.max_retries ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {item.retry_count} / {item.max_retries}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-1">
                                    {item.status === 'failed' && (
                                      <button
                                        onClick={() => retryFailedEmail(item.id)}
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                        title="إعادة المحاولة"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                      </button>
                                    )}
                                    {item.error_message && (
                                      <button
                                        onClick={() => {
                                          toast.error(item.error_message || 'خطأ غير معروف', {
                                            description: 'تفاصيل الخطأ',
                                            duration: 10000
                                          })
                                        }}
                                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                                        title="عرض الخطأ"
                                      >
                                        <AlertTriangle className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">الجلسات النشطة</h2>
                  <button
                    onClick={loadActiveSessions}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    تحديث
                  </button>
                </div>

                <div className="grid gap-4">
                  {activeSessions.map((session) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="font-semibold">جلسة نشطة</span>
                        </div>
                        <button
                          onClick={() => terminateSession(session.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                        >
                          إنهاء الجلسة
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><span className="text-gray-600">المستخدم:</span> {session.users?.full_name || 'غير محدد'}</p>
                          <p><span className="text-gray-600">البريد الإلكتروني:</span> {session.users?.email || 'غير محدد'}</p>
                        </div>
                        <div>
                          <p><span className="text-gray-600">المتصفح:</span> {(session.device_info as Record<string, unknown>)?.browser ? String((session.device_info as Record<string, unknown>).browser) : 'غير محدد'}</p>
                          <p><span className="text-gray-600">النظام:</span> {(session.device_info as Record<string, unknown>)?.platform ? String((session.device_info as Record<string, unknown>).platform) : 'غير محدد'}</p>
                        </div>
                        <div>
                          <p>
                            <span className="text-gray-600">آخر نشاط:</span>{' '}
                            <HijriDateDisplay date={session.last_activity}>
                              {formatDate(session.last_activity)}
                            </HijriDateDisplay>
                          </p>
                        </div>
                        <div>
                          <p>
                            <span className="text-gray-600">تاريخ تسجيل الدخول:</span>{' '}
                            <HijriDateDisplay date={session.created_at}>
                              {formatDate(session.created_at)}
                            </HijriDateDisplay>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Session History Table */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">سجل الجلسات</h2>
                    <div className="flex items-center gap-2">
                      {selectedSessions.size > 0 && (
                        <button
                          onClick={deleteSelectedSessions}
                          disabled={isDeletingSessions}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          حذف المحدد ({selectedSessions.size})
                        </button>
                      )}
                      <button
                        onClick={() => {
                          loadActiveSessions()
                          loadSessionHistory()
                        }}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        تحديث
                      </button>
                    </div>
                  </div>

                  {sessionHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      لا توجد جلسات مسجلة
                    </div>
                  ) : (
                    <div className="bg-white border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-right">
                                <input
                                  type="checkbox"
                                  checked={selectedSessions.size === sessionHistory.length && sessionHistory.length > 0}
                                  onChange={toggleAllSessions}
                                  className="w-4 h-4"
                                />
                              </th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المستخدم</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">البريد الإلكتروني</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">وقت تسجيل الدخول</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">وقت تسجيل الخروج</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الحالة</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {sessionHistory.map((session) => (
                              <tr key={session.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedSessions.has(session.id)}
                                    onChange={() => toggleSessionSelection(session.id)}
                                    className="w-4 h-4"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {session.users?.full_name || 'غير محدد'}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {session.users?.email || 'غير محدد'}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <HijriDateDisplay date={session.created_at}>
                                    {formatDate(session.created_at)}
                                  </HijriDateDisplay>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {session.logged_out_at ? (
                                    <HijriDateDisplay date={session.logged_out_at}>
                                      {formatDate(session.logged_out_at)}
                                    </HijriDateDisplay>
                                  ) : session.is_active ? (
                                    <span className="text-green-600">نشطة</span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    session.is_active 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {session.is_active ? 'نشطة' : 'منتهية'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => deleteSession(session.id)}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    title="حذف"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Audit Tab */}
            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">إحصائيات التدقيق</h2>
                  <button
                    onClick={async () => {
                      setIsLoading(true)
                      try {
                        await loadActiveSessions()
                        await loadAuditStats()
                        await loadRecentSecurityEvents()
                      } finally {
                        setIsLoading(false)
                      }
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    تحديث الإحصائيات
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Security Summary */}
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

                  {/* System Status */}
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

                {/* Recent Security Events */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">الأحداث الأمنية الأخيرة</h3>
                  <div className="space-y-2 text-sm">
                    {recentSecurityEvents.length > 0 ? (
                      recentSecurityEvents.map((event) => {
                        const Icon = event.icon
                        const timeAgo = formatDistanceToNow(new Date(event.timestamp), {
                          addSuffix: true,
                          locale: ar
                        })
                        
                        return (
                          <div key={event.id} className={`flex items-center gap-2 p-2 ${event.bgColor} rounded`}>
                            <Icon className={`w-4 h-4 ${event.iconColor}`} />
                            <span>{event.title} - {timeAgo}</span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        لا توجد أحداث أمنية حديثة
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* نافذة إرسال النسخة الاحتياطية بالبريد */}
      {showEmailModal && selectedBackupForEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">إرسال نسخة احتياطية بالبريد</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">عنوان الملف</label>
                <p className="text-gray-600 text-sm font-mono">{selectedBackupForEmail.file_path}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">عناوين البريد الإلكتروني</label>
                <textarea
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="أدخل عناوين البريد مفصولة بفواصل (مثال: email1@gmail.com, email2@gmail.com)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                />
                {savedEmailRecipients.length > 0 && (
                  <button
                    onClick={() => setEmailRecipients(savedEmailRecipients.join(', '))}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    استخدام الإيميلات المحفوظة: {savedEmailRecipients.join(', ')}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setSelectedBackupForEmail(null)
                  setEmailRecipients('')
                }}
                disabled={isSendingEmail}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={sendBackupByEmail}
                disabled={isSendingEmail || !emailRecipients.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSendingEmail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    إرسال
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة إعداد جديد */}
      {showAddSettingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">إضافة إعداد أمان جديد</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">مفتاح الإعداد (setting_key) *</label>
                <input
                  type="text"
                  value={newSetting.setting_key}
                  onChange={(e) => setNewSetting(prev => ({ ...prev, setting_key: e.target.value }))}
                  placeholder="مثال: backup_email_notifications"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">نوع الإعداد *</label>
                <select
                  value={newSetting.setting_type}
                  onChange={(e) => setNewSetting(prev => ({ ...prev, setting_type: e.target.value as 'text' | 'number' | 'boolean' | 'select' | 'time' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="text">نص (text)</option>
                  <option value="number">رقم (number)</option>
                  <option value="boolean">نعم/لا (boolean)</option>
                  <option value="time">وقت (time)</option>
                  <option value="select">قائمة (select)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">القيمة *</label>
                {newSetting.setting_type === 'boolean' ? (
                  <select
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, setting_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="false">معطل (false)</option>
                    <option value="true">مفعل (true)</option>
                  </select>
                ) : newSetting.setting_type === 'time' ? (
                  <input
                    type="time"
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, setting_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <input
                    type={newSetting.setting_type === 'number' ? 'number' : 'text'}
                    value={newSetting.setting_value}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, setting_value: e.target.value }))}
                    placeholder={newSetting.setting_type === 'number' ? '0' : 'أدخل القيمة'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>

              {newSetting.setting_type === 'select' && (
                <div>
                  <label className="block text-sm font-medium mb-2">الخيارات (مفصولة بفواصل)</label>
                  <input
                    type="text"
                    value={newSetting.options}
                    onChange={(e) => setNewSetting(prev => ({ ...prev, options: e.target.value }))}
                    placeholder="مثال: option1, option2, option3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">الوصف (اختياري)</label>
                <textarea
                  value={newSetting.description}
                  onChange={(e) => setNewSetting(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف الإعداد"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button
                onClick={() => {
                  setShowAddSettingModal(false)
                  setNewSetting({
                    setting_key: '',
                    setting_value: '',
                    description: '',
                    setting_type: 'text',
                    options: ''
                  })
                }}
                disabled={isAddingSetting}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={addNewSetting}
                disabled={isAddingSetting || !newSetting.setting_key.trim() || !newSetting.setting_value}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAddingSetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    إضافة
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && backupToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 p-3 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">تأكيد الحذف</h3>
                  <p className="text-sm text-gray-600">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
              </div>
              {backupToDelete.id.includes(',') ? (
                // حذف متعدد
                <div className="text-gray-700 mb-6">
                  <p className="mb-2">
                    هل أنت متأكد من حذف <strong className="text-red-600">{backupToDelete.id.split(',').length}</strong> نسخة احتياطية؟
                  </p>
                  <span className="text-sm text-red-600 block mt-2">
                    سيتم حذف جميع الملفات والسجلات نهائياً
                  </span>
                </div>
              ) : (
                // حذف واحد
                <p className="text-gray-700 mb-6">
                  هل أنت متأكد من حذف النسخة الاحتياطية:
                  <br />
                  <strong className="text-gray-900 font-mono text-sm mt-2 block">{backupToDelete.fileName}</strong>
                  <span className="text-sm text-red-600 mt-2 block">
                    سيتم حذف الملف والسجل نهائياً
                  </span>
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={deleteBackup}
                  disabled={isDeletingBackups}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingBackups ? 'جاري الحذف...' : 'نعم، احذف'}
                </button>
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeletingBackups}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition font-medium disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}