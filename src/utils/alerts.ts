import { Alert } from '../components/alerts/AlertCard'
import { supabase, type Company } from '../lib/supabase'
import { logger } from './logger'

// Default thresholds for alerts
const DEFAULT_THRESHOLDS = {
  residence_urgent_days: 7,
  residence_high_days: 15,
  residence_medium_days: 30,
  contract_urgent_days: 7,
  contract_high_days: 15,
  contract_medium_days: 30,
  commercial_reg_urgent_days: 30,
  commercial_reg_high_days: 45,
  commercial_reg_medium_days: 60,
  health_insurance_urgent_days: 30,
  health_insurance_high_days: 45,
  health_insurance_medium_days: 60,
  power_subscription_urgent_days: 30,
  power_subscription_high_days: 45,
  power_subscription_medium_days: 60,
  moqeem_subscription_urgent_days: 30,
  moqeem_subscription_high_days: 45,
  moqeem_subscription_medium_days: 60,
}

// Cache for notification thresholds
let thresholdsCache: typeof DEFAULT_THRESHOLDS | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

// Function to invalidate the cache (call this when settings are saved)
export function invalidateNotificationThresholdsCache() {
  thresholdsCache = null
  cacheTimestamp = 0
}

// Get notification thresholds from database settings with caching
export async function getNotificationThresholds() {
  // In test environment, avoid network calls and use defaults
  if (import.meta.env.MODE === 'test') {
    return DEFAULT_THRESHOLDS
  }

  // Check if cache is valid
  const now = Date.now()
  if (thresholdsCache && now - cacheTimestamp < CACHE_TTL) {
    return thresholdsCache
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_thresholds')
      .maybeSingle()

    if (error || !data || !data.setting_value) {
      logger.debug('Using default notification thresholds')
      // Cache the defaults
      thresholdsCache = DEFAULT_THRESHOLDS
      cacheTimestamp = now
      return DEFAULT_THRESHOLDS
    }

    // Merge with defaults to ensure all required fields exist
    const mergedThresholds = { ...DEFAULT_THRESHOLDS, ...data.setting_value }
    // Update cache
    thresholdsCache = mergedThresholds
    cacheTimestamp = now
    return mergedThresholds
  } catch (error) {
    console.error('Error loading notification thresholds:', error)
    // Cache the defaults on error
    thresholdsCache = DEFAULT_THRESHOLDS
    cacheTimestamp = now
    return DEFAULT_THRESHOLDS
  }
}

const loggedCompanyDigestKeys = new Set<string>()

function getTodayAlertDate(): string {
  return new Date().toISOString().slice(0, 10)
}

// Alert factory configuration
interface AlertConfig {
  expiryFieldKey: keyof Company
  alertType: Alert['type']
  alertTitle: string
  idPrefix: string
  thresholdKeys: {
    urgent: string
    high: string
    medium: string
  }
  messageTemplate: {
    expired: (days: number, name: string) => string
    today: (name: string) => string
    tomorrow: (name: string) => string
    upcoming: (days: number, name: string) => string
    urgentUpcoming: (days: number, name: string) => string
    highUpcoming: (days: number, name: string) => string
  }
  actionTemplate: {
    expired: (name: string) => string
    today: (name: string) => string
    tomorrow: (name: string) => string
    upcoming: (days: number, name: string) => string
    urgentUpcoming: (days: number, name: string) => string
    highUpcoming: (days: number, name: string) => string
  }
}

