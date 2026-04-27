/**
 * backup-scheduler — Supabase Scheduled Edge Function
 *
 * Runs every hour. Reads backup schedule settings from system_settings,
 * checks whether a backup is due, and invokes automated-backup if needed.
 *
 * Deploy schedule (set in Supabase dashboard or config.toml):
 *   cron: "0 * * * *"   (every hour)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase    = createClient(supabaseUrl, serviceKey)

  try {
    // Read backup schedule settings
    const { data: settings, error: settingsErr } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'backup_schedule_enabled',
        'backup_next_run_at',
        'backup_frequency',
        'backup_schedule_hour',
        'backup_schedule_day',
        'backup_retention_days',
      ])

    if (settingsErr) throw settingsErr

    const map = new Map(settings?.map((s: { setting_key: string; setting_value: unknown }) => [s.setting_key, s.setting_value]))

    const enabled    = Boolean(map.get('backup_schedule_enabled'))
    const nextRunRaw = map.get('backup_next_run_at') as string | null

    if (!enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'scheduled backups disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now     = new Date()
    const nextRun = nextRunRaw ? new Date(nextRunRaw) : null

    // If next run is not set or is in the future — skip
    if (nextRun && nextRun > now) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'backup not due yet', nextRun: nextRun.toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Invoke automated-backup
    console.log('[backup-scheduler] Triggering scheduled backup...')
    const { data: backupResult, error: backupErr } = await supabase.functions.invoke(
      'automated-backup',
      { body: { backup_type: 'full', triggered_by: 'scheduled' } }
    )

    if (backupErr) throw backupErr

    // Update last_run_at and compute next_run_at via DB function
    await supabase
      .from('system_settings')
      .upsert({ setting_key: 'backup_last_run_at', setting_value: JSON.stringify(now.toISOString()), category: 'backup', description: '', setting_type: 'text' })

    // Recalculate next_run_at
    await supabase.rpc('refresh_next_backup_at')

    console.log('[backup-scheduler] Backup completed successfully')

    return new Response(
      JSON.stringify({ success: true, triggered: true, result: backupResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[backup-scheduler] Error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
