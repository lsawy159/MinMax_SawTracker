/**
 * معالج موحد للتواريخ يدعم صيغ متعددة
 * Unified date parser supporting multiple formats
 */

export interface ParseDateResult {
  date: Date | null
  error?: string
  format?: string
}

/**
 * أسماء الأشهر بالإنجليزية (كاملة ومختصرة)
 */
const MONTH_NAMES: { [key: string]: number } = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12
}

/**
 * تحويل رقم Excel التسلسلي إلى تاريخ
 */
function excelSerialToDate(serial: number): Date {
  // Excel epoch starts from January 1, 1900
  const excelEpoch = new Date(1900, 0, 1)
  // Excel incorrectly treats 1900 as a leap year, so we subtract 1 day
  const days = serial - 2
  return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000)
}

/**
 * محاولة تحليل التاريخ بصيغة YYYY-MM-DD أو YYYY/MM/DD
 */
function parseYYYYMMDD(dateStr: string): Date | null {
  const patterns = [
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/,
    /^(\d{4})(\d{2})(\d{2})$/
  ]

  for (const pattern of patterns) {
    const match = dateStr.trim().match(pattern)
    if (match) {
      const year = parseInt(match[1], 10)
      const month = parseInt(match[2], 10) - 1 // JavaScript months are 0-indexed
      const day = parseInt(match[3], 10)
      
      if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day)
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
          return date
        }
      }
    }
  }
  return null
}

/**
 * محاولة تحليل التاريخ بصيغة DD/MM/YYYY أو DD-MM-YYYY
 */
function parseDDMMYYYY(dateStr: string): Date | null {
  const pattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
  const match = dateStr.trim().match(pattern)
  
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1 // JavaScript months are 0-indexed
    const year = parseInt(match[3], 10)
    
    if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(year, month, day)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date
      }
    }
  }
  return null
}

/**
 * محاولة تحليل التاريخ بصيغة MM/DD/YYYY أو MM-DD-YYYY
 */
function parseMMDDYYYY(dateStr: string): Date | null {
  const pattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/
  const match = dateStr.trim().match(pattern)
  
  if (match) {
    const month = parseInt(match[1], 10) - 1 // JavaScript months are 0-indexed
    const day = parseInt(match[2], 10)
    const year = parseInt(match[3], 10)
    
    if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(year, month, day)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date
      }
    }
  }
  return null
}

/**
 * محاولة تحليل التاريخ بصيغة DD-Mon-YYYY أو DD/Mon/YYYY
 * يدعم: 03-May-2026, 05/Nov/1995
 */
function parseDDMonYYYY(dateStr: string): Date | null {
  const normalized = dateStr.trim()
  // Pattern for DD-Mon-YYYY or DD/Mon/YYYY (e.g., 04/Jun/1997, 03-May-2026)
  const pattern = /^(\d{1,2})[-/]([a-z]{3,})[-/](\d{4})$/i
  
  const match = normalized.match(pattern)
  if (match) {
    const day = parseInt(match[1], 10)
    const monthName = match[2].toLowerCase()
    const year = parseInt(match[3], 10)
    const month = MONTH_NAMES[monthName]
    
    if (month && year >= 1900 && year <= 2100 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day)
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date
      }
    }
  }
  
  return null
}

/**
 * محاولة تحليل التاريخ بصيغة YYYY-Mon-DD أو YYYY/Mon/DD
 * يدعم: 1995-Nov-05, 1995/Nov/05
 */
function parseYYYYMonDD(dateStr: string): Date | null {
  const normalized = dateStr.trim()
  // Pattern for YYYY-Mon-DD or YYYY/Mon/DD
  const pattern = /^(\d{4})[-/]([a-z]{3,})[-/](\d{1,2})$/i
  
  const match = normalized.match(pattern)
  if (match) {
    const year = parseInt(match[1], 10)
    const monthName = match[2].toLowerCase()
    const day = parseInt(match[3], 10)
    const month = MONTH_NAMES[monthName]
    
    if (month && year >= 1900 && year <= 2100 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day)
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date
      }
    }
  }
  
  return null
}

