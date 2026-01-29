/**
 * 📊 Daily Excel Digest Generator - 03:00 AM Makkah Time
 * 
 * This Supabase Edge Function:
 * 1. Fetches all unprocessed alerts from daily_excel_logs (created today)
 * 2. Generates a consolidated XLSX file with multiple sheets
 * 3. Emails the Excel file to admin at 03:00 AM
 * 4. Marks alerts as processed
 * 
 * Deployment:
 * 1. Deploy: supabase functions deploy send-daily-excel-digest
 * 2. Set cron: "0 3 * * *" (Every day at 03:00 AM Makkah Time)
 * 
 * Environment Variables Needed:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - RESEND_API_KEY
 * - VITE_ADMIN_EMAIL
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @deno-types="npm:@types/node"
import * as XLSX from "npm:xlsx@0.18.5"

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Daily Digest] Missing environment variables')
}

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = Deno.env.get('VITE_ADMIN_EMAIL')

if (!ADMIN_EMAIL) {
  throw new Error('VITE_ADMIN_EMAIL environment variable is required but not configured')
}

interface DailyExcelLog {
  id: string
  employee_id?: string
  company_id?: string
  alert_type: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  action_required?: string
  expiry_date?: string
  details: Record<string, unknown>
  created_at: string
}

/**
 * Normalize values for stable keys
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().toLowerCase()
}

/**
 * Build a stable entity key for de-duplication (employee/company)
 */
function getEntityKey(alert: DailyExcelLog): string {
  const details = (alert.details || {}) as Record<string, unknown>
  const employeeName = normalizeValue(details.employee_name)
  const residenceNumber = normalizeValue(details.residence_number)
  if (residenceNumber || employeeName) {
    return `emp:${employeeName}|${residenceNumber}`
  }

  const companyName = normalizeValue(details.company_name)
  const unifiedNumber = normalizeValue(details.unified_number)
  if (unifiedNumber || companyName) {
    return `comp:${companyName}|${unifiedNumber}`
  }

  if (alert.employee_id) {
    return `emp:${alert.employee_id}`
  }
  if (alert.company_id) {
    return `comp:${alert.company_id}`
  }

  return 'unknown'
}

/**
 * Build a stable key for de-duplication (one row per entity + alert type)
 */
function getAlertKey(alert: DailyExcelLog): string {
  const entityKey = getEntityKey(alert)
  return `${entityKey}|${normalizeValue(alert.alert_type) || 'unknown'}`
}

/**
 * De-duplicate alerts by entity + type, keeping the most recent one
 */
function dedupeAlerts(alerts: DailyExcelLog[]): DailyExcelLog[] {
  const map = new Map<string, DailyExcelLog>()
  for (const alert of alerts) {
    const key = getAlertKey(alert)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, alert)
      continue
    }
    const existingTime = new Date(existing.created_at).getTime()
    const currentTime = new Date(alert.created_at).getTime()
    if (currentTime > existingTime) {
      map.set(key, alert)
    }
  }
  return Array.from(map.values())
}

/**
 * De-duplicate records per sheet by entity only (same alert type already grouped)
 */
function dedupeRecordsByEntity(records: DailyExcelLog[]): DailyExcelLog[] {
  const map = new Map<string, DailyExcelLog>()
  for (const record of records) {
    const key = getEntityKey(record)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, record)
      continue
    }
    const existingTime = new Date(existing.created_at).getTime()
    const currentTime = new Date(record.created_at).getTime()
    if (currentTime > existingTime) {
      map.set(key, record)
    }
  }
  return Array.from(map.values())
}

/**
 * Fetch all unprocessed alerts (not yet handled/resolved)
 */
async function fetchTodayAlerts(): Promise<DailyExcelLog[]> {
  try {
    console.log('[Daily Digest] Fetching all unprocessed alerts...')

    // الحصول على جميع التنبيهات التي لم يتم إرسالها بعد
    // (بغض النظر عن تاريخ الإنشاء)
    const { data, error } = await supabase
      .from('daily_excel_logs')
      .select('*')
      .is('processed_at', null)  // فقط التنبيهات التي لم تُرسل
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Daily Digest] Error fetching alerts:', error)
      throw error
    }

    console.log('[Daily Digest] Fetched alerts:', data?.length || 0)
    
    // إذا لم توجد تنبيهات، تحقق من وجود أي سجلات في الجدول
    if (!data || data.length === 0) {
      console.log('[Daily Digest] WARNING: No unprocessed alerts found. Checking total records...')
      const { data: allRecords, error: countError } = await supabase
        .from('daily_excel_logs')
        .select('id, employee_id, alert_type, created_at, processed_at')
        .limit(5)
      
      if (!countError) {
        console.log('[Daily Digest] Total records in database:', allRecords?.length || 0)
        if (allRecords && allRecords.length > 0) {
          console.log('[Daily Digest] Sample records:', JSON.stringify(allRecords, null, 2))
        }
      }
    }
    
    return (data || []) as DailyExcelLog[]
  } catch (err) {
    console.error('[Daily Digest] Exception in fetchTodayAlerts:', err)
    throw err
  }
}

