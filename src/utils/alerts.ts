import { Alert } from '../components/alerts/AlertCard'
import { supabase } from '../lib/supabase'

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
  social_insurance_urgent_days: 30,  // بدلاً من insurance_urgent_days
  social_insurance_high_days: 45,
  social_insurance_medium_days: 60,   // بدلاً من insurance_medium_days
  health_insurance_urgent_days: 30,
  health_insurance_high_days: 45,
  health_insurance_medium_days: 60,
  power_subscription_urgent_days: 30,
  power_subscription_high_days: 45,
  power_subscription_medium_days: 60,
  moqeem_subscription_urgent_days: 30,
  moqeem_subscription_high_days: 45,
  moqeem_subscription_medium_days: 60
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
  // Check if cache is valid
  const now = Date.now()
  if (thresholdsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return thresholdsCache
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_thresholds')
      .maybeSingle()

    if (error || !data || !data.setting_value) {
      console.log('Using default notification thresholds')
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

export interface Company {
  id: string
  name: string
  commercial_registration_number?: string
  commercial_registration_expiry?: string
  social_insurance_expiry?: string  // بدلاً من insurance_subscription_expiry
  social_insurance_start?: string   // بدلاً من insurance_subscription_start
  ending_subscription_power_date?: string
  ending_subscription_moqeem_date?: string
  created_at: string
  updated_at: string
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
    
    // إضافة تنبيهات التأمينات الاجتماعية
    const socialInsuranceAlert = await checkSocialInsuranceExpiry(company)
    if (socialInsuranceAlert) {
      alerts.push(socialInsuranceAlert)
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
  
  companies.forEach(company => {
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
          } else if (daysRemaining <= (thresholds.commercial_reg_high_days || thresholds.commercial_reg_urgent_days + 15)) {
            priority = 'high'
          } else {
            priority = 'medium'
          }
          
          alerts.push({
            id: `commercial_${company.id}_${company.commercial_registration_expiry}`,
            type: 'commercial_registration',
            priority,
            title: 'انتهاء صلاحية السجل التجاري',
            message: `ينتهي السجل التجاري للمؤسسة "${company.name}" ${daysRemaining < 0 ? `منذ ${Math.abs(daysRemaining)} يوم` : `خلال ${daysRemaining} يوم`}`,
            company: {
              id: company.id,
              name: company.name,
              commercial_registration_number: company.commercial_registration_number
            },
            expiry_date: company.commercial_registration_expiry,
            days_remaining: daysRemaining,
            action_required: `قم بتجديد السجل التجاري للمؤسسة "${company.name}"`,
            created_at: new Date().toISOString()
          })
        }
      }
      
      // إضافة تنبيهات التأمينات الاجتماعية (في النسخة المتزامنة)
      if (company.social_insurance_expiry) {
        const today = new Date()
        const expiryDate = new Date(company.social_insurance_expiry)
        const timeDiff = expiryDate.getTime() - today.getTime()
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
        
        if (daysRemaining <= thresholds.social_insurance_medium_days) {
          let priority: Alert['priority']
          if (daysRemaining < 0) {
            priority = 'urgent'
          } else if (daysRemaining <= thresholds.social_insurance_urgent_days) {
            priority = 'urgent'
          } else if (daysRemaining <= (thresholds.social_insurance_high_days || thresholds.social_insurance_urgent_days + 15)) {
            priority = 'high'
          } else {
            priority = 'medium'
          }
          
          alerts.push({
            id: `social_insurance_${company.id}_${company.social_insurance_expiry}`,
            type: 'social_insurance_expiry',
            priority,
            title: 'انتهاء صلاحية التأمينات الاجتماعية',
            message: `تنتهي التأمينات الاجتماعية للمؤسسة "${company.name}" ${daysRemaining < 0 ? `منذ ${Math.abs(daysRemaining)} يوم` : `خلال ${daysRemaining} يوم`}`,
            company: {
              id: company.id,
              name: company.name,
              commercial_registration_number: company.commercial_registration_number
            },
            expiry_date: company.social_insurance_expiry,
            days_remaining: daysRemaining,
            action_required: `قم بتجديد التأمينات الاجتماعية للمؤسسة "${company.name}"`,
            created_at: new Date().toISOString()
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
        const urgentDays = thresholds.power_subscription_urgent_days ?? thresholds.commercial_reg_urgent_days
        const highDays = thresholds.power_subscription_high_days ?? thresholds.commercial_reg_high_days
        const mediumDays = thresholds.power_subscription_medium_days ?? thresholds.commercial_reg_medium_days
        
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
            type: 'power_subscription',
            priority,
            title: 'انتهاء صلاحية اشتراك قوى',
            message,
            company: {
              id: company.id,
              name: company.name,
              commercial_registration_number: company.commercial_registration_number
            },
            expiry_date: company.ending_subscription_power_date,
            days_remaining: daysRemaining,
            action_required: actionRequired,
            created_at: new Date().toISOString()
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
        const urgentDays = thresholds.moqeem_subscription_urgent_days ?? thresholds.commercial_reg_urgent_days
        const highDays = thresholds.moqeem_subscription_high_days ?? thresholds.commercial_reg_high_days
        const mediumDays = thresholds.moqeem_subscription_medium_days ?? thresholds.commercial_reg_medium_days
        
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
            type: 'moqeem_subscription',
            priority,
            title: 'انتهاء صلاحية اشتراك مقيم',
            message,
            company: {
              id: company.id,
              name: company.name,
              commercial_registration_number: company.commercial_registration_number
            },
            expiry_date: company.ending_subscription_moqeem_date,
            days_remaining: daysRemaining,
            action_required: actionRequired,
            created_at: new Date().toISOString()
          })
        }
      }
  })
  
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
  if (!company.commercial_registration_expiry) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(company.commercial_registration_expiry)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getNotificationThresholds()
  
  // لا يوجد تنبيه إذا كان التاريخ سارياً لأكثر من الحد الأقصى
  if (daysRemaining > thresholds.commercial_reg_medium_days) {
    return null
  }
  
  // تحديد الأولوية حسب عدد الأيام المتبقية
  let priority: Alert['priority']
  let badgeText: string
  
  if (daysRemaining < 0) {
    priority = 'urgent'
    badgeText = 'منتهي'
  } else if (daysRemaining <= thresholds.commercial_reg_urgent_days) {
    priority = 'urgent'
    badgeText = 'عاجل'
  } else if (daysRemaining <= (thresholds.commercial_reg_high_days || thresholds.commercial_reg_urgent_days + 15)) {
    priority = 'high'
    badgeText = 'عاجل'
  } else if (daysRemaining <= thresholds.commercial_reg_medium_days) {
    priority = 'medium'
    badgeText = 'متوسط'
  } else {
    priority = 'low'
    badgeText = 'طفيف'
  }
  
  // إنشاء رسالة التنبيه
  let message: string
  let actionRequired: string
  
  if (daysRemaining < 0) {
    const daysExpired = Math.abs(daysRemaining)
    message = `انتهت صلاحية السجل التجاري للمؤسسة "${company.name}" منذ ${daysExpired} يوم. يجب تجديده فوراً لتجنب المشاكل القانونية.`
    actionRequired = `قم بتجديد السجل التجاري للمؤسسة "${company.name}" في أقرب وقت ممكن لضمان استمرار النشاط القانوني.`
  } else if (daysRemaining === 0) {
    message = `ينتهي السجل التجاري للمؤسسة "${company.name}" اليوم. يجب تجديده قبل نهاية اليوم.`
    actionRequired = `قم بتجديد السجل التجاري للمؤسسة "${company.name}" قبل نهاية اليوم.`
  } else if (daysRemaining === 1) {
    message = `ينتهي السجل التجاري للمؤسسة "${company.name}" غداً. يفضل تجديده اليوم.`
    actionRequired = `قم بتجديد السجل التجاري للمؤسسة "${company.name}" قبل انتهاء مدته غداً.`
  } else {
    message = `ينتهي السجل التجاري للمؤسسة "${company.name}" خلال ${daysRemaining} يوم. يفضل تجديده قبل انتهاء المدة.`
    actionRequired = `قم بترتيب تجديد السجل التجاري للمؤسسة "${company.name}" خلال ال ${daysRemaining} يوم القادمة.`
  }
  
  return {
    id: `commercial_${company.id}_${company.commercial_registration_expiry}`,
    type: 'commercial_registration',
    priority,
    title: 'انتهاء صلاحية السجل التجاري',
    message,
    company: {
      id: company.id,
      name: company.name,
      commercial_registration_number: company.commercial_registration_number
    },
    expiry_date: company.commercial_registration_expiry,
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString()
  }
}

