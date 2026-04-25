/**
 * ط®ط¯ظ…ط© ط§ظ„ظ…ط±ط§ظ‚ط¨ط© ط§ظ„ط´ط§ظ…ظ„ط© ظ„طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط©
 * 
 * طھظ‚ظˆظ… ظ‡ط°ظ‡ ط§ظ„ط®ط¯ظ…ط© ط¨ظ…ط±ط§ظ‚ط¨ط© ط¬ظ…ظٹط¹ طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط© ظ„ظ„ط´ط±ظƒط§طھ ظˆط§ظ„ظ…ظˆط¸ظپظٹظ†
 * ظˆط¥ط±ط³ط§ظ„ طھظ†ط¨ظٹظ‡ط§طھ ط¨ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ظ„ظ„طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ط¹ط§ط¬ظ„ط© ظˆط§ظ„ظ‡ط§ظ…ط©
 * 
 * @module comprehensiveExpiryAlertService
 * @author SAW Tracker System
 */

import { supabase } from '../lib/supabase'
import { enqueueEmail } from '../lib/emailQueueService'
import { getNotificationRecipients } from '@/lib/notificationRecipientService'
import { PRIMARY_ADMIN_EMAIL } from '@/lib/notificationTypes'
import { logger } from '../utils/logger'
import { getNotificationThresholds } from '../utils/alerts'
import { getEmployeeNotificationThresholdsPublic } from '../utils/employeeAlerts'
import { calculateDaysRemaining } from '@/utils/statusHelpers'

// ========================
// ط§ظ„ط£ظ†ظˆط§ط¹ ظˆط§ظ„ظˆط§ط¬ظ‡ط§طھ
// ========================

/**
 * طھظƒظˆظٹظ† ط§ظ„ظ…ط±ط§ظ‚ط¨ط© ظ„ظƒظ„ ظ†ظˆط¹ ظ…ظ† ط§ظ„ظ…ط³طھظ†ط¯ط§طھ
 */
interface ExpiryMonitorConfig {
  /** ط§ط³ظ… ط§ظ„ط­ظ‚ظ„ ظپظٹ ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ */
  fieldName: string
  /** ط§ط³ظ… ط§ظ„ظ†ظˆط¹ ط¨ط§ظ„ط¹ط±ط¨ظٹط© (ظٹط¸ظ‡ط± ظپظٹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ) */
  arabicName: string
  /** ط§ط³ظ… ظ†ظˆط¹ ط§ظ„طھظ†ط¨ظٹظ‡ */
  alertType: string
  /** ظ…ظپط§طھظٹط­ ط§ظ„ط¹طھط¨ط§طھ ظپظٹ system_settings */
  thresholdKeys: {
    urgent: string
    high: string
    medium: string
  }
}

/**
 * طھظ†ط¨ظٹظ‡ ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط©
 */
interface ExpiryAlert {
  id: string
  entityType: 'company' | 'employee'
  entityId: string
  entityName: string
  documentType: string
  documentTypeArabic: string
  expiryDate: string
  daysRemaining: number
  priority: 'urgent' | 'high' | 'medium'
  message: string
  actionRequired: string
  companyName?: string
}

// ========================
// طھظƒظˆظٹظ† ط£ظ†ظˆط§ط¹ ط§ظ„ظ…ط³طھظ†ط¯ط§طھ
// ========================

/**
 * طھظƒظˆظٹظ† ظ…ط±ط§ظ‚ط¨ط© ظ…ط³طھظ†ط¯ط§طھ ط§ظ„ط´ط±ظƒط§طھ
 */
const COMPANY_DOCUMENT_CONFIGS: ExpiryMonitorConfig[] = [
  {
    fieldName: 'commercial_registration_expiry',
    arabicName: 'ط§ظ„ط³ط¬ظ„ ط§ظ„طھط¬ط§ط±ظٹ',
    alertType: 'commercial_registration_expiry',
    thresholdKeys: {
      urgent: 'commercial_reg_urgent_days',
      high: 'commercial_reg_high_days',
      medium: 'commercial_reg_medium_days'
    }
  },
  {
    fieldName: 'ending_subscription_power_date',
    arabicName: 'ط§ط´طھط±ط§ظƒ ظ‚ظˆظ‰',
    alertType: 'power_subscription_expiry',
    thresholdKeys: {
      urgent: 'power_subscription_urgent_days',
      high: 'power_subscription_high_days',
      medium: 'power_subscription_medium_days'
    }
  },
  {
    fieldName: 'ending_subscription_moqeem_date',
    arabicName: 'ط§ط´طھط±ط§ظƒ ظ…ظ‚ظٹظ…',
    alertType: 'moqeem_subscription_expiry',
    thresholdKeys: {
      urgent: 'moqeem_subscription_urgent_days',
      high: 'moqeem_subscription_high_days',
      medium: 'moqeem_subscription_medium_days'
    }
  }
]

