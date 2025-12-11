import { differenceInDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { logger } from './logger'

/**
 * القيم الافتراضية لإعدادات الحالات (موحد مع الموظفين)
 * طارئ - عاجل - متوسط - ساري
 */
export const DEFAULT_STATUS_THRESHOLDS = {
  commercial_reg_urgent_days: 7,
  commercial_reg_high_days: 15,
  commercial_reg_medium_days: 30,
  social_insurance_urgent_days: 7,
  social_insurance_high_days: 15,
  social_insurance_medium_days: 30,
  power_subscription_urgent_days: 7,
  power_subscription_high_days: 15,
  power_subscription_medium_days: 30,
  moqeem_subscription_urgent_days: 7,
  moqeem_subscription_high_days: 15,
  moqeem_subscription_medium_days: 30
}

// Cache for status thresholds
let statusThresholdsCache: typeof DEFAULT_STATUS_THRESHOLDS | null = null
let statusCacheTimestamp: number = 0
const STATUS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

// Function to invalidate the cache (call this when settings are saved)
export function invalidateStatusThresholdsCache() {
  statusThresholdsCache = null
  statusCacheTimestamp = 0
}

// Get status thresholds from database settings with caching (async)
export async function getStatusThresholds() {
  // Check if cache is valid
  const now = Date.now()
  if (statusThresholdsCache && (now - statusCacheTimestamp) < STATUS_CACHE_TTL) {
    return statusThresholdsCache
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'status_thresholds')
      .maybeSingle()

    if (error || !data || !data.setting_value) {
      logger.debug('Using default status thresholds')
      // Cache the defaults
      statusThresholdsCache = DEFAULT_STATUS_THRESHOLDS
      statusCacheTimestamp = now
      return DEFAULT_STATUS_THRESHOLDS
    }

    // Merge with defaults to ensure all required fields exist
    const mergedThresholds = { ...DEFAULT_STATUS_THRESHOLDS, ...data.setting_value }
    // Update cache
    statusThresholdsCache = mergedThresholds
    statusCacheTimestamp = now
    return mergedThresholds
  } catch (error) {
    console.error('Error loading status thresholds:', error)
    // Cache the defaults on error
    statusThresholdsCache = DEFAULT_STATUS_THRESHOLDS
    statusCacheTimestamp = now
    return DEFAULT_STATUS_THRESHOLDS
  }
}

// Get status thresholds from cache (sync) - returns defaults if cache not available
function getStatusThresholdsSync(): typeof DEFAULT_STATUS_THRESHOLDS {
  return statusThresholdsCache || DEFAULT_STATUS_THRESHOLDS
}

/**
 * حساب عدد الأيام المتبقية على انتهاء تاريخ معين
 */
export const calculateDaysRemaining = (date: string | null | undefined): number => {
  if (!date) return 0
  
  const expiryDate = new Date(date)
  const today = new Date()
  
  // إعادة تعيين الوقت لضمان المقارنة الصحيحة
  today.setHours(0, 0, 0, 0)
  expiryDate.setHours(0, 0, 0, 0)
  
  return differenceInDays(expiryDate, today)
}

/**
 * دالة عامة موحدة لحساب الحالة (للموظفين والمؤسسات)
 * النظام الموحد: طارئ - عاجل - متوسط - ساري
 */
export const calculateUnifiedStatus = (
  daysRemaining: number,
  urgentDays: number,
  highDays: number,
  mediumDays: number,
  itemName: string
): {
  status: 'منتهي' | 'طارئ' | 'عاجل' | 'متوسط' | 'ساري'
  color: {
    backgroundColor: string
    textColor: string
    borderColor: string
  }
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
} => {
  if (daysRemaining < 0) {
    const expiredDays = Math.abs(daysRemaining)
    return {
      status: 'منتهي',
      color: {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      },
      description: `انتهى ${itemName} منذ ${expiredDays} يوم`,
      priority: 'urgent'
    }
  } else if (daysRemaining <= urgentDays) {
    // طارئ (أحمر)
    const description = daysRemaining === 0 
      ? `ينتهي ${itemName} اليوم - إجراء فوري مطلوب`
      : daysRemaining === 1
      ? `ينتهي ${itemName} غداً - إجراء فوري مطلوب`
      : `ينتهي ${itemName} خلال ${daysRemaining} أيام - إجراء فوري مطلوب`
    
    return {
      status: 'طارئ',
      color: {
        backgroundColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      },
      description,
      priority: 'urgent'
    }
  } else if (daysRemaining <= highDays) {
    // عاجل (برتقالي)
    return {
      status: 'عاجل',
      color: {
        backgroundColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200'
      },
      description: `ينتهي ${itemName} خلال ${daysRemaining} يوم - يحتاج متابعة`,
      priority: 'high'
    }
  } else if (daysRemaining <= mediumDays) {
    // متوسط (أصفر)
    return {
      status: 'متوسط',
      color: {
        backgroundColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200'
      },
      description: `ينتهي ${itemName} خلال ${daysRemaining} يوم - متابعة مطلوبة`,
      priority: 'medium'
    }
  } else {
    // ساري (أخضر) - أكثر من mediumDays
    return {
      status: 'ساري',
      color: {
        backgroundColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      },
      description: `${itemName} ساري المفعول (${daysRemaining} يوم متبقي)`,
      priority: 'low'
    }
  }
}