/**
 * فحص انتهاء صلاحية التأمينات الاجتماعية للمؤسسة
 */
export async function checkSocialInsuranceExpiry(company: Company): Promise<Alert | null> {
  // إذا لم يكن هناك تاريخ انتهاء للتأمينات الاجتماعية، نتحقق من تاريخ البداية لحساب المدة الافتراضية
  if (!company.social_insurance_expiry && !company.social_insurance_start) {
    return null
  }
  
  const today = new Date()
  
  let expiryDate: Date
  let message: string
  let actionRequired: string
  let priority: Alert['priority']
  
  // حساب تاريخ انتهاء التأمينات الاجتماعية
  if (company.social_insurance_expiry) {
    expiryDate = new Date(company.social_insurance_expiry)
  } else {
    // إذا لم يكن هناك تاريخ انتهاء، نحسب سنة واحدة من تاريخ البداية
    const startDate = new Date(company.social_insurance_start!)
    expiryDate = new Date(startDate)
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)
  }
  
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getNotificationThresholds()
  
  // لا يوجد تنبيه إذا كانت التأمينات الاجتماعية سارية لأكثر من الحد الأقصى
  if (daysRemaining > thresholds.social_insurance_medium_days) {
    return null
  }
  
  // تحديد الأولوية حسب عدد الأيام المتبقية
  if (daysRemaining < 0) {
    priority = 'urgent'
    const daysExpired = Math.abs(daysRemaining)
    message = `انتهت صلاحية التأمينات الاجتماعية للمؤسسة "${company.name}" منذ ${daysExpired} يوم. يجب تجديدها فوراً لحماية المؤسسة من المخاطر.`
    actionRequired = `قم بتجديد التأمينات الاجتماعية للمؤسسة "${company.name}" فوراً لضمان الحماية القانونية والمالية.`
  } else if (daysRemaining <= thresholds.social_insurance_urgent_days) {
    priority = 'urgent'
    message = `تنتهي التأمينات الاجتماعية للمؤسسة "${company.name}" خلال ${daysRemaining} يوم. يجب تجديدها فوراً.`
    actionRequired = `قم بترتيب تجديد التأمينات الاجتماعية للمؤسسة "${company.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= (thresholds.social_insurance_high_days || thresholds.social_insurance_urgent_days + 15)) {
    priority = 'high'
    message = `تنتهي التأمينات الاجتماعية للمؤسسة "${company.name}" خلال ${daysRemaining} يوم. يجب تجديدها قريباً.`
    actionRequired = `قم بترتيب تجديد التأمينات الاجتماعية للمؤسسة "${company.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= thresholds.social_insurance_medium_days) {
    priority = 'medium'
    message = `تنتهي التأمينات الاجتماعية للمؤسسة "${company.name}" خلال ${daysRemaining} يوم. يفضل تجديدها قبل انتهاء المدة.`
    actionRequired = `قم بمراجعة وتجديد التأمينات الاجتماعية للمؤسسة "${company.name}" خلال الشهر القادم.`
  } else {
    priority = 'low'
    message = `التأمينات الاجتماعية للمؤسسة "${company.name}" ستنتهي خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد التأمينات الاجتماعية للمؤسسة "${company.name}" عند الحاجة.`
  }
  
  return {
    id: `social_insurance_${company.id}_${expiryDate.toISOString().split('T')[0]}`,
    type: 'social_insurance_expiry',
    priority,
    title: 'انتهاء صلاحية التأمينات الاجتماعية',
    message,
    company: {
      id: company.id,
      name: company.name,
      commercial_registration_number: company.commercial_registration_number
    },
    expiry_date: expiryDate.toISOString().split('T')[0],
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString()
  }
}

