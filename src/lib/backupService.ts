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

// ًں”گ NEW: ط¥ط±ط³ط§ظ„ ط¥ط´ط¹ط§ط± ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ظ…ط¹ ظ†ط¸ط§ظ… ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ظ…طھظ‚ط¯ظ…
// ط§ط³طھط®ط¯ط§ظ… new notification system ظ…ط¹ fallback ط¢ظ…ظ†
async function maybeNotifyBackupNew(backup: BackupRecord): Promise<void> {
  try {
    // âœ… ط§ط³طھط®ط¯ظ… ظ†ط¸ط§ظ… ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ط¬ط¯ظٹط¯
    const recipients = await getNotificationRecipients({
      notificationType: 'backupNotifications',
      timeout: 5000,
      includeLogging: true,
    })

    if (recipients.length === 0) {
      logger.warn('[BackupService] No recipients found for backup notification')
      return
    }

    const storagePath = backup.file_path
    const subject = 'طھظ… ط¥ظ†ط´ط§ط، ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط© ط¬ط¯ظٹط¯ط© ظ„ظ„ظ†ط¸ط§ظ…'
    const bodyText = `طھظ… ط¥ظ†ط´ط§ط، ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط© ط¨ظ†ط¬ط§ط­.\nط§ظ„ظ…ط¹ط±ظپ: ${backup.id}\nط§ظ„ظ…ط³ط§ط±: backups/${storagePath}\nط§ظ„ط­ط§ظ„ط©: ${backup.status}\nط§ظ„ظˆظ‚طھ: ${backup.completed_at || backup.started_at}`
    const bodyHtml = `<p>طھظ… ط¥ظ†ط´ط§ط، ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط© ط¨ظ†ط¬ط§ط­.</p>
        <ul>
          <li><strong>ط§ظ„ظ…ط¹ط±ظپ:</strong> ${backup.id}</li>
          <li><strong>ط§ظ„ظ…ط³ط§ط±:</strong> <code>backups/${storagePath}</code></li>
          <li><strong>ط§ظ„ط­ط§ظ„ط©:</strong> ${backup.status}</li>
          <li><strong>ط§ظ„ظˆظ‚طھ:</strong> ${backup.completed_at || backup.started_at}</li>
        </ul>`

    logger.debug(`[BackupService] Sending backup notification to ${recipients.length} recipient(s)`)

    await enqueueEmail({
      toEmails: recipients,
      subject,
      textContent: bodyText,
      htmlContent: bodyHtml,
      priority: 'high',
    })

    logger.info(`[BackupService] Backup notification sent successfully to ${recipients.join(', ')}`)
  } catch (err) {
    logger.error(
      `[BackupService] maybeNotifyBackupNew error: ${err instanceof Error ? err.message : String(err)}`
    )
    // ًں”گ FALLBACK: Try legacy system
    try {
      await maybeNotifyBackupLegacy(backup)
      logger.warn('[BackupService] Fell back to legacy notification system')
    } catch (legacyErr) {
      logger.error(
        `[BackupService] Legacy notification also failed: ${legacyErr instanceof Error ? legacyErr.message : String(legacyErr)}`
      )
    }
  }
}

