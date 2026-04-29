import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'

export interface BackupRecord {
  id: string
  backup_type: string
  triggered_by?: string
  file_path: string
  file_size: number
  compression_ratio: number
  status: 'in_progress' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
  error_message?: string | null
  tables_included?: string[]
}

export interface BackupSettings {
  schedule_enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  schedule_hour: number
  schedule_day: number
  retention_days: number
  delivery_mode: 'local_only' | 'local_plus_email'
  email_notifications_enabled: boolean
  email_recipients: string[]
  last_run_at: string | null
  next_run_at: string | null
}

const BACKUP_SETTING_KEYS = [
  'backup_schedule_enabled',
  'backup_frequency',
  'backup_schedule_hour',
  'backup_schedule_day',
  'backup_retention_days',
  'backup_delivery_mode',
  'backup_email_notifications_enabled',
  'backup_email_recipients',
  'backup_last_run_at',
  'backup_next_run_at',
]

export async function fetchBackupSettings(): Promise<BackupSettings> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', BACKUP_SETTING_KEYS)

  if (error) throw error

  const map = new Map(
    (data || []).map((r: { setting_key: string; setting_value: unknown }) => [
      r.setting_key,
      r.setting_value,
    ])
  )

  const raw = (key: string) => map.get(key)
  const cleanStr = (val: unknown) =>
    val != null ? String(val).replace(/^"|"$/g, '') : null
  const parseBool = (val: unknown, fallback: boolean): boolean => {
    if (typeof val === 'boolean') return val
    if (typeof val === 'string') {
      const normalized = val.replace(/^"|"$/g, '').trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
    if (typeof val === 'number') return val !== 0
    return fallback
  }
  const parseStringArray = (val: unknown, fallback: string[]): string[] => {
    if (Array.isArray(val)) {
      return val.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    }

    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (trimmed.length === 0) return fallback

      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0
          )
        }
      } catch {
        return trimmed
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      }
    }

    return fallback
  }

  return {
    schedule_enabled: parseBool(raw('backup_schedule_enabled'), false),
    frequency: (cleanStr(raw('backup_frequency')) ?? 'daily') as BackupSettings['frequency'],
    schedule_hour: Number(raw('backup_schedule_hour') ?? 2),
    schedule_day: Number(raw('backup_schedule_day') ?? 0),
    retention_days: Number(raw('backup_retention_days') ?? 30),
    delivery_mode:
      (cleanStr(raw('backup_delivery_mode')) as BackupSettings['delivery_mode']) ?? 'local_plus_email',
    email_notifications_enabled: parseBool(raw('backup_email_notifications_enabled'), true),
    email_recipients: parseStringArray(raw('backup_email_recipients'), []),
    last_run_at: cleanStr(raw('backup_last_run_at')),
    next_run_at: cleanStr(raw('backup_next_run_at')),
  }
}

export async function saveBackupSettings(settings: BackupSettings): Promise<void> {
  const rows = [
    {
      setting_key: 'backup_schedule_enabled',
      setting_value: JSON.stringify(settings.schedule_enabled),
      category: 'backup',
      description: 'تفعيل النسخ الاحتياطي التلقائي',
      setting_type: 'boolean',
    },
    {
      setting_key: 'backup_frequency',
      setting_value: JSON.stringify(settings.frequency),
      category: 'backup',
      description: 'تكرار النسخ الاحتياطي',
      setting_type: 'select',
    },
    {
      setting_key: 'backup_schedule_hour',
      setting_value: JSON.stringify(settings.schedule_hour),
      category: 'backup',
      description: 'ساعة التشغيل (0-23)',
      setting_type: 'number',
    },
    {
      setting_key: 'backup_schedule_day',
      setting_value: JSON.stringify(settings.schedule_day),
      category: 'backup',
      description: 'يوم الأسبوع للنسخ الأسبوعي (0=الأحد)',
      setting_type: 'number',
    },
    {
      setting_key: 'backup_retention_days',
      setting_value: JSON.stringify(settings.retention_days),
      category: 'backup',
      description: 'عدد أيام الاحتفاظ بالنسخ الاحتياطية',
      setting_type: 'number',
    },
    {
      setting_key: 'backup_delivery_mode',
      setting_value: JSON.stringify(settings.delivery_mode),
      category: 'backup',
      description: 'طريقة تسليم النسخ الاحتياطية (محلي فقط/محلي + بريد)',
      setting_type: 'select',
    },
    {
      setting_key: 'backup_email_notifications_enabled',
      setting_value: JSON.stringify(settings.email_notifications_enabled),
      category: 'backup',
      description: 'تفعيل إرسال إشعارات النسخ الاحتياطي عبر البريد الإلكتروني',
      setting_type: 'boolean',
    },
    {
      setting_key: 'backup_email_recipients',
      setting_value: JSON.stringify(settings.email_recipients),
      category: 'backup',
      description: 'قائمة بريد المستقبلين لإشعارات النسخ الاحتياطي',
      setting_type: 'json',
    },
  ]

  const { error } = await supabase
    .from('system_settings')
    .upsert(rows, { onConflict: 'setting_key' })

  if (error) throw error

  // Recalculate next_run_at via DB function
  const { error: rpcErr } = await supabase.rpc('refresh_next_backup_at')
  if (rpcErr) logger.warn('[BackupService] refresh_next_backup_at failed:', rpcErr)
}

export async function triggerManualBackup(): Promise<BackupRecord | null> {
  const { data, error } = await supabase.functions.invoke('automated-backup', {
    body: { backup_type: 'full', triggered_by: 'manual' },
  })

  if (error) throw error

  // Some edge functions return errors inside data
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String(data.error))
  }

  const { data: latest, error: latestErr } = await supabase
    .from('backup_history')
    .select(
      'id, backup_type, triggered_by, file_path, file_size, compression_ratio, status, started_at, completed_at, error_message, tables_included'
    )
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestErr) throw latestErr
  return latest as BackupRecord | null
}

export async function getBackupDownloadUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('backups')
    .createSignedUrl(filePath, 3600) // 1-hour expiry

  if (error) {
    logger.error('[BackupService] Failed to create signed URL:', error)
    return null
  }
  return data?.signedUrl ?? null
}

/** @deprecated use triggerManualBackup */
export const triggerManualBackupAndNotify = triggerManualBackup