// Factory function to create alerts with consolidated logic
async function createExpiryAlert(
  company: Company,
  config: AlertConfig,
  thresholds: typeof DEFAULT_THRESHOLDS
): Promise<Alert | null> {
  const expiryDateStr = company[config.expiryFieldKey]
  if (!expiryDateStr) {
    return null
  }

  const today = new Date()
  const expiryDate = new Date(expiryDateStr as string)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))

  // Get threshold values with fallback to commercial_reg defaults
  const urgentThreshold = (thresholds[config.thresholdKeys.urgent as keyof typeof DEFAULT_THRESHOLDS] ?? thresholds.commercial_reg_urgent_days) as number
  const highThreshold = (thresholds[config.thresholdKeys.high as keyof typeof DEFAULT_THRESHOLDS] ?? thresholds.commercial_reg_high_days) as number
  const mediumThreshold = (thresholds[config.thresholdKeys.medium as keyof typeof DEFAULT_THRESHOLDS] ?? thresholds.commercial_reg_medium_days) as number

  // No alert if beyond medium threshold
  if (daysRemaining > mediumThreshold) {
    return null
  }

  // Determine priority
  let priority: Alert['priority']
  if (daysRemaining < 0) {
    priority = 'urgent'
  } else if (daysRemaining <= urgentThreshold) {
    priority = 'urgent'
  } else if (daysRemaining <= highThreshold) {
    priority = 'high'
  } else if (daysRemaining <= mediumThreshold) {
    priority = 'medium'
  } else {
    priority = 'low'
  }

  // Build message and action based on days remaining
  let message: string
  let actionRequired: string

  if (daysRemaining < 0) {
    message = config.messageTemplate.expired(Math.abs(daysRemaining), company.name)
    actionRequired = config.actionTemplate.expired(company.name)
  } else if (daysRemaining === 0) {
    message = config.messageTemplate.today(company.name)
    actionRequired = config.actionTemplate.today(company.name)
  } else if (daysRemaining === 1) {
    message = config.messageTemplate.tomorrow(company.name)
    actionRequired = config.actionTemplate.tomorrow(company.name)
  } else if (daysRemaining <= urgentThreshold) {
    message = config.messageTemplate.urgentUpcoming(daysRemaining, company.name)
    actionRequired = config.actionTemplate.urgentUpcoming(daysRemaining, company.name)
  } else if (daysRemaining <= highThreshold) {
    message = config.messageTemplate.highUpcoming(daysRemaining, company.name)
    actionRequired = config.actionTemplate.highUpcoming(daysRemaining, company.name)
  } else {
    message = config.messageTemplate.upcoming(daysRemaining, company.name)
    actionRequired = config.actionTemplate.upcoming(daysRemaining, company.name)
  }

  return {
    id: `${config.idPrefix}${company.id}_${expiryDateStr}`,
    type: config.alertType,
    priority,
    title: config.alertTitle,
    message,
    company: {
      id: company.id,
      name: company.name,
      commercial_registration_number: company.commercial_registration_number,
      unified_number: company.unified_number,
    },
    expiry_date: expiryDateStr as string,
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString(),
  }
}

function getCompanyDigestKey(alert: Alert): string {
  return `${alert.company?.id ?? 'unknown'}:${alert.type}:${alert.expiry_date ?? getTodayAlertDate()}`
}

// T-513: Send alert logging to Edge Function instead of client-side DB writes
function logCompanyAlertsForDigest(alerts: Alert[]) {
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return
  }

  const urgentHighAlerts = alerts.filter((alert) => alert.priority === 'urgent' || alert.priority === 'high')

  if (urgentHighAlerts.length === 0) {
    return
  }

  // Dedup on client side to avoid redundant Edge Function calls
  const logsToSend = urgentHighAlerts
    .filter((alert) => {
      const digestKey = getCompanyDigestKey(alert)
      if (loggedCompanyDigestKeys.has(digestKey)) {
        return false
      }
      loggedCompanyDigestKeys.add(digestKey)
      return true
    })
    .map((alert) => ({
      company_id: alert.company?.id || null,
      alert_type: alert.type,
      priority: alert.priority,
      title: alert.title,
      message: alert.message,
      action_required: alert.action_required,
      expiry_date: alert.expiry_date || null,
      details: {
        company_name: alert.company?.name,
        company_commercial_id: alert.company?.commercial_registration_number,
        unified_number: alert.company?.unified_number,
      },
    }))

  if (logsToSend.length === 0) {
    return
  }

  // Call Edge Function to handle logging
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  fetch(`${supabaseUrl}/functions/v1/log-alert-digest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabase.auth.session()?.access_token || ''}`,
    },
    body: JSON.stringify({ logs: logsToSend }),
  })
    .then((res) => res.json())
    .then((result) => {
      logger.debug(`Alert digest logging: ${result.logged} logged, ${result.skipped} skipped, ${result.failed} failed`)
    })
    .catch((err) => {
      logger.error('Failed to call log-alert-digest function:', err)
    })
}

