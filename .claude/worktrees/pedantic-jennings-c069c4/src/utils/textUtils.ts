/**
 * توحيد النص العربي للمقارنة
 */
export const normalizeArabic = (text?: string | null): string => {
  if (!text) return ''

  return text
    // إزالة التشكيل
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // توحيد الألف: أ، إ، آ -> ا
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')
    // توحيد التاء المربوطة -> ه
    .replace(/\u0629/g, '\u0647')
    // توحيد الياء المقصورة -> ي
    .replace(/\u0649/g, '\u064A')
    // حذف المسافات الزائدة
    .trim()
}
