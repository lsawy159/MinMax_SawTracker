/**
 * خدمة المراقبة الشاملة لتواريخ انتهاء الصلاحية
 * 
 * تقوم هذه الخدمة بمراقبة جميع تواريخ انتهاء الصلاحية للشركات والموظفين
 * وإرسال تنبيهات بالبريد الإلكتروني للتنبيهات العاجلة والهامة
 * 
 * @module comprehensiveExpiryAlertService
 * @author SAW Tracker System
 */

import { supabase } from '../lib/supabase'
import { enqueueEmail } from '../lib/emailQueueService'
import { logger } from '../utils/logger'
import { getNotificationThresholds } from '../utils/alerts'
import { getEmployeeNotificationThresholdsPublic } from '../utils/employeeAlerts'

// ========================
// الأنواع والواجهات
// ========================

/**
 * تكوين المراقبة لكل نوع من المستندات
 */
interface ExpiryMonitorConfig {
  /** اسم الحقل في قاعدة البيانات */
  fieldName: string
  /** اسم النوع بالعربية (يظهر في التنبيهات) */
  arabicName: string
  /** اسم نوع التنبيه */
  alertType: string
  /** مفاتيح العتبات في system_settings */
  thresholdKeys: {
    urgent: string
    high: string
    medium: string
  }
}

/**
 * تنبيه انتهاء الصلاحية
 */
interface ExpiryAlert {
  id: string
  entityType: 'company' | 'employee'
  entityId: string
  entityName: string
  documentType: string
  documentTypeArabic: string
  expiryDate: string
  daysRemaining: number
  priority: 'urgent' | 'high' | 'medium'
  message: string
  actionRequired: string
  companyName?: string
}

// ========================
// تكوين أنواع المستندات
// ========================

/**
 * تكوين مراقبة مستندات الشركات
 */
const COMPANY_DOCUMENT_CONFIGS: ExpiryMonitorConfig[] = [
  {
    fieldName: 'commercial_registration_expiry',
    arabicName: 'السجل التجاري',
    alertType: 'commercial_registration_expiry',
    thresholdKeys: {
      urgent: 'commercial_reg_urgent_days',
      high: 'commercial_reg_high_days',
      medium: 'commercial_reg_medium_days'
    }
  },
  {
    fieldName: 'ending_subscription_power_date',
    arabicName: 'اشتراك قوى',
    alertType: 'power_subscription_expiry',
    thresholdKeys: {
      urgent: 'power_subscription_urgent_days',
      high: 'power_subscription_high_days',
      medium: 'power_subscription_medium_days'
    }
  },
  {
    fieldName: 'ending_subscription_moqeem_date',
    arabicName: 'اشتراك مقيم',
    alertType: 'moqeem_subscription_expiry',
    thresholdKeys: {
      urgent: 'moqeem_subscription_urgent_days',
      high: 'moqeem_subscription_high_days',
      medium: 'moqeem_subscription_medium_days'
    }
  }
]

/**
 * تكوين مراقبة مستندات الموظفين
 */
const EMPLOYEE_DOCUMENT_CONFIGS: ExpiryMonitorConfig[] = [
  {
    fieldName: 'residence_expiry',
    arabicName: 'الإقامة',
    alertType: 'residence_expiry',
    thresholdKeys: {
      urgent: 'residence_urgent_days',
      high: 'residence_high_days',
      medium: 'residence_medium_days'
    }
  },
  {
    fieldName: 'health_insurance_expiry',
    arabicName: 'التأمين الصحي',
    alertType: 'health_insurance_expiry',
    thresholdKeys: {
      urgent: 'health_insurance_urgent_days',
      high: 'health_insurance_high_days',
      medium: 'health_insurance_medium_days'
    }
  },
  {
    fieldName: 'contract_expiry',
    arabicName: 'عقد العمل',
    alertType: 'contract_expiry',
    thresholdKeys: {
      urgent: 'contract_urgent_days',
      high: 'contract_high_days',
      medium: 'contract_medium_days'
    }
  },
  {
    fieldName: 'hired_worker_contract_expiry',
    arabicName: 'عقد أجير',
    alertType: 'hired_worker_contract_expiry',
    thresholdKeys: {
      urgent: 'hired_worker_contract_urgent_days',
      high: 'hired_worker_contract_high_days',
      medium: 'hired_worker_contract_medium_days'
    }
  }
]

