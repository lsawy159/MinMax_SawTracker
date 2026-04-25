import { calculateDaysRemaining } from './statusHelpers'

/**
 * الحصول على نص الحالة حسب عدد الأيام المتبقية
 */
export const getStatusText = (days: number): string => {
  if (days < 0) {
    const expiredDays = Math.abs(days)
    return expiredDays === 1 ? 
      `منتهي (منذ يوم)` : 
      `منتهي (منذ ${expiredDays} يوم)`
  } else if (days === 0) {
    return `ينتهي اليوم`
  } else if (days === 1) {
    return `باقي يوم واحد`
  } else if (days <= 30) {
    return `باقي ${days} يوم`
  } else if (days <= 60) {
    return `ساري (${days} يوم متبقي)`
  } else {
    return `ساري (${days} يوم متبقي)`
  }
}

/**
 * الحصول على وصف مفصل للحالة
 */
export const getStatusDescription = (days: number): string => {
  if (days < 0) {
    const expiredDays = Math.abs(days)
    return expiredDays === 1 ? 
      `منتهي منذ يوم واحد` : 
      `منتهي منذ ${expiredDays} يوم`
  } else if (days === 0) {
    return `ينتهي السجل التجاري اليوم`
  } else if (days === 1) {
    return `ينتهي السجل التجاري غداً`
  } else if (days <= 7) {
    return `ينتهي السجل التجاري خلال أسبوع`
  } else if (days <= 30) {
    return `ينتهي السجل التجاري خلال شهر`
  } else if (days <= 60) {
    return `ينتهي السجل التجاري خلال شهرين`
  } else {
    return `السجل التجاري ساري`
  }
}

/**
 * الحصول على أيقونة الحالة
 */
export const getStatusIcon = (days: number): string => {
  if (days < 0) {
    return '❌' // منتهي
  } else if (days <= 30) {
    return '⚠️' // أقل من 30 يوم
  } else if (days <= 60) {
    return '🟡' // 30-60 يوم
  } else {
    return '✅' // أكثر من 60 يوم
  }
}

/**
 * الحصول على الحالة المبسطة للتصنيف
 */
export const getStatusCategory = (days: number): 'expired' | 'expiring_soon' | 'valid' => {
  if (days < 0 || days <= 30) {
    return 'expired' // منتهي أو أقل من 30 يوم
  } else if (days <= 60) {
    return 'expiring_soon' // 30-60 يوم
  } else {
    return 'valid' // أكثر من 60 يوم
  }
}

/**
 * حساب إحصائيات السجل التجاري لمجموعة من المؤسسات
 */
export interface CommercialRegStats {
  total: number
  expired: number
  expiringSoon: number
  valid: number
  percentageValid: number
  percentageExpired: number
  percentageExpiringSoon: number
}

export const calculateCommercialRegStats = (companies: Array<{ commercial_registration_expiry: string | null }>): CommercialRegStats => {
  const stats = {
    total: companies.length,
    expired: 0,
    expiringSoon: 0,
    valid: 0,
    percentageValid: 0,
    percentageExpired: 0,
    percentageExpiringSoon: 0
  }

  companies.forEach(company => {
    if (!company.commercial_registration_expiry) {
      return // تجاهل الشركات بدون تاريخ انتهاء
    }

    const days = calculateDaysRemaining(company.commercial_registration_expiry)
    const category = getStatusCategory(days)

    if (category === 'expired') {
      stats.expired++
    } else if (category === 'expiring_soon') {
      stats.expiringSoon++
    } else {
      stats.valid++
    }
  })

  // حساب النسب المئوية
  if (stats.total > 0) {
    stats.percentageValid = Math.round((stats.valid / stats.total) * 100)
    stats.percentageExpired = Math.round((stats.expired / stats.total) * 100)
    stats.percentageExpiringSoon = Math.round((stats.expiringSoon / stats.total) * 100)
  }

  return stats
}

/**
 * الحصول على لون الحالة للفلاتر والجداول
 */
export const getStatusColorForFilters = (days: number): string => {
  if (days < 0 || days <= 30) {
    return 'text-red-600 bg-red-50 border-red-200'
  } else if (days <= 60) {
    return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  } else {
    return 'text-blue-600 bg-blue-50 border-blue-200'
  }
}

/**
 * الحصول على نص الحالة المختصر للجداول
 */
export const getShortStatusText = (days: number): string => {
  if (days < 0) {
    const expiredDays = Math.abs(days)
    return expiredDays === 1 ? 'منتهي (1 يوم)' : `منتهي (${expiredDays} يوم)`
  } else if (days <= 30) {
    return days === 1 ? 'ينتهي غداً' : `باقي ${days} يوم`
  } else if (days <= 60) {
    return `ساري (${days} يوم)`
  } else {
    return `ساري (${days}+ يوم)`
  }
}