import { toHijri } from 'hijri-converter'

/**
 * تحويل التاريخ الميلادي إلى هجري
 */
export function toHijriDate(date: Date | null | undefined): { year: number; month: number; day: number } {
  if (!date || date === null || date === undefined) {
    return { year: 0, month: 0, day: 0 }
  }
  
  try {
    const hijri = toHijri(date.getFullYear(), date.getMonth() + 1, date.getDate())
    return {
      year: hijri.hy,
      month: hijri.hm,
      day: hijri.hd
    }
  } catch (error) {
    console.error('خطأ في تحويل التاريخ إلى هجري:', error)
    return { year: 0, month: 0, day: 0 }
  }
}

/**
 * تنسيق التاريخ الهجري كنص
 */
export function formatHijriDate(date: Date | null | undefined): string {
  if (!date || date === null || date === undefined) {
    return ''
  }
  
  const hijri = toHijriDate(date)
  if (hijri.year === 0) return ''
  
  const monthNames = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ]
  
  return `${hijri.day} ${monthNames[hijri.month - 1]} ${hijri.year} هـ`
}

/**
 * تنسيق التاريخ الميلادي كنص عربي
 */
export function formatGregorianDate(date: Date | string | null | undefined, includeTime: boolean = false): string {
  // التحقق من القيم الفارغة
  if (!date || date === null || date === undefined) {
    return ''
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // التحقق من أن dateObj صحيح
  if (!dateObj || isNaN(dateObj.getTime())) {
    return ''
  }
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'gregory',
    numberingSystem: 'arab'
  }
  
  if (includeTime) {
    options.hour = '2-digit'
    options.minute = '2-digit'
  }
  
  return dateObj.toLocaleDateString('ar-SA', options)
}


/**
 * تنسيق التاريخ الميلادي فقط (بدون الهجري)
 */
export function formatDateWithHijri(date: Date | string | null | undefined, includeTime: boolean = false): string {
  // التحقق من القيم الفارغة
  if (!date || date === null || date === undefined) {
    return ''
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // التحقق من أن dateObj صحيح
  if (!dateObj || isNaN(dateObj.getTime())) {
    return ''
  }
  
  return formatGregorianDate(dateObj, includeTime)
}

/**
 * تنسيق التاريخ بصيغة yyyy-MM-dd (الميلادي فقط)
 */
export function formatDateShortWithHijri(date: Date | string | null | undefined): string {
  // التحقق من القيم الفارغة
  if (!date || date === null || date === undefined) {
    return ''
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // التحقق من أن dateObj صحيح
  if (!dateObj || isNaN(dateObj.getTime())) {
    return ''
  }
  
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * تنسيق التاريخ مع الوقت بصيغة yyyy-MM-dd HH:mm (الميلادي فقط)
 */
export function formatDateTimeWithHijri(date: Date | string | null | undefined): string {
  // التحقق من القيم الفارغة
  if (!date || date === null || date === undefined) {
    return ''
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // التحقق من أن dateObj صحيح
  if (!dateObj || isNaN(dateObj.getTime())) {
    return ''
  }
  
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