/**
 * طھظƒظˆظٹظ† ظ…ط±ط§ظ‚ط¨ط© ظ…ط³طھظ†ط¯ط§طھ ط§ظ„ظ…ظˆط¸ظپظٹظ†
 */
const EMPLOYEE_DOCUMENT_CONFIGS: ExpiryMonitorConfig[] = [
  {
    fieldName: 'residence_expiry',
    arabicName: 'ط§ظ„ط¥ظ‚ط§ظ…ط©',
    alertType: 'residence_expiry',
    thresholdKeys: {
      urgent: 'residence_urgent_days',
      high: 'residence_high_days',
      medium: 'residence_medium_days'
    }
  },
  {
    fieldName: 'health_insurance_expiry',
    arabicName: 'ط§ظ„طھط£ظ…ظٹظ† ط§ظ„طµط­ظٹ',
    alertType: 'health_insurance_expiry',
    thresholdKeys: {
      urgent: 'health_insurance_urgent_days',
      high: 'health_insurance_high_days',
      medium: 'health_insurance_medium_days'
    }
  },
  {
    fieldName: 'contract_expiry',
    arabicName: 'ط¹ظ‚ط¯ ط§ظ„ط¹ظ…ظ„',
    alertType: 'contract_expiry',
    thresholdKeys: {
      urgent: 'contract_urgent_days',
      high: 'contract_high_days',
      medium: 'contract_medium_days'
    }
  },
  {
    fieldName: 'hired_worker_contract_expiry',
    arabicName: 'ط¹ظ‚ط¯ ط£ط¬ظٹط±',
    alertType: 'hired_worker_contract_expiry',
    thresholdKeys: {
      urgent: 'hired_worker_contract_urgent_days',
      high: 'hired_worker_contract_high_days',
      medium: 'hired_worker_contract_medium_days'
    }
  }
]

// ========================
// ط§ظ„ط¯ظˆط§ظ„ ط§ظ„ظ…ط³ط§ط¹ط¯ط©
// ========================


/**
 * طھط­ط¯ظٹط¯ ط£ظˆظ„ظˆظٹط© ط§ظ„طھظ†ط¨ظٹظ‡ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط¹ط¯ط¯ ط§ظ„ط£ظٹط§ظ… ط§ظ„ظ…طھط¨ظ‚ظٹط©
 */
function determinePriority(
  daysRemaining: number,
  urgentDays: number,
  highDays: number,
  mediumDays: number
): 'urgent' | 'high' | 'medium' | null {
  if (daysRemaining < 0 || daysRemaining <= urgentDays) {
    return 'urgent'
  } else if (daysRemaining <= highDays) {
    return 'high'
  } else if (daysRemaining <= mediumDays) {
    return 'medium'
  }
  return null
}

/**
 * ط¥ظ†ط´ط§ط، ط±ط³ط§ظ„ط© ط§ظ„طھظ†ط¨ظٹظ‡ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط§ظ„ط£ظˆظ„ظˆظٹط© ظˆط¹ط¯ط¯ ط§ظ„ط£ظٹط§ظ…
 */