// ًں“¦ LEGACY: ط¥ط±ط³ط§ظ„ ط¥ط´ط¹ط§ط± ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط© ط¥ط°ط§ ظƒط§ظ†طھ ظ…ظپط¹ظ‘ظ„ط© ظپظٹ system_settings
// ظ†ط­طھظپط¸ ط¨ظ‡ ظ„ظ„طھظˆط§ظپظ‚ظٹط© ظˆط§ظ„ط¹ظˆط¯ط© ط§ظ„ط¢ظ…ظ†ط© (fallback)
async function maybeNotifyBackupLegacy(backup: BackupRecord): Promise<void> {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'backup_notifications_enabled',
        'backup_email_notifications',
        'admin_email',
      ])

    if (error) throw error

    const map = new Map<string, unknown>(
      settings?.map((s: SystemSetting) => [s.setting_key, s.setting_value])
    )
    const enabled = Boolean(map.get('backup_notifications_enabled') ?? true)
    if (!enabled) return

    const recipientsRaw = (map.get('backup_email_notifications') as string) || ''
    const adminEmail = (map.get('admin_email') as string) || PRIMARY_ADMIN_EMAIL
    const toList = [
      ...recipientsRaw
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ]
    if (toList.length === 0 && adminEmail) toList.push(adminEmail)
    if (toList.length === 0) return

    const storagePath = backup.file_path
    const subject = 'طھظ… ط¥ظ†ط´ط§ط، ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط© ط¬ط¯ظٹط¯ط© ظ„ظ„ظ†ط¸ط§ظ…'
    const bodyText = `طھظ… ط¥ظ†ط´ط§ط، ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط© ط¨ظ†ط¬ط§ط­.\nط§ظ„ظ…ط¹ط±ظپ: ${backup.id}\nط§ظ„ظ…ط³ط§ط±: backups/${storagePath}\nط§ظ„ط­ط§ظ„ط©: ${backup.status}\nط§ظ„ظˆظ‚طھ: ${backup.completed_at || backup.started_at}`
    const bodyHtml = `<p>طھظ… ط¥ظ†ط´ط§ط، ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط© ط¨ظ†ط¬ط§ط­.</p>
        <ul>
          <li><strong>ط§ظ„ظ…ط¹ط±ظپ:</strong> ${backup.id}</li>
          <li><strong>ط§ظ„ظ…ط³ط§ط±:</strong> <code>backups/${storagePath}</code></li>
          <li><strong>ط§ظ„ط­ط§ظ„ط©:</strong> ${backup.status}</li>
          <li><strong>ط§ظ„ظˆظ‚طھ:</strong> ${backup.completed_at || backup.started_at}</li>
        </ul>`

    await enqueueEmail({
      toEmails: toList,
      subject,
      textContent: bodyText,
      htmlContent: bodyHtml,
      priority: 'high',
    })
  } catch (err) {
    logger.warn(
      `[BackupService] maybeNotifyBackupLegacy error: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

// âœ… PUBLIC EXPORT: ط§ط³طھط®ط¯ظ… ظ‡ط°ظ‡ ط§ظ„ط¯ط§ظ„ط© (طھظˆط¬ظ‡ ط¥ظ„ظ‰ ط§ظ„ظ†ط¸ط§ظ… ط§ظ„ط¬ط¯ظٹط¯ ظ…ط¹ fallback)
export async function maybeNotifyBackup(backup: BackupRecord): Promise<void> {
  // Try new system first, fall back to legacy if needed
  await maybeNotifyBackupNew(backup)
}

// ط¥ظ†ط´ط§ط، ظ†ط³ط®ط© ط§ط­طھظٹط§ط·ظٹط© ظٹط¯ظˆظٹط© ظˆط¥ط±ط³ط§ظ„ ط¥ط´ط¹ط§ط± ط¹ظ†ط¯ ط§ظ„ظ†ط¬ط§ط­
export async function triggerManualBackupAndNotify(): Promise<BackupRecord | null> {
  const { data, error } = await supabase.functions.invoke('automated-backup', {
    body: { backup_type: 'manual' },
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

  if (
    !responseData ||
    (typeof responseData === 'object' &&
      responseData !== null &&
      'success' in responseData &&
      !responseData.success)
  ) {
    const message =
      responseData &&
      typeof responseData === 'object' &&
      responseData !== null &&
      'error' in responseData &&
      typeof responseData.error === 'string'
        ? responseData.error
        : 'ظپط´ظ„ ظپظٹ ط¥ظ†ط´ط§ط، ط§ظ„ظ†ط³ط®ط© ط§ظ„ط§ط­طھظٹط§ط·ظٹط©'
    throw new Error(message)
  }

  const { data: latest, error: latestErr } = await supabase
    .from('backup_history')
    .select('id')
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