// ========================
// الدوال المساعدة
// ========================

/**
 * حساب عدد الأيام المتبقية حتى تاريخ الانتهاء
 */
function calculateDaysRemaining(expiryDate: string): number {
  const today = new Date()
  const expiry = new Date(expiryDate)
  const timeDiff = expiry.getTime() - today.getTime()
  return Math.ceil(timeDiff / (1000 * 3600 * 24))
}

/**
 * تحديد أولوية التنبيه بناءً على عدد الأيام المتبقية
 */
function determinePriority(
  daysRemaining: number,
  urgentDays: number,
  highDays: number,
  mediumDays: number
): 'urgent' | 'high' | 'medium' | null {
  if (daysRemaining < 0 || daysRemaining <= urgentDays) {
    return 'urgent'
  } else if (daysRemaining <= highDays) {
    return 'high'
  } else if (daysRemaining <= mediumDays) {
    return 'medium'
  }
  return null
}

/**
 * إنشاء رسالة التنبيه بناءً على الأولوية وعدد الأيام
 */
function createAlertMessage(
  entityName: string,
  documentTypeArabic: string,
  daysRemaining: number,
  priority: 'urgent' | 'high' | 'medium'
): { message: string; actionRequired: string } {
  let message: string
  let actionRequired: string

  if (daysRemaining < 0) {
    const daysExpired = Math.abs(daysRemaining)
    message = `انتهت صلاحية ${documentTypeArabic} لـ "${entityName}" منذ ${daysExpired} يوم. يجب التجديد فوراً.`
    actionRequired = `قم بتجديد ${documentTypeArabic} لـ "${entityName}" في أقرب وقت ممكن.`
  } else if (daysRemaining === 0) {
    message = `تنتهي صلاحية ${documentTypeArabic} لـ "${entityName}" اليوم. يجب التجديد قبل نهاية اليوم.`
    actionRequired = `قم بتجديد ${documentTypeArabic} لـ "${entityName}" قبل نهاية اليوم.`
  } else if (daysRemaining === 1) {
    message = `تنتهي صلاحية ${documentTypeArabic} لـ "${entityName}" غداً. يفضل التجديد اليوم.`
    actionRequired = `قم بتجديد ${documentTypeArabic} لـ "${entityName}" قبل انتهاء مدته غداً.`
  } else if (priority === 'urgent') {
    message = `تنتهي صلاحية ${documentTypeArabic} لـ "${entityName}" خلال ${daysRemaining} أيام - إجراء فوري مطلوب.`
    actionRequired = `قم بترتيب تجديد ${documentTypeArabic} لـ "${entityName}" خلال الـ ${daysRemaining} أيام القادمة.`
  } else if (priority === 'high') {
    message = `تنتهي صلاحية ${documentTypeArabic} لـ "${entityName}" خلال ${daysRemaining} يوم - متابعة مطلوبة.`
    actionRequired = `قم بترتيب تجديد ${documentTypeArabic} لـ "${entityName}" خلال الـ ${daysRemaining} يوم القادمة.`
  } else {
    message = `${documentTypeArabic} لـ "${entityName}" ستنتهي خلال ${daysRemaining} يوم.`
    actionRequired = `قم بمتابعة تجديد ${documentTypeArabic} لـ "${entityName}" عند الحاجة.`
  }

  return { message, actionRequired }
}

// ========================
// دوال المراقبة الرئيسية
// ========================

/**
 * مراقبة تواريخ انتهاء الصلاحية للشركات
 */