function createAlertMessage(
  entityName: string,
  documentTypeArabic: string,
  daysRemaining: number,
  priority: 'urgent' | 'high' | 'medium'
): { message: string; actionRequired: string } {
  let message: string
  let actionRequired: string

  if (daysRemaining < 0) {
    const daysExpired = Math.abs(daysRemaining)
    message = `ط§ظ†طھظ‡طھ طµظ„ط§ط­ظٹط© ${documentTypeArabic} ظ„ظ€ "${entityName}" ظ…ظ†ط° ${daysExpired} ظٹظˆظ…. ظٹط¬ط¨ ط§ظ„طھط¬ط¯ظٹط¯ ظپظˆط±ط§ظ‹.`
    actionRequired = `ظ‚ظ… ط¨طھط¬ط¯ظٹط¯ ${documentTypeArabic} ظ„ظ€ "${entityName}" ظپظٹ ط£ظ‚ط±ط¨ ظˆظ‚طھ ظ…ظ…ظƒظ†.`
  } else if (daysRemaining === 0) {
    message = `طھظ†طھظ‡ظٹ طµظ„ط§ط­ظٹط© ${documentTypeArabic} ظ„ظ€ "${entityName}" ط§ظ„ظٹظˆظ…. ظٹط¬ط¨ ط§ظ„طھط¬ط¯ظٹط¯ ظ‚ط¨ظ„ ظ†ظ‡ط§ظٹط© ط§ظ„ظٹظˆظ….`
    actionRequired = `ظ‚ظ… ط¨طھط¬ط¯ظٹط¯ ${documentTypeArabic} ظ„ظ€ "${entityName}" ظ‚ط¨ظ„ ظ†ظ‡ط§ظٹط© ط§ظ„ظٹظˆظ….`
  } else if (daysRemaining === 1) {
    message = `طھظ†طھظ‡ظٹ طµظ„ط§ط­ظٹط© ${documentTypeArabic} ظ„ظ€ "${entityName}" ط؛ط¯ط§ظ‹. ظٹظپط¶ظ„ ط§ظ„طھط¬ط¯ظٹط¯ ط§ظ„ظٹظˆظ….`
    actionRequired = `ظ‚ظ… ط¨طھط¬ط¯ظٹط¯ ${documentTypeArabic} ظ„ظ€ "${entityName}" ظ‚ط¨ظ„ ط§ظ†طھظ‡ط§ط، ظ…ط¯طھظ‡ ط؛ط¯ط§ظ‹.`
  } else if (priority === 'urgent') {
    message = `طھظ†طھظ‡ظٹ طµظ„ط§ط­ظٹط© ${documentTypeArabic} ظ„ظ€ "${entityName}" ط®ظ„ط§ظ„ ${daysRemaining} ط£ظٹط§ظ… - ط¥ط¬ط±ط§ط، ظپظˆط±ظٹ ظ…ط·ظ„ظˆط¨.`
    actionRequired = `ظ‚ظ… ط¨طھط±طھظٹط¨ طھط¬ط¯ظٹط¯ ${documentTypeArabic} ظ„ظ€ "${entityName}" ط®ظ„ط§ظ„ ط§ظ„ظ€ ${daysRemaining} ط£ظٹط§ظ… ط§ظ„ظ‚ط§ط¯ظ…ط©.`
  } else if (priority === 'high') {
    message = `طھظ†طھظ‡ظٹ طµظ„ط§ط­ظٹط© ${documentTypeArabic} ظ„ظ€ "${entityName}" ط®ظ„ط§ظ„ ${daysRemaining} ظٹظˆظ… - ظ…طھط§ط¨ط¹ط© ظ…ط·ظ„ظˆط¨ط©.`
    actionRequired = `ظ‚ظ… ط¨طھط±طھظٹط¨ طھط¬ط¯ظٹط¯ ${documentTypeArabic} ظ„ظ€ "${entityName}" ط®ظ„ط§ظ„ ط§ظ„ظ€ ${daysRemaining} ظٹظˆظ… ط§ظ„ظ‚ط§ط¯ظ…ط©.`
  } else {
    message = `${documentTypeArabic} ظ„ظ€ "${entityName}" ط³طھظ†طھظ‡ظٹ ط®ظ„ط§ظ„ ${daysRemaining} ظٹظˆظ….`
    actionRequired = `ظ‚ظ… ط¨ظ…طھط§ط¨ط¹ط© طھط¬ط¯ظٹط¯ ${documentTypeArabic} ظ„ظ€ "${entityName}" ط¹ظ†ط¯ ط§ظ„ط­ط§ط¬ط©.`
  }

  return { message, actionRequired }
}

// ========================
// ط¯ظˆط§ظ„ ط§ظ„ظ…ط±ط§ظ‚ط¨ط© ط§ظ„ط±ط¦ظٹط³ظٹط©
// ========================

/**
 * ظ…ط±ط§ظ‚ط¨ط© طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط© ظ„ظ„ط´ط±ظƒط§طھ
 */