/**
 * دالة مساعدة لإنشاء جميع تنبيهات المؤسسات
 */
export async function generateCompanyAlerts(companies: Company[]): Promise<Alert[]> {
  const alerts: Alert[] = []

  for (const company of companies) {
    // إضافة تنبيهات السجل التجاري
    const commercialRegAlert = await checkCommercialRegistrationExpiry(company)
    if (commercialRegAlert) {
      alerts.push(commercialRegAlert)
    }

    // إضافة تنبيهات اشتراك قوى
    const powerAlert = await checkPowerSubscriptionExpiry(company)
    if (powerAlert) {
      alerts.push(powerAlert)
    }

    // إضافة تنبيهات اشتراك مقيم
    const moqeemAlert = await checkMoqeemSubscriptionExpiry(company)
    if (moqeemAlert) {
      alerts.push(moqeemAlert)
    }
  }

  logCompanyAlertsForDigest(alerts)

  return alerts.sort((a, b) => {
    // ترتيب حسب الأولوية (عاجل أولاً)
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff

    // ثم حسب عدد الأيام المتبقية (أقل عدد أيام أولاً)
    const daysA = a.days_remaining ?? Infinity
    const daysB = b.days_remaining ?? Infinity
    return daysA - daysB
  })
}

// Backward compatibility function - now async to load settings
export async function generateCompanyAlertsSync(companies: Company[]): Promise<Alert[]> {
  const alerts: Alert[] = []
  const thresholds = await getNotificationThresholds()

  companies.forEach((company) => {
    if (company.commercial_registration_expiry) {
      const today = new Date()
      const expiryDate = new Date(company.commercial_registration_expiry)
      const timeDiff = expiryDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))

      if (daysRemaining <= thresholds.commercial_reg_medium_days) {
        let priority: Alert['priority']
        if (daysRemaining < 0) {
          priority = 'urgent'
        } else if (daysRemaining <= thresholds.commercial_reg_urgent_days) {
          priority = 'urgent'
        } else if (
          daysRemaining <=
          (thresholds.commercial_reg_high_days || thresholds.commercial_reg_urgent_days + 15)
        ) {
          priority = 'high'
        } else {
          priority = 'medium'
        }

        alerts.push({
          id: `commercial_${company.id}_${company.commercial_registration_expiry}`,
          type: 'commercial_registration_expiry',
          priority,
          title: 'انتهاء صلاحية السجل التجاري',
          message: `ينتهي السجل التجاري للمؤسسة "${company.name}" ${daysRemaining < 0 ? `منذ ${Math.abs(daysRemaining)} يوم` : `خلال ${daysRemaining} يوم`}`,
          company: {
            id: company.id,
            name: company.name,
            commercial_registration_number: company.commercial_registration_number,
            unified_number: company.unified_number,
          },
          expiry_date: company.commercial_registration_expiry,
          days_remaining: daysRemaining,
          action_required: `قم بتجديد السجل التجاري للمؤسسة "${company.name}"`,
          created_at: new Date().toISOString(),
        })
      }
    }

    // إضافة تنبيهات اشتراك قوى (في النسخة المتزامنة)
    if (company.ending_subscription_power_date) {
      const today = new Date()
      const expiryDate = new Date(company.ending_subscription_power_date)
      const timeDiff = expiryDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))

      // استخدام إعدادات اشتراك قوى المخصصة، أو استخدام إعدادات السجل التجاري كبديل
      const urgentDays =
        thresholds.power_subscription_urgent_days ?? thresholds.commercial_reg_urgent_days
      const highDays =
        thresholds.power_subscription_high_days ?? thresholds.commercial_reg_high_days
      const mediumDays =
        thresholds.power_subscription_medium_days ?? thresholds.commercial_reg_medium_days

      if (daysRemaining <= mediumDays) {
        let priority: Alert['priority']
        let message: string
        let actionRequired: string

        if (daysRemaining < 0) {
          priority = 'urgent'
          const daysExpired = Math.abs(daysRemaining)
          message = `انتهت صلاحية اشتراك قوى للمؤسسة "${company.name}" منذ ${daysExpired} يوم. يجب تجديده فوراً.`
          actionRequired = `قم بتجديد اشتراك قوى للمؤسسة "${company.name}" في أقرب وقت ممكن.`
        } else if (daysRemaining <= urgentDays) {
          priority = 'urgent'
          message = `ينتهي اشتراك قوى للمؤسسة "${company.name}" خلال ${daysRemaining} أيام - إجراء فوري مطلوب.`
          actionRequired = `قم بترتيب تجديد اشتراك قوى للمؤسسة "${company.name}" خلال ال ${daysRemaining} أيام القادمة.`
        } else if (daysRemaining <= (highDays || urgentDays + 15)) {
          priority = 'high'
          message = `ينتهي اشتراك قوى للمؤسسة "${company.name}" خلال ${daysRemaining} يوم - متابعة مطلوبة.`
          actionRequired = `قم بترتيب تجديد اشتراك قوى للمؤسسة "${company.name}" خلال ال ${daysRemaining} يوم القادمة.`
        } else {
          priority = 'medium'
          message = `ينتهي اشتراك قوى للمؤسسة "${company.name}" خلال ${daysRemaining} يوم.`
          actionRequired = `قم بمتابعة تجديد اشتراك قوى للمؤسسة "${company.name}" عند الحاجة.`
        }

        alerts.push({
          id: `power_${company.id}_${company.ending_subscription_power_date}`,
          type: 'power_subscription_expiry',
          priority,
          title: 'انتهاء صلاحية اشتراك قوى',
          message,
          company: {
            id: company.id,
            name: company.name,
            commercial_registration_number: company.commercial_registration_number,
            unified_number: company.unified_number,
          },
          expiry_date: company.ending_subscription_power_date,
          days_remaining: daysRemaining,
          action_required: actionRequired,
          created_at: new Date().toISOString(),
        })
      }
    }

    // إضافة تنبيهات اشتراك مقيم (في النسخة المتزامنة)
    if (company.ending_subscription_moqeem_date) {
      const today = new Date()
      const expiryDate = new Date(company.ending_subscription_moqeem_date)
      const timeDiff = expiryDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))

      // استخدام إعدادات اشتراك مقيم المخصصة، أو استخدام إعدادات السجل التجاري كبديل
      const urgentDays =
        thresholds.moqeem_subscription_urgent_days ?? thresholds.commercial_reg_urgent_days
      const highDays =
        thresholds.moqeem_subscription_high_days ?? thresholds.commercial_reg_high_days
      const mediumDays =
        thresholds.moqeem_subscription_medium_days ?? thresholds.commercial_reg_medium_days

      if (daysRemaining <= mediumDays) {
        let priority: Alert['priority']
        let message: string
        let actionRequired: string

        if (daysRemaining < 0) {
          priority = 'urgent'
          const daysExpired = Math.abs(daysRemaining)
          message = `انتهت صلاحية اشتراك مقيم للمؤسسة "${company.name}" منذ ${daysExpired} يوم. يجب تجديده فوراً.`
          actionRequired = `قم بتجديد اشتراك مقيم للمؤسسة "${company.name}" في أقرب وقت ممكن.`
        } else if (daysRemaining <= urgentDays) {
          priority = 'urgent'
          message = `ينتهي اشتراك مقيم للمؤسسة "${company.name}" خلال ${daysRemaining} أيام - إجراء فوري مطلوب.`
          actionRequired = `قم بترتيب تجديد اشتراك مقيم للمؤسسة "${company.name}" خلال ال ${daysRemaining} أيام القادمة.`
        } else if (daysRemaining <= (highDays || urgentDays + 15)) {
          priority = 'high'
          message = `ينتهي اشتراك مقيم للمؤسسة "${company.name}" خلال ${daysRemaining} يوم - متابعة مطلوبة.`
          actionRequired = `قم بترتيب تجديد اشتراك مقيم للمؤسسة "${company.name}" خلال ال ${daysRemaining} يوم القادمة.`
        } else {
          priority = 'medium'
          message = `ينتهي اشتراك مقيم للمؤسسة "${company.name}" خلال ${daysRemaining} يوم.`
          actionRequired = `قم بمتابعة تجديد اشتراك مقيم للمؤسسة "${company.name}" عند الحاجة.`
        }

        alerts.push({
          id: `moqeem_${company.id}_${company.ending_subscription_moqeem_date}`,
          type: 'moqeem_subscription_expiry',
          priority,
          title: 'انتهاء صلاحية اشتراك مقيم',
          message,
          company: {
            id: company.id,
            name: company.name,
            commercial_registration_number: company.commercial_registration_number,
            unified_number: company.unified_number,
          },
          expiry_date: company.ending_subscription_moqeem_date,
          days_remaining: daysRemaining,
          action_required: actionRequired,
          created_at: new Date().toISOString(),
        })
      }
    }
  })

  logCompanyAlertsForDigest(alerts)

  return alerts.sort((a, b) => {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff

    const daysA = a.days_remaining ?? Infinity
    const daysB = b.days_remaining ?? Infinity
    return daysA - daysB
  })
}