/**
 * Calculate days remaining or days since expiry
 * Positive = days until expiry, Negative = days since expiry
 */
function calculateDaysDifference(expiryDate: string | null): number {
  if (!expiryDate) return 0
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  
  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Get status text based on expiry date
 */
function getStatus(expiryDate: string | null): string {
  const days = calculateDaysDifference(expiryDate)
  
  if (days < 0) {
    return 'منتهية'
  } else if (days <= 30) {
    return 'أوشكت على الانتهاء'
  } else {
    return 'سارية'
  }
}

/**
 * Convert date to Gregorian format (DD/MM/YYYY)
 */
function formatGregorianDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  
  return `${day}/${month}/${year}`
}

/**
 * Generate Excel file with separate sheets for each alert type
 * Returns Base64 encoded Excel file
 */
async function generateExcelFile(alerts: DailyExcelLog[]): Promise<string> {
  try {
    console.log('[Daily Digest] Starting Excel generation for', alerts.length, 'alerts')
    
    // Group by alert type
    const alertsByType: Record<string, DailyExcelLog[]> = {}
    alerts.forEach(alert => {
      if (!alertsByType[alert.alert_type]) {
        alertsByType[alert.alert_type] = []
      }
      alertsByType[alert.alert_type].push(alert)
    })

    console.log('[Daily Digest] Alert types:', Object.keys(alertsByType))

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Arabic alert type names
    const alertTypeNames: Record<string, string> = {
      'residence_expiry': 'انتهاء الإقامة',
      'contract_expiry': 'انتهاء العقد',
      'passport_expiry': 'انتهاء الجواز',
      'insurance_expiry': 'انتهاء التأمين',
      'license_expiry': 'انتهاء الرخصة',
      'vehicle_license_expiry': 'انتهاء رخصة المركبة',
      'commercial_registration_expiry': 'انتهاء السجل التجاري',
      'municipal_license_expiry': 'انتهاء الرخصة البلدية',
    }

    // Create sheet for each alert type
    for (const [alertType, records] of Object.entries(alertsByType)) {
      try {
        const sheetName = alertTypeNames[alertType] || alertType
        const wsData: unknown[][] = []

        const dedupedRecords = dedupeRecordsByEntity(records)

        // Check if this is employee or company alert
        const isEmployeeAlert = dedupedRecords[0].employee_id !== null

        if (isEmployeeAlert) {
          // Employee alert headers: Name, ID, Company, Status, Days, Date
          wsData.push(['اسم الموظف', 'رقم الإقامة', 'الرقم الموحد للمؤسسة', 'الحالة', 'عدد الأيام', 'تاريخ الانتهاء'])
          
          // Employee data rows
          for (const record of dedupedRecords) {
            const details = record.details as Record<string, unknown>
            const daysDiff = calculateDaysDifference(record.expiry_date)
            const status = getStatus(record.expiry_date)
            
            wsData.push([
              details?.employee_name || '-',
              details?.residence_number || '-',
              details?.unified_number || '-',
              status,
              daysDiff !== 0 ? daysDiff : '-',
              formatGregorianDate(record.expiry_date)
            ])
          }
        } else {
          // Company alert headers: Name, Unified Number, Status, Days, Date
          wsData.push(['اسم المؤسسة', 'الرقم الموحد', 'الحالة', 'عدد الأيام', 'تاريخ الانتهاء'])
          
          // Company data rows
          for (const record of dedupedRecords) {
            const details = record.details as Record<string, unknown>
            const daysDiff = calculateDaysDifference(record.expiry_date)
            const status = getStatus(record.expiry_date)
            
            wsData.push([
              details?.company_name || '-',
              details?.unified_number || '-',
              status,
              daysDiff !== 0 ? daysDiff : '-',
              formatGregorianDate(record.expiry_date)
            ])
          }
        }

        // Create worksheet and add to workbook
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        
        // Set column widths for better readability
        ws['!cols'] = [
          { wch: 25 }, // Name column
          { wch: 18 }, // ID/Number column
          { wch: 22 }, // Unified number
          { wch: 20 }, // Status column
          { wch: 12 }, // Days column
          { wch: 15 }  // Date column
        ]

        XLSX.utils.book_append_sheet(wb, ws, sheetName)
        console.log('[Daily Digest] Created sheet:', sheetName)
      } catch (sheetError) {
        console.error('[Daily Digest] Error creating sheet:', alertType, sheetError)
        throw sheetError
      }
    }

    console.log('[Daily Digest] Generating Excel buffer...')
    
    // Generate Excel buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    console.log('[Daily Digest] Converting to Base64...')
    
    // Convert to Base64
    const base64 = btoa(
      new Uint8Array(excelBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )
    
    console.log('[Daily Digest] Excel generation complete, size:', base64.length)
    
    return base64
  } catch (err) {
    console.error('[Daily Digest] Error in generateExcelFile:', err)
    throw err
  }
}

/**
 * Build simple HTML email content (Excel file will be attached)
 */
function buildEmailHTML(alerts: DailyExcelLog[]): string {
  if (alerts.length === 0) {
    return `
      <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a;">
        <h2>✅ تقرير التنبيهات اليومي</h2>
        <p>لا توجد تنبيهات لهذا اليوم</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          تم إنشاء هذا التقرير تلقائياً بواسطة نظام SAW Tracker في ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}
        </p>
      </div>
    `
  }

  const urgentCount = alerts.filter(a => a.priority === 'urgent').length
  const highCount = alerts.filter(a => a.priority === 'high').length

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto;">
      <h2 style="color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px;">
        📊 تقرير التنبيهات اليومي
      </h2>
      
      <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>إجمالي التنبيهات:</strong> ${alerts.length}</p>
        <p><strong>تنبيهات عاجلة:</strong> <span style="color: #dc2626; font-weight: bold;">${urgentCount}</span></p>
        <p><strong>تنبيهات هامة:</strong> <span style="color: #ea580c; font-weight: bold;">${highCount}</span></p>
      </div>

      <p style="background: #dbeafe; padding: 12px; border-right: 4px solid #3b82f6; margin: 15px 0; color: #1e40af;">
        📎 مرفق ملف Excel يحتوي على التنبيهات اليومية، مصنفة حسب النوع في صفحات منفصلة لسهولة المراجعة.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      
      <p style="color: #666; font-size: 12px;">
        تم إنشاء هذا التقرير تلقائياً بواسطة نظام SAW Tracker في ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}
      </p>
    </div>
  `
}

/**
 * Send email via Resend with Excel attachment
 */
async function sendDigestEmail(alerts: DailyExcelLog[]): Promise<boolean> {
  try {
    console.log('[Daily Digest] Building email HTML...')
    const htmlContent = buildEmailHTML(alerts)

    console.log('[Daily Digest] Generating Excel file...')
    // Generate Excel file
    const excelBase64 = await generateExcelFile(alerts)

    console.log('[Daily Digest] Preparing email...')
    // Get today's date for filename
    const today = new Date().toLocaleDateString('ar-SA', { 
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-')

    console.log('[Daily Digest] Sending email to:', ADMIN_EMAIL)
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ADMIN_EMAIL,
        subject: `📊 تقرير التنبيهات اليومي - ${today}`,
        html: htmlContent,
        attachments: [
          {
            filename: `التنبيهات_اليومية_${today}.xlsx`,
            content: excelBase64,
            content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Daily Digest] Resend API error:', response.status, error)
      return false
    }

    const result = await response.json()
    console.log('[Daily Digest] Email sent successfully:', result.id)
    return true
  } catch (err) {
    console.error('[Daily Digest] Error sending email:', err)
    return false
  }
}

/**
 * Log the digest email sent (don't mark alerts as processed - they stay for next daily digest)
 */
async function logDigestEmailSent(alertCount: number): Promise<boolean> {
  try {
    console.log('[Daily Digest] Logging digest sent event...')
    
    // Log success
    const { error } = await supabase
      .from('activity_log')
      .insert({
        action: 'daily_excel_digest_sent',
        entity_type: 'email_digest',
        details: {
          alert_count: alertCount,
          sent_at: new Date().toISOString(),
          recipient: ADMIN_EMAIL,
          timestamp: new Date().toISOString()
        },
      })

    if (error) {
      console.error('[Daily Digest] Error logging digest sent:', error)
      return false
    }

    console.log('[Daily Digest] Successfully logged digest sent')
    return true
  } catch (err) {
    console.error('[Daily Digest] Exception logging digest sent:', err)
    return false
  }
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    console.log('[Daily Digest] Starting daily digest generation at', new Date().toISOString())

    // Verify environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables', success: false }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      )
    }

    // Fetch today's alerts
    const rawAlerts = await fetchTodayAlerts()
    console.log(`[Daily Digest] Found ${rawAlerts.length} unprocessed alerts`)

    if (rawAlerts.length === 0) {
      console.log('[Daily Digest] No alerts to send')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No alerts to send',
          count: 0,
          note: 'jdoel (No alerts to send)' 
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      )
    }

    const alerts = dedupeAlerts(rawAlerts)
    console.log(`[Daily Digest] Deduped alerts: ${alerts.length} from ${rawAlerts.length}`)

    if (alerts.length === 0) {
      console.log('[Daily Digest] No alerts to send after de-duplication')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No alerts to send after de-duplication',
          count: 0
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    // Send email with Excel report
    const emailSent = await sendDigestEmail(alerts)

    if (!emailSent) {
      return new Response(
        JSON.stringify({ error: 'Failed to send email', success: false }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      )
    }

    // Log that digest was sent (don't mark alerts as processed - they stay for next digest)
    await logDigestEmailSent(alerts.length)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily digest sent with ${alerts.length} alerts`,
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  } catch (err) {
    console.error('[Daily Digest] Exception in main handler:', err)
    return new Response(
      JSON.stringify({ error: String(err), success: false }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  }
})