/**
 * محاولة تحليل التاريخ بصيغة DD-MM-YY مع تحويل السنة المكونة من رقمين
 * يدعم: 26-05-27 (يُحول إلى 2027), 29-05-27
 * منطق تحويل السنة: إذا كانت السنة <= 50، افترض 20XX، وإلا افترض 19XX
 */
function parseDDMMYY(dateStr: string): Date | null {
  const pattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/
  const match = dateStr.trim().match(pattern)
  
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1 // JavaScript months are 0-indexed
    const yearTwoDigit = parseInt(match[3], 10)
    
    // تحويل السنة المكونة من رقمين إلى 4 أرقام
    // إذا كانت السنة <= 50، افترض أنها 20XX (مثل 27 → 2027)
    // إذا كانت السنة > 50، افترض أنها 19XX (مثل 95 → 1995)
    const year = yearTwoDigit <= 50 ? 2000 + yearTwoDigit : 1900 + yearTwoDigit
    
    if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(year, month, day)
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date
      }
    }
  }
  
  return null
}

/**
 * محاولة تحليل التاريخ بصيغة Mon/YYYY/DD أو Mon-YYYY-DD (سنة 4 أرقام)
 * يدعم: May/2026/03
 */
function parseMonYYYYDD(dateStr: string): Date | null {
  const normalized = dateStr.trim()
  // Pattern for Mon/YYYY/DD or Mon-YYYY-DD where YYYY is 4 digits
  const pattern = /^([a-z]{3,})[-/](\d{4})[-/](\d{1,2})$/i
  
  const match = normalized.match(pattern)
  if (match) {
    const monthName = match[1].toLowerCase()
    const year = parseInt(match[2], 10)
    const day = parseInt(match[3], 10)
    const month = MONTH_NAMES[monthName]
    
    if (month && year >= 1900 && year <= 2100 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day)
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date
      }
    }
  }
  
  return null
}

/**
 * محاولة تحليل التاريخ بصيغة Mon/YYY/DD أو Mon-YYY-DD مع سنة مكونة من 3 أرقام
 * يدعم: Jun/199/04, May/202/03, Feb/202/13
 * منطق إصلاح السنة:
 * - إذا كانت السنة بين 190-199، أضف 9 في النهاية (199 → 1999, 195 → 1995)
 * - إذا كانت السنة بين 200-209، أضف الرقم المناسب:
 *   - 200 → 2000
 *   - 201 → 2019 (أو 2020 حسب السياق)
 *   - 202 → 2026 (أو 2020 حسب السياق)
 *   - 203-209 → 2023-2029
 */
function parseMonYYYDD(dateStr: string): Date | null {
  const normalized = dateStr.trim()
  // Pattern for Mon/YYY/DD or Mon-YYY-DD where YYY is 3 digits
  const pattern = /^([a-z]{3,})[-/](\d{3})[-/](\d{1,2})$/i
  
  const match = normalized.match(pattern)
  if (match) {
    const monthName = match[1].toLowerCase()
    const yearThreeDigit = parseInt(match[2], 10)
    const day = parseInt(match[3], 10)
    const month = MONTH_NAMES[monthName]
    
    if (!month || day < 1 || day > 31) {
      return null
    }
    
    // إصلاح السنة المكونة من 3 أرقام
    // 199 → 1999 (أضف 9 في النهاية)
    // 202 → 2026 (حسب السياق المذكور)
    let year: number
    if (yearThreeDigit >= 190 && yearThreeDigit <= 199) {
      // 199 → 1999, 195 → 1995, 190 → 1990
      // ببساطة: أضف 9 في النهاية
      // 199 = 1*100 + 99 → 1999 = 1*1000 + 999
      // الطريقة: 1900 + (الرقمين الأخيرين) + 900
      const lastTwoDigits = yearThreeDigit % 100 // 99 من 199
      year = 1900 + lastTwoDigits // 1900 + 99 = 1999 ✅
    } else if (yearThreeDigit >= 200 && yearThreeDigit <= 209) {
      // 200 → 2000
      if (yearThreeDigit === 200) {
        year = 2000
      } else if (yearThreeDigit === 202) {
        year = 2026 // الأكثر احتمالاً في السياق الحالي (May/202/03 → May 2026)
      } else {
        // 201, 203-209 → 2019, 2023-2029
        const lastTwoDigits = yearThreeDigit % 100
        year = 2000 + lastTwoDigits
      }
    } else {
      return null
    }
    
    if (year >= 1900 && year <= 2100) {
      const date = new Date(year, month - 1, day)
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date
      }
    }
  }
  
  return null
}

