/**
 * التحقق من صحة أرقام المؤسسات
 * - الرقم الموحد: يجب أن يبدأ برقم 7 ويكون 10 أرقام
 * - رقم قوى: يجب أن يبدأ ب 13 على شكل 13-XXXXXXX (7 أرقام)
 * - "لا يوجد": قيمة صالحة تُعامل كـ N/A
 */

export const NO_VALUE_TEXT = 'لا يوجد'

export const isNoValue = (value: string | number | null | undefined): boolean => {
  if (value === null || value === undefined) return false
  return String(value).trim() === NO_VALUE_TEXT
}

export const normalizeNoValue = (value: string | number | null | undefined): string | number | null => {
  if (value === null || value === undefined) return null
  return isNoValue(value) ? null : value
}

/**
 * التحقق من صحة الرقم الموحد
 * @param unifiedNumber - الرقم الموحد
 * @returns { valid: boolean, error?: string }
 */
export const validateUnifiedNumber = (unifiedNumber: string | number | null | undefined): { valid: boolean; error?: string } => {
  if (!unifiedNumber) {
    return { valid: false, error: 'الرقم الموحد مطلوب' }
  }

  if (isNoValue(unifiedNumber)) {
    return { valid: true }
  }

  const numberStr = String(unifiedNumber).trim()

  // التحقق من أنه يحتوي على أرقام فقط
  if (!/^\d+$/.test(numberStr)) {
    return { valid: false, error: 'الرقم الموحد يجب أن يحتوي على أرقام فقط' }
  }

  // التحقق من أن الطول يساوي 10 أرقام
  if (numberStr.length !== 10) {
    return { valid: false, error: `الرقم الموحد يجب أن يكون 10 أرقام (الحالي: ${numberStr.length} أرقام)` }
  }

  // التحقق من أن يبدأ برقم 7
  if (!numberStr.startsWith('7')) {
    return { valid: false, error: `الرقم الموحد يجب أن يبدأ برقم 7 (الحالي: يبدأ برقم ${numberStr[0]})` }
  }

  return { valid: true }
}

/**
 * التحقق من صحة رقم قوى
 * @param laborSubscription - رقم قوى (يجب أن يكون على شكل 13-XXXXXXX)
 * @returns { valid: boolean, error?: string }
 */
export const validateLaborSubscription = (laborSubscription: string | number | null | undefined): { valid: boolean; error?: string } => {
  if (!laborSubscription) {
    // إذا كان فارغاً، لا مشكلة (حقل اختياري)
    return { valid: true }
  }

  if (isNoValue(laborSubscription)) {
    return { valid: true }
  }

  const numberStr = String(laborSubscription).trim()

  // التحقق من الصيغة: 13-XXXXXXX
  const laborSubPattern = /^13-\d{7}$/
  
  if (!laborSubPattern.test(numberStr)) {
    // رسالة خطأ مفصلة بناءً على المشكلة
    if (!numberStr.startsWith('13')) {
      return { valid: false, error: 'رقم قوى يجب أن يبدأ ب 13' }
    }
    
    if (!numberStr.includes('-')) {
      return { valid: false, error: 'رقم قوى يجب أن يكون بالصيغة: 13-XXXXXXX (مثال: 13-4084802)' }
    }

    const parts = numberStr.split('-')
    if (parts.length !== 2) {
      return { valid: false, error: 'رقم قوى يجب أن يحتوي على شرطة واحدة فقط: 13-XXXXXXX' }
    }

    if (!/^\d{7}$/.test(parts[1])) {
      return { valid: false, error: `الجزء الثاني من رقم قوى يجب أن يكون 7 أرقام بالضبط (الحالي: ${parts[1].length} أرقام)` }
    }

    return { valid: false, error: 'الصيغة الصحيحة لرقم قوى: 13-XXXXXXX (مثال: 13-4084802)' }
  }

  return { valid: true }
}

/**
 * دالة مساعدة للتحقق من رقمي المؤسسة معاً
 */
export const validateCompanyNumbers = (unifiedNumber: string | number | null | undefined, laborSubscription: string | number | null | undefined) => {
  const unifiedValidation = validateUnifiedNumber(unifiedNumber)
  const laborValidation = validateLaborSubscription(laborSubscription)

  return {
    unifiedNumber: unifiedValidation,
    laborSubscription: laborValidation,
    isValid: unifiedValidation.valid && laborValidation.valid
  }
}