/**
 * فحص انتهاء صلاحية السجل التجاري للمؤسسة
 */
export async function checkCommercialRegistrationExpiry(company: Company): Promise<Alert | null> {
  const thresholds = await getNotificationThresholds()

  const config: AlertConfig = {
    expiryFieldKey: 'commercial_registration_expiry',
    alertType: 'commercial_registration_expiry',
    alertTitle: 'انتهاء صلاحية السجل التجاري',
    idPrefix: 'commercial_',
    thresholdKeys: {
      urgent: 'commercial_reg_urgent_days',
      high: 'commercial_reg_high_days',
      medium: 'commercial_reg_medium_days',
    },
    messageTemplate: {
      expired: (days, name) =>
        `انتهت صلاحية السجل التجاري للمؤسسة "${name}" منذ ${days} يوم. يجب تجديده فوراً لتجنب المشاكل القانونية.`,
      today: (name) => `ينتهي السجل التجاري للمؤسسة "${name}" اليوم. يجب تجديده قبل نهاية اليوم.`,
      tomorrow: (name) => `ينتهي السجل التجاري للمؤسسة "${name}" غداً. يفضل تجديده اليوم.`,
      upcoming: (days, name) =>
        `ينتهي السجل التجاري للمؤسسة "${name}" خلال ${days} يوم. يفضل تجديده قبل انتهاء المدة.`,
      urgentUpcoming: (days, name) =>
        `ينتهي السجل التجاري للمؤسسة "${name}" خلال ${days} أيام - إجراء فوري مطلوب.`,
      highUpcoming: (days, name) =>
        `ينتهي السجل التجاري للمؤسسة "${name}" خلال ${days} يوم - متابعة مطلوبة.`,
    },
    actionTemplate: {
      expired: (name) =>
        `قم بتجديد السجل التجاري للمؤسسة "${name}" في أقرب وقت ممكن لضمان استمرار النشاط القانوني.`,
      today: (name) => `قم بتجديد السجل التجاري للمؤسسة "${name}" قبل نهاية اليوم.`,
      tomorrow: (name) => `قم بتجديد السجل التجاري للمؤسسة "${name}" قبل انتهاء مدته غداً.`,
      upcoming: (days, name) =>
        `قم بترتيب تجديد السجل التجاري للمؤسسة "${name}" خلال ال ${days} يوم القادمة.`,
      urgentUpcoming: (days, name) =>
        `قم بترتيب تجديد السجل التجاري للمؤسسة "${name}" خلال ال ${days} أيام القادمة.`,
      highUpcoming: (days, name) =>
        `قم بترتيب تجديد السجل التجاري للمؤسسة "${name}" خلال ال ${days} يوم القادمة.`,
    },
  }

  return createExpiryAlert(company, config, thresholds)
}

