/**
 * 🔐 Notification Management System - Type Definitions
 * 
 * Features:
 * - Robust fallback to primary admin email (ahmad.alsawy159@gmail.com)
 * - Comprehensive error handling with logging
 * - Validation functions for JSON parsing
 * - Type-safe recipient management
 * 
 * Last Updated: February 4, 2026
 */

import { logger } from '@/utils/logger'

/**
 * ✅ Primary Admin Email - FIXED AND UNCHANGEABLE
 * This email ALWAYS receives all notifications
 */
export const PRIMARY_ADMIN_EMAIL = 'ahmad.alsawy159@gmail.com'

/**
 * 📧 Individual Additional Recipient
 * Stores permission flags for each notification type
 */
export interface AdditionalRecipient {
  id: string
  email: string
  expiryAlerts: boolean
  backupNotifications: boolean
  dailyDigest: boolean
  added_at: string
  added_by: string
}

/**
 * 🎯 Complete Notification Recipients Configuration
 * Stored as JSONB in system_settings table
 * 
 * Structure:
 * {
 *   "primary_admin": "ahmad.alsawy159@gmail.com",
 *   "primary_admin_locked": true,
 *   "additional_recipients": [...],
 *   "version": "1.0",
 *   "last_modified": "2026-02-04T..."
 * }
 */
export interface NotificationRecipientsConfig {
  primary_admin: string
  primary_admin_locked: boolean
  additional_recipients: AdditionalRecipient[]
  version: string
  last_modified: string
}

/**
 * 🔄 Create Default Configuration
 * Used when notification_recipients setting doesn't exist
 */
export function createDefaultConfig(): NotificationRecipientsConfig {
  return {
    primary_admin: PRIMARY_ADMIN_EMAIL,
    primary_admin_locked: true,
    additional_recipients: [],
    version: '1.0',
    last_modified: new Date().toISOString()
  }
}

/**
 * ✔️ Validate Configuration Structure
 * Ensures all required fields are present and correct type
 * 
 * Returns { valid: boolean, config: NotificationRecipientsConfig, error?: string }
 */
export function validateConfig(
  data: unknown
): { valid: boolean; config: NotificationRecipientsConfig; error?: string } {
  try {
    if (!data || typeof data !== 'object') {
      logger.warn('Invalid notification config: not an object')
      return {
        valid: false,
        config: createDefaultConfig(),
        error: 'Configuration is not an object'
      }
    }

    const obj = data as Record<string, unknown>

    // Check primary_admin
    if (typeof obj.primary_admin !== 'string' || !obj.primary_admin.includes('@')) {
      logger.warn(`Invalid primary_admin: ${obj.primary_admin}`)
      obj.primary_admin = PRIMARY_ADMIN_EMAIL
    }

    // Check primary_admin_locked
    if (typeof obj.primary_admin_locked !== 'boolean') {
      obj.primary_admin_locked = true
    }

    // Check additional_recipients is array
    if (!Array.isArray(obj.additional_recipients)) {
      logger.warn('additional_recipients is not an array, setting to []')
      obj.additional_recipients = []
    } else {
      // Validate each recipient
      obj.additional_recipients = (obj.additional_recipients as unknown[]).filter((r) => {
        if (typeof r !== 'object' || r === null) return false
        const recipient = r as Record<string, unknown>
        return (
          typeof recipient.email === 'string' &&
          recipient.email.includes('@') &&
          typeof recipient.expiryAlerts === 'boolean' &&
          typeof recipient.backupNotifications === 'boolean' &&
          typeof recipient.dailyDigest === 'boolean'
        )
      })
    }

    // Check version
    if (typeof obj.version !== 'string') {
      obj.version = '1.0'
    }

    // Check last_modified
    if (typeof obj.last_modified !== 'string') {
      obj.last_modified = new Date().toISOString()
    }

    const config = obj as unknown as NotificationRecipientsConfig
    return { valid: true, config }
  } catch (err) {
    logger.error(`Error validating notification config: ${err instanceof Error ? err.message : String(err)}`)
    return {
      valid: false,
      config: createDefaultConfig(),
      error: `Validation error: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

/**
 * 📩 Build Recipient List for Specific Notification Type
 * 
 * Returns:
 * - ALWAYS includes primary_admin
 * - Filters additional_recipients by permission flag
 * - Has fallback to primary_admin only if parsing fails
 * 
 * Example:
 * ```
 * const recipients = getRecipientsForNotificationType(config, 'expiryAlerts')
 * // Returns: ['ahmad.alsawy159@gmail.com', 'admin2@company.com']
 * ```
 */
export function getRecipientsForNotificationType(
  config: NotificationRecipientsConfig,
  notificationType: 'expiryAlerts' | 'backupNotifications' | 'dailyDigest'
): string[] {
  const recipients = new Set<string>()

  // 🔐 ALWAYS add primary admin - NEVER fails
  recipients.add(PRIMARY_ADMIN_EMAIL)

  try {
    // Add filtered additional recipients based on permission flag
    const key = notificationType as keyof Omit<AdditionalRecipient, 'id' | 'email' | 'added_at' | 'added_by'>
    
    config.additional_recipients.forEach((recipient) => {
      if (recipient[key] === true && recipient.email && recipient.email.includes('@')) {
        recipients.add(recipient.email)
      }
    })
  } catch (err) {
    logger.error(
      `Error filtering recipients for ${notificationType}: ${err instanceof Error ? err.message : String(err)}`
    )
    // Fall back to just primary admin
  }

  return Array.from(recipients)
}

/**
 * 🔍 Safe JSON Parse with Fallback
 * 
 * If parsing fails, returns default config instead of throwing
 * This ensures notifications are NEVER blocked by parsing errors
 */
export function safeParseConfig(
  rawValue: string | Record<string, unknown> | null | undefined
): NotificationRecipientsConfig {
  if (!rawValue) {
    logger.warn('No notification config provided, using default')
    return createDefaultConfig()
  }

  try {
    let parsed: unknown = rawValue

    if (typeof rawValue === 'string') {
      parsed = JSON.parse(rawValue)

      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed)
      }
    }

    const { valid, config, error } = validateConfig(parsed)

    if (!valid) {
      logger.warn(`Config validation failed: ${error}, using defaults`)
      return createDefaultConfig()
    }

    return config
  } catch (err) {
    logger.error(
      `Failed to parse notification config JSON: ${err instanceof Error ? err.message : String(err)}`
    )
    logger.warn('Falling back to default config with primary admin only')
    return createDefaultConfig()
  }
}

/**
 * 🧪 Test Helper - Create Sample Config
 * Used for testing and documentation
 */
export function createSampleConfig(): NotificationRecipientsConfig {
  return {
    primary_admin: PRIMARY_ADMIN_EMAIL,
    primary_admin_locked: true,
    additional_recipients: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'admin2@company.com',
        expiryAlerts: true,
        backupNotifications: true,
        dailyDigest: false,
        added_at: '2026-02-03T10:00:00Z',
        added_by: 'system'
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'admin3@company.com',
        expiryAlerts: false,
        backupNotifications: true,
        dailyDigest: true,
        added_at: '2026-02-03T11:00:00Z',
        added_by: 'system'
      }
    ],
    version: '1.0',
    last_modified: new Date().toISOString()
  }
}
