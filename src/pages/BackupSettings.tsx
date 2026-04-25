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
import { NotificationRecipientsConfig, AdditionalRecipient, createDefaultConfig } from '@/lib/notificationTypes'
import { Button } from '@/components/ui/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'

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
  { value: 30000, label: '30 ط«ط§ظ†ظٹط©' },
  { value: 60000, label: 'ط¯ظ‚ظٹظ‚ط© ظˆط§ط­ط¯ط©' },
  { value: 120000, label: 'ط¯ظ‚ظٹظ‚طھط§ظ†' },
  { value: 300000, label: '5 ط¯ظ‚ط§ط¦ظ‚' },
  { value: 0, label: 'طھط¹ط·ظٹظ„ ط§ظ„طھط­ط¯ظٹط« ط§ظ„طھظ„ظ‚ط§ط¦ظٹ' }
]

export default function BackupSettingsPage() {
  const { user, session } = useAuth()
  const permissions = usePermissions()

  const hasViewPermission = permissions?.canView('adminSettings') || user?.role === 'admin'
  const hasEditPermission = permissions?.canEdit('adminSettings') || user?.role === 'admin'

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('general')

  // ًں”گ NEW: Notification Recipients Config State
  const [notificationConfig, setNotificationConfig] = useState<NotificationRecipientsConfig>(createDefaultConfig())
  const [newRecipientEmail, setNewRecipientEmail] = useState('')

  // Legacy Email Config State (for backward compatibility)
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    admin_email: DEFAULT_ADMIN_EMAIL,
    backup_email_notifications: '',
    backup_notifications_enabled: true
  })
  const [recipients, setRecipients] = useState<string[]>()

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

  // Send Digest/Alert Email State
  const [isSendingDigest, setIsSendingDigest] = useState(false)
  const [digestMessage, setDigestMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Loading & Saving States
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [manualBackupLoading, setManualBackupLoading] = useState(false)
  const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null)

  const systemPulse = useMemo(() => {
    if (!stats.lastSuccessTime) {
      return { label: 'ط¹ط§ظ…ظ„ ط§ظ„ط§ظ†طھط¸ط§ط±', tone: 'warning' as const }
    }
    const diffMinutes = (Date.now() - new Date(stats.lastSuccessTime).getTime()) / 60000
    return diffMinutes > 10
      ? { label: 'ط¹ط§ظ…ظ„ ط§ظ„ط§ظ†طھط¸ط§ط±', tone: 'warning' as const }
      : { label: 'ظ†ط´ط·', tone: 'success' as const }
  }, [stats.lastSuccessTime])

  // ============================================================================
  // EMAIL CONFIGURATION FUNCTIONS - NEW SYSTEM WITH FALLBACK
  // ============================================================================

  // ًں”گ Load notification recipients from new notification_recipients setting
  const loadNotificationRecipients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'notification_recipients')
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data?.setting_value) {
        try {
          const rawValue = data.setting_value as unknown
          let parsedValue: unknown = rawValue

          if (typeof rawValue === 'string') {
            parsedValue = JSON.parse(rawValue)

            if (typeof parsedValue === 'string') {
              parsedValue = JSON.parse(parsedValue)
            }
          }

          const config = parsedValue as NotificationRecipientsConfig
          setNotificationConfig(config)
          logger.debug('[BackupSettings] Loaded notification recipients:', config)
        } catch (parseErr) {
          logger.warn('[BackupSettings] Failed to parse notification_recipients JSON:', parseErr)
          setNotificationConfig(createDefaultConfig())
        }
      } else {
        setNotificationConfig(createDefaultConfig())
      }
    } catch (error) {
      logger.error('[BackupSettings] Failed to load notification recipients:', error)
      setNotificationConfig(createDefaultConfig())
    }
  }, [])

  const loadEmailSettings = useCallback(async () => {
    setLoading(true)
    try {
      // Load both legacy and new settings
      await loadNotificationRecipients()

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
      logger.error('[BackupSettings] Failed to load email settings:', error)
      toast.error('طھط¹ط°ط± طھط­ظ…ظٹظ„ ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ')
    } finally {
      setLoading(false)
    }
  }, [loadNotificationRecipients])

  useEffect(() => {
    if (!hasViewPermission) {
      setLoading(false)
      return
    }
    loadEmailSettings()
  }, [hasViewPermission, loadEmailSettings])

  const saveEmailSettings = async () => {
    if (!hasEditPermission) {
      toast.error('ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„طھط¹ط¯ظٹظ„ ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط¨ط±ظٹط¯')
      return
    }

    setSaving(true)
    try {
      // Save new notification_recipients JSON
      const updatedConfig: NotificationRecipientsConfig = {
        ...notificationConfig,
        last_modified: new Date().toISOString()
      }

      const { error: newError } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'notification_recipients',
          setting_value: JSON.stringify(updatedConfig),
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' })
        .select()

      if (newError) throw newError

      // Also save legacy settings for backward compatibility
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

      const { error: legacyError } = await supabase
        .from('system_settings')
        .upsert(payload, { onConflict: 'setting_key' })
        .select()

      if (legacyError) throw legacyError

      toast.success('طھظ… ط­ظپط¸ ط¬ظ…ظٹط¹ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ ط¨ظ†ط¬ط§ط­')
      await loadEmailSettings()
    } catch (error) {
      logger.error('[BackupSettings] Failed to save email settings:', error)
      toast.error('ظپط´ظ„ ط­ظپط¸ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ')
    } finally {
      setSaving(false)
    }
  }

  // ًں”گ Add new recipient to notification list
  const addRecipient = () => {
    const email = newRecipientEmail.trim()
    if (!email) return
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('ط¨ط±ظٹط¯ ط؛ظٹط± طµط§ظ„ط­')
      return
    }
    if (notificationConfig.additional_recipients.some(r => r.email === email)) {
      toast.info('ظ‡ط°ط§ ط§ظ„ط¨ط±ظٹط¯ ظ…ظˆط¬ظˆط¯ ط¨ط§ظ„ظپط¹ظ„')
      return
    }
    const newRecipient: AdditionalRecipient = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      email,
      expiryAlerts: true,
      backupNotifications: true,
      dailyDigest: false,
      added_at: new Date().toISOString(),
      added_by: user?.id || 'unknown'
    }
    setNotificationConfig(prev => ({
      ...prev,
      additional_recipients: [...prev.additional_recipients, newRecipient]
    }))
    setNewRecipientEmail('')
    toast.success('طھظ… ط¥ط¶ط§ظپط© ط§ظ„ظ…ط³طھظ‚ط¨ظ„ ط§ظ„ط¬ط¯ظٹط¯')
  }

  // ًں”گ Remove recipient from notification list
  const removeRecipient = (id: string) => {
    setNotificationConfig(prev => ({
      ...prev,
      additional_recipients: prev.additional_recipients.filter(r => r.id !== id)
    }))
    toast.success('طھظ… ط­ط°ظپ ط§ظ„ظ…ط³طھظ‚ط¨ظ„')
  }

  // ًں”گ Update recipient notification flags
  const updateRecipientFlags = (id: string, updates: Partial<Omit<AdditionalRecipient, 'id' | 'email' | 'added_at' | 'added_by'>>) => {
    setNotificationConfig(prev => ({
      ...prev,
      additional_recipients: prev.additional_recipients.map(r =>
        r.id === id ? { ...r, ...updates } : r
      )
    }))
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
        toast.error('ظ„ط§ ظٹظˆط¬ط¯ ط¨ط±ظٹط¯ ط¥ط¯ط§ط±ظٹ ظ…ط­ط¯ط¯ ظ„ط¥ط±ط³ط§ظ„ ط§ظ„ط§ط®طھط¨ط§ط±')
        return
      }
      const subject = 'ط§ط®طھط¨ط§ط± ظ…ط³ط§ط± ط§ظ„ظ…ط±ط§ط³ظ„ط§طھ - ط¹ط§ط¬ظ„'
      const html = `<p>ظ‡ط°ط§ ط¨ط±ظٹط¯ ط§ط®طھط¨ط§ط± طھط´ط®ظٹطµظٹ ظ„طھط£ظƒظٹط¯ ط§ظ„ظ…ط³ط§ط±.</p><p>ط§ظ„ظˆظ‚طھ: ${new Date().toISOString()}</p>`
      const res = await enqueueEmail({
        toEmails: [admin],
        subject,
        htmlContent: html,
        priority: 'urgent'
      })
      if (res.success) {
        toast.success('طھظ… ط¥ط¶ط§ظپط© ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط§ط®طھط¨ط§ط±ظٹ ط¥ظ„ظ‰ ظ‚ط§ط¦ظ…ط© ط§ظ„ط§ظ†طھط¸ط§ط± ط¨ظ†ط¬ط§ط­ - ط³ظٹطھظ… ط§ظ„ط¥ط±ط³ط§ظ„ ظ‚ط±ظٹط¨ط§ظ‹')
        await loadStatsAndActivity()
      } else {
        // ط±ط³ط§ظ„ط© ط®ط·ط£ ط£ظƒط«ط± طھظپطµظٹظ„ط§ظ‹
        const errorMsg = res.error || 'ظپط´ظ„ ظپظٹ ط¥ط¶ط§ظپط© ط§ظ„ط¨ط±ظٹط¯ ط¥ظ„ظ‰ ط§ظ„ط·ط§ط¨ظˆط±'
        console.error('[BackupSettings] Enqueue error:', res.error)
        toast.error(`ظپط´ظ„: ${errorMsg}`)
      }
    } catch (err) {
      console.error('[BackupSettings] sendTestEmail error:', err)
      toast.error('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط¥ط±ط³ط§ظ„ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط§ط®طھط¨ط§ط±ظٹ')
    }
  }

  const retryAllFailed = async () => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .update({ status: 'pending', retry_count: 0, error_message: null })
        .eq('status', 'failed')
      if (error) throw error
      toast.success('طھظ…طھ ط¥ط¹ط§ط¯ط© ظ…ط­ط§ظˆظ„ط© ط¬ظ…ظٹط¹ ط§ظ„ط±ط³ط§ط¦ظ„ ط§ظ„ظپط§ط´ظ„ط©')
      await loadStatsAndActivity()
    } catch (err) {
      console.error('[BackupSettings] retryAllFailed error:', err)
      toast.error('ظپط´ظ„ ظپظٹ ط¥ط¹ط§ط¯ط© ط§ظ„ظ…ط­ط§ظˆظ„ط© ط§ظ„ط¬ظ…ط§ط¹ظٹط©')
    }
  }

  const clearHistory = async () => {
    try {
      const { error } = await supabase
        .from('email_queue')
        .delete()
        .in('status', ['completed', 'failed'])
      if (error) throw error
      toast.success('طھظ… ظ…ط³ط­ ط³ط¬ظ„ ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹ (ط§ظ„ظ†ط§ط¬ط­ط©/ط§ظ„ظپط§ط´ظ„ط©)')
      await loadStatsAndActivity()
    } catch (err) {
      console.error('[BackupSettings] clearHistory error:', err)
      toast.error('ظپط´ظ„ ظپظٹ ظ…ط³ط­ ط§ظ„ط³ط¬ظ„')
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
        .select('id,file_path,status,completed_at,backup_type')
        .order('started_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[Backup] Error loading backups:', error)
        toast.error('ظپط´ظ„ ظپظٹ طھط­ظ…ظٹظ„ ظ‚ط§ط¦ظ…ط© ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط©')
        return
      }

      setBackups(data || [])
      logger.debug('[Backup] Backups loaded successfully, count:', data?.length || 0)
    } catch (error) {
      console.error('[Backup] Error in loadBackups:', error)
      toast.error('ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، طھط­ظ…ظٹظ„ ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط©')
    } finally {
      setBackupsLoading(false)
    }
  }, [])

  const handleSendDigestNow = async () => {
    try {
      setIsSendingDigest(true)
      setDigestMessage(null)

      // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ظˆط¬ظˆط¯ ط¬ظ„ط³ط© ظ†ط´ط·ط©
      if (!session?.access_token) {
        setDigestMessage({
          type: 'error',
          text: 'طھظ… ط§ظ†ظ‚ط·ط§ط¹ ط§ظ„ط¬ظ„ط³ط©. ظٹط±ط¬ظ‰ طھط­ط¯ظٹط« ط§ظ„طµظپط­ط© ظˆطھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ظ…ط¬ط¯ط¯ط§ظ‹.'
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
        text: `طھظ… ط¥ط±ط³ط§ظ„ ط§ظ„ط¨ط±ظٹط¯ ط¨ظ†ط¬ط§ط­! (${result.message || 'طھظ… ط¥ط±ط³ط§ظ„ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ'})`
      })
    } catch (err) {
      console.error('Error sending digest:', err)
      setDigestMessage({
        type: 'error',
        text: `ط®ط·ط£ ظپظٹ ط¥ط±ط³ط§ظ„ ط§ظ„ط¨ط±ظٹط¯: ${err instanceof Error ? err.message : 'ط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰'}`
      })
    } finally {
      setIsSendingDigest(false)
    }
  }

  const handleManualBackup = async () => {
    if (manualBackupLoading) return
    setManualBackupLoading(true)
    try {
      await triggerManualBackupAndNotify()
      toast.success('طھظ… ط¥ط·ظ„ط§ظ‚ ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ط¨ظ†ط¬ط§ط­')
      await loadBackups()
      await loadStatsAndActivity()
    } catch (err) {
      console.error('[BackupSettings] manual backup error:', err)
      toast.error('ظپط´ظ„ ط¥ط·ظ„ط§ظ‚ ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ط§ظ„ظٹط¯ظˆظٹط©')
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

      toast.success(`طھظ… طھط­ظ…ظٹظ„ ${fileName} ط¨ظ†ط¬ط§ط­`)
    } catch (err) {
      console.error('Download failed:', err)
      toast.error('ظپط´ظ„ طھط­ظ…ظٹظ„ ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط©')
    } finally {
      setDownloadingBackup(null)
    }
  }

  const deleteBackup = async (backupId: string, filePath: string) => {
    if (!confirm('ظ‡ظ„ ط£ظ†طھ ظ…طھط£ظƒط¯ ظ…ظ† ط­ط°ظپ ظ‡ط°ظ‡ ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط©طں')) return

    try {
      // ط­ط°ظپ ظ…ظ† ط§ظ„طھط®ط²ظٹظ†
      const { error: storageError } = await supabase.storage
        .from('backups')
        .remove([filePath])

      if (storageError) console.warn('[Backup] Storage deletion warning:', storageError)

      // ط­ط°ظپ ظ…ظ† ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ
      const { error: dbError } = await supabase
        .from('backup_history')
        .delete()
        .eq('id', backupId)

      if (dbError) throw dbError

      setBackups(prev => prev.filter(b => b.id !== backupId))
      toast.success('طھظ… ط­ط°ظپ ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ط¨ظ†ط¬ط§ط­')
    } catch (err) {
      console.error('[Backup] Delete error:', err)
      toast.error('ظپط´ظ„ ط­ط°ظپ ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط©')
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
        .select('id,setting_key,setting_value,created_at,updated_at')
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
      toast.error('ظپط´ظ„ طھط­ظ…ظٹظ„ ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط£ظ…ط§ظ†')
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ط؛ظٹط± ظ…طµط±ط­</h2>
            <p className="text-gray-600">ط¹ط°ط±ط§ظ‹طŒ ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ظ„ط¹ط±ط¶ ظ‡ط°ظ‡ ط§ظ„طµظپط­ط©.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid" dir="rtl">
        {/* Header */}
        <div className="app-panel border-primary/30 bg-primary/10 p-6 text-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="app-icon-chip p-3">
                <HardDrive className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">ط¥ط¯ط§ط±ط© ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ظˆط§ظ„ط£ظ…ط§ظ†</h1>
                <p className="mt-1 text-slate-700">ظ„ظˆط­ط© طھط­ظƒظ… ظ…طھظƒط§ظ…ظ„ط© ظ„ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ظˆط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ظˆط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط£ظ…ط§ظ†</p>
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
        <div className="app-panel">
          <div className="flex border-b border-border">
            {[
              { id: 'general', label: 'ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط¹ط§ظ…ط©', icon: SettingsIcon },
              { id: 'email', label: 'ط¥ط¯ط§ط±ط© ط§ظ„ط¨ط±ظٹط¯ ظˆط§ظ„ط¥ط´ط¹ط§ط±ط§طھ', icon: Mail },
              { id: 'backup-history', label: 'ط³ط¬ظ„ ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط©', icon: Database },
              { id: 'security', label: 'ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط£ظ…ط§ظ†', icon: Shield }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`app-tab-button border-b-2 ${
                  activeTab === tab.id
                    ? 'app-tab-button-active'
                    : 'border-transparent text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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
                <div className="app-panel p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">ط§ظ„ظ…ط±ط³ظ„ ط§ظ„ظٹظˆظ…</p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">{stats.sentToday}</p>
                    </div>
                    <CheckCircle className="w-12 h-12 text-primary" />
                  </div>
                </div>
                <div className="app-panel p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">ظ‚ظٹط¯ ط§ظ„ط§ظ†طھط¸ط§ط±</p>
                      <p className="mt-2 text-3xl font-bold text-yellow-600">{stats.pending}</p>
                    </div>
                    <RefreshCw className="w-12 h-12 text-yellow-500" />
                  </div>
                </div>
                <div className="app-panel p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">ط±ط³ط§ط¦ظ„ ظپط§ط´ظ„ط©</p>
                      <p className="mt-2 text-3xl font-bold text-red-600">{stats.failed}</p>
                    </div>
                    <AlertTriangle className="w-12 h-12 text-red-400" />
                  </div>
                </div>
                <div className="app-panel p-6">
                  <div>
                    <p className="text-sm text-gray-600">ط¢ط®ط± ط¹ظ…ظ„ظٹط© ظ†ط¬ط­طھ</p>
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
                <h2 className="text-xl font-bold text-gray-900 mb-4">ط§ظ„ط¥ط¬ط±ط§ط،ط§طھ ط§ظ„ط³ط±ظٹط¹ط©</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={handleManualBackup}
                    disabled={manualBackupLoading}
                    className="w-full justify-center"
                  >
                    {manualBackupLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <HardDrive className="w-5 h-5" />
                    )}
                    {manualBackupLoading ? 'ط¬ط§ط±ظٹ ط¥ظ†ط´ط§ط، ط§ظ„ظ†ط³ط®ط©...' : 'ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط© ظٹط¯ظˆظٹط©'}
                  </Button>
                  <Button
                    onClick={sendTestEmail}
                    variant="success"
                    className="w-full justify-center"
                  >
                    <Mail className="w-5 h-5" />
                    ط¨ط±ظٹط¯ ط§ط®طھط¨ط§ط±
                  </Button>
                  <Button
                    onClick={retryAllFailed}
                    variant="warning"
                    className="w-full justify-center"
                  >
                    <RefreshCw className="w-5 h-5" />
                    ط¥ط¹ط§ط¯ط© ظ…ط­ط§ظˆظ„ط© ط§ظ„ظپط§ط´ظ„ط©
                  </Button>
                </div>
              </div>

              {/* Refresh Interval Control */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">طھط­ظƒظ… ط§ظ„طھط­ط¯ظٹط« ط§ظ„طھظ„ظ‚ط§ط¦ظٹ</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ظپطھط±ط© ط§ظ„طھط­ط¯ظٹط« ط§ظ„طھظ„ظ‚ط§ط¦ظٹ ظ„ظ…ط±ط§ظ‚ط¨ط© ط§ظ„ط¨ط±ظٹط¯
                    </label>
                    <Select
                      value={String(refreshInterval)}
                      onValueChange={(value) => setRefreshInterval(Number(value))}
                      disabled={!hasEditPermission}
                    >
                      <SelectTrigger className="w-full rounded-xl disabled:bg-gray-100">
                        <SelectValue placeholder="ط§ط®طھط± ظپطھط±ط© ط§ظ„طھط­ط¯ظٹط«" />
                      </SelectTrigger>
                      <SelectContent>
                        {REFRESH_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-600 mt-2">
                      ظƒظ„ظ…ط§ ظ‚ظ„ظ‘ ط§ظ„ط±ظ‚ظ…طŒ ظƒظ„ظ…ط§ ظƒط§ظ†طھ ط§ظ„طھط­ط¯ظٹط«ط§طھ ط£ط³ط±ط¹ ظ„ظƒظ† طھط²ظٹط¯ ط¶ط؛ط· ط§ظ„ط®ط§ط¯ظ…
                    </p>
                  </div>

                  <div className="app-info-block flex gap-3 p-4">
                    <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-900" />
                    <div className="text-sm text-slate-800">
                      <p className="font-semibold mb-1">ًں’، ظ…ظ„ط§ط­ط¸ط©:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>ط§ظ„ط­ط¯ ط§ظ„ط£ط¯ظ†ظ‰: 30 ط«ط§ظ†ظٹط©</li>
                        <li>ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰: 5 ط¯ظ‚ط§ط¦ظ‚</li>
                        <li>ط¥ط°ط§ ط§ط®طھط±طھ "طھط¹ط·ظٹظ„"طŒ ط³ظٹطھظˆظ‚ظپ ط§ظ„طھط­ط¯ظٹط« ط§ظ„طھظ„ظ‚ط§ط¦ظٹ</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Send Alert Email Section */}
              <div className="app-info-block rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-lg bg-primary/20 p-3">
                      <Mail className="w-5 h-5 text-slate-900" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">ط¥ط±ط³ط§ظ„ ط¨ط±ظٹط¯ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ</h2>
                      <p className="text-gray-600 text-sm mt-1">
                        ط£ط±ط³ظ„ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ط­ط§ظ„ظٹط© ط؛ظٹط± ط§ظ„ظ…ط­ظ„ظˆظ„ط© ط¥ظ„ظ‰ ط¨ط±ظٹط¯ظƒ ط§ظ„ط¥ط¯ط§ط±ظٹ ط§ظ„ط¢ظ†
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        ط§ظ„ط¨ط±ظٹط¯ ط³ظٹظڈط±ط³ظ„ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ظƒظ„ ظٹظˆظ… ط§ظ„ط³ط§ط¹ط© 03:00 طµط¨ط§ط­ط§ظ‹ ظ…ط¹ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ظ†ط´ط·ط©
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSendDigestNow}
                    disabled={isSendingDigest}
                    className="whitespace-nowrap"
                  >
                    {isSendingDigest ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                        ط¬ط§ط±ظٹ ط§ظ„ط¥ط±ط³ط§ظ„...
                      </span>
                    ) : (
                      'ط¥ط±ط³ط§ظ„ ط§ظ„ط¢ظ†'
                    )}
                  </Button>
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
            </div>
          )}

          {/* EMAIL TAB */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              {/* Email Queue Monitor */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">ظ…ط±ط§ظ‚ط¨ط© ظ‚ط§ط¦ظ…ط© ط§ظ„ط§ظ†طھط¸ط§ط±</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      طھط­ط¯ظٹط« ط¢ظ„ظٹ {refreshInterval === 0 ? 'ظ…ط¹ط·ظ‘ظ„' : `ظƒظ„ ${Math.round(refreshInterval / 1000)} ط«ط§ظ†ظٹط©`}
                    </p>
                  </div>
                  <button
                    onClick={clearHistory}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-semibold text-sm"
                  >
                    ظ…ط³ط­ ط§ظ„ط³ط¬ظ„
                  </button>
                </div>
                <EmailQueueMonitor />
              </div>

              {/* Email Configuration - NEW SYSTEM */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">ط¥ط¯ط§ط±ط© ظ…ط³طھظ‚ط¨ظ„ظٹ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ</h2>
                  <p className="text-sm text-gray-600">
                    ًں”گ ظ†ط¸ط§ظ… ط¥ط¯ط§ط±ط© ط¥ط´ط¹ط§ط±ط§طھ ظ…طھظ‚ط¯ظ… - ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط£ط³ط§ط³ظٹ (ahmad.alsawy159@gmail.com) ظٹطھظ„ظ‚ظ‰ ط¬ظ…ظٹط¹ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط¯ط§ط¦ظ…ط§ظ‹
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Primary Admin (Read-Only) */}
                  <div className="app-info-block rounded-lg p-4">
                    <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Shield className="w-4 h-4" />
                      ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط£ط³ط§ط³ظٹ (ظ…ط­ظ…ظٹ - ظٹطھظ„ظ‚ظ‰ ط¬ظ…ظٹط¹ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={notificationConfig.primary_admin}
                        disabled={true}
                        className="flex-1 cursor-not-allowed rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 font-semibold text-slate-900"
                      />
                      <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">âœ“ ط«ط§ط¨طھ</span>
                    </div>
                  </div>

                  {/* Additional Recipients Management */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">ظ…ط³طھظ‚ط¨ظ„ظˆظ† ط¥ط¶ط§ظپظٹظˆظ†</label>
                    
                    {notificationConfig.additional_recipients.length === 0 ? (
                      <p className="text-sm text-gray-500 mb-4">ظ„ط§ طھظˆط¬ط¯ ظ…ط³طھظ‚ط¨ظ„ظˆظ† ط¥ط¶ط§ظپظٹظˆظ† ط­ط§ظ„ظٹط§ظ‹</p>
                    ) : (
                      <div className="space-y-3 mb-4">
                        {notificationConfig.additional_recipients.map((recipient) => (
                          <div key={recipient.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{recipient.email}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  ط£ط¶ظٹظپ ط¨ظˆط§ط³ط·ط©: {recipient.added_by === user?.id ? 'ط£ظ†طھ' : 'ظ…ط³ط¤ظˆظ„ ط¢ط®ط±'} â€¢ {new Date(recipient.added_at).toLocaleDateString('ar-SA')}
                                </p>
                              </div>
                              <button
                                onClick={() => removeRecipient(recipient.id)}
                                disabled={!hasEditPermission}
                                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 text-sm font-medium"
                              >
                                ط­ط°ظپ
                              </button>
                            </div>

                            {/* Notification Type Toggles */}
                            <div className="grid grid-cols-3 gap-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={recipient.expiryAlerts}
                                  onChange={(e) => updateRecipientFlags(recipient.id, { expiryAlerts: e.target.checked })}
                                  disabled={!hasEditPermission}
                                  className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-gray-700">طھظ†ط¨ظٹظ‡ط§طھ ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط©</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={recipient.backupNotifications}
                                  onChange={(e) => updateRecipientFlags(recipient.id, { backupNotifications: e.target.checked })}
                                  disabled={!hasEditPermission}
                                  className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-gray-700">ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط©</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={recipient.dailyDigest}
                                  onChange={(e) => updateRecipientFlags(recipient.id, { dailyDigest: e.target.checked })}
                                  disabled={!hasEditPermission}
                                  className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-gray-700">ط§ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹ</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Recipient */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newRecipientEmail}
                          onChange={(e) => setNewRecipientEmail(e.target.value)}
                          disabled={!hasEditPermission}
                          placeholder="ط£ط¶ظپ ط¨ط±ظٹط¯ ط¥ظ„ظƒطھط±ظˆظ†ظٹ ط¬ط¯ظٹط¯..."
                          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus-ring-brand disabled:bg-gray-100"
                          onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
                        />
                        <Button
                          onClick={addRecipient}
                          disabled={!hasEditPermission || !newRecipientEmail.trim()}
                          size="sm"
                        >
                          ط¥ط¶ط§ظپط©
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">ط³ظٹطھظ…ظƒظ† ط§ظ„ظ…ط³طھظ‚ط¨ظ„ ط§ظ„ط¬ط¯ظٹط¯ ظ…ظ† طھظ„ظ‚ظٹ ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط§ظ„طµظ†ط§ط¯ظٹظ‚ ط§ظ„ظ…ط®طھط§ط±ط©</p>
                    </div>
                  </div>

                  {/* Enable/Disable Backup Notifications */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">طھظپط¹ظٹظ„ ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط©</p>
                        <p className="text-xs text-gray-600 mt-1">ط¥ط±ط³ط§ظ„/ط¥ظٹظ‚ط§ظپ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ط¹ظ†ط¯ ط¥طھظ…ط§ظ… ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط©</p>
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
                          emailConfig.backup_notifications_enabled ? 'bg-primary' : 'bg-gray-300'
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
                    <Button
                      onClick={saveEmailSettings}
                      disabled={saving || !hasEditPermission}
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      {saving ? 'ط¬ط§ط±ظٹ ط§ظ„ط­ظپط¸...' : 'ط­ظپط¸ ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ'}
                    </Button>
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
                    <h2 className="text-xl font-bold text-gray-900">ط³ط¬ظ„ ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط©</h2>
                    <p className="text-sm text-gray-600 mt-1">ط¬ظ…ظٹط¹ ط§ظ„ظ†ط³ط® ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ط§ظ„ظ…ط­ظپظˆط¸ط© ظ…ط¹ ط¥ظ…ظƒط§ظ†ظٹط© ط§ظ„طھط­ظ…ظٹظ„ ظˆط§ظ„ط­ط°ظپ</p>
                  </div>
                  <Button
                    onClick={loadBackups}
                    disabled={backupsLoading}
                    variant="outline"
                  >
                    <RefreshCw className={`w-4 h-4 ${backupsLoading ? 'animate-spin' : ''}`} />
                    طھط­ط¯ظٹط«
                  </Button>
                </div>

                {backupsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">ظ„ط§ طھظˆط¬ط¯ ظ†ط³ط® ط§ط­طھظٹط§ط·ظٹط© ط¨ط¹ط¯</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">ط§ظ„ظ†ظˆط¹</th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">ط§ظ„ط­ط¬ظ…</th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">ط§ظ„ط­ط§ظ„ط©</th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">ط§ظ„طھط§ط±ظٹط®</th>
                          <th className="text-right px-6 py-3 font-semibold text-gray-900">ط§ظ„ط¥ط¬ط±ط§ط،ط§طھ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {backups.map(backup => (
                          <tr key={backup.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-slate-900">
                                {backup.backup_type === 'full' ? 'ظƒط§ظ…ظ„ط©' : backup.backup_type === 'incremental' ? 'طھط²ط§ظٹط¯ظٹط©' : 'ظٹط¯ظˆظٹط©'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-900 font-mono">
                              {backup.file_size ? `${(backup.file_size / 1024).toFixed(2)} KB` : '-'}
                            </td>
                            <td className="px-6 py-4">
                              {backup.status === 'completed' ? (
                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">âœ“ ظ…ظƒطھظ…ظ„ط©</span>
                              ) : backup.status === 'failed' ? (
                                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">âœ• ظپط§ط´ظ„ط©</span>
                              ) : (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">âڈ³ ط¬ط§ط±ظٹ</span>
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
                                className="flex items-center gap-1 rounded-lg bg-primary/15 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-primary/25 disabled:opacity-60"
                              >
                                {downloadingBackup === backup.file_path ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                                طھط­ظ…ظٹظ„
                              </button>
                              <button
                                onClick={() => deleteBackup(backup.id, backup.file_path)}
                                className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-xs font-semibold"
                              >
                                <Trash2 className="w-4 h-4" />
                                ط­ط°ظپ
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
                <h2 className="text-xl font-bold text-gray-900 mb-4">ط¥ط¹ط¯ط§ط¯ط§طھ ط§ظ„ط£ظ…ط§ظ†</h2>

                {securityLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                ) : securitySettings.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">ظ„ط§ طھظˆط¬ط¯ ط¥ط¹ط¯ط§ط¯ط§طھ ط£ظ…ط§ظ† ظ…طھط§ط­ط©</p>
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