/**
 * حساب حالة المؤسسة بناءً على تاريخ انتهاء السجل التجاري
 * النظام الموحد (نفس الموظفين):
 * - ≤ طارئ: أحمر (طارئ)
 * - ≤ عاجل: برتقالي (عاجل)
 * - ≤ متوسط: أصفر (متوسط)
 * - > متوسط: أخضر (ساري)
 */
export const calculateCommercialRegistrationStatus = (
  expiryDate: string | null | undefined,
  thresholds?: typeof DEFAULT_STATUS_THRESHOLDS
): {
  status: 'غير محدد' | 'منتهي' | 'طارئ' | 'عاجل' | 'متوسط' | 'ساري'
  daysRemaining: number
  color: {
    backgroundColor: string
    textColor: string
    borderColor: string
  }
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
} => {
  if (!expiryDate) {
    return {
      status: 'غير محدد',
      daysRemaining: 0,
      color: {
        backgroundColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200'
      },
      description: 'تاريخ انتهاء السجل التجاري غير محدد',
      priority: 'low'
    }
  }

  // Get thresholds if not provided (use cache or defaults)
  const statusThresholds = thresholds || getStatusThresholdsSync()
  const urgentDays = statusThresholds.commercial_reg_urgent_days
  const highDays = statusThresholds.commercial_reg_high_days
  const mediumDays = statusThresholds.commercial_reg_medium_days

  const daysRemaining = calculateDaysRemaining(expiryDate)
  const result = calculateUnifiedStatus(daysRemaining, urgentDays, highDays, mediumDays, 'السجل التجاري')
  
  return {
    ...result,
    daysRemaining
  }
}

/**
 * حساب حالة المؤسسة بناءً على تاريخ انتهاء اشتراك التأمينات
 * النظام الموحد: طارئ - عاجل - متوسط - ساري
 */
export const calculateSocialInsuranceStatus = (
  expiryDate: string | null | undefined,
  thresholds?: typeof DEFAULT_STATUS_THRESHOLDS
): {
  status: 'غير محدد' | 'منتهي' | 'طارئ' | 'عاجل' | 'متوسط' | 'ساري'
  daysRemaining: number
  color: {
    backgroundColor: string
    textColor: string
    borderColor: string
  }
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
} => {
  if (!expiryDate) {
    return {
      status: 'غير محدد',
      daysRemaining: 0,
      color: {
        backgroundColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200'
      },
      description: 'تاريخ انتهاء التأمينات الاجتماعية غير محدد',
      priority: 'low'
    }
  }

  // Get thresholds if not provided
  const statusThresholds = thresholds || getStatusThresholdsSync()
  const urgentDays = statusThresholds.social_insurance_urgent_days
  const highDays = statusThresholds.social_insurance_high_days
  const mediumDays = statusThresholds.social_insurance_medium_days

  const daysRemaining = calculateDaysRemaining(expiryDate)
  const result = calculateUnifiedStatus(daysRemaining, urgentDays, highDays, mediumDays, 'التأمينات الاجتماعية')
  
  return {
    ...result,
    daysRemaining
  }
}

/**
 * حساب إحصائيات السجل التجاري
 */
export interface CommercialRegStats {
  total: number
  expired: number
  urgent: number    // طارئ - أحمر
  high: number      // عاجل - برتقالي
  medium: number    // متوسط - أصفر
  valid: number     // ساري - أخضر
  notSpecified: number
  percentageValid: number
  percentageExpired: number
  percentageUrgent: number
  percentageHigh: number
  percentageMedium: number
  percentageNotSpecified: number
}