async function monitorCompanyExpiryDates(): Promise<ExpiryAlert[]> {
  const alerts: ExpiryAlert[] = []

  try {
    // ط¬ظ„ط¨ ط¬ظ…ظٹط¹ ط§ظ„ط´ط±ظƒط§طھ ط§ظ„ظ†ط´ط·ط©
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_number,commercial_registration_status,additional_fields,ending_subscription_power_date,ending_subscription_moqeem_date,employee_count,max_employees,notes,exemptions,company_type,created_at,updated_at')

    if (error) {
      logger.error('ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط´ط±ظƒط§طھ:', error)
      return alerts
    }

    if (!companies || companies.length === 0) {
      logger.debug('ظ„ط§ طھظˆط¬ط¯ ط´ط±ظƒط§طھ ظ„ظ„ظ…ط±ط§ظ‚ط¨ط©')
      return alerts
    }

    // ط¬ظ„ط¨ ط§ظ„ط¹طھط¨ط§طھ ظ…ظ† system_settings
    const thresholds = await getNotificationThresholds()

    // ظ…ط±ط§ظ‚ط¨ط© ظƒظ„ ظ†ظˆط¹ ظ…ظ† ط§ظ„ظ…ط³طھظ†ط¯ط§طھ
    for (const company of companies) {
      for (const config of COMPANY_DOCUMENT_CONFIGS) {
        const expiryDate = company[config.fieldName]
        
        if (!expiryDate) {
          continue // طھط¬ط§ظ‡ظ„ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظپط§ط±ط؛ط©
        }

        const daysRemaining = calculateDaysRemaining(expiryDate)
        
        // ط§ظ„ط­طµظˆظ„ ط¹ظ„ظ‰ ط§ظ„ط¹طھط¨ط§طھ ظ„ظ‡ط°ط§ ط§ظ„ظ†ظˆط¹ ظ…ظ† ط§ظ„ظ…ط³طھظ†ط¯ط§طھ
        const urgentDays = thresholds[config.thresholdKeys.urgent as keyof typeof thresholds] as number
        const highDays = thresholds[config.thresholdKeys.high as keyof typeof thresholds] as number
        const mediumDays = thresholds[config.thresholdKeys.medium as keyof typeof thresholds] as number

        const priority = determinePriority(daysRemaining, urgentDays, highDays, mediumDays)

        // ط¥ظ†ط´ط§ط، طھظ†ط¨ظٹظ‡ ظپظ‚ط· ط¥ط°ط§ ظƒط§ظ† ط¶ظ…ظ† ظ†ط·ط§ظ‚ ط§ظ„ط¹طھط¨ط§طھ
        if (priority) {
          const { message, actionRequired } = createAlertMessage(
            company.name,
            config.arabicName,
            daysRemaining,
            priority
          )

          alerts.push({
            id: `${config.alertType}_${company.id}_${expiryDate}`,
            entityType: 'company',
            entityId: company.id,
            entityName: company.name,
            documentType: config.alertType,
            documentTypeArabic: config.arabicName,
            expiryDate,
            daysRemaining,
            priority,
            message,
            actionRequired
          })
        }
      }
    }

    logger.info(`طھظ… ط¥ظ†ط´ط§ط، ${alerts.length} طھظ†ط¨ظٹظ‡ ظ„ظ„ط´ط±ظƒط§طھ`)
  } catch (error) {
    logger.error('ط®ط·ط£ ظپظٹ ظ…ط±ط§ظ‚ط¨ط© طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط© ظ„ظ„ط´ط±ظƒط§طھ:', error)
  }

  return alerts
}

/**
 * ظ…ط±ط§ظ‚ط¨ط© طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط© ظ„ظ„ظ…ظˆط¸ظپظٹظ†
 */
