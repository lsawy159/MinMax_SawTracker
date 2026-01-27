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
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = Deno.env.get('VITE_ADMIN_EMAIL') || 'ahmad.alsawy159@gmail.com'

interface DailyAlert {
  id: string
  employee_id?: string
  company_id?: string
  alert_type: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  details: Record<string, any>
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

    console.log('🚀 Starting daily digest at 03:00 AM')

    // 1. Get all alerts from today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

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

    // 3. Send email
    const sent = await sendViaResend(ADMIN_EMAIL, subject, html)
    if (!sent) {
      throw new Error('Failed to send email via Resend')
    }

    console.log(`✅ Digest email sent to ${ADMIN_EMAIL}`)

    // 4. Mark alerts as processed
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

    // 5. Log the action
    const { error: logError } = await supabase
      .from('activity_log')
      .insert({
        action: 'daily_digest_sent',
        entity_type: 'email',
        entity_id: 'daily-digest-' + new Date().toISOString().split('T')[0],
        details: {
          alert_count: alertCount,
          recipient: ADMIN_EMAIL,
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
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (err as Error).message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
