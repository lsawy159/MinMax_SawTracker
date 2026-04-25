/**
 * 🚨 EMERGENCY: Email Queue Cleanup Utilities
 * 
 * This module provides emergency functions to:
 * 1. Clear pending emails from queue
 * 2. Check queue status
 * 3. Initialize daily_alert_logs table if needed
 */

import { supabase } from '../lib/supabase'
import { logger } from './logger'

/**
 * Clear all pending emails from the email_queue to stop inbox flooding
 * @returns Count of cleared emails
 */
export async function clearPendingEmailQueue(): Promise<number> {
  try {
    logger.warn('🚨 EMERGENCY: Clearing all pending emails from queue...')
    
    const { data, error } = await supabase
      .from('email_queue')
      .update({ status: 'cancelled', reason: 'emergency_flood_cleanup' })
      .eq('status', 'pending')
      .select('id')
    
    if (error) {
      logger.error('Failed to clear pending queue:', error)
      throw error
    }
    
    const count = data?.length || 0
    logger.warn(`✅ Cleared ${count} pending emails from queue`)
    return count
  } catch (err) {
    logger.error('Emergency cleanup failed:', err)
    throw err
  }
}

/**
 * Get current status of email queue
 */
export async function getEmailQueueStatus() {
  try {
    const { data, error } = await supabase
      .from('email_queue')
      .select('status')
    
    if (error) throw error
    
    const statusMap = {
      pending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      other: 0
    }
    
    for (const record of data || []) {
      if (record.status === 'pending') statusMap.pending++
      else if (record.status === 'sent') statusMap.sent++
      else if (record.status === 'failed') statusMap.failed++
      else if (record.status === 'cancelled') statusMap.cancelled++
      else statusMap.other++
    }
    
    return statusMap
  } catch (err) {
    logger.error('Failed to get email queue status:', err)
    return { pending: 0, sent: 0, failed: 0, cancelled: 0, other: 0 }
  }
}

/**
 * Create daily_alert_logs table if it doesn't exist
 * This table will hold temporary alert logs before consolidating into daily digest
 */
export async function ensureDailyAlertLogsTable(): Promise<boolean> {
  try {
    // Try to select from table to see if it exists
    const { error: selectError } = await supabase
      .from('daily_alert_logs')
      .select('id')
      .limit(1)
    
    if (!selectError) {
      logger.info('✅ daily_alert_logs table already exists')
      return true
    }
    
    // If table doesn't exist, we need to create it via SQL
    logger.warn('⚠️  daily_alert_logs table does not exist - will need to be created via migration')
    return false
  } catch (err) {
    logger.error('Error checking daily_alert_logs table:', err)
    return false
  }
}

/**
 * Log an alert to daily_alert_logs instead of immediately queueing email
 * This is used in DIGEST mode
 */
export async function logAlertToDailyLogs(params: {
  employee_id?: string
  company_id?: string
  alert_type: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  details: Record<string, unknown>
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('daily_alert_logs')
      .insert({
        employee_id: params.employee_id || null,
        company_id: params.company_id || null,
        alert_type: params.alert_type,
        priority: params.priority,
        title: params.title,
        message: params.message,
        details: params.details,
        created_at: new Date().toISOString()
      })
    
    if (error) {
      logger.error('Failed to log alert to daily_alert_logs:', error)
      return false
    }
    
    return true
  } catch (err) {
    logger.error('Error logging alert to daily logs:', err)
    return false
  }
}

/**
 * Get all alerts from daily_alert_logs for today
 */
export async function getTodaysDailyLogs() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()
    
    const { data, error } = await supabase
      .from('daily_alert_logs')
      .select('*')
      .gte('created_at', todayIso)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return data || []
  } catch (err) {
    logger.error('Failed to get todays daily logs:', err)
    return []
  }
}

/**
 * Clear daily alert logs after sending digest
 */
export async function clearProcessedDailyLogs(processedIds: string[]): Promise<boolean> {
  try {
    if (processedIds.length === 0) return true
    
    const { error } = await supabase
      .from('daily_alert_logs')
      .delete()
      .in('id', processedIds)
    
    if (error) {
      logger.error('Failed to clear processed daily logs:', error)
      return false
    }
    
    return true
  } catch (err) {
    logger.error('Error clearing daily logs:', err)
    return false
  }
}