/**
 * فحص انتهاء صلاحية اشتراك قوى للمؤسسة
 */
export async function checkPowerSubscriptionExpiry(company: Company): Promise<Alert | null> {
  const thresholds = await getNotificationThresholds()

  const config: AlertConfig = {
    expiryFieldKey: 'ending_subscription_power_date',
    alertType: 'power_subscription_expiry',
    alertTitle: 'انتهاء صلاحية اشتراك قوى',
    idPrefix: 'power_',
    thresholdKeys: {
      urgent: 'power_subscription_urgent_days',
      high: 'power_subscription_high_days',
      medium: 'power_subscription_medium_days',
    },
    messageTemplate: {
      expired: (days, name) =>
        `انتهت صلاحية اشتراك قوى للمؤسسة "${name}" منذ ${days} يوم. يجب تجديده فوراً.`,
      today: (name) => `ينتهي اشتراك قوى للمؤسسة "${name}" اليوم. يجب تجديده قبل نهاية اليوم.`,
      tomorrow: (name) => `ينتهي اشتراك قوى للمؤسسة "${name}" غداً. يفضل تجديده اليوم.`,
      upcoming: (days, name) =>
        `ينتهي اشتراك قوى للمؤسسة "${name}" خلال ${days} يوم.`,
      urgentUpcoming: (days, name) =>
        `ينتهي اشتراك قوى للمؤسسة "${name}" خلال ${days} أيام - إجراء فوري مطلوب.`,
      highUpcoming: (days, name) =>
        `ينتهي اشتراك قوى للمؤسسة "${name}" خلال ${days} يوم - متابعة مطلوبة.`,
    },
    actionTemplate: {
      expired: (name) => `قم بتجديد اشتراك قوى للمؤسسة "${name}" في أقرب وقت ممكن.`,
      today: (name) => `قم بتجديد اشتراك قوى للمؤسسة "${name}" قبل نهاية اليوم.`,
      tomorrow: (name) => `قم بتجديد اشتراك قوى للمؤسسة "${name}" قبل انتهاء مدته غداً.`,
      upcoming: (days, name) =>
        `قم بمتابعة تجديد اشتراك قوى للمؤسسة "${name}" عند الحاجة.`,
      urgentUpcoming: (days, name) =>
        `قم بترتيب تجديد اشتراك قوى للمؤسسة "${name}" خلال ال ${days} أيام القادمة.`,
      highUpcoming: (days, name) =>
        `قم بترتيب تجديد اشتراك قوى للمؤسسة "${name}" خلال ال ${days} يوم القادمة.`,
    },
  }

  return createExpiryAlert(company, config, thresholds)
}

