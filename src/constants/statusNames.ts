/**
 * المسميات الموحدة لحالات الانتهاءات في النظام
 * 
 * المسميات الموحدة:
 * - منتهي: < 0 يوم (انتهي أو قديم جداً)
 * - طارئ: ≤ 7 أيام (يحتاج تجديد فوري)
 * - عاجل: 8 - 30 يوم (يحتاج تجديد قريباً)
 * - متوسط: 31 - 45 يوم (تنبيه متوسط)
 * - ساري: > 45 يوم (صحيح وساري)
 */

export const STATUS_NAMES = {
  EXPIRED: 'منتهي',
  URGENT: 'طارئ',
  HIGH: 'عاجل',
  MEDIUM: 'متوسط',
  VALID: 'ساري',
  NOT_SPECIFIED: 'غير محدد'
} as const

export type StatusName = typeof STATUS_NAMES[keyof typeof STATUS_NAMES]

/**
 * الحصول على اسم الحالة بالعربية
 */
export const getStatusName = (status: StatusName): string => {
  return status
}

/**
 * جميع المسميات كقائمة
 */
export const ALL_STATUS_NAMES = Object.values(STATUS_NAMES)