/**
 * فحص انتهاء صلاحية اشتراك قوى للمؤسسة
 */
export async function checkPowerSubscriptionExpiry(company: Company): Promise<Alert | null> {
  if (!company.ending_subscription_power_date) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(company.ending_subscription_power_date)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getNotificationThresholds()
  
  // لا يوجد تنبيه إذا كان التاريخ سارياً لأكثر من الحد الأقصى
  if (daysRemaining > thresholds.commercial_reg_medium_days) {
    return null
  }
  
  // تحديد الأولوية حسب عدد الأيام المتبقية
  let priority: Alert['priority']
  let badgeText: string
  
  if (daysRemaining < 0) {
    priority = 'urgent'
    badgeText = 'منتهي'
  } else if (daysRemaining <= thresholds.commercial_reg_urgent_days) {
    priority = 'urgent'
    badgeText = 'عاجل'
  } else if (daysRemaining <= (thresholds.commercial_reg_high_days || thresholds.commercial_reg_urgent_days + 15)) {
    priority = 'high'
    badgeText = 'عاجل'
  } else if (daysRemaining <= thresholds.commercial_reg_medium_days) {
    priority = 'medium'
    badgeText = 'متوسط'
  } else {
    priority = 'low'
    badgeText = 'طفيف'
  }
  
  // إنشاء رسالة التنبيه
  let message: string
  let actionRequired: string
  
  if (daysRemaining < 0) {
    const daysExpired = Math.abs(daysRemaining)
    message = `انتهت صلاحية اشتراك قوى للمؤسسة "${company.name}" منذ ${daysExpired} يوم. يجب تجديده فوراً.`
    actionRequired = `قم بتجديد اشتراك قوى للمؤسسة "${company.name}" في أقرب وقت ممكن.`
  } else if (daysRemaining === 0) {
    message = `ينتهي اشتراك قوى للمؤسسة "${company.name}" اليوم. يجب تجديده قبل نهاية اليوم.`
    actionRequired = `قم بتجديد اشتراك قوى للمؤسسة "${company.name}" قبل نهاية اليوم.`
  } else if (daysRemaining === 1) {
    message = `ينتهي اشتراك قوى للمؤسسة "${company.name}" غداً. يفضل تجديده اليوم.`
    actionRequired = `قم بتجديد اشتراك قوى للمؤسسة "${company.name}" قبل انتهاء مدته غداً.`
  } else if (daysRemaining <= thresholds.commercial_reg_urgent_days) {
    message = `ينتهي اشتراك قوى للمؤسسة "${company.name}" خلال ${daysRemaining} أيام - إجراء فوري مطلوب.`
    actionRequired = `قم بترتيب تجديد اشتراك قوى للمؤسسة "${company.name}" خلال ال ${daysRemaining} أيام القادمة.`
  } else if (daysRemaining <= (thresholds.commercial_reg_high_days || thresholds.commercial_reg_urgent_days + 15)) {
    message = `ينتهي اشتراك قوى للمؤسسة "${company.name}" خلال ${daysRemaining} يوم - متابعة مطلوبة.`
    actionRequired = `قم بترتيب تجديد اشتراك قوى للمؤسسة "${company.name}" خلال ال ${daysRemaining} يوم القادمة.`
  } else {
    message = `ينتهي اشتراك قوى للمؤسسة "${company.name}" خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد اشتراك قوى للمؤسسة "${company.name}" عند الحاجة.`
  }
  
  return {
    id: `power_${company.id}_${company.ending_subscription_power_date}`,
    type: 'power_subscription',
    priority,
    title: 'انتهاء صلاحية اشتراك قوى',
    message,
    company: {
      id: company.id,
      name: company.name,
      commercial_registration_number: company.commercial_registration_number
    },
    expiry_date: company.ending_subscription_power_date,
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString()
  }
}