async function monitorEmployeeExpiryDates(): Promise<ExpiryAlert[]> {
  const alerts: ExpiryAlert[] = []

  try {
    // ط¬ظ„ط¨ ط¬ظ…ظٹط¹ ط§ظ„ظ…ظˆط¸ظپظٹظ† ظ…ط¹ ظ…ط¹ظ„ظˆظ…ط§طھ ط§ظ„ط´ط±ظƒط©
    const { data: employees, error } = await supabase
      .from('employees')
      .select(`
        *,
        companies:company_id (
          id,
          name,
          commercial_registration_number
        )
      `)

    if (error) {
      logger.error('ط®ط·ط£ ظپظٹ ط¬ظ„ط¨ ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ظˆط¸ظپظٹظ†:', error)
      return alerts
    }

    if (!employees || employees.length === 0) {
      logger.debug('ظ„ط§ ظٹظˆط¬ط¯ ظ…ظˆط¸ظپظٹظ† ظ„ظ„ظ…ط±ط§ظ‚ط¨ط©')
      return alerts
    }

    // ط¬ظ„ط¨ ط§ظ„ط¹طھط¨ط§طھ ظ…ظ† system_settings
    const thresholds = await getEmployeeNotificationThresholdsPublic()

    // ظ…ط±ط§ظ‚ط¨ط© ظƒظ„ ظ†ظˆط¹ ظ…ظ† ط§ظ„ظ…ط³طھظ†ط¯ط§طھ
    for (const employee of employees) {
      // Type guard: companies ظٹظ…ظƒظ† ط£ظ† ظٹظƒظˆظ† object ط£ظˆ null
      const companyData = employee.companies && typeof employee.companies === 'object' && 'name' in employee.companies 
        ? employee.companies as { name: string; id: string; commercial_registration_number?: string }
        : null
      const companyName = companyData?.name ?? 'ط؛ظٹط± ظ…ط­ط¯ط¯'

      for (const config of EMPLOYEE_DOCUMENT_CONFIGS) {
        const expiryDate = employee[config.fieldName]
        
        if (!expiryDate) {
          continue // طھط¬ط§ظ‡ظ„ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظپط§ط±ط؛ط©
        }

        const daysRemaining = calculateDaysRemaining(expiryDate)
        
        // ط§ظ„ط­طµظˆظ„ ط¹ظ„ظ‰ ط§ظ„ط¹طھط¨ط§طھ ظ„ظ‡ط°ط§ ط§ظ„ظ†ظˆط¹ ظ…ظ† ط§ظ„ظ…ط³طھظ†ط¯ط§طھ
        const urgentDays = thresholds[config.thresholdKeys.urgent as keyof typeof thresholds] as number
        const highDays = thresholds[config.thresholdKeys.high as keyof typeof thresholds] as number
        const mediumDays = thresholds[config.thresholdKeys.medium as keyof typeof thresholds] as number

        const priority = determinePriority(daysRemaining, urgentDays, highDays, mediumDays)

        // ط¥ظ†ط´ط§ط، طھظ†ط¨ظٹظ‡ ظپظ‚ط· ط¥ط°ط§ ظƒط§ظ† ط¶ظ…ظ† ظ†ط·ط§ظ‚ ط§ظ„ط¹طھط¨ط§طھ
        if (priority) {
          const { message, actionRequired } = createAlertMessage(
            employee.name,
            config.arabicName,
            daysRemaining,
            priority
          )

          alerts.push({
            id: `${config.alertType}_${employee.id}_${expiryDate}`,
            entityType: 'employee',
            entityId: employee.id,
            entityName: employee.name,
            documentType: config.alertType,
            documentTypeArabic: config.arabicName,
            expiryDate,
            daysRemaining,
            priority,
            message,
            actionRequired,
            companyName
          })
        }
      }
    }

    logger.info(`طھظ… ط¥ظ†ط´ط§ط، ${alerts.length} طھظ†ط¨ظٹظ‡ ظ„ظ„ظ…ظˆط¸ظپظٹظ†`)
  } catch (error) {
    logger.error('ط®ط·ط£ ظپظٹ ظ…ط±ط§ظ‚ط¨ط© طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط© ظ„ظ„ظ…ظˆط¸ظپظٹظ†:', error)
  }

  return alerts
}

/**
 * ط¥ط±ط³ط§ظ„ طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ظ„ظ„طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ط¹ط§ط¬ظ„ط© ظˆط§ظ„ظ‡ط§ظ…ط©
 */