export const calculateCommercialRegStats = (companies: Array<{ commercial_registration_expiry: string | null }>): CommercialRegStats => {
  const stats = {
    total: companies.length,
    expired: 0,
    urgent: 0,    // طارئ - أحمر
    high: 0,      // عاجل - برتقالي
    medium: 0,    // متوسط - أصفر
    valid: 0,     // ساري - أخضر
    notSpecified: 0,
    percentageValid: 0,
    percentageExpired: 0,
    percentageUrgent: 0,
    percentageHigh: 0,
    percentageMedium: 0,
    percentageNotSpecified: 0
  }

  companies.forEach(company => {
    const statusInfo = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
    
    switch (statusInfo.status) {
      case 'منتهي':
        stats.expired++
        break
      case 'طارئ':
        stats.urgent++
        break
      case 'عاجل':
        stats.high++
        break
      case 'متوسط':
        stats.medium++
        break
      case 'ساري':
        stats.valid++
        break
      case 'غير محدد':
        stats.notSpecified++
        break
    }
  })

  // حساب النسب المئوية
  if (stats.total > 0) {
    stats.percentageValid = Math.round((stats.valid / stats.total) * 100)
    stats.percentageExpired = Math.round((stats.expired / stats.total) * 100)
    stats.percentageUrgent = Math.round((stats.urgent / stats.total) * 100)
    stats.percentageHigh = Math.round((stats.high / stats.total) * 100)
    stats.percentageMedium = Math.round((stats.medium / stats.total) * 100)
    stats.percentageNotSpecified = Math.round((stats.notSpecified / stats.total) * 100)
  }

  return stats
}

/**
 * حساب إحصائيات اشتراك التأمينات
 */
export interface InsuranceStats {
  total: number
  expired: number
  urgent: number    // طارئ - أحمر
  high: number      // عاجل - برتقالي
  medium: number    // متوسط - أصفر
  valid: number     // ساري - أخضر
  notSpecified: number
  percentageValid: number
  percentageExpired: number
  percentageUrgent: number
  percentageHigh: number
  percentageMedium: number
  percentageNotSpecified: number
}

// تحديث: calculateInsuranceStats - استخدام social_insurance_expiry
export const calculateSocialInsuranceStats = (companies: Array<{ social_insurance_expiry: string | null }>): InsuranceStats => {
  const stats = {
    total: companies.length,
    expired: 0,
    urgent: 0,    // طارئ - أحمر
    high: 0,      // عاجل - برتقالي
    medium: 0,    // متوسط - أصفر
    valid: 0,     // ساري - أخضر
    notSpecified: 0,
    percentageValid: 0,
    percentageExpired: 0,
    percentageUrgent: 0,
    percentageHigh: 0,
    percentageMedium: 0,
    percentageNotSpecified: 0
  }

  companies.forEach(company => {
    const statusInfo = calculateSocialInsuranceStatus(company.social_insurance_expiry)
    
    switch (statusInfo.status) {
      case 'منتهي':
        stats.expired++
        break
      case 'طارئ':
        stats.urgent++
        break
      case 'عاجل':
        stats.high++
        break
      case 'متوسط':
        stats.medium++
        break
      case 'ساري':
        stats.valid++
        break
      case 'غير محدد':
        stats.notSpecified++
        break
    }
  })

  // حساب النسب المئوية
  if (stats.total > 0) {
    stats.percentageValid = Math.round((stats.valid / stats.total) * 100)
    stats.percentageExpired = Math.round((stats.expired / stats.total) * 100)
    stats.percentageUrgent = Math.round((stats.urgent / stats.total) * 100)
    stats.percentageHigh = Math.round((stats.high / stats.total) * 100)
    stats.percentageMedium = Math.round((stats.medium / stats.total) * 100)
    stats.percentageNotSpecified = Math.round((stats.notSpecified / stats.total) * 100)
  }

  return stats
}

/**
 * حساب حالة المؤسسة بناءً على تاريخ انتهاء اشتراك قوى
 * يستخدم النظام الموحد: طارئ، عاجل، متوسط، ساري
 */
