import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuth } from '../_shared/auth.ts'
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts'

interface AlertDigestLog {
  company_id?: string | null
  employee_id?: string | null
  alert_type: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  action_required: string
  expiry_date?: string | null
  details: Record<string, unknown>
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    await requireAuth(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { logs } = await req.json() as { logs: AlertDigestLog[] }

    if (!logs || !Array.isArray(logs)) {
      return new Response(
        JSON.stringify({ error: 'logs array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

    const results = await Promise.allSettled(
      logs.map(async (log) => {
        // T-513: Dedup check — skip if log already exists for today
        const { data: existingLog, error: lookupError } = await supabase
          .from('daily_excel_logs')
          .select('id')
          .eq(log.company_id ? 'company_id' : 'employee_id', log.company_id || log.employee_id || '')
          .eq('alert_type', log.alert_type)
          .gte('created_at', startOfToday.toISOString())
          .lt('created_at', startOfTomorrow.toISOString())
          .maybeSingle()

        if (lookupError && lookupError.code !== 'PGRST116') {
          throw new Error(`Lookup error: ${lookupError.message}`)
        }

        if (existingLog) {
          return { skipped: true, reason: 'Already logged today' }
        }

        // Insert new log entry
        const { error: insertError } = await supabase.from('daily_excel_logs').insert({
          company_id: log.company_id || null,
          employee_id: log.employee_id || null,
          alert_type: log.alert_type,
          priority: log.priority,
          title: log.title,
          message: log.message,
          action_required: log.action_required,
          expiry_date: log.expiry_date || null,
          details: log.details,
        })

        if (insertError) {
          if (insertError.code === '23505') {
            return { skipped: true, reason: 'Duplicate key (unique constraint)' }
          }
          throw insertError
        }

        return { logged: true }
      })
    )

    const logged = results.filter((r) => r.status === 'fulfilled' && (r.value as any).logged).length
    const skipped = results.filter((r) => r.status === 'fulfilled' && (r.value as any).skipped).length
    const failed = results.filter((r) => r.status === 'rejected').length

    return new Response(
      JSON.stringify({
        success: true,
        logged,
        skipped,
        failed,
        message: `Logged ${logged}, skipped ${skipped}, failed ${failed}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error in log-alert-digest:', error)
    const corsHeaders = buildCorsHeaders('')
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
