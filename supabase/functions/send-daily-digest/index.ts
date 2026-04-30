/**
 * 🚨 EMERGENCY: Daily Digest at 03:00 AM
 * 
 * This Supabase Edge Function consolidates all daily_alert_logs into ONE email
 * Sent daily at 03:00 AM via Cron
 * 
 * Deployment:
 * 1. Save this as: supabase/functions/send-daily-digest/index.ts
 * 2. Deploy: supabase functions deploy send-daily-digest
 * 3. Set cron: "0 3 * * *" (Every day at 03:00 AM)
 * 
 * 🔐 Security: Reads recipients from system_settings.notification_recipients JSON
 * Fallback: Uses VITE_ADMIN_EMAIL if JSON parsing fails
 */

// deno-lint-ignore-file no-explicit-any
// @ts-expect-error Deno Edge Function imports - valid in Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error Deno Edge Function imports - valid in Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireServiceToken, toErrorResponse } from '../_shared/auth.ts'

// @ts-expect-error Deno global - valid in Deno runtime
const supabaseUrl = Deno.env.get('SUPABASE_URL')
// @ts-expect-error Deno global - valid in Deno runtime
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// @ts-expect-error Deno global - valid in Deno runtime
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const PRIMARY_ADMIN_EMAIL = 'ahmad.alsawy159@gmail.com'

if (!RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY environment variable is required')
}

// 🔐 Helper: Get recipients from notification_recipients JSON
async function getDigestRecipients(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_recipients')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - use fallback
        console.warn('[getDigestRecipients] notification_recipients not found, using fallback')
        return [PRIMARY_ADMIN_EMAIL]
      }
      throw error
    }

    // Parse JSON safely
    const configJson = data?.setting_value as string | null
    if (!configJson) {
      console.warn('[getDigestRecipients] Empty config, using fallback')
      return [PRIMARY_ADMIN_EMAIL]
    }

    const config = JSON.parse(configJson) as Record<string, unknown>
    const recipients = new Set<string>()

    // 🔐 ALWAYS add primary admin
    recipients.add(PRIMARY_ADMIN_EMAIL)

    // Add additional recipients with dailyDigest flag
    const additionalRecipients = config.additional_recipients as unknown[]
    if (Array.isArray(additionalRecipients)) {
      additionalRecipients.forEach((r) => {
        if (typeof r === 'object' && r !== null) {
          const recipient = r as Record<string, unknown>
          if (recipient.dailyDigest === true && typeof recipient.email === 'string') {
            recipients.add(recipient.email)
          }
        }
      })
    }

    const result = Array.from(recipients)
    console.log(`[getDigestRecipients] Got ${result.length} recipient(s): ${result.join(', ')}`)
    return result
  } catch (err) {
    console.error(`[getDigestRecipients] Error: ${err instanceof Error ? err.message : String(err)}`)
    console.warn(`[getDigestRecipients] Falling back to primary admin: ${PRIMARY_ADMIN_EMAIL}`)
    return [PRIMARY_ADMIN_EMAIL]
  }
}

interface DailyAlert {
  id: string
  employee_id?: string
  company_id?: string
  alert_type: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  details: Record<string, unknown>
  created_at: string
}

/**
 * Build HTML email content from daily alerts
 */
