import { Alert } from '../components/alerts/AlertCard'

// Default thresholds for alerts
const DEFAULT_THRESHOLDS = {
  residence_urgent_days: 7,
  residence_high_days: 15,
  residence_medium_days: 30,
  contract_urgent_days: 7,
  contract_high_days: 15,
  contract_medium_days: 30,
  commercial_reg_urgent_days: 30,
  commercial_reg_medium_days: 60,
  insurance_urgent_days: 30,
  insurance_medium_days: 60
}

// Get notification thresholds (could be from settings later)
async function getNotificationThresholds() {
  // TODO: Load from database settings
  return DEFAULT_THRESHOLDS
}

export interface Company {
  id: string
  name: string
  commercial_registration_number?: string
  commercial_registration_expiry?: string
  insurance_subscription_expiry?: string
  insurance_subscription_start?: string
  government_docs_renewal?: string
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
    
    // إضافة تنبيهات اشتراك التأمين
    const insuranceAlert = await checkInsuranceSubscriptionExpiry(company)
    if (insuranceAlert) {
      alerts.push(insuranceAlert)
    }
  }
  
  return alerts.sort((a, b) => {
    // ترتيب حسب الأولوية (عاجل أولاً)
    const priorityOrder = { urgent: 3, medium: 2, low: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
    if (priorityDiff !== 0) return priorityDiff
    
    // ثم حسب عدد الأيام المتبقية (أقل عدد أيام أولاً)
    const daysA = a.days_remaining ?? Infinity
    const daysB = b.days_remaining ?? Infinity
    return daysA - daysB
  })
}

// Backward compatibility function
export function generateCompanyAlertsSync(companies: Company[]): Alert[] {
  // This is a simplified synchronous version for backward compatibility
  const alerts: Alert[] = []
  
  companies.forEach(company => {
    // For now, use default thresholds for sync version
    if (company.commercial_registration_expiry) {
      const today = new Date()
      const expiryDate = new Date(company.commercial_registration_expiry)
      const timeDiff = expiryDate.getTime() - today.getTime()
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
      
      if (daysRemaining <= 60) {
        let priority: Alert['priority']
        if (daysRemaining < 0) {
          priority = 'urgent'
        } else if (daysRemaining <= 30) {
          priority = 'urgent'
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
  })
  
  return alerts.sort((a, b) => {
    const priorityOrder = { urgent: 3, medium: 2, low: 1 }
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
 * فحص انتهاء صلاحية اشتراك التأمين للمؤسسة
 */
export async function checkInsuranceSubscriptionExpiry(company: Company): Promise<Alert | null> {
  // إذا لم يكن هناك تاريخ انتهاء للتأمين، نتحقق من تاريخ البداية لحساب المدة الافتراضية
  if (!company.insurance_subscription_expiry && !company.insurance_subscription_start) {
    return null
  }
  
  const today = new Date()
  
  let expiryDate: Date
  let message: string
  let actionRequired: string
  let priority: Alert['priority']
  
  // حساب تاريخ انتهاء التأمين
  if (company.insurance_subscription_expiry) {
    expiryDate = new Date(company.insurance_subscription_expiry)
  } else {
    // إذا لم يكن هناك تاريخ انتهاء، نحسب سنة واحدة من تاريخ البداية
    const startDate = new Date(company.insurance_subscription_start!)
    expiryDate = new Date(startDate)
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)
  }
  
  const timeDiff = expiryDate.getTime() - today.getTime()
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24))
  
  const thresholds = await getNotificationThresholds()
  
  // لا يوجد تنبيه إذا كان التأمين سارياً لأكثر من الحد الأقصى
  if (daysRemaining > thresholds.insurance_medium_days) {
    return null
  }
  
  // تحديد الأولوية حسب عدد الأيام المتبقية
  if (daysRemaining < 0) {
    priority = 'urgent'
    const daysExpired = Math.abs(daysRemaining)
    message = `انتهت صلاحية اشتراك التأمين للمؤسسة "${company.name}" منذ ${daysExpired} يوم. يجب تجديده فوراً لحماية المؤسسة من المخاطر.`
    actionRequired = `قم بتجديد اشتراك التأمين للمؤسسة "${company.name}" فوراً لضمان الحماية القانونية والمالية.`
  } else if (daysRemaining <= thresholds.insurance_urgent_days) {
    priority = 'urgent'
    message = `ينتهي اشتراك التأمين للمؤسسة "${company.name}" خلال ${daysRemaining} يوم. يجب تجديده فوراً.`
    actionRequired = `قم بترتيب تجديد اشتراك التأمين للمؤسسة "${company.name}" خلال ${daysRemaining} يوم القادمة.`
  } else if (daysRemaining <= thresholds.insurance_medium_days) {
    priority = 'medium'
    message = `ينتهي اشتراك التأمين للمؤسسة "${company.name}" خلال ${daysRemaining} يوم. يفضل تجديده قبل انتهاء المدة.`
    actionRequired = `قم بمراجعة وتجديد اشتراك التأمين للمؤسسة "${company.name}" خلال الشهر القادم.`
  } else {
    priority = 'low'
    message = `اشتراك التأمين للمؤسسة "${company.name}" سينتهي خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد اشتراك التأمين للمؤسسة "${company.name}" عند الحاجة.`
  }
  
  return {
    id: `insurance_${company.id}_${expiryDate.toISOString().split('T')[0]}`,
    type: 'insurance_subscription',
    priority,
    title: 'انتهاء صلاحية اشتراك التأمين',
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
  const medium = alerts.filter(a => a.priority === 'medium').length
  const low = alerts.filter(a => a.priority === 'low').length
  const commercialRegAlerts = alerts.filter(a => a.type === 'commercial_registration').length
  const insuranceAlerts = alerts.filter(a => a.type === 'insurance_subscription').length
  
  return {
    total,
    urgent,
    medium,
    low,
    commercialRegAlerts,
    insuranceAlerts
  }
}

/**
 * الحصول على التنبيهات العاجلة فقط
 */
export function getUrgentAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(alert => alert.priority === 'urgent')
}

/**
 * الحصول على تنبيهات منتهية الصلاحية
 */
export function getExpiredAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(alert => 
    alert.days_remaining !== undefined && alert.days_remaining < 0
  )
}