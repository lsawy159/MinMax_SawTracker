/**
 * Excel Alert Generator
 * Converts daily_excel_logs into a consolidated XLSX file with multiple sheets
 * One sheet per alert type for easy organization
 */

import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { logger } from './logger'

export interface AlertLogRecord {
  id: string
  employee_id: string | null
  company_id: string | null
  alert_type: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  action_required: string | null
  expiry_date: string | null
  details: Record<string, unknown>
  created_at: string
  processed_at: string | null
}

/**
 * Fetch all unprocessed alerts from today
 */
export async function fetchTodayAlerts(): Promise<AlertLogRecord[]> {
  try {
    const { data, error } = await supabase
      .from('daily_excel_logs_today')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('[Excel] Error fetching today alerts:', error)
      return []
    }

    return (data || []) as AlertLogRecord[]
  } catch (err) {
    logger.error('[Excel] Exception fetching today alerts:', err)
    return []
  }
}

/**
 * Fetch alerts of specific type (for single sheet generation)
 */
export async function fetchAlertsByType(alertType: string): Promise<AlertLogRecord[]> {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('daily_excel_logs')
      .select('*')
      .eq('alert_type', alertType)
      .gte('created_at', todayStart.toISOString())
      .is('processed_at', null)
      .order('priority', { ascending: false })

    if (error) {
      logger.error(`[Excel] Error fetching ${alertType} alerts:`, error)
      return []
    }

    return (data || []) as AlertLogRecord[]
  } catch (err) {
    logger.error('[Excel] Exception fetching alerts by type:', err)
    return []
  }
}

/**
 * Generate Excel workbook with alerts grouped by type
 * Each alert type gets its own sheet
 */
export async function generateAlertExcelWorkbook(): Promise<XLSX.WorkBook | null> {
  try {
    const alerts = await fetchTodayAlerts()

    if (alerts.length === 0) {
      logger.warn('[Excel] No alerts found for today')
      return null
    }

    // Group alerts by type
    const alertsByType: Record<string, AlertLogRecord[]> = {}
    alerts.forEach(alert => {
      if (!alertsByType[alert.alert_type]) {
        alertsByType[alert.alert_type] = []
      }
      alertsByType[alert.alert_type].push(alert)
    })

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Add summary sheet
    const summaryData = Object.entries(alertsByType).map(([type, records]) => ({
      'نوع التنبيه': type,
      'العدد': records.length,
      'عاجل': records.filter(r => r.priority === 'urgent').length,
      'هام': records.filter(r => r.priority === 'high').length,
      'متوسط': records.filter(r => r.priority === 'medium').length,
      'منخفض': records.filter(r => r.priority === 'low').length,
    }))

    const summarySheet = XLSX.utils.json_to_sheet(summaryData, {
      header: ['نوع التنبيه', 'العدد', 'عاجل', 'هام', 'متوسط', 'منخفض'],
    })
    summarySheet['!cols'] = [
      { wch: 20 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
    ]
    XLSX.utils.book_append_sheet(wb, summarySheet, 'ملخص')

    // Add sheet for each alert type
    Object.entries(alertsByType).forEach(([alertType, records]) => {
      const sheetData = records.map(record => ({
        'التاريخ': new Date(record.created_at).toLocaleString('ar-SA', {
          timeZone: 'Asia/Riyadh',
        }),
        'الأولوية': getPriorityArabic(record.priority),
        'العنوان': record.title,
        'الرسالة': record.message,
        'الإجراء المطلوب': record.action_required || '-',
        'تاريخ الانتهاء': record.expiry_date ? new Date(record.expiry_date).toLocaleDateString('ar-SA') : '-',
        'الكيان': record.employee_id ? 'موظف' : 'شركة',
        'ملاحظات': JSON.stringify(record.details || {}),
      }))

      const sheet = XLSX.utils.json_to_sheet(sheetData, {
        header: [
          'التاريخ',
          'الأولوية',
          'العنوان',
          'الرسالة',
          'الإجراء المطلوب',
          'تاريخ الانتهاء',
          'الكيان',
          'ملاحظات',
        ],
      })

      // Set column widths
      sheet['!cols'] = [
        { wch: 18 },
        { wch: 10 },
        { wch: 20 },
        { wch: 30 },
        { wch: 25 },
        { wch: 15 },
        { wch: 10 },
        { wch: 20 },
      ]

      // Truncate sheet name to 31 chars (Excel limit)
      const sheetName = alertType.substring(0, 31)
      XLSX.utils.book_append_sheet(wb, sheet, sheetName)
    })

    logger.info(`[Excel] Generated workbook with ${Object.keys(alertsByType).length} alert types`)
    return wb
  } catch (err) {
    logger.error('[Excel] Error generating workbook:', err)
    return null
  }
}

/**
 * Convert priority to Arabic text
 */
function getPriorityArabic(priority: string): string {
  const priorityMap: Record<string, string> = {
    urgent: '🚨 عاجل',
    high: '⚠️ هام',
    medium: '📌 متوسط',
    low: '📝 منخفض',
  }
  return priorityMap[priority] || priority
}

/**
 * Download workbook as file
 */
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string = 'التنبيهات_اليومية.xlsx'): void {
  try {
    XLSX.writeFile(wb, filename)
    logger.info('[Excel] File downloaded:', filename)
  } catch (err) {
    logger.error('[Excel] Error downloading file:', err)
  }
}

/**
 * Mark alerts as processed
 */
export async function markAlertsAsProcessed(alertIds: string[]): Promise<boolean> {
  try {
    if (alertIds.length === 0) {
      logger.warn('[Excel] No alert IDs to mark as processed')
      return true
    }

    const { error } = await supabase
      .from('daily_excel_logs')
      .update({
        processed_at: new Date().toISOString(),
      })
      .in('id', alertIds)

    if (error) {
      logger.error('[Excel] Error marking alerts as processed:', error)
      return false
    }

    logger.info(`[Excel] Marked ${alertIds.length} alerts as processed`)
    return true
  } catch (err) {
    logger.error('[Excel] Exception marking alerts as processed:', err)
    return false
  }
}

/**
 * Get count of unprocessed alerts for today
 */
export async function getUnprocessedAlertCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('daily_excel_logs_today')
      .select('*', { count: 'exact' })

    if (error) {
      logger.error('[Excel] Error getting unprocessed count:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    logger.error('[Excel] Exception getting unprocessed count:', err)
    return 0
  }
}
