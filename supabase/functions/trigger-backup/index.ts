// Edge Function: trigger-backup
// Purpose: استدعاء النسخ الاحتياطي اليدوي من الواجهة الأمامية
// Usage: يُستدعى من صفحة الإعدادات -> تبويب النسخ الاحتياطية

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface TriggerBackupRequest {
  backup_type?: 'full' | 'incremental' | 'partial'
  triggered_by?: 'manual' | 'system'
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // التحقق من المصادقة
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // إنشاء عميل Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // استخراج بيانات الطلب
    const payload = (await req.json()) as TriggerBackupRequest

    const backupType = payload.backup_type || 'full'
    const triggeredBy = payload.triggered_by || 'manual'

    // تسجيل في السجل: بدء النسخ الاحتياطي
    const { data: logEntry, error: logError } = await supabase
      .from('cron_jobs_log')
      .insert({
        job_name: 'backup_daily',
        status: 'running',
        executed_by: triggeredBy,
        result_details: { backup_type: backupType, triggered_by: triggeredBy }
      })
      .select('id')
      .single()

    if (logError) {
      console.error('Error creating log entry:', logError)
      return new Response(
        JSON.stringify({ error: 'Failed to create log entry', details: logError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // استدعاء Edge Function automated-backup
    const backupResponse = await fetch(
      `${supabaseUrl}/functions/v1/automated-backup`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backup_type: backupType,
          manual_trigger: true,
        })
      }
    )

    const backupData = await backupResponse.json()

    // تحديث السجل: انتهاء النسخ الاحتياطي
    const executionEndTime = new Date()
    const executionStartTime = new Date(logEntry.created_at)
    const executionTimeMs = executionEndTime.getTime() - executionStartTime.getTime()

    const { error: updateError } = await supabase
      .from('cron_jobs_log')
      .update({
        status: backupResponse.ok ? 'completed' : 'failed',
        execution_end: executionEndTime.toISOString(),
        execution_time_ms: executionTimeMs,
        error_message: !backupResponse.ok ? JSON.stringify(backupData) : null,
        result_details: backupData
      })
      .eq('id', logEntry.id)

    if (updateError) {
      console.error('Error updating log entry:', updateError)
    }

    // إرجاع النتيجة
    return new Response(
      JSON.stringify({
        success: backupResponse.ok,
        message: backupResponse.ok ? 'تم تشغيل النسخ الاحتياطي بنجاح' : 'فشل تشغيل النسخ الاحتياطي',
        backup_data: backupData,
        execution_time_ms: executionTimeMs
      }),
      {
        status: backupResponse.ok ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in trigger-backup:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
