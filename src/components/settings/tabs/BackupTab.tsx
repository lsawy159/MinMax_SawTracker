import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { toast } from 'sonner'
import { logger } from '@/utils/logger'
import {
  fetchBackupSettings,
  saveBackupSettings,
  triggerManualBackup,
  getBackupDownloadUrl,
  type BackupRecord,
  type BackupSettings,
} from '@/lib/backupService'
import {
  Database,
  Download,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Clock,
  CalendarClock,
  HardDrive,
  RotateCcw,
  Save,
  Shield,
  Play,
} from 'lucide-react'

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
}

const DAY_LABELS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

function formatNextRun(iso: string | null): string {
  if (!iso) return 'غير محدد'
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ─── Schedule Settings Form ───────────────────────────────────────────────────

interface ScheduleFormProps {
  initial: BackupSettings
  onSaved: () => void
}

function ScheduleForm({ initial, onSaved }: ScheduleFormProps) {
  const [form, setForm] = useState<BackupSettings>(initial)
  const [dirty, setDirty] = useState(false)

  const update = <K extends keyof BackupSettings>(k: K, v: BackupSettings[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }))
    setDirty(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => saveBackupSettings(form),
    onSuccess: () => {
      toast.success('تم حفظ إعدادات الجدولة')
      setDirty(false)
      onSaved()
    },
    onError: (err) => {
      logger.error('[BackupTab] save settings error:', err)
      toast.error('فشل حفظ الإعدادات: ' + (err instanceof Error ? err.message : String(err)))
    },
  })

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <CalendarClock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground">جدولة النسخ التلقائي</h4>
          <p className="text-xs text-foreground-tertiary">يُشغَّل تلقائياً بواسطة Supabase Scheduled Function</p>
        </div>
        {/* Enable toggle */}
        <button
          type="button"
          onClick={() => update('schedule_enabled', !form.schedule_enabled)}
          className={`mr-auto relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${
            form.schedule_enabled ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
          aria-checked={form.schedule_enabled}
          role="switch"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              form.schedule_enabled ? '-translate-x-6' : '-translate-x-1'
            }`}
          />
        </button>
      </div>

      {form.schedule_enabled && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Frequency */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
              التكرار
            </label>
            <select
              value={form.frequency}
              onChange={(e) => update('frequency', e.target.value as BackupSettings['frequency'])}
              className="app-input h-10 w-full text-sm"
            >
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
              <option value="monthly">شهري</option>
            </select>
          </div>

          {/* Hour */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
              وقت التشغيل
            </label>
            <select
              value={form.schedule_hour}
              onChange={(e) => update('schedule_hour', Number(e.target.value))}
              className="app-input h-10 w-full text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          {/* Day of week (weekly only) */}
          {form.frequency === 'weekly' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                يوم الأسبوع
              </label>
              <select
                value={form.schedule_day}
                onChange={(e) => update('schedule_day', Number(e.target.value))}
                className="app-input h-10 w-full text-sm"
              >
                {DAY_LABELS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Retention */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
              الاحتفاظ (يوم)
            </label>
            <select
              value={form.retention_days}
              onChange={(e) => update('retention_days', Number(e.target.value))}
              className="app-input h-10 w-full text-sm"
            >
              {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                <option key={d} value={d}>{d} يوم</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {dirty && (
        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2"
            size="sm"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            حفظ الإعدادات
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'blue' | 'amber'
}) {
  const accents = {
    green: 'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg ${accent ? accents[accent] : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>
        {icon}
      </div>
      <p className="text-xs text-foreground-tertiary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-foreground-tertiary">{sub}</p>}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function BackupTab(): JSX.Element {
  const qc = useQueryClient()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Backup settings
  const {
    data: settings,
    isLoading: settingsLoading,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['backup-settings'],
    queryFn: fetchBackupSettings,
    staleTime: 60_000,
  })

  // Backup history
  const {
    data: backups = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['backup-history'],
    queryFn: async (): Promise<BackupRecord[]> => {
      const { data, error } = await supabase
        .from('backup_history')
        .select(
          'id, backup_type, triggered_by, file_path, file_size, compression_ratio, status, started_at, completed_at, error_message, tables_included'
        )
        .order('started_at', { ascending: false })
        .limit(20)

      if (error) throw error
      return (data as BackupRecord[]) || []
    },
    refetchInterval: 30_000,
  })

  // Manual backup trigger
  const triggerMutation = useMutation({
    mutationFn: triggerManualBackup,
    onSuccess: () => {
      toast.success('تم بدء النسخة الاحتياطية بنجاح')
      refetchHistory()
      refetchSettings()
      qc.invalidateQueries({ queryKey: ['backup-history'] })
    },
    onError: (err) => {
      logger.error('[BackupTab] manual trigger error:', err)
      toast.error('فشل إنشاء النسخة الاحتياطية: ' + (err instanceof Error ? err.message : String(err)))
    },
  })

  const handleDownload = async (backup: BackupRecord) => {
    setDownloadingId(backup.id)
    try {
      const url = await getBackupDownloadUrl(backup.file_path)
      if (!url) {
        toast.error('تعذر الحصول على رابط التنزيل')
        return
      }
      const a = document.createElement('a')
      a.href = url
      a.download = backup.file_path.split('/').pop() || 'backup.sql'
      a.click()
    } catch (err) {
      toast.error('فشل التنزيل')
      logger.error('[BackupTab] download error:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  if (settingsLoading || historyLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    )
  }

  const completedBackups = backups.filter((b) => b.status === 'completed')
  const lastBackup = completedBackups[0] ?? null
  const totalSize = completedBackups.reduce((sum, b) => sum + (b.file_size || 0), 0)

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Schedule Settings ── */}
      {settings && (
        <ScheduleForm
          initial={settings}
          onSaved={() => {
            refetchSettings()
            refetchHistory()
          }}
        />
      )}

      {/* ── Status Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="آخر نسخة احتياطية"
          value={lastBackup ? formatDateWithHijri(lastBackup.completed_at ?? lastBackup.started_at) : 'لا يوجد'}
          accent="green"
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="الموعد القادم"
          value={settings?.schedule_enabled ? formatNextRun(settings.next_run_at) : 'معطّل'}
          sub={settings?.schedule_enabled ? FREQUENCY_LABELS[settings.frequency] : undefined}
          accent="blue"
        />
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="عدد النسخ"
          value={String(completedBackups.length)}
          sub="نسخة ناجحة"
          accent="amber"
        />
        <StatCard
          icon={<HardDrive className="h-4 w-4" />}
          label="الحجم الإجمالي"
          value={formatBytes(totalSize)}
          sub={`${settings?.retention_days ?? 30} يوم احتفاظ`}
        />
      </div>

      {/* ── Manual Trigger ── */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">نسخة احتياطية فورية</p>
              <p className="text-xs text-foreground-tertiary">
                نسخة كاملة لجميع بيانات النظام الآن
              </p>
            </div>
          </div>
          <Button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            className="flex items-center gap-2 min-w-[150px]"
            aria-label={triggerMutation.isPending ? 'جاري إنشاء النسخة' : 'إنشاء نسخة احتياطية الآن'}
          >
            {triggerMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري النسخ...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                تشغيل الآن
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Backup History ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">سجل النسخ الاحتياطية</h4>
          <button
            type="button"
            onClick={() => refetchHistory()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-foreground-tertiary hover:bg-surface-secondary transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            تحديث
          </button>
        </div>

        {backups.length === 0 ? (
          <EmptyState
            icon={<Database className="h-10 w-10 text-neutral-400" />}
            title="لا توجد نسخ احتياطية"
            description="لم يتم إنشاء أي نسخ احتياطية بعد"
          />
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-secondary"
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {backup.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-success-500" />
                  ) : backup.status === 'failed' ? (
                    <AlertTriangle className="h-4 w-4 text-danger-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {backup.backup_type === 'full' ? 'نسخة كاملة' : 'نسخة جزئية'}
                    </span>
                    {backup.triggered_by && backup.triggered_by !== 'manual' && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        تلقائي
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        backup.status === 'completed'
                          ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-300'
                          : backup.status === 'failed'
                            ? 'bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                      }`}
                    >
                      {backup.status === 'completed' ? 'نجح' : backup.status === 'failed' ? 'فشل' : 'جاري...'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-foreground-tertiary">
                    {backup.completed_at
                      ? formatDateWithHijri(backup.completed_at)
                      : formatDateWithHijri(backup.started_at)}
                  </p>
                  {backup.error_message && (
                    <p className="mt-0.5 text-[11px] text-danger-500 truncate">{backup.error_message}</p>
                  )}
                </div>

                {/* Size + download */}
                <div className="flex flex-shrink-0 items-center gap-3">
                  {backup.file_size > 0 && (
                    <span className="text-xs text-foreground-tertiary">{formatBytes(backup.file_size)}</span>
                  )}
                  {backup.status === 'completed' && backup.file_path && (
                    <button
                      type="button"
                      onClick={() => handleDownload(backup)}
                      disabled={downloadingId === backup.id}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground-secondary transition-colors hover:bg-surface-secondary disabled:opacity-50"
                      aria-label={`تحميل النسخة الاحتياطية ${formatBytes(backup.file_size)}`}
                    >
                      {downloadingId === backup.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      تحميل
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