async function sendEmailNotifications(alerts: ExpiryAlert[]): Promise<void> {
  // طھط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ط¹ط§ط¬ظ„ط© ظˆط§ظ„ظ‡ط§ظ…ط© ظپظ‚ط·
  const criticalAlerts = alerts.filter(
    alert => alert.priority === 'urgent' || alert.priority === 'high'
  )

  if (criticalAlerts.length === 0) {
    logger.debug('ظ„ط§ طھظˆط¬ط¯ طھظ†ط¨ظٹظ‡ط§طھ ط¹ط§ط¬ظ„ط© ط£ظˆ ظ‡ط§ظ…ط© ظ„ط¥ط±ط³ط§ظ„ ظ…ظ„ط®طµ ظٹظˆظ…ظٹ')
    return
  }

  // ط­ط§ط±ط³ ط§ظ„طھظƒط±ط§ط±: ظ„ط§ طھط±ط³ظ„ ظ†ظپط³ ط§ظ„ط³ط¬ظ„ ط®ظ„ط§ظ„ 24 ط³ط§ط¹ط©
  const SETTING_KEY = 'expiry_digest_last_sent'
  const { data: settingRows, error: settingError } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .limit(1)
  if (settingError) {
    logger.warn('طھط¹ط°ط± ظ‚ط±ط§ط،ط© ط³ط¬ظ„ ط§ظ„ط¥ط±ط³ط§ظ„ ط§ظ„ط³ط§ط¨ظ‚ ظ„ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹ:', settingError)
  }
  const sentMap: Record<string, string> = (() => {
    try {
      const raw = settingRows?.[0]?.setting_value as string | undefined
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })()

  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000
  const eligibleAlerts = criticalAlerts.filter(a => {
    const last = sentMap[a.id]
    if (!last) return true
    return (now - new Date(last).getTime()) >= DAY_MS
  })

  if (eligibleAlerts.length === 0) {
    logger.info('ظƒظ„ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ط¹ط§ط¬ظ„ط©/ط§ظ„ظ‡ط§ظ…ط© طھظ… ط¥ط´ط¹ط§ط±ظ‡ط§ ط®ظ„ط§ظ„ ط¢ط®ط± 24 ط³ط§ط¹ط© â€” ظ„ط§ ط¥ط±ط³ط§ظ„ ط¬ط¯ظٹط¯')
    return
  }

  // ط¥ظ†ط´ط§ط، ظ‚ط§ظ„ط¨ آ«ط§ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹآ»
  const buildDigestTable = (items: ExpiryAlert[], title: string) => {
    const rows = items.map(item => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.entityType === 'employee' ? item.entityName : (item.companyName || item.entityName)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.documentTypeArabic}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${new Date(item.expiryDate).toLocaleDateString('ar-SA')}</td>
      </tr>
    `).join('')
    return `
      <h3 style="margin:16px 0 8px;color:#1f2937;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;text-align:right;">
            <th style="padding:10px;border-bottom:1px solid #e5e7eb;">ط§ظ„ط§ط³ظ…</th>
            <th style="padding:10px;border-bottom:1px solid #e5e7eb;">ظ†ظˆط¹ ط§ظ„ظ…ط³طھظ†ط¯</th>
            <th style="padding:10px;border-bottom:1px solid #e5e7eb;">طھط§ط±ظٹط® ط§ظ„ط§ظ†طھظ‡ط§ط،</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
  }

  const employeeItems = eligibleAlerts.filter(a => a.entityType === 'employee')
  const companyItems = eligibleAlerts.filter(a => a.entityType === 'company')

  const header = `
    <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;padding:20px;text-align:center;border-radius:8px;">
      <h2 style="margin:0;font-size:22px;">ًں“¬ ط§ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹ ظ„ظ„طھظ†ط¨ظٹظ‡ط§طھ</h2>
      <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}</p>
    </div>
  `

  const sections = [
    employeeItems.length ? buildDigestTable(employeeItems, 'طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ظ…ظˆط¸ظپظٹظ†') : '',
    companyItems.length ? buildDigestTable(companyItems, 'طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ط´ط±ظƒط§طھ') : ''
  ].filter(Boolean).join('\n')

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
        <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);padding:20px;">
          ${header}
          <p style="margin:16px 0;color:#374151;font-size:14px;">ظٹطھط¶ظ…ظ† ظ‡ط°ط§ ط§ظ„ظ…ظ„ط®طµ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ ط§ظ„ط¹ط§ط¬ظ„ط© ظˆط§ظ„ظ‡ط§ظ…ط© ط®ظ„ط§ظ„ ط¢ط®ط± ظپط­طµ.</p>
          ${sections || '<p style="color:#6b7280;">ظ„ط§ طھظˆط¬ط¯ طھظ†ط¨ظٹظ‡ط§طھ ط­ط§ظ„ظٹط§ظ‹.</p>'}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">ظ‡ط°ط§ ط¨ط±ظٹط¯ ط¢ظ„ظٹ ظ…ظ† ظ†ط¸ط§ظ… SAW Tracker</p>
        </div>
      </body>
    </html>
  `

  const textContent = [
    'ًں“¬ ط§ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹ ظ„ظ„طھظ†ط¨ظٹظ‡ط§طھ',
    `طھط§ط±ظٹط® ط§ظ„ط¥ط±ط³ط§ظ„: ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}`,
    '',
    ...eligibleAlerts.map(a => `- ${(a.entityType === 'employee') ? a.entityName : (a.companyName || a.entityName)} | ${a.documentTypeArabic} | ${new Date(a.expiryDate).toLocaleDateString('ar-SA')}`)
  ].join('\n')

  const subject = `ًں“¬ Daily Digest: ${eligibleAlerts.length} طھظ†ط¨ظٹظ‡`

  // طھط£ط®ظٹط± 600ms ط§ط­طھط±ط§ظ…ط§ظ‹ ظ„ظ…ط¹ط¯ظ„ Resend
  await new Promise(res => setTimeout(res, 600))

  // ًں”گ NEW: ط§ط³طھط®ط¯ظ… ظ†ط¸ط§ظ… ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ ط§ظ„ط¬ط¯ظٹط¯
  let toEmails: string[] = []
  try {
    toEmails = await getNotificationRecipients({
      notificationType: 'expiryAlerts',
      timeout: 5000,
      includeLogging: true
    })
  } catch (err) {
    logger.error(`ظپط´ظ„ ط§ظ„ط­طµظˆظ„ ط¹ظ„ظ‰ ط§ظ„ظ…ط³طھظ‚ط¨ظ„ظٹظ† ظ…ظ† ط§ظ„ظ†ط¸ط§ظ… ط§ظ„ط¬ط¯ظٹط¯: ${err instanceof Error ? err.message : String(err)}`)
    // ًں”گ FALLBACK: ط§ط³طھط®ط¯ظ… ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط£ط³ط§ط³ظٹ ظپظ‚ط·
    toEmails = [PRIMARY_ADMIN_EMAIL]
    logger.warn(`ط§ظ„ط±ط¬ظˆط¹ ط¥ظ„ظ‰ ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط£ط³ط§ط³ظٹ: ${PRIMARY_ADMIN_EMAIL}`)
  }

  if (toEmails.length === 0) {
    logger.warn('ظ„ظ… ظٹطھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ط£ظٹ ظ…ط³طھظ‚ط¨ظ„ظٹظ† ظ„ظ„ط¥ط´ط¹ط§ط±')
    toEmails = [PRIMARY_ADMIN_EMAIL]
  }

  logger.debug(`ط¥ط±ط³ط§ظ„ ط¥ط´ط¹ط§ط± ط§ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹ ط¥ظ„ظ‰ ${toEmails.length} ظ…ط³طھظ‚ط¨ظ„: ${toEmails.join(', ')}`)

  const enqueueResult = await enqueueEmail({
    toEmails,
    subject,
    htmlContent,
    textContent,
    priority: 'high'
  })

  if (!enqueueResult.success) {
    logger.error('ظپط´ظ„ ط¥ط¶ط§ظپط© ط§ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹ ط¥ظ„ظ‰ ظ‚ط§ط¦ظ…ط© ط§ظ„ط§ظ†طھط¸ط§ط±:', enqueueResult.error)
    return
  }

  // طھط­ط¯ظٹط« ط³ط¬ظ„ ط§ظ„ط¥ط±ط³ط§ظ„ ظ„ظ…ظ†ط¹ ط§ظ„طھظƒط±ط§ط± ط®ظ„ط§ظ„ 24 ط³ط§ط¹ط©
  const updatedSentMap = { ...sentMap }
  const isoNow = new Date().toISOString()
  for (const a of eligibleAlerts) {
    updatedSentMap[a.id] = isoNow
  }
  const { error: upsertError } = await supabase
    .from('system_settings')
    .upsert({ setting_key: SETTING_KEY, setting_value: JSON.stringify(updatedSentMap), updated_at: isoNow }, { onConflict: 'setting_key' })
    .select()
  if (upsertError) {
    logger.warn('طھط¹ط°ط± طھط­ط¯ظٹط« ط³ط¬ظ„ ط§ظ„ط¥ط±ط³ط§ظ„ ظ„ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹ:', upsertError)
  }

  logger.info(`طھظ… ط¥ط¶ط§ظپط© ط¨ط±ظٹط¯ ظˆط§ط­ط¯ ظ„ظ„ظ…ظ„ط®طµ ط§ظ„ظٹظˆظ…ظٹ ط¨ط¹ط¯ط¯ ط¹ظ†ط§طµط±: ${eligibleAlerts.length}`)
}

// ========================
// ط§ظ„ط¯ط§ظ„ط© ط§ظ„ط±ط¦ظٹط³ظٹط©
// ========================

/**
 * طھط´ط؛ظٹظ„ ظ…ط±ط§ظ‚ط¨ط© ط´ط§ظ…ظ„ط© ظ„ط¬ظ…ظٹط¹ طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط©
 * 
 * ظ‡ط°ظ‡ ط§ظ„ط¯ط§ظ„ط© ط§ظ„ط±ط¦ظٹط³ظٹط© ط§ظ„طھظٹ ظٹط¬ط¨ ط§ط³طھط¯ط¹ط§ط¤ظ‡ط§ ظ…ظ† Cron Job
 * طھظ‚ظˆظ… ط¨ظ…ط±ط§ظ‚ط¨ط© ط¬ظ…ظٹط¹ ط§ظ„ط´ط±ظƒط§طھ ظˆط§ظ„ظ…ظˆط¸ظپظٹظ† ظˆط¥ط±ط³ط§ظ„ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ
 */
export async function runComprehensiveExpiryMonitoring(): Promise<{
  companyAlerts: ExpiryAlert[]
  employeeAlerts: ExpiryAlert[]
  totalAlerts: number
  criticalAlerts: number
}> {
  logger.info('ط¨ط¯ط، ط§ظ„ظ…ط±ط§ظ‚ط¨ط© ط§ظ„ط´ط§ظ…ظ„ط© ظ„طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط©')
  
  try {
    // ظ…ط±ط§ظ‚ط¨ط© ط§ظ„ط´ط±ظƒط§طھ ظˆط§ظ„ظ…ظˆط¸ظپظٹظ† ط¨ط´ظƒظ„ ظ…طھظˆط§ط²ظٹ
    const [companyAlerts, employeeAlerts] = await Promise.all([
      monitorCompanyExpiryDates(),
      monitorEmployeeExpiryDates()
    ])

    // ط¯ظ…ط¬ ط¬ظ…ظٹط¹ ط§ظ„طھظ†ط¨ظٹظ‡ط§طھ
    const allAlerts = [...companyAlerts, ...employeeAlerts]
    const criticalAlerts = allAlerts.filter(
      alert => alert.priority === 'urgent' || alert.priority === 'high'
    )

    // ط¥ط±ط³ط§ظ„ ظ…ظ„ط®طµ ظٹظˆظ…ظٹ ظˆط§ط­ط¯ ط¨ط§ظ„ط¨ط±ظٹط¯
    await sendEmailNotifications(allAlerts)

    logger.info(
      `ط§ظƒطھظ…ظ„طھ ط§ظ„ظ…ط±ط§ظ‚ط¨ط© ط§ظ„ط´ط§ظ…ظ„ط©: ط¥ط¬ظ…ط§ظ„ظٹ ${allAlerts.length} طھظ†ط¨ظٹظ‡ (${criticalAlerts.length} ط¹ط§ط¬ظ„/ظ‡ط§ظ…)`
    )

    return {
      companyAlerts,
      employeeAlerts,
      totalAlerts: allAlerts.length,
      criticalAlerts: criticalAlerts.length
    }
  } catch (error) {
    logger.error('ط®ط·ط£ ظپظٹ ط§ظ„ظ…ط±ط§ظ‚ط¨ط© ط§ظ„ط´ط§ظ…ظ„ط© ظ„طھظˆط§ط±ظٹط® ط§ظ†طھظ‡ط§ط، ط§ظ„طµظ„ط§ط­ظٹط©:', error)
    throw error
  }
}

// طھطµط¯ظٹط± ط§ظ„ط¯ظˆط§ظ„ ط§ظ„ظ…ط³ط§ط¹ط¯ط© ظ„ظ„ط§ط³طھط®ط¯ط§ظ… ط§ظ„ط®ط§ط±ط¬ظٹ
export {
  monitorCompanyExpiryDates,
  monitorEmployeeExpiryDates,
  sendEmailNotifications,
  type ExpiryAlert,
  type ExpiryMonitorConfig
}