export const calculatePowerSubscriptionStatus = (
  expiryDate: string | null | undefined,
  thresholds?: typeof DEFAULT_STATUS_THRESHOLDS
): {
  status: 'غير محدد' | 'منتهي' | 'طارئ' | 'عاجل' | 'متوسط' | 'ساري'
  daysRemaining: number
  color: {
    backgroundColor: string
    textColor: string
    borderColor: string
  }
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
} => {
  if (!expiryDate) {
    return {
      status: 'غير محدد',
      daysRemaining: 0,
      color: {
        backgroundColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200'
      },
      description: 'تاريخ انتهاء اشتراك قوى غير محدد',
      priority: 'low'
    }
  }

  const statusThresholds = thresholds || getStatusThresholdsSync()
  const daysRemaining = calculateDaysRemaining(expiryDate)
  const result = calculateUnifiedStatus(
    daysRemaining,
    statusThresholds.power_subscription_urgent_days,
    statusThresholds.power_subscription_high_days,
    statusThresholds.power_subscription_medium_days,
    'اشتراك قوى'
  )
  
  return {
    ...result,
    daysRemaining
  }
}

/**
 * حساب حالة المؤسسة بناءً على تاريخ انتهاء اشتراك مقيم
 * يستخدم النظام الموحد: طارئ، عاجل، متوسط، ساري
 */
export const calculateMoqeemSubscriptionStatus = (
  expiryDate: string | null | undefined,
  thresholds?: typeof DEFAULT_STATUS_THRESHOLDS
): {
  status: 'غير محدد' | 'منتهي' | 'طارئ' | 'عاجل' | 'متوسط' | 'ساري'
  daysRemaining: number
  color: {
    backgroundColor: string
    textColor: string
    borderColor: string
  }
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
} => {
  if (!expiryDate) {
    return {
      status: 'غير محدد',
      daysRemaining: 0,
      color: {
        backgroundColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200'
      },
      description: 'تاريخ انتهاء اشتراك مقيم غير محدد',
      priority: 'low'
    }
  }

  const statusThresholds = thresholds || getStatusThresholdsSync()
  const daysRemaining = calculateDaysRemaining(expiryDate)
  const result = calculateUnifiedStatus(
    daysRemaining,
    statusThresholds.moqeem_subscription_urgent_days,
    statusThresholds.moqeem_subscription_high_days,
    statusThresholds.moqeem_subscription_medium_days,
    'اشتراك مقيم'
  )
  
  return {
    ...result,
    daysRemaining
  }
}

/**
 * حساب إحصائيات اشتراك قوى
 */
export interface PowerStats {
  total: number
  expired: number
  urgent: number    // طارئ - أحمر
  high: number      // عاجل - برتقالي
  medium: number    // متوسط - أصفر
  valid: number     // ساري - أخضر
  notSpecified: number
  percentageValid: number
  percentageExpired: number
  percentageUrgent: number
  percentageHigh: number
  percentageMedium: number
  percentageNotSpecified: number
}

export const calculatePowerStats = (companies: Array<{ ending_subscription_power_date: string | null }>): PowerStats => {
  const stats = {
    total: companies.length,
    expired: 0,
    urgent: 0,    // طارئ - أحمر
    high: 0,      // عاجل - برتقالي
    medium: 0,    // متوسط - أصفر
    valid: 0,     // ساري - أخضر
    notSpecified: 0,
    percentageValid: 0,
    percentageExpired: 0,
    percentageUrgent: 0,
    percentageHigh: 0,
    percentageMedium: 0,
    percentageNotSpecified: 0
  }

  companies.forEach(company => {
    const statusInfo = calculatePowerSubscriptionStatus(company.ending_subscription_power_date)
    
    switch (statusInfo.status) {
      case 'منتهي':
        stats.expired++
        break
      case 'طارئ':
        stats.urgent++
        break
      case 'عاجل':
        stats.high++
        break
      case 'متوسط':
        stats.medium++
        break
      case 'ساري':
        stats.valid++
        break
      case 'غير محدد':
        stats.notSpecified++
        break
    }
  })

  // حساب النسب المئوية
  if (stats.total > 0) {
    stats.percentageValid = Math.round((stats.valid / stats.total) * 100)
    stats.percentageExpired = Math.round((stats.expired / stats.total) * 100)
    stats.percentageUrgent = Math.round((stats.urgent / stats.total) * 100)
    stats.percentageHigh = Math.round((stats.high / stats.total) * 100)
    stats.percentageMedium = Math.round((stats.medium / stats.total) * 100)
    stats.percentageNotSpecified = Math.round((stats.notSpecified / stats.total) * 100)
  }

  return stats
}

/**
 * حساب إحصائيات اشتراك مقيم
 */
export interface MoqeemStats {
  total: number
  expired: number
  urgent: number    // طارئ - أحمر
  high: number      // عاجل - برتقالي
  medium: number    // متوسط - أصفر
  valid: number     // ساري - أخضر
  notSpecified: number
  percentageValid: number
  percentageExpired: number
  percentageUrgent: number
  percentageHigh: number
  percentageMedium: number
  percentageNotSpecified: number
}