async function monitorCompanyExpiryDates(): Promise<ExpiryAlert[]> {
  const alerts: ExpiryAlert[] = []

  try {
    // جلب جميع الشركات النشطة
    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')

    if (error) {
      logger.error('خطأ في جلب بيانات الشركات:', error)
      return alerts
    }

    if (!companies || companies.length === 0) {
      logger.debug('لا توجد شركات للمراقبة')
      return alerts
    }

    // جلب العتبات من system_settings
    const thresholds = await getNotificationThresholds()

    // مراقبة كل نوع من المستندات
    for (const company of companies) {
      for (const config of COMPANY_DOCUMENT_CONFIGS) {
        const expiryDate = company[config.fieldName]
        
        if (!expiryDate) {
          continue // تجاهل الحقول الفارغة
        }

        const daysRemaining = calculateDaysRemaining(expiryDate)
        
        // الحصول على العتبات لهذا النوع من المستندات
        const urgentDays = thresholds[config.thresholdKeys.urgent as keyof typeof thresholds] as number
        const highDays = thresholds[config.thresholdKeys.high as keyof typeof thresholds] as number
        const mediumDays = thresholds[config.thresholdKeys.medium as keyof typeof thresholds] as number

        const priority = determinePriority(daysRemaining, urgentDays, highDays, mediumDays)

        // إنشاء تنبيه فقط إذا كان ضمن نطاق العتبات
        if (priority) {
          const { message, actionRequired } = createAlertMessage(
            company.name,
            config.arabicName,
            daysRemaining,
            priority
          )

          alerts.push({
            id: `${config.alertType}_${company.id}_${expiryDate}`,
            entityType: 'company',
            entityId: company.id,
            entityName: company.name,
            documentType: config.alertType,
            documentTypeArabic: config.arabicName,
            expiryDate,
            daysRemaining,
            priority,
            message,
            actionRequired
          })
        }
      }
    }

    logger.info(`تم إنشاء ${alerts.length} تنبيه للشركات`)
  } catch (error) {
    logger.error('خطأ في مراقبة تواريخ انتهاء الصلاحية للشركات:', error)
  }

  return alerts
}

/**
 * مراقبة تواريخ انتهاء الصلاحية للموظفين
 */
async function monitorEmployeeExpiryDates(): Promise<ExpiryAlert[]> {
  const alerts: ExpiryAlert[] = []

  try {
    // جلب جميع الموظفين مع معلومات الشركة
    const { data: employees, error } = await supabase
      .from('employees')
      .select(`
        *,
        companies:company_id (
          id,
          name,
          commercial_registration_number
        )
      `)

    if (error) {
      logger.error('خطأ في جلب بيانات الموظفين:', error)
      return alerts
    }

    if (!employees || employees.length === 0) {
      logger.debug('لا يوجد موظفين للمراقبة')
      return alerts
    }

    // جلب العتبات من system_settings
    const thresholds = await getEmployeeNotificationThresholdsPublic()

    // مراقبة كل نوع من المستندات
    for (const employee of employees) {
      // Type guard: companies يمكن أن يكون object أو null
      const companyData = employee.companies && typeof employee.companies === 'object' && 'name' in employee.companies 
        ? employee.companies as { name: string; id: string; commercial_registration_number?: string }
        : null
      const companyName = companyData?.name ?? 'غير محدد'

      for (const config of EMPLOYEE_DOCUMENT_CONFIGS) {
        const expiryDate = employee[config.fieldName]
        
        if (!expiryDate) {
          continue // تجاهل الحقول الفارغة
        }

        const daysRemaining = calculateDaysRemaining(expiryDate)
        
        // الحصول على العتبات لهذا النوع من المستندات
        const urgentDays = thresholds[config.thresholdKeys.urgent as keyof typeof thresholds] as number
        const highDays = thresholds[config.thresholdKeys.high as keyof typeof thresholds] as number
        const mediumDays = thresholds[config.thresholdKeys.medium as keyof typeof thresholds] as number

        const priority = determinePriority(daysRemaining, urgentDays, highDays, mediumDays)

        // إنشاء تنبيه فقط إذا كان ضمن نطاق العتبات
        if (priority) {
          const { message, actionRequired } = createAlertMessage(
            employee.name,
            config.arabicName,
            daysRemaining,
            priority
          )

          alerts.push({
            id: `${config.alertType}_${employee.id}_${expiryDate}`,
            entityType: 'employee',
            entityId: employee.id,
            entityName: employee.name,
            documentType: config.alertType,
            documentTypeArabic: config.arabicName,
            expiryDate,
            daysRemaining,
            priority,
            message,
            actionRequired,
            companyName
          })
        }
      }
    }

    logger.info(`تم إنشاء ${alerts.length} تنبيه للموظفين`)
  } catch (error) {
    logger.error('خطأ في مراقبة تواريخ انتهاء الصلاحية للموظفين:', error)
  }

  return alerts
}