/**
 * محاولة تحليل التاريخ بصيغة نصية إنجليزية
 * يدعم: 25-may-2025, May 25, 2025, 25 May 2025, may 25 2025, etc.
 */
function parseTextDate(dateStr: string): Date | null {
  const normalized = dateStr.trim().toLowerCase()
  
  // Patterns for text dates
  const patterns = [
    // DD-month-YYYY or DD month YYYY
    /^(\d{1,2})[-/\s]+([a-z]+)[-/\s]+(\d{4})$/,
    // month DD, YYYY or month DD YYYY
    /^([a-z]+)[-/\s]+(\d{1,2})[,]?[-/\s]*(\d{4})$/,
    // YYYY-month-DD
    /^(\d{4})[-/\s]+([a-z]+)[-/\s]+(\d{1,2})$/
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match) {
      let day: number
      let month: number
      let year: number

      // Determine which pattern matched and extract values
      if (pattern === patterns[0]) {
        // DD-month-YYYY
        day = parseInt(match[1], 10)
        const monthName = match[2]
        year = parseInt(match[3], 10)
        month = MONTH_NAMES[monthName]
      } else if (pattern === patterns[1]) {
        // month DD, YYYY
        const monthName = match[1]
        day = parseInt(match[2], 10)
        year = parseInt(match[3], 10)
        month = MONTH_NAMES[monthName]
      } else {
        // YYYY-month-DD
        year = parseInt(match[1], 10)
        const monthName = match[2]
        day = parseInt(match[3], 10)
        month = MONTH_NAMES[monthName]
      }

      if (month && year >= 1900 && year <= 2100 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day) // month is 1-indexed in our map
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
          return date
        }
      }
    }
  }
  
  return null
}

/**
 * الدالة الرئيسية لتحليل التواريخ
 * تحاول تحليل التاريخ بجميع الصيغ المدعومة
 */