/**
 * فحص انتهاء صلاحية اشتراك مقيم للمؤسسة
 */
export async function checkMoqeemSubscriptionExpiry(company: Company): Promise<Alert | null> {
  if (!company.ending_subscription_moqeem_date) {
    return null
  }
  
  const today = new Date()
  const expiryDate = new Date(company.ending_subscription_moqeem_date)
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getNotificationThresholds()
  
  // لا يوجد تنبيه إذا كان التاريخ سارياً لأكثر من الحد الأقصى
  if (daysRemaining > thresholds.commercial_reg_medium_days) {
    return null
  }
  
  // تحديد الأولوية حسب عدد الأيام المتبقية
  let priority: Alert['priority']
  let badgeText: string
  
  if (daysRemaining < 0) {
    priority = 'urgent'
    badgeText = 'منتهي'
  } else if (daysRemaining <= thresholds.commercial_reg_urgent_days) {
    priority = 'urgent'
    badgeText = 'عاجل'
  } else if (daysRemaining <= (thresholds.commercial_reg_high_days || thresholds.commercial_reg_urgent_days + 15)) {
    priority = 'high'
    badgeText = 'عاجل'
  } else if (daysRemaining <= thresholds.commercial_reg_medium_days) {
    priority = 'medium'
    badgeText = 'متوسط'
  } else {
    priority = 'low'
    badgeText = 'طفيف'
  }
  
  // إنشاء رسالة التنبيه
  let message: string
  let actionRequired: string
  
  if (daysRemaining < 0) {
    const daysExpired = Math.abs(daysRemaining)
    message = `انتهت صلاحية اشتراك مقيم للمؤسسة "${company.name}" منذ ${daysExpired} يوم. يجب تجديده فوراً.`
    actionRequired = `قم بتجديد اشتراك مقيم للمؤسسة "${company.name}" في أقرب وقت ممكن.`
  } else if (daysRemaining === 0) {
    message = `ينتهي اشتراك مقيم للمؤسسة "${company.name}" اليوم. يجب تجديده قبل نهاية اليوم.`
    actionRequired = `قم بتجديد اشتراك مقيم للمؤسسة "${company.name}" قبل نهاية اليوم.`
  } else if (daysRemaining === 1) {
    message = `ينتهي اشتراك مقيم للمؤسسة "${company.name}" غداً. يفضل تجديده اليوم.`
    actionRequired = `قم بتجديد اشتراك مقيم للمؤسسة "${company.name}" قبل انتهاء مدته غداً.`
  } else if (daysRemaining <= thresholds.commercial_reg_urgent_days) {
    message = `ينتهي اشتراك مقيم للمؤسسة "${company.name}" خلال ${daysRemaining} أيام - إجراء فوري مطلوب.`
    actionRequired = `قم بترتيب تجديد اشتراك مقيم للمؤسسة "${company.name}" خلال ال ${daysRemaining} أيام القادمة.`
  } else if (daysRemaining <= (thresholds.commercial_reg_high_days || thresholds.commercial_reg_urgent_days + 15)) {
    message = `ينتهي اشتراك مقيم للمؤسسة "${company.name}" خلال ${daysRemaining} يوم - متابعة مطلوبة.`
    actionRequired = `قم بترتيب تجديد اشتراك مقيم للمؤسسة "${company.name}" خلال ال ${daysRemaining} يوم القادمة.`
  } else {
    message = `ينتهي اشتراك مقيم للمؤسسة "${company.name}" خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد اشتراك مقيم للمؤسسة "${company.name}" عند الحاجة.`
  }
  
  return {
    id: `moqeem_${company.id}_${company.ending_subscription_moqeem_date}`,
    type: 'moqeem_subscription',
    priority,
    title: 'انتهاء صلاحية اشتراك مقيم',
    message,
    company: {
      id: company.id,
      name: company.name,
      commercial_registration_number: company.commercial_registration_number
    },
    expiry_date: company.ending_subscription_moqeem_date,
    days_remaining: daysRemaining,
    action_required: actionRequired,
    created_at: new Date().toISOString()
  }
}