function buildDigestEmailHTML(alerts: DailyAlert[]): string {
  // Group by priority
  const urgentAlerts = alerts.filter(a => a.priority === 'urgent')
  const highAlerts = alerts.filter(a => a.priority === 'high')
  const mediumAlerts = alerts.filter(a => a.priority === 'medium')
  const lowAlerts = alerts.filter(a => a.priority === 'low')

  const formatAlerts = (items: DailyAlert[], section: string) => {
    if (items.length === 0) return ''
    
    const rows = items.map(a => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
          <strong>${a.title}</strong><br/>
          ${a.message}
        </td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">
          ${a.details?.employee_name || a.details?.company_name || 'N/A'}
        </td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
          ${new Date(a.created_at).toLocaleDateString('ar-SA')}
        </td>
      </tr>
    `).join('')
    
    return `
      <div style="margin:20px 0;">
        <h3 style="color:#1f2937;border-bottom:2px solid ${section === 'عاجل' ? '#dc2626' : '#ea580c'};padding-bottom:10px;">
          ${section} (${items.length})
        </h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:12px;text-align:right;">الوصف</th>
              <th style="padding:12px;text-align:right;">الكيان</th>
              <th style="padding:12px;text-align:right;">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `
  }

  const header = `
    <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;padding:20px;text-align:center;border-radius:8px;">
      <h1 style="margin:0;font-size:24px;">📬 الملخص اليومي - ${new Date().toLocaleDateString('ar-SA')}</h1>
      <p style="margin:10px 0 0;opacity:0.9;">عدد التنبيهات: ${alerts.length}</p>
    </div>
  `

  const sections = [
    formatAlerts(urgentAlerts, 'عاجل 🚨'),
    formatAlerts(highAlerts, 'هام ⚠️'),
    formatAlerts(mediumAlerts, 'متوسط ℹ️'),
    formatAlerts(lowAlerts, 'منخفض ✓')
  ].filter(Boolean).join('')

  const footer = `
    <div style="margin:20px 0;padding:20px;background:#f9fafb;border-radius:8px;font-size:13px;color:#6b7280;text-align:center;">
      <p>تم إنشاء هذا الملخص تلقائياً في ${new Date().toLocaleTimeString('ar-SA')} (توقيت مكة المكرمة)</p>
      <p>يتم إرسال ملخص يومي واحد فقط في الساعة 3:00 صباحاً لتقليل الرسائل</p>
    </div>
  `

  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;">
      ${header}
      ${sections || '<p style="padding:20px;text-align:center;color:#9ca3af;">لا توجد تنبيهات اليوم</p>'}
      ${footer}
    </div>
  `
}

/**
 * Send email via Resend API
 */
async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to,
        subject,
        html,
        reply_to: 'ahmad.alsawy159@gmail.com'
      })
    })
    
    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`)
    }
    
    return true
  } catch (err) {
    console.error('Failed to send via Resend:', err)
    return false
  }
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  try {
    // Only accept POST requests (Cron calls POST)
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // التحقق من service token (يرسله الصادر المجدول فقط)
    requireServiceToken(req)

    console.log('🚀 Starting daily digest at 03:00 AM')

    // 1. Get all alerts from today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: alerts, error: fetchError } = await supabase
      .from('daily_excel_logs')
      .select('*')
      .is('processed_at', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (fetchError) {
      throw new Error(`Failed to fetch alerts: ${fetchError.message}`)
    }

    const alertCount = alerts?.length || 0
    console.log(`📊 Found ${alertCount} alerts to digest`)

    if (alertCount === 0) {
      console.log('✅ No alerts to send today')
      return new Response('No alerts to send', { status: 200 })
    }

    // 2. Build email content
    const html = buildDigestEmailHTML(alerts || [])
    const subject = `📬 الملخص اليومي: ${alertCount} تنبيه - ${new Date().toLocaleDateString('ar-SA')}`

    // 3. Get recipients from notification_recipients JSON
    const recipients = await getDigestRecipients()
    
    if (recipients.length === 0) {
      console.warn('No recipients found for digest email')
      return new Response('No recipients found', { status: 200 })
    }

    // 4. Send email to all recipients
    let successCount = 0
    let failureCount = 0

    for (const recipient of recipients) {
      const sent = await sendViaResend(recipient, subject, html)
      if (sent) {
        successCount++
      } else {
        failureCount++
      }
    }

    console.log(`✅ Digest email sent to ${successCount} recipient(s), ${failureCount} failure(s)`)

    // 5. Log to email_queue for unified logging
    const timestamp = new Date().toISOString()
    const { error: queueError } = await supabase
      .from('email_queue')
      .insert({
        to_emails: recipients,
        subject,
        status: 'completed',
        priority: 'high',
        created_at: timestamp,
        processed_at: timestamp,
        completed_at: timestamp,
        retry_count: 0,
        max_retries: 5,
      })

    if (queueError) {
      console.warn('Failed to log to email_queue:', queueError)
    } else {
      console.log('✅ Logged digest email to email_queue')
    }

    // 5. Mark alerts as processed
    console.log(`🔄 Attempting to mark ${alerts?.length || 0} alerts as processed`)
    
    if ((alerts?.length || 0) > 0) {
      const processedAt = new Date().toISOString()
      
      // Update all unprocessed alerts in one go
      const { data: updateData, error: updateError } = await supabase
        .from('daily_excel_logs')
        .update({ processed_at: processedAt })
        .is('processed_at', null)
        .select('id')

      if (updateError) {
        console.error('Failed to mark alerts as processed:', JSON.stringify(updateError))
        console.error('Update details:', { processedAt })
      } else {
        const updatedCount = updateData?.length || 0
        console.log(`✅ Marked ${updatedCount} alerts as processed at ${processedAt}`)
      }
    }

    // 6. Log the action to activity_log
    const { error: logError } = await supabase
      .from('activity_log')
      .insert({
        action: 'daily_digest_sent',
        entity_type: 'email',
        entity_id: 'daily-digest-' + new Date().toISOString().split('T')[0],
        details: {
          alert_count: alertCount,
          recipient_count: recipients.length,
          timestamp: new Date().toISOString()
        }
      })

    if (logError) {
      console.warn('Failed to log digest action:', logError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily digest sent with ${alertCount} alerts`,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (err) {
    console.error('❌ Digest generation failed:', err)
    
    return toErrorResponse(err, { 'Content-Type': 'application/json' })
  }
})