/**
 * إرسال تنبيهات البريد الإلكتروني للتنبيهات العاجلة والهامة
 */
async function sendEmailNotifications(alerts: ExpiryAlert[]): Promise<void> {
  // تجميع التنبيهات العاجلة والهامة فقط
  const criticalAlerts = alerts.filter(
    alert => alert.priority === 'urgent' || alert.priority === 'high'
  )

  if (criticalAlerts.length === 0) {
    logger.debug('لا توجد تنبيهات عاجلة أو هامة لإرسال ملخص يومي')
    return
  }

  // حارس التكرار: لا ترسل نفس السجل خلال 24 ساعة
  const SETTING_KEY = 'expiry_digest_last_sent'
  const { data: settingRows, error: settingError } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .limit(1)
  if (settingError) {
    logger.warn('تعذر قراءة سجل الإرسال السابق للملخص اليومي:', settingError)
  }
  const sentMap: Record<string, string> = (() => {
    try {
      const raw = settingRows?.[0]?.setting_value as string | undefined
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })()

  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000
  const eligibleAlerts = criticalAlerts.filter(a => {
    const last = sentMap[a.id]
    if (!last) return true
    return (now - new Date(last).getTime()) >= DAY_MS
  })

  if (eligibleAlerts.length === 0) {
    logger.info('كل التنبيهات العاجلة/الهامة تم إشعارها خلال آخر 24 ساعة — لا إرسال جديد')
    return
  }

  // إنشاء قالب «الملخص اليومي»
  const buildDigestTable = (items: ExpiryAlert[], title: string) => {
    const rows = items.map(item => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.entityType === 'employee' ? item.entityName : (item.companyName || item.entityName)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.documentTypeArabic}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${new Date(item.expiryDate).toLocaleDateString('ar-SA')}</td>
      </tr>
    `).join('')
    return `
      <h3 style="margin:16px 0 8px;color:#1f2937;">${title}</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;text-align:right;">
            <th style="padding:10px;border-bottom:1px solid #e5e7eb;">الاسم</th>
            <th style="padding:10px;border-bottom:1px solid #e5e7eb;">نوع المستند</th>
            <th style="padding:10px;border-bottom:1px solid #e5e7eb;">تاريخ الانتهاء</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
  }

  const employeeItems = eligibleAlerts.filter(a => a.entityType === 'employee')
  const companyItems = eligibleAlerts.filter(a => a.entityType === 'company')

  const header = `
    <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;padding:20px;text-align:center;border-radius:8px;">
      <h2 style="margin:0;font-size:22px;">📬 الملخص اليومي للتنبيهات</h2>
      <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}</p>
    </div>
  `

  const sections = [
    employeeItems.length ? buildDigestTable(employeeItems, 'تنبيهات الموظفين') : '',
    companyItems.length ? buildDigestTable(companyItems, 'تنبيهات الشركات') : ''
  ].filter(Boolean).join('\n')

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
        <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);padding:20px;">
          ${header}
          <p style="margin:16px 0;color:#374151;font-size:14px;">يتضمن هذا الملخص جميع التنبيهات العاجلة والهامة خلال آخر فحص.</p>
          ${sections || '<p style="color:#6b7280;">لا توجد تنبيهات حالياً.</p>'}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">هذا بريد آلي من نظام SAW Tracker</p>
        </div>
      </body>
    </html>
  `

  const textContent = [
    '📬 الملخص اليومي للتنبيهات',
    `تاريخ الإرسال: ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}`,
    '',
    ...eligibleAlerts.map(a => `- ${(a.entityType === 'employee') ? a.entityName : (a.companyName || a.entityName)} | ${a.documentTypeArabic} | ${new Date(a.expiryDate).toLocaleDateString('ar-SA')}`)
  ].join('\n')

  const subject = `📬 Daily Digest: ${eligibleAlerts.length} تنبيه`

  // تأخير 600ms احتراماً لمعدل Resend
  await new Promise(res => setTimeout(res, 600))

  // إرسال بريد واحد إلى المسؤول الأساسي المطلوب
  const adminEmail = 'ahmad.alsawy159@gmail.com'
  const enqueueResult = await enqueueEmail({
    toEmails: [adminEmail],
    subject,
    htmlContent,
    textContent,
    priority: 'high'
  })

  if (!enqueueResult.success) {
    logger.error('فشل إضافة الملخص اليومي إلى قائمة الانتظار:', enqueueResult.error)
    return
  }

  // تحديث سجل الإرسال لمنع التكرار خلال 24 ساعة
  const updatedSentMap = { ...sentMap }
  const isoNow = new Date().toISOString()
  for (const a of eligibleAlerts) {
    updatedSentMap[a.id] = isoNow
  }
  const { error: upsertError } = await supabase
    .from('system_settings')
    .upsert({ setting_key: SETTING_KEY, setting_value: JSON.stringify(updatedSentMap), updated_at: isoNow }, { onConflict: 'setting_key' })
    .select()
  if (upsertError) {
    logger.warn('تعذر تحديث سجل الإرسال للملخص اليومي:', upsertError)
  }

  logger.info(`تم إضافة بريد واحد للملخص اليومي بعدد عناصر: ${eligibleAlerts.length}`)
}

// ========================
// الدالة الرئيسية
// ========================

/**
 * تشغيل مراقبة شاملة لجميع تواريخ انتهاء الصلاحية
 * 
 * هذه الدالة الرئيسية التي يجب استدعاؤها من Cron Job
 * تقوم بمراقبة جميع الشركات والموظفين وإرسال التنبيهات
 */
export async function runComprehensiveExpiryMonitoring(): Promise<{
  companyAlerts: ExpiryAlert[]
  employeeAlerts: ExpiryAlert[]
  totalAlerts: number
  criticalAlerts: number
}> {
  logger.info('بدء المراقبة الشاملة لتواريخ انتهاء الصلاحية')
  
  try {
    // مراقبة الشركات والموظفين بشكل متوازي
    const [companyAlerts, employeeAlerts] = await Promise.all([
      monitorCompanyExpiryDates(),
      monitorEmployeeExpiryDates()
    ])

    // دمج جميع التنبيهات
    const allAlerts = [...companyAlerts, ...employeeAlerts]
    const criticalAlerts = allAlerts.filter(
      alert => alert.priority === 'urgent' || alert.priority === 'high'
    )

    // إرسال ملخص يومي واحد بالبريد
    await sendEmailNotifications(allAlerts)

    logger.info(
      `اكتملت المراقبة الشاملة: إجمالي ${allAlerts.length} تنبيه (${criticalAlerts.length} عاجل/هام)`
    )

    return {
      companyAlerts,
      employeeAlerts,
      totalAlerts: allAlerts.length,
      criticalAlerts: criticalAlerts.length
    }
  } catch (error) {
    logger.error('خطأ في المراقبة الشاملة لتواريخ انتهاء الصلاحية:', error)
    throw error
  }
}

// تصدير الدوال المساعدة للاستخدام الخارجي
export {
  monitorCompanyExpiryDates,
  monitorEmployeeExpiryDates,
  sendEmailNotifications,
  type ExpiryAlert,
  type ExpiryMonitorConfig
}