export const calculateMoqeemStats = (companies: Array<{ ending_subscription_moqeem_date: string | null }>): MoqeemStats => {
  const stats = {
    total: companies.length,
    expired: 0,
    urgent: 0,    // طارئ - أحمر
    high: 0,      // عاجل - برتقالي
    medium: 0,    // متوسط - أصفر
    valid: 0,     // ساري - أخضر
    notSpecified: 0,
    percentageValid: 0,
    percentageExpired: 0,
    percentageUrgent: 0,
    percentageHigh: 0,
    percentageMedium: 0,
    percentageNotSpecified: 0
  }

  companies.forEach(company => {
    const statusInfo = calculateMoqeemSubscriptionStatus(company.ending_subscription_moqeem_date)
    
    switch (statusInfo.status) {
      case 'منتهي':
        stats.expired++
        break
      case 'طارئ':
        stats.urgent++
        break
      case 'عاجل':
        stats.high++
        break
      case 'متوسط':
        stats.medium++
        break
      case 'ساري':
        stats.valid++
        break
      case 'غير محدد':
        stats.notSpecified++
        break
    }
  })

  // حساب النسب المئوية
  if (stats.total > 0) {
    stats.percentageValid = Math.round((stats.valid / stats.total) * 100)
    stats.percentageExpired = Math.round((stats.expired / stats.total) * 100)
    stats.percentageUrgent = Math.round((stats.urgent / stats.total) * 100)
    stats.percentageHigh = Math.round((stats.high / stats.total) * 100)
    stats.percentageMedium = Math.round((stats.medium / stats.total) * 100)
    stats.percentageNotSpecified = Math.round((stats.notSpecified / stats.total) * 100)
  }

  return stats
}

/**
 * حساب إحصائيات موحدة للمؤسسة (السجل التجاري + اشتراك التأمينات + اشتراك قوى + اشتراك مقيم)
 * النظام الموحد: طارئ، عاجل، متوسط، ساري
 */
export interface CompanyStatusStats {
  totalCompanies: number
  commercialRegStats: CommercialRegStats
  socialInsuranceStats: InsuranceStats  // تحديث: insuranceStats → socialInsuranceStats
  powerStats: PowerStats
  moqeemStats: MoqeemStats
  // إحصائيات موحدة (تشمل جميع الحالات)
  totalValid: number       // ساري - أخضر
  totalMedium: number      // متوسط - أصفر
  totalCritical: number    // طارئ + عاجل معاً (urgent + high) - أحمر/برتقالي
  totalExpired: number     // منتهي
  totalValidPercentage: number
  totalMediumPercentage: number
  totalCriticalPercentage: number    // نسبة (طارئ + عاجل)
  totalExpiredPercentage: number
  totalCriticalAlerts: number        // عدد المؤسسات التي تحتاج اهتمام عاجل (urgent + high)
  totalMediumAlerts: number          // عدد المؤسسات متوسطة الأهمية
}

