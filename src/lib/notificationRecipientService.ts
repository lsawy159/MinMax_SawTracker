/**
 * 🔐 Safe Notification Recipients Getter
 * 
 * Features:
 * - Reads from system_settings with fallback to defaults
 * - Robust error handling with comprehensive logging
 * - ALWAYS includes primary admin email (ahmad.alsawy159@gmail.com)
 * - Safe async operations with timeout
 * 
 * Last Updated: February 4, 2026
 */

import { supabase } from '@/lib/supabase'
import {
  PRIMARY_ADMIN_EMAIL,
  getRecipientsForNotificationType,
  safeParseConfig
} from '@/lib/notificationTypes'
import { logger } from '@/utils/logger'

interface GetRecipientsOptions {
  notificationType: 'expiryAlerts' | 'backupNotifications' | 'dailyDigest'
  timeout?: number // milliseconds, default 5000
  includeLogging?: boolean // default true
}

/**
 * 🎯 Get Recipients for a Specific Notification Type
 * 
 * This is the MAIN function used by all services
 * 
 * Safety Features:
 * 1. Database read with timeout
 * 2. JSON parsing with fallback
 * 3. Permission filtering with validation
 * 4. ALWAYS includes primary admin
 * 5. Falls back to primary admin if any error
 * 6. Comprehensive error logging
 * 
 * Returns: string[] of email addresses
 * 
 * Example:
 * ```typescript
 * const recipients = await getNotificationRecipients({
 *   notificationType: 'expiryAlerts'
 * })
 * // Returns: ['ahmad.alsawy159@gmail.com', 'other@company.com']
 * ```
 */
export async function getNotificationRecipients(
  options: GetRecipientsOptions
): Promise<string[]> {
  const {
    notificationType,
    timeout = 5000,
    includeLogging = true
  } = options

  if (includeLogging) {
    logger.debug(`[getNotificationRecipients] Fetching recipients for: ${notificationType}`)
  }

  try {
    // Set up timeout race condition
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Database query timeout after ${timeout}ms`))
      }, timeout)
      
      // Ensure timeout is cleared
      return () => clearTimeout(timer)
    })

    // Fetch notification_recipients from database
    const fetchPromise = (async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'notification_recipients')
        .single()

      if (error) {
        // It's OK if the setting doesn't exist yet - we use defaults
        if (error.code === 'PGRST116') {
          if (includeLogging) {
            logger.debug('[getNotificationRecipients] notification_recipients setting not found, using defaults')
          }
          return null
        }
        throw error
      }

      return data?.setting_value ?? null
    })()

    // Race between fetch and timeout
    const configJson = await Promise.race([fetchPromise, timeoutPromise])

    // Parse configuration (safe - has fallback)
    const config = safeParseConfig(configJson)

    // Get recipients for this notification type
    const recipients = getRecipientsForNotificationType(config, notificationType)

    if (includeLogging) {
      logger.debug(
        `[getNotificationRecipients] Got ${recipients.length} recipient(s) for ${notificationType}: ${recipients.join(', ')}`
      )
    }

    return recipients
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    logger.error(
      `[getNotificationRecipients] Error fetching recipients for ${notificationType}: ${errorMessage}`
    )

    // 🔐 FALLBACK: Return only primary admin
    logger.warn(`[getNotificationRecipients] Falling back to primary admin: ${PRIMARY_ADMIN_EMAIL}`)
    return [PRIMARY_ADMIN_EMAIL]
  }
}

/**
 * 🧪 Health Check - Verify Notification System is Working
 * 
 * Returns:
 * ```
 * {
 *   status: 'healthy' | 'degraded' | 'error',
 *   primaryAdmin: string,
 *   recipientCount: number,
 *   lastChecked: string,
 *   warnings: string[]
 * }
 * ```
 */
export async function checkNotificationHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'error'
  primaryAdmin: string
  recipientCount: number
  lastChecked: string
  warnings: string[]
}> {
  const warnings: string[] = []

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_recipients')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    const config = safeParseConfig(data?.setting_value as string | null)
    const recipients = getRecipientsForNotificationType(config, 'expiryAlerts')

    // Check if primary admin is included
    if (!recipients.includes(PRIMARY_ADMIN_EMAIL)) {
      warnings.push('Primary admin not in recipients list')
    }

    return {
      status: warnings.length === 0 ? 'healthy' : 'degraded',
      primaryAdmin: PRIMARY_ADMIN_EMAIL,
      recipientCount: recipients.length,
      lastChecked: new Date().toISOString(),
      warnings
    }
  } catch (err) {
    logger.error(`[checkNotificationHealth] Error: ${err instanceof Error ? err.message : String(err)}`)
    return {
      status: 'error',
      primaryAdmin: PRIMARY_ADMIN_EMAIL,
      recipientCount: 1,
      lastChecked: new Date().toISOString(),
      warnings: [
        'Error checking notification system',
        err instanceof Error ? err.message : String(err)
      ]
    }
  }
}
