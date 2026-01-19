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
    fieldName: 'social_insurance_expiry',
    arabicName: 'التأمينات الاجتماعية',
    alertType: 'social_insurance_expiry',
    thresholdKeys: {
      urgent: 'social_insurance_urgent_days',
      high: 'social_insurance_high_days',
      medium: 'social_insurance_medium_days'
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
  // تصفية التنبيهات العاجلة والهامة فقط
  const criticalAlerts = alerts.filter(
    alert => alert.priority === 'urgent' || alert.priority === 'high'
  )

  if (criticalAlerts.length === 0) {
    logger.debug('لا توجد تنبيهات عاجلة أو هامة لإرسال البريد الإلكتروني')
    return
  }

  // البريد الإلكتروني للمسؤول
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'admin@example.com'

  // إرسال بريد إلكتروني لكل تنبيه
  const emailPromises = criticalAlerts.map(async alert => {
    try {
      const priorityColor = alert.priority === 'urgent' ? '#dc2626' : '#ea580c'
      const priorityEmoji = alert.priority === 'urgent' ? '🚨' : '⚠️'
      const priorityText = alert.priority === 'urgent' ? 'عاجل' : 'هام'
      
      const subject = `${priorityEmoji} تنبيه ${priorityText}: ${alert.documentTypeArabic} - ${alert.entityName}`
      
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, ${priorityColor}, ${alert.priority === 'urgent' ? '#991b1b' : '#c2410c'}); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">
                ${priorityEmoji} تنبيه ${priorityText}
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">
                ${alert.documentTypeArabic}
              </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
              <!-- Entity Info -->
              <div style="background-color: #f9fafb; border-right: 4px solid ${priorityColor}; padding: 20px; margin-bottom: 20px; border-radius: 5px;">
                <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 20px;">
                  معلومات الكيان
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">النوع:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${alert.entityType === 'company' ? 'شركة' : 'موظف'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">الاسم:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${alert.entityName}</td>
                  </tr>
                  ${alert.companyName ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">الشركة:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${alert.companyName}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">نوع المستند:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${alert.documentTypeArabic}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Alert Message -->
              <div style="background-color: ${alert.priority === 'urgent' ? '#fef2f2' : '#fff7ed'}; border: 2px solid ${priorityColor}; padding: 20px; margin-bottom: 20px; border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: ${priorityColor}; font-size: 18px;">
                  📋 الرسالة
                </h3>
                <p style="margin: 0; color: #374151; line-height: 1.6; font-size: 16px;">
                  ${alert.message}
                </p>
              </div>
              
              <!-- Expiry Info -->
              <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                <div style="flex: 1; background-color: #f3f4f6; padding: 15px; border-radius: 5px; text-align: center;">
                  <div style="color: #6b7280; font-size: 14px; margin-bottom: 5px;">تاريخ الانتهاء</div>
                  <div style="color: #1f2937; font-size: 18px; font-weight: bold;">${new Date(alert.expiryDate).toLocaleDateString('ar-SA')}</div>
                </div>
                <div style="flex: 1; background-color: ${alert.priority === 'urgent' ? '#fef2f2' : '#fff7ed'}; padding: 15px; border-radius: 5px; text-align: center;">
                  <div style="color: #6b7280; font-size: 14px; margin-bottom: 5px;">الأيام المتبقية</div>
                  <div style="color: ${priorityColor}; font-size: 24px; font-weight: bold;">
                    ${alert.daysRemaining >= 0 ? alert.daysRemaining : `(منتهي منذ ${Math.abs(alert.daysRemaining)} يوم)`}
                  </div>
                </div>
              </div>
              
              <!-- Action Required -->
              <div style="background-color: #eff6ff; border-right: 4px solid #3b82f6; padding: 20px; margin-bottom: 20px; border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 18px;">
                  ✅ الإجراء المطلوب
                </h3>
                <p style="margin: 0; color: #374151; line-height: 1.6; font-size: 16px;">
                  ${alert.actionRequired}
                </p>
              </div>
              
              <!-- Footer Note -->
              <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                  هذا تنبيه آلي من نظام SAW Tracker<br>
                  يرجى اتخاذ الإجراء اللازم في أقرب وقت ممكن
                </p>
                <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 12px;">
                  تاريخ الإرسال: ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      const textContent = `
${priorityEmoji} تنبيه ${priorityText}: ${alert.documentTypeArabic}

معلومات الكيان:
- النوع: ${alert.entityType === 'company' ? 'شركة' : 'موظف'}
- الاسم: ${alert.entityName}
${alert.companyName ? `- الشركة: ${alert.companyName}` : ''}
- نوع المستند: ${alert.documentTypeArabic}

الرسالة:
${alert.message}

تاريخ الانتهاء: ${new Date(alert.expiryDate).toLocaleDateString('ar-SA')}
الأيام المتبقية: ${alert.daysRemaining >= 0 ? alert.daysRemaining : `(منتهي منذ ${Math.abs(alert.daysRemaining)} يوم)`}

الإجراء المطلوب:
${alert.actionRequired}

---
هذا تنبيه آلي من نظام SAW Tracker
تاريخ الإرسال: ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}
      `.trim()

      await enqueueEmail({
        toEmails: [adminEmail],
        subject,
        htmlContent,
        textContent,
        priority: alert.priority
      })

      logger.debug(`تم إضافة بريد إلكتروني إلى قائمة الانتظار: ${alert.id}`)
    } catch (emailError) {
      logger.error(`فشل إضافة بريد إلكتروني لتنبيه ${alert.id}:`, emailError)
      // استمر في معالجة التنبيهات الأخرى حتى لو فشل واحد
    }
  })

  // انتظار جميع وعود البريد الإلكتروني
  await Promise.allSettled(emailPromises)
  
  logger.info(`تم إرسال ${criticalAlerts.length} بريد إلكتروني للتنبيهات العاجلة والهامة`)
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

    // إرسال تنبيهات البريد الإلكتروني
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
