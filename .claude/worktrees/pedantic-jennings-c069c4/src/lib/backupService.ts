import { supabase } from '@/lib/supabase'
import { enqueueEmail } from '@/lib/emailQueueService'
import { getNotificationRecipients } from '@/lib/notificationRecipientService'
import { PRIMARY_ADMIN_EMAIL } from '@/lib/notificationTypes'
import { logger } from '@/utils/logger'

export interface BackupRecord {
  id: string
  file_path: string
  status: string
  completed_at?: string | null
  started_at?: string | null
}

interface SystemSetting {
  setting_key: string
  setting_value: unknown
}

// 🔐 NEW: إرسال إشعار النسخة الاحتياطية مع نظام الإشعارات المتقدم
// استخدام new notification system مع fallback آمن
async function maybeNotifyBackupNew(backup: BackupRecord): Promise<void> {
  try {
    // ✅ استخدم نظام الإشعارات الجديد
    const recipients = await getNotificationRecipients({
      notificationType: 'backupNotifications',
      timeout: 5000,
      includeLogging: true
    })

    if (recipients.length === 0) {
      logger.warn('[BackupService] No recipients found for backup notification')
      return
    }

    const storagePath = backup.file_path
    const subject = 'تم إنشاء نسخة احتياطية جديدة للنظام'
    const bodyText = `تم إنشاء نسخة احتياطية بنجاح.\nالمعرف: ${backup.id}\nالمسار: backups/${storagePath}\nالحالة: ${backup.status}\nالوقت: ${backup.completed_at || backup.started_at}`
    const bodyHtml = `<p>تم إنشاء نسخة احتياطية بنجاح.</p>
        <ul>
          <li><strong>المعرف:</strong> ${backup.id}</li>
          <li><strong>المسار:</strong> <code>backups/${storagePath}</code></li>
          <li><strong>الحالة:</strong> ${backup.status}</li>
          <li><strong>الوقت:</strong> ${backup.completed_at || backup.started_at}</li>
        </ul>`

    logger.debug(`[BackupService] Sending backup notification to ${recipients.length} recipient(s)`)

    await enqueueEmail({
      toEmails: recipients,
      subject,
      textContent: bodyText,
      htmlContent: bodyHtml,
      priority: 'high'
    })

    logger.info(`[BackupService] Backup notification sent successfully to ${recipients.join(', ')}`)
  } catch (err) {
    logger.error(`[BackupService] maybeNotifyBackupNew error: ${err instanceof Error ? err.message : String(err)}`)
    // 🔐 FALLBACK: Try legacy system
    try {
      await maybeNotifyBackupLegacy(backup)
      logger.warn('[BackupService] Fell back to legacy notification system')
    } catch (legacyErr) {
      logger.error(`[BackupService] Legacy notification also failed: ${legacyErr instanceof Error ? legacyErr.message : String(legacyErr)}`)
    }
  }
}

// 📦 LEGACY: إرسال إشعار النسخة الاحتياطية إذا كانت مفعّلة في system_settings
// نحتفظ به للتوافقية والعودة الآمنة (fallback)
async function maybeNotifyBackupLegacy(backup: BackupRecord): Promise<void> {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['backup_notifications_enabled', 'backup_email_notifications', 'admin_email'])

    if (error) throw error

    const map = new Map<string, unknown>(settings?.map((s: SystemSetting) => [s.setting_key, s.setting_value]))
    const enabled = Boolean(map.get('backup_notifications_enabled') ?? true)
    if (!enabled) return

    const recipientsRaw = (map.get('backup_email_notifications') as string) || ''
    const adminEmail = (map.get('admin_email') as string) || PRIMARY_ADMIN_EMAIL
    const toList = [
      ...recipientsRaw.split(/[;,]/).map(s => s.trim()).filter(Boolean),
    ]
    if (toList.length === 0 && adminEmail) toList.push(adminEmail)
    if (toList.length === 0) return

    const storagePath = backup.file_path
    const subject = 'تم إنشاء نسخة احتياطية جديدة للنظام'
    const bodyText = `تم إنشاء نسخة احتياطية بنجاح.\nالمعرف: ${backup.id}\nالمسار: backups/${storagePath}\nالحالة: ${backup.status}\nالوقت: ${backup.completed_at || backup.started_at}`
    const bodyHtml = `<p>تم إنشاء نسخة احتياطية بنجاح.</p>
        <ul>
          <li><strong>المعرف:</strong> ${backup.id}</li>
          <li><strong>المسار:</strong> <code>backups/${storagePath}</code></li>
          <li><strong>الحالة:</strong> ${backup.status}</li>
          <li><strong>الوقت:</strong> ${backup.completed_at || backup.started_at}</li>
        </ul>`

    await enqueueEmail({
      toEmails: toList,
      subject,
      textContent: bodyText,
      htmlContent: bodyHtml,
      priority: 'high'
    })
  } catch (err) {
    logger.warn(`[BackupService] maybeNotifyBackupLegacy error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ✅ PUBLIC EXPORT: استخدم هذه الدالة (توجه إلى النظام الجديد مع fallback)
export async function maybeNotifyBackup(backup: BackupRecord): Promise<void> {
  // Try new system first, fall back to legacy if needed
  await maybeNotifyBackupNew(backup)
}

// إنشاء نسخة احتياطية يدوية وإرسال إشعار عند النجاح
export async function triggerManualBackupAndNotify(): Promise<BackupRecord | null> {
  const { data, error } = await supabase.functions.invoke('automated-backup', {
    body: { backup_type: 'manual' }
  })

  if (error) {
    throw error
  }

  let responseData: unknown = data
  if (typeof data === 'string') {
    try {
      responseData = JSON.parse(data)
    } catch (parseError) {
      console.error('[BackupService] Failed to parse response:', parseError)
      throw parseError
    }
  }

  if (!responseData || (typeof responseData === 'object' && responseData !== null && 'success' in responseData && !responseData.success)) {
    const message = (responseData && typeof responseData === 'object' && responseData !== null && 'error' in responseData && typeof responseData.error === 'string') 
      ? responseData.error 
      : 'فشل في إنشاء النسخة الاحتياطية'
    throw new Error(message)
  }

  const { data: latest, error: latestErr } = await supabase
    .from('backup_history')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)

  if (latestErr) {
    throw latestErr
  }

  if (latest && latest[0]) {
    const backup = latest[0] as BackupRecord
    try {
      await maybeNotifyBackup(backup)
    } catch (notifyErr) {
      console.warn('[BackupService] Notification failed:', notifyErr)
    }
    return backup
  }

  return null
}
