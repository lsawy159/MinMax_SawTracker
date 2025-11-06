import { differenceInDays } from 'date-fns'

/**
 * حساب عدد الأيام المتبقية على انتهاء اشتراك التأمين
 */
export const calculateInsuranceDaysRemaining = (date: string): number => {
  if (!date) return 0
  
  const expiryDate = new Date(date)
  const today = new Date()
  
  // إعادة تعيين الوقت لضمان المقارنة الصحيحة
  today.setHours(0, 0, 0, 0)
  expiryDate.setHours(0, 0, 0, 0)
  
  return differenceInDays(expiryDate, today)
}

/**
 * الحصول على لون الحالة حسب عدد الأيام المتبقية لاشتراك التأمين
 * نظام الألوان المحدث:
 * - أحمر: أقل من 30 يوم أو منتهي الصلاحية
 * - أصفر: 30-60 يوم متبقي
 * - أزرق/أخضر: أكثر من 60 يوم متبقي
 */
export const getInsuranceStatusColor = (days: number): {
  backgroundColor: string
  textColor: string
  borderColor: string
} => {
  if (days < 0) {
    return {
      backgroundColor: 'bg-red-50',
      textColor: 'text-red-700',
      borderColor: 'border-red-200'
    }
  } else if (days < 30) {
    return {
      backgroundColor: 'bg-red-50',
      textColor: 'text-red-700',
      borderColor: 'border-red-200'
    }
  } else if (days <= 60) {
    return {
      backgroundColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      borderColor: 'border-yellow-200'
    }
  } else {
    // أكثر من 60 يوم - لون أزرق/أخضر
    return {
      backgroundColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200'
    }
  }
}

/**
 * الحصول على نص الحالة حسب عدد الأيام المتبقية لاشتراك التأمين
 */
export const getInsuranceStatusText = (days: number): string => {
  if (days < 0) {
    const expiredDays = Math.abs(days)
    return expiredDays === 1 ? 
      `منتهي الصلاحية (منذ يوم)` : 
      `منتهي الصلاحية (منذ ${expiredDays} يوم)`
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
 * الحصول على وصف مفصل لحالة اشتراك التأمين
 */
export const getInsuranceStatusDescription = (days: number): string => {
  if (days < 0) {
    const expiredDays = Math.abs(days)
    return expiredDays === 1 ? 
      `منتهي الصلاحية منذ يوم واحد` : 
      `منتهي الصلاحية منذ ${expiredDays} يوم`
  } else if (days === 0) {
    return `ينتهي اشتراك التأمين اليوم`
  } else if (days === 1) {
    return `ينتهي اشتراك التأمين غداً`
  } else if (days <= 7) {
    return `ينتهي اشتراك التأمين خلال أسبوع`
  } else if (days <= 30) {
    return `ينتهي اشتراك التأمين خلال شهر`
  } else if (days <= 60) {
    return `ينتهي اشتراك التأمين خلال شهرين`
  } else {
    return `اشتراك التأمين ساري`
  }
}

/**
 * الحصول على أيقونة الحالة لاشتراك التأمين
 */
export const getInsuranceStatusIcon = (days: number): string => {
  if (days < 0) {
    return '❌'
  } else if (days <= 30) {
    return '⚠️'
  } else if (days <= 60) {
    return '🟡'
  } else {
    return '✅'
  }
}