/**
 * فلترة التنبيهات حسب الأولوية
 */
export function filterAlertsByPriority(alerts: Alert[], priority: Alert['priority']): Alert[] {
  return alerts.filter(alert => alert.priority === priority)
}

/**
 * فلترة التنبيهات حسب نوعها
 */
export function filterAlertsByType(alerts: Alert[], type: Alert['type']): Alert[] {
  return alerts.filter(alert => alert.type === type)
}

/**
 * الحصول على إحصائيات التنبيهات
 */
export function getAlertsStats(alerts: Alert[]) {
  const total = alerts.length
  const urgent = alerts.filter(a => a.priority === 'urgent').length
  const high = alerts.filter(a => a.priority === 'high').length
  const medium = alerts.filter(a => a.priority === 'medium').length
  const low = alerts.filter(a => a.priority === 'low').length
  const commercialRegAlerts = alerts.filter(a => a.type === 'commercial_registration').length
  const socialInsuranceAlerts = alerts.filter(a => a.type === 'social_insurance_expiry').length
  const powerAlerts = alerts.filter(a => a.type === 'power_subscription').length
  const moqeemAlerts = alerts.filter(a => a.type === 'moqeem_subscription').length
  
  return {
    total,
    urgent,
    high,
    medium,
    low,
    commercialRegAlerts,
    socialInsuranceAlerts,  // بدلاً من insuranceAlerts
    powerAlerts,
    moqeemAlerts
  }
}

/**
 * الحصول على التنبيهات العاجلة والعالية فقط
 */
export function getUrgentAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(alert => alert.priority === 'urgent' || alert.priority === 'high')
}

/**
 * الحصول على تنبيهات منتهية الصلاحية
 */
export function getExpiredAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(alert => 
    alert.days_remaining !== undefined && alert.days_remaining < 0
  )
}