export const calculateCompanyStatusStats = (companies: Array<{
  id: string
  name: string
  commercial_registration_expiry: string | null
  social_insurance_expiry: string | null  // تحديث: insurance_subscription_expiry → social_insurance_expiry
  ending_subscription_power_date?: string | null
  ending_subscription_moqeem_date?: string | null
}>): CompanyStatusStats => {
  const commercialRegCompanies = companies.map(c => ({
    commercial_registration_expiry: c.commercial_registration_expiry
  }))
  
  const socialInsuranceCompanies = companies.map(c => ({
    social_insurance_expiry: c.social_insurance_expiry  // تحديث: insurance_subscription_expiry → social_insurance_expiry
  }))
  
  const powerCompanies = companies.map(c => ({
    ending_subscription_power_date: c.ending_subscription_power_date
  }))
  
  const moqeemCompanies = companies.map(c => ({
    ending_subscription_moqeem_date: c.ending_subscription_moqeem_date
  }))

  const commercialRegStats = calculateCommercialRegStats(commercialRegCompanies)
  const socialInsuranceStats = calculateSocialInsuranceStats(socialInsuranceCompanies)  // تحديث: calculateInsuranceStats → calculateSocialInsuranceStats
  const powerStats = calculatePowerStats(powerCompanies)
  const moqeemStats = calculateMoqeemStats(moqeemCompanies)

  // حساب إجمالي التنبيهات الحرجة والمتوسطة (يشمل جميع الحالات)
  let totalCriticalAlerts = 0
  let totalMediumAlerts = 0

  companies.forEach(company => {
    const commercialStatus = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
    const insuranceStatus = calculateSocialInsuranceStatus(company.social_insurance_expiry)  // تحديث: calculateInsuranceSubscriptionStatus → calculateSocialInsuranceStatus, insurance_subscription_expiry → social_insurance_expiry
    const powerStatus = calculatePowerSubscriptionStatus(company.ending_subscription_power_date)
    const moqeemStatus = calculateMoqeemSubscriptionStatus(company.ending_subscription_moqeem_date)
    
    if (commercialStatus.priority === 'urgent' || 
        insuranceStatus.priority === 'urgent' ||
        powerStatus.priority === 'urgent' ||
        moqeemStatus.priority === 'urgent') {
      totalCriticalAlerts++
    }
    
    if (commercialStatus.priority === 'medium' || 
        insuranceStatus.priority === 'medium' ||
        powerStatus.priority === 'medium' ||
        moqeemStatus.priority === 'medium') {
      totalMediumAlerts++
    }
  })

  // حساب إحصائيات موحدة (تشمل جميع الحالات الأربع)
  // المؤسسة تعتبر "ساري" إذا كانت جميع حالاتها سارية
  // المؤسسة تعتبر "متوسط" إذا كان لديها حالة واحدة على الأقل متوسطة وليست حرجة
  // المؤسسة تعتبر "حرج" إذا كان لديها حالة واحدة على الأقل حرجة
  // المؤسسة تعتبر "منتهي" إذا كان لديها حالة واحدة على الأقل منتهية
  
  let totalValid = 0
  let totalMedium = 0
  let totalCritical = 0
  let totalExpired = 0

  companies.forEach(company => {
    const commercialStatus = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
    const insuranceStatus = calculateSocialInsuranceStatus(company.social_insurance_expiry)  // تحديث: calculateInsuranceSubscriptionStatus → calculateSocialInsuranceStatus, insurance_subscription_expiry → social_insurance_expiry
    const powerStatus = calculatePowerSubscriptionStatus(company.ending_subscription_power_date)
    const moqeemStatus = calculateMoqeemSubscriptionStatus(company.ending_subscription_moqeem_date)
    
    const allStatuses = [commercialStatus, insuranceStatus, powerStatus, moqeemStatus]
    const priorities = allStatuses.map(s => s.priority)
    const statuses = allStatuses.map(s => s.status)
    
    // إذا كان هناك حالة منتهية، المؤسسة منتهية
    if (statuses.includes('منتهي')) {
      totalExpired++
    }
    // إذا كان هناك حالة حرجة (وليس منتهية)، المؤسسة حرجة
    else if (priorities.includes('urgent')) {
      totalCritical++
    }
    // إذا كان هناك حالة عاجلة (وليس حرجة أو منتهية)، المؤسسة حرجة أيضاً
    else if (priorities.includes('high')) {
      totalCritical++
    }
    // إذا كان هناك حالة متوسطة (وليس حرجة أو منتهية)، المؤسسة متوسطة
    else if (priorities.includes('medium')) {
      totalMedium++
    }
    // إذا كانت جميع الحالات سارية، المؤسسة سارية
    else if (priorities.every(p => p === 'low')) {
      totalValid++
    }
    // إذا كانت جميع الحالات غير محددة، المؤسسة سارية (افتراضياً)
    else {
      totalValid++
    }
  })

  const totalCompanies = companies.length
  const totalValidPercentage = totalCompanies > 0 ? Math.round((totalValid / totalCompanies) * 100) : 0
  const totalMediumPercentage = totalCompanies > 0 ? Math.round((totalMedium / totalCompanies) * 100) : 0
  const totalCriticalPercentage = totalCompanies > 0 ? Math.round((totalCritical / totalCompanies) * 100) : 0
  const totalExpiredPercentage = totalCompanies > 0 ? Math.round((totalExpired / totalCompanies) * 100) : 0

  return {
    totalCompanies: companies.length,
    commercialRegStats,
    socialInsuranceStats,  // تحديث: insuranceStats → socialInsuranceStats
    powerStats,
    moqeemStats,
    totalValid,
    totalMedium,
    totalCritical,
    totalExpired,
    totalValidPercentage,
    totalMediumPercentage,
    totalCriticalPercentage,
    totalExpiredPercentage,
    totalCriticalAlerts,
    totalMediumAlerts
  }
}