/**
 * فحص انتهاء صلاحية اشتراك مقيم للمؤسسة
 */
export async function checkMoqeemSubscriptionExpiry(company: Company): Promise<Alert | null> {
  const thresholds = await getNotificationThresholds()

  const config: AlertConfig = {
    expiryFieldKey: 'ending_subscription_moqeem_date',
    alertType: 'moqeem_subscription_expiry',
    alertTitle: 'انتهاء صلاحية اشتراك مقيم',
    idPrefix: 'moqeem_',
    thresholdKeys: {
      urgent: 'moqeem_subscription_urgent_days',
      high: 'moqeem_subscription_high_days',
      medium: 'moqeem_subscription_medium_days',
    },
    messageTemplate: {
      expired: (days, name) =>
        `انتهت صلاحية اشتراك مقيم للمؤسسة "${name}" منذ ${days} يوم. يجب تجديده فوراً.`,
      today: (name) => `ينتهي اشتراك مقيم للمؤسسة "${name}" اليوم. يجب تجديده قبل نهاية اليوم.`,
      tomorrow: (name) => `ينتهي اشتراك مقيم للمؤسسة "${name}" غداً. يفضل تجديده اليوم.`,
      upcoming: (days, name) =>
        `ينتهي اشتراك مقيم للمؤسسة "${name}" خلال ${days} يوم.`,
      urgentUpcoming: (days, name) =>
        `ينتهي اشتراك مقيم للمؤسسة "${name}" خلال ${days} أيام - إجراء فوري مطلوب.`,
      highUpcoming: (days, name) =>
        `ينتهي اشتراك مقيم للمؤسسة "${name}" خلال ${days} يوم - متابعة مطلوبة.`,
    },
    actionTemplate: {
      expired: (name) => `قم بتجديد اشتراك مقيم للمؤسسة "${name}" في أقرب وقت ممكن.`,
      today: (name) => `قم بتجديد اشتراك مقيم للمؤسسة "${name}" قبل نهاية اليوم.`,
      tomorrow: (name) => `قم بتجديد اشتراك مقيم للمؤسسة "${name}" قبل انتهاء مدته غداً.`,
      upcoming: (days, name) =>
        `قم بمتابعة تجديد اشتراك مقيم للمؤسسة "${name}" عند الحاجة.`,
      urgentUpcoming: (days, name) =>
        `قم بترتيب تجديد اشتراك مقيم للمؤسسة "${name}" خلال ال ${days} أيام القادمة.`,
      highUpcoming: (days, name) =>
        `قم بترتيب تجديد اشتراك مقيم للمؤسسة "${name}" خلال ال ${days} يوم القادمة.`,
    },
  }

  return createExpiryAlert(company, config, thresholds)
}

/**
 * فلترة التنبيهات حسب الأولوية
 */
export function filterAlertsByPriority(alerts: Alert[], priority: Alert['priority']): Alert[] {
  return alerts.filter((alert) => alert.priority === priority)
}

/**
 * فلترة التنبيهات حسب نوعها
 */
export function filterAlertsByType(alerts: Alert[], type: Alert['type']): Alert[] {
  return alerts.filter((alert) => alert.type === type)
}

/**
 * الحصول على إحصائيات التنبيهات
 * تحسب عدد المؤسسات الفريدة التي لديها تنبيهات وليس عدد التنبيهات
 */
export function getAlertsStats(alerts: Alert[]) {
  // عد التنبيهات الكلية
  const totalAlerts = alerts.length

  // عد المؤسسات الفريدة التي لديها تنبيهات
  const uniqueCompanyIds = new Set(alerts.map((a) => a.company?.id).filter(Boolean))
  const total = uniqueCompanyIds.size

  // حساب الأولويات بناءً على المؤسسات الفريدة
  // للمؤسسة الواحدة، نستخدم أعلى أولوية لديها
  const companyMaxPriority = new Map<string, 'urgent' | 'high' | 'medium' | 'low'>()
  const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }

  alerts.forEach((alert) => {
    const companyId = alert.company?.id
    if (!companyId) return

    // إذا لم تكن المؤسسة موجودة في الخريطة، أضفها
    if (!companyMaxPriority.has(companyId)) {
      companyMaxPriority.set(companyId, alert.priority)
    } else {
      // إذا كانت موجودة، احتفظ بالأولوية الأعلى
      const currentPriority = companyMaxPriority.get(companyId)!
      if (priorityOrder[alert.priority] > priorityOrder[currentPriority]) {
        companyMaxPriority.set(companyId, alert.priority)
      }
    }
  })

  const urgent = Array.from(companyMaxPriority.values()).filter((p) => p === 'urgent').length
  const high = Array.from(companyMaxPriority.values()).filter((p) => p === 'high').length
  const medium = Array.from(companyMaxPriority.values()).filter((p) => p === 'medium').length
  const low = Array.from(companyMaxPriority.values()).filter((p) => p === 'low').length

  // عد التنبيهات حسب النوع (عدد التنبيهات، ليس المؤسسات)
  const commercialRegAlerts = alerts.filter(
    (a) => a.type === 'commercial_registration_expiry'
  ).length
  const powerAlerts = alerts.filter((a) => a.type === 'power_subscription_expiry').length
  const moqeemAlerts = alerts.filter((a) => a.type === 'moqeem_subscription_expiry').length

  return {
    total, // عدد المؤسسات الفريدة
    totalAlerts, // عدد التنبيهات الكلية (للمرجع)
    urgent,
    high,
    medium,
    low,
    commercialRegAlerts,
    powerAlerts,
    moqeemAlerts,
  }
}

/**
 * الحصول على التنبيهات العاجلة والعالية فقط
 */
export function getUrgentAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter((alert) => alert.priority === 'urgent' || alert.priority === 'high')
}

/**
 * الحصول على تنبيهات منتهية الصلاحية
 */
export function getExpiredAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter((alert) => alert.days_remaining !== undefined && alert.days_remaining < 0)
}