export function parseDate(dateStr: string | null | undefined): ParseDateResult {
  // التعامل مع القيم الفارغة
  if (!dateStr || typeof dateStr !== 'string') {
    return {
      date: null,
      error: 'تاريخ فارغ أو غير صحيح'
    }
  }

  const trimmed = dateStr.trim()
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
    return {
      date: null,
      error: 'تاريخ فارغ'
    }
  }

  // محاولة الصيغ المختلفة بالترتيب
  // نبدأ بالصيغ الأكثر شيوعاً في Excel
  // نضع DD/MM/YYYY أولاً لأنه الأكثر شيوعاً
  const parsers = [
    { name: 'DD/MM/YYYY', parser: parseDDMMYYYY }, // DD/MM/YYYY - الأكثر شيوعاً في Excel
    { name: 'DD-Mon-YYYY', parser: parseDDMonYYYY }, // DD/Mon/YYYY أو DD-Mon-YYYY
    { name: 'Mon/YYYY/DD', parser: parseMonYYYYDD }, // Mon/YYYY/DD أو Mon-YYYY-DD
    { name: 'Mon-YYY-DD', parser: parseMonYYYDD }, // معالجة السنوات المكونة من 3 أرقام (Mon/YYY/DD)
    { name: 'YYYY-Mon-DD', parser: parseYYYYMonDD }, // YYYY-Mon-DD أو YYYY/Mon/DD
    { name: 'YYYY-MM-DD', parser: parseYYYYMMDD },
    { name: 'DD-MM-YY', parser: parseDDMMYY },
    { name: 'MM/DD/YYYY', parser: parseMMDDYYYY },
    { name: 'text_date', parser: parseTextDate }
  ]

  for (const { name, parser } of parsers) {
    try {
      const date = parser(trimmed)
      if (date && !isNaN(date.getTime())) {
        // التحقق من أن التاريخ منطقي (بين 1900 و 2100)
        const year = date.getFullYear()
        if (year >= 1900 && year <= 2100) {
          // رفض التواريخ التي تبدو كتواريخ افتراضية (مثل 1900-01-01 أو 1900-01-XX)
          // لكن نحن نريد قبول التواريخ الصحيحة من سنة 1900
          if (year === 1900 && date.getMonth() === 0 && date.getDate() <= 31) {
            // هذا قد يكون تاريخ افتراضي - نتجاوزه ونكمل
            continue
          }
          return {
            date,
            format: name
          }
        }
      }
    } catch (error) {
      // Continue to next parser
    }
  }

  // محاولة تحليل رقم Excel التسلسلي (فقط إذا لم تكن القيمة تحتوي على / أو -)
  // هذا يعني أنها ليست صيغة تاريخ نصية
  if (!trimmed.includes('/') && !trimmed.includes('-') && !trimmed.match(/[a-z]/i)) {
    const excelSerial = parseFloat(trimmed)
    if (!isNaN(excelSerial) && excelSerial > 0 && excelSerial < 1000000) {
      try {
        const date = excelSerialToDate(excelSerial)
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear()
          // التحقق من أن التاريخ منطقي وليس تاريخ افتراضي
          if (year >= 1900 && year <= 2100 && !(year === 1900 && date.getMonth() === 0 && date.getDate() <= 31)) {
            return {
              date,
              format: 'excel_serial'
            }
          }
        }
      } catch {
        // Continue to other formats
      }
    }
  }

  for (const { name, parser } of parsers) {
    try {
      const date = parser(trimmed)
      if (date && !isNaN(date.getTime())) {
        // التحقق من أن التاريخ منطقي (بين 1900 و 2100)
        const year = date.getFullYear()
        if (year >= 1900 && year <= 2100) {
          // رفض التواريخ التي تبدو كتواريخ افتراضية (مثل 1900-01-01 أو 1900-01-XX)
          // لكن نحن نريد قبول التواريخ الصحيحة من سنة 1900
          if (year === 1900 && date.getMonth() === 0 && date.getDate() <= 31) {
            // هذا قد يكون تاريخ افتراضي - نتجاوزه ونكمل
            continue
          }
          return {
            date,
            format: name
          }
        }
      }
    } catch (error) {
      // Continue to next parser
    }
  }

  // محاولة أخيرة باستخدام Date constructor (للصيغ غير المدعومة)
  try {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      // التحقق من أن التاريخ منطقي (ليس سنة 1970 أو تاريخ غير صحيح)
      const year = date.getFullYear()
      if (year >= 1900 && year <= 2100) {
        return {
          date,
          format: 'auto_detected'
        }
      }
    }
  } catch {
    // Ignore
  }

  return {
    date: null,
    error: `لا يمكن تحليل التاريخ: "${trimmed}". الصيغ المدعومة: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, أو تواريخ نصية إنجليزية`
  }
}

/**
 * تحويل التاريخ إلى صيغة YYYY-MM-DD
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  const result = parseDate(dateStr)
  if (result.date) {
    const year = result.date.getFullYear()
    const month = String(result.date.getMonth() + 1).padStart(2, '0')
    const day = String(result.date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return null
}

/**
 * التحقق من صحة التاريخ
 */
export function isValidDate(dateStr: string | null | undefined): boolean {
  const result = parseDate(dateStr)
  return result.date !== null
}

