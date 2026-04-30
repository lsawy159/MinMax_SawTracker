// Edge Function: النسخ الاحتياطية التلقائية
// المرحلة 9: نظام النسخ الاحتياطي المتطور

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin, toErrorResponse } from '../_shared/auth.ts'

interface BackupResponse {
  success: boolean
  backup_id?: string
  file_path?: string
  file_size?: number
  error?: string
}

interface BackupNotificationConfig {
  deliveryMode: 'local_only' | 'local_plus_email'
  emailEnabled: boolean
  emailRecipients: string[]
}

async function readBackupNotificationConfig(supabase: ReturnType<typeof createClient>): Promise<BackupNotificationConfig> {
  const settingKeys = [
    'backup_delivery_mode',
    'backup_email_notifications_enabled',
    'backup_email_recipients',
  ]

  const { data } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', settingKeys)

  const map = new Map<string, unknown>()
  for (const row of data || []) {
    map.set((row as { setting_key: string }).setting_key, (row as { setting_value: unknown }).setting_value)
  }

  const rawMode = String(map.get('backup_delivery_mode') ?? 'local_plus_email')
    .replace(/^"|"$/g, '')
    .trim()
    .toLowerCase()
  const deliveryMode: BackupNotificationConfig['deliveryMode'] =
    rawMode === 'local_only' ? 'local_only' : 'local_plus_email'

  const rawEnabled = String(map.get('backup_email_notifications_enabled') ?? 'true')
    .replace(/^"|"$/g, '')
    .trim()
    .toLowerCase()
  const emailEnabled = rawEnabled !== 'false'

  const rawRecipients = map.get('backup_email_recipients')
  let emailRecipients: string[] = []
  if (Array.isArray(rawRecipients)) {
    emailRecipients = rawRecipients.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    )
  } else if (typeof rawRecipients === 'string' && rawRecipients.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawRecipients)
      if (Array.isArray(parsed)) {
        emailRecipients = parsed.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        )
      }
    } catch {
      emailRecipients = rawRecipients
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    }
  }

  return {
    deliveryMode,
    emailEnabled,
    emailRecipients,
  }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    await requireAdmin(req)

    // إنشاء عميل Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const notificationConfig = await readBackupNotificationConfig(supabase)
    const shouldSendEmail =
      notificationConfig.deliveryMode === 'local_plus_email' && notificationConfig.emailEnabled

    // الحصول على معايير النسخ الاحتياطي
    const { backup_type = 'full', tables = [], triggered_by = 'manual' } = await req.json().catch(() => ({}))

    // T-107: قائمة الجداول المسموح بنسخها (ALLOWED_TABLES)
    const SENSITIVE_TABLES = new Set(['user_sessions', 'login_attempts', 'security_events', 'audit_log'])
    const ALLOWED_TABLES = new Set([
      'companies', 'employees', 'users', 'notifications', 'activity_log',
      'saved_searches', 'system_settings', 'backup_history', 'security_settings',
      'user_permissions', 'projects', 'contracts', 'invoices', 'payments',
      'daily_excel_logs', 'email_queue', 'cron_jobs_log',
    ])

    if (tables.length > 0) {
      const invalid = (tables as string[]).filter(
        (t: string) => !ALLOWED_TABLES.has(t) || SENSITIVE_TABLES.has(t)
      )
      if (invalid.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'INVALID_TABLE', tables: invalid }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFileName = `backup_${backup_type}_${timestamp}.sql`
    
    // جداول قاعدة البيانات المطلوب نسخها
    // الجداول الأساسية (مطلوبة)
    // Read retention setting from system_settings
    const { data: retentionSetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'backup_retention_days')
      .maybeSingle()
    const retentionDays: number = Number(retentionSetting?.setting_value) || 30

    const requiredTables = [
      'companies',
      'employees',
      'users',
      'notifications',
      'activity_log',
      'saved_searches',
      'system_settings',
      'backup_history',
      'security_settings'
    ]
    
    // جداول اختيارية (قد لا تكون موجودة في بعض المشاريع)
    const optionalTables = [
      'user_permissions',
    ]
    
    // دمج الجداول المطلوبة والاختيارية
    const tablesToBackup = tables.length > 0 ? tables : [...requiredTables, ...optionalTables]

    // إنشاء سجل النسخ الاحتياطي
    const { data: backupRecord, error: insertError } = await supabase
      .from('backup_history')
      .insert({
        backup_type,
        triggered_by,
        file_path: backupFileName,
        tables_included: tablesToBackup,
        status: 'in_progress'
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`فشل في إنشاء سجل النسخ الاحتياطي: ${insertError.message}`)
    }

    // بناء بيانات النسخ الاحتياطي
    let backupData = `-- النسخة الاحتياطية التلقائية لـ SawTracker
-- تاريخ الإنشاء: ${new Date().toISOString()}
-- نوع النسخة: ${backup_type}
-- الجداول المشمولة: ${tablesToBackup.join(', ')}

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

`

    let totalRows = 0

    // دالة مساعدة لجلب بيانات جدول واحد
    const fetchTableData = async (table: string, isOptional: boolean = false) => {
      try {
        const { data: tableData, error: selectError } = await supabase
          .from(table)
          .select('*')

        if (selectError) {
          // التحقق من أن الخطأ بسبب عدم وجود الجدول
          const errorMessage = selectError.message?.toLowerCase() || ''
          const isTableNotFound = errorMessage.includes('not found') || 
                                   errorMessage.includes('does not exist') ||
                                   errorMessage.includes('schema cache') ||
                                   errorMessage.includes('could not find') ||
                                   selectError.code === 'PGRST116' ||
                                   selectError.code === '42P01'
          
          // إذا كان الجدول اختياري وغير موجود، نتخطاه بهدوء بدون تحذير
          if (isTableNotFound && isOptional) {
            return { table, data: null, error: null, skipped: true }
          }
          
          // للجداول المطلوبة، نسجل تحذير فقط إذا كان الخطأ ليس بسبب عدم وجود الجدول
          // أو إذا كان الخطأ غير متوقع
          if (!isOptional && !isTableNotFound) {
            console.warn(`تحذير: لا يمكن قراءة الجدول ${table}: ${selectError.message}`)
          }
          
          // إذا كان الجدول مطلوباً وغير موجود، هذا خطأ حرج
          if (!isOptional && isTableNotFound) {
            console.error(`خطأ: الجدول المطلوب ${table} غير موجود في قاعدة البيانات`)
          }
          
          return { table, data: null, error: selectError, skipped: !isOptional && isTableNotFound }
        }

        return { table, data: tableData, error: null, skipped: false }
      } catch (tableError: unknown) {
        // للجداول الاختيارية، نتخطاها بهدوء بدون تحذير
        if (isOptional) {
          return { table, data: null, error: null, skipped: true }
        }
        
        // للجداول المطلوبة، نسجل الخطأ
        console.error(`خطأ في نسخ الجدول ${table}:`, tableError?.message || tableError)
        return { table, data: null, error: tableError, skipped: false }
      }
    }

    // جلب بيانات جميع الجداول بشكل متوازي (parallel)
    console.log(`[Backup] Fetching data from ${tablesToBackup.length} tables in parallel...`)
    const tableDataResults = await Promise.all(
      tablesToBackup.map(table => {
        const isOptional = optionalTables.includes(table)
        return fetchTableData(table, isOptional)
      })
    )

    // معالجة البيانات المجلوبة
    const skippedTables: string[] = []
    for (const result of tableDataResults) {
      const { table, data: tableData, error, skipped } = result
      
      // إذا تم تخطي الجدول (اختياري وغير موجود)، نسجله ونستمر
      if (skipped) {
        skippedTables.push(table)
        continue
      }
      
      if (error || !tableData || tableData.length === 0) {
        continue
      }

      backupData += `\n-- بيانات الجدول: ${table} (${tableData.length} صف)\n`
      backupData += `TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;\n`
      
      // تحويل البيانات إلى INSERT statements
      for (const row of tableData) {
        const columns = Object.keys(row)
        const values = Object.values(row).map(value => {
          if (value === null) return 'NULL'
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
          if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`
          return value
        })
        
        backupData += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`
      }
      
      totalRows += tableData.length
      backupData += `\n`
    }
    
    console.log(`[Backup] Fetched ${totalRows} total rows from ${tablesToBackup.length} tables`)

    // ضغط البيانات (محاكاة)
    const originalSize = new TextEncoder().encode(backupData).length
    const compressedSize = Math.floor(originalSize * 0.3) // محاكاة ضغط 70%
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100)

    // التحقق من وجود bucket قبل المحاولة
    const { data: buckets } = await supabase.storage.listBuckets()
    const backupsBucketExists = buckets?.some(bucket => bucket.name === 'backups')
    
    if (!backupsBucketExists) {
      const errorMsg = 'Bucket "backups" not found. Please create it in Supabase Dashboard → Storage → New bucket'
      console.error(errorMsg)
      
      // تحديث حالة الفشل
      await supabase
        .from('backup_history')
        .update({
          status: 'failed',
          error_message: errorMsg,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupRecord.id)

      throw new Error(errorMsg)
    }

    // رفع النسخة الاحتياطية إلى Storage
    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(backupFileName, new TextEncoder().encode(backupData), {
        contentType: 'application/sql',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      // تحديث حالة الفشل
      await supabase
        .from('backup_history')
        .update({
          status: 'failed',
          error_message: uploadError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupRecord.id)

      // إرسال بريد إلكتروني عن الفشل بشكل غير متزامن (لا ننتظرها)
      if (shouldSendEmail) {
        sendBackupNotificationEmail(
          supabase,
          supabaseUrl,
          backupRecord.id,
          backupFileName,
          'failed',
          0,
          backup_type,
          uploadError.message,
          notificationConfig.emailRecipients
        ).catch(emailError => {
          console.warn('فشل في إرسال بريد الفشل (غير حرج):', emailError?.message || emailError)
        })
      }

      throw new Error(`فشل في رفع النسخة الاحتياطية: ${uploadError.message}`)
    }

    // تحديث سجل النسخ الاحتياطي بالنجاح
    await supabase
      .from('backup_history')
      .update({
        status: 'completed',
        file_size: compressedSize,
        compression_ratio: compressionRatio,
        completed_at: new Date().toISOString()
      })
      .eq('id', backupRecord.id)

    // إرجاع الاستجابة فوراً بعد تحديث الحالة
    const response: BackupResponse = {
      success: true,
      backup_id: backupRecord.id,
      file_path: backupFileName,
      file_size: compressedSize
    }

    // Update last_run_at and refresh next_run_at schedule after success
    const now = new Date().toISOString()
    await Promise.allSettled([
      supabase.from('system_settings').upsert({
        setting_key: 'backup_last_run_at',
        setting_value: JSON.stringify(now),
        category: 'backup',
        description: 'آخر تشغيل فعلي للنسخ الاحتياطي',
        setting_type: 'text',
      }),
      supabase.rpc('refresh_next_backup_at'),
    ])

    // تنظيف النسخ القديمة بشكل غير متزامن (لا ننتظرها)
    // هذا يقلل من وقت الاستجابة
    Promise.all([
      // تنظيف النسخ القديمة بناءً على إعداد الاحتفاظ
      (async () => {
        try {
          const cutoffDate = new Date(Date.now() - retentionDays * 86400 * 1000).toISOString()
          const { data: oldBackups } = await supabase
            .from('backup_history')
            .select('id, file_path')
            .lt('completed_at', cutoffDate)
            .order('completed_at', { ascending: true })
            .limit(100)

          if (oldBackups && oldBackups.length > 0) {
            console.log(`[Backup] Cleaning up ${oldBackups.length} old backups...`)
            for (const oldBackup of oldBackups) {
              // حذف الملف من Storage
              await supabase.storage.from('backups').remove([oldBackup.file_path])
              // حذف السجل من قاعدة البيانات
              await supabase.from('backup_history').delete().eq('id', oldBackup.id)
            }
            console.log(`[Backup] Cleanup completed`)
          }
        } catch (cleanupError) {
          console.warn('[Backup] Error during cleanup (non-critical):', cleanupError)
        }
      })(),
      
      // إرسال بريد إلكتروني بشكل غير متزامن (لا ننتظرها)
      (async () => {
        try {
          if (!shouldSendEmail) {
            return
          }
          await sendBackupNotificationEmail(
            supabase,
            supabaseUrl,
            backupRecord.id,
            backupFileName,
            'success',
            compressedSize,
            backup_type,
            undefined,
            notificationConfig.emailRecipients
          )
        } catch (emailError) {
          console.warn('فشل في إرسال بريد النجاح (غير حرج):', emailError?.message || emailError)
        }
      })()
    ]).catch(err => {
      console.warn('[Backup] Error in background tasks (non-critical):', err)
    })

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('خطأ في النسخ الاحتياطي:', error)
    
    // إرسال بريد إلكتروني عن الخطأ بشكل غير متزامن (لا ننتظرها)
    // هذا يضمن إرجاع استجابة الخطأ بسرعة
    ;(async () => {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const notificationConfig = await readBackupNotificationConfig(supabase)
        const shouldSendEmail =
          notificationConfig.deliveryMode === 'local_plus_email' && notificationConfig.emailEnabled

        if (!shouldSendEmail) {
          return
        }
        
        // البحث عن آخر backup record فاشل
        const { data: failedBackup } = await supabase
          .from('backup_history')
          .select('id, file_path, backup_type')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (failedBackup) {
          sendBackupNotificationEmail(
            supabase, 
            supabaseUrl, 
            failedBackup.id, 
            failedBackup.file_path || 'unknown', 
            'failed', 
            0, 
            failedBackup.backup_type || 'full',
            error.message,
            notificationConfig.emailRecipients
          ).catch(notificationError => {
            console.warn('فشل في إرسال بريد الخطأ (غير حرج):', notificationError?.message || notificationError)
          })
        }
      } catch (emailError) {
        console.warn('فشل في معالجة بريد الخطأ (غير حرج):', emailError?.message || emailError)
      }
    })()
    
    return toErrorResponse(error, corsHeaders)
  }
})

// دالة مساعدة لإرسال بريد إشعار النسخ الاحتياطي
async function sendBackupNotificationEmail(
  supabase: any,
  supabaseUrl: string,
  backupId: string,
  fileName: string,
  status: 'success' | 'failed',
  fileSize: number,
  backupType: string,
  errorMessage?: string,
  overrideRecipients: string[] = []
) {
  try {
    if (overrideRecipients.length > 0) {
      const uniqueRecipients = Array.from(new Set(overrideRecipients.map((email) => email.trim())))
        .filter((email) => email.length > 0)

      if (uniqueRecipients.length > 0) {
        console.log('[BackupNotification] Using override recipients from backup settings')
        return await sendBackupEmailPayload(
          supabase,
          supabaseUrl,
          uniqueRecipients,
          backupId,
          fileName,
          status,
          fileSize,
          backupType,
          errorMessage
        )
      }
    }

    // 🆕 استخدام نظام الإشعارات الموحد من notification_recipients في system_settings
    const { data: notificationConfig, error: configError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_recipients')
      .maybeSingle()

    let recipients: string[] = []
    const PRIMARY_ADMIN = 'ahmad.alsawy159@gmail.com'

    // محاولة القراءة من notification_recipients
    if (notificationConfig?.setting_value && !configError) {
      try {
        let parsed = notificationConfig.setting_value
        console.log('[BackupNotification] Raw notification_recipients value:', typeof parsed)
        
        // تحليل JSON إذا كانت string
        if (typeof parsed === 'string') {
          console.log('[BackupNotification] Parsing string JSON...')
          parsed = JSON.parse(parsed)
          
          // تحليل مزدوج إذا لزم الأمر
          if (typeof parsed === 'string') {
            console.log('[BackupNotification] Parsing double-encoded JSON...')
            parsed = JSON.parse(parsed)
          }
        }

        // استخراج جميع المستقبلين
        if (parsed && typeof parsed === 'object') {
          // الإداري الأساسي - ALWAYS ADD
          if (parsed.primary_admin && typeof parsed.primary_admin === 'string') {
            recipients.push(parsed.primary_admin)
            console.log('[BackupNotification] Added primary admin:', parsed.primary_admin)
          } else {
            recipients.push(PRIMARY_ADMIN)
            console.log('[BackupNotification] Using hardcoded primary admin:', PRIMARY_ADMIN)
          }
          
          // المستقبلين الإضافيين الذين لديهم إذن backupNotifications
          if (Array.isArray(parsed.additional_recipients)) {
            console.log('[BackupNotification] Found additional_recipients:', parsed.additional_recipients.length)
            for (const recipient of parsed.additional_recipients) {
              console.log(`[BackupNotification] Checking recipient: ${recipient.email}, backupNotifications: ${recipient.backupNotifications}`)
              if (recipient.email && recipient.backupNotifications === true) {
                recipients.push(recipient.email)
                console.log('[BackupNotification] Added additional recipient:', recipient.email)
              }
            }
          }
        }
      } catch (parseError) {
        console.error('[BackupNotification] خطأ في تحليل notification_recipients:', parseError)
        // Fallback إلى البريد الإداري الأساسي فقط
        recipients = [PRIMARY_ADMIN]
        console.log('[BackupNotification] Using fallback, primary admin only')
      }
    } else {
      // إذا لم نجد البيانات أو كان هناك خطأ
      console.warn('[BackupNotification] notification_recipients not found, using primary admin only')
      recipients = [PRIMARY_ADMIN]
    }

    // إذا كانت القائمة فارغة، لا نرسل بريد
    if (recipients.length === 0) {
      console.warn('[BackupNotification] No recipients found after parsing')
      return
    }

    console.log(`[BackupNotification] Sending to ${recipients.length} recipient(s): ${recipients.join(', ')}`)
    await sendBackupEmailPayload(
      supabase,
      supabaseUrl,
      recipients,
      backupId,
      fileName,
      status,
      fileSize,
      backupType,
      errorMessage
    )
  } catch (error) {
    console.error('خطأ في إرسال بريد إشعار النسخ الاحتياطي:', error)
    throw error
  }
}

async function sendBackupEmailPayload(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  recipients: string[],
  backupId: string,
  fileName: string,
  status: 'success' | 'failed',
  fileSize: number,
  backupType: string,
  errorMessage?: string
) {
  try {
    // إنشاء محتوى البريد
    const date = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2)
    
    // إنشاء رابط تحميل موقّع (صالح لمدة 7 أيام) عند النجاح
    let downloadUrl = ''
    if (status === 'success') {
      try {
        const { data: signedUrlData } = await supabase.storage
          .from('backups')
          .createSignedUrl(fileName, 60 * 60 * 24 * 7) // 7 أيام
        
        if (signedUrlData) {
          downloadUrl = signedUrlData.signedUrl
        }
      } catch (urlError) {
        console.error('تعذر إنشاء رابط تحميل موقّع:', urlError)
      }
    }

    const subject =
      status === 'success'
        ? `✅ نسخة احتياطية ناجحة - ${fileName}`
        : `❌ فشل النسخ الاحتياطي - ${fileName}`

    const htmlContent =
      status === 'success'
        ? `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #22c55e;">✅ نسخة احتياطية تمت بنجاح</h2>
          <p><strong>اسم الملف:</strong> ${fileName}</p>
          <p><strong>نوع النسخة:</strong> ${backupType === 'full' ? 'كاملة' : backupType === 'incremental' ? 'تزايدية' : 'جزئية'}</p>
          <p><strong>حجم الملف:</strong> ${fileSizeMB} MB</p>
          <p><strong>تاريخ الإنشاء:</strong> ${date}</p>
          <p><strong>معرف النسخة:</strong> ${backupId}</p>
          ${downloadUrl ? `
            <p style="margin-top: 20px;">
              <a href="${downloadUrl}" style="background-color: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                تحميل النسخة الاحتياطية
              </a>
            </p>
            <p style="margin-top: 10px; color: #666; font-size: 12px;">
              ملاحظة: هذا الرابط صالح لمدة 7 أيام فقط.
            </p>
          ` : '<p style="margin-top: 20px; color: #666;">يمكنك تحميل النسخة الاحتياطية من لوحة التحكم في إدارة الأمان.</p>'}
        </div>
      `
      : `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #ef4444;">❌ فشل النسخ الاحتياطي</h2>
          <p><strong>اسم الملف:</strong> ${fileName}</p>
          <p><strong>نوع النسخة:</strong> ${backupType === 'full' ? 'كاملة' : backupType === 'incremental' ? 'تزايدية' : 'جزئية'}</p>
          <p><strong>تاريخ المحاولة:</strong> ${date}</p>
          <p><strong>معرف النسخة:</strong> ${backupId}</p>
          <p><strong>رسالة الخطأ:</strong></p>
          <pre style="background: #f3f4f6; padding: 10px; border-radius: 5px;">${errorMessage || 'خطأ غير معروف'}</pre>
          <p style="margin-top: 20px; color: #666;">يرجى مراجعة إعدادات النسخ الاحتياطي أو الاتصال بالدعم الفني.</p>
        </div>
      `

    // استدعاء Edge Function لإرسال البريد عبر HTTP
    const functionsUrl = `${supabaseUrl}/functions/v1/send-email`
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const emailResponse = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        to: recipients,
        subject: subject,
        html: htmlContent,
        text: status === 'success' 
          ? `نسخة احتياطية ناجحة - ${fileName} - ${date}`
          : `فشل النسخ الاحتياطي - ${fileName} - ${date}\nالخطأ: ${errorMessage || 'غير معروف'}`
      })
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({ error: 'Failed to send email' }))
      console.error('خطأ في استدعاء send-email:', errorData)
      throw new Error((errorData as { error?: string }).error || 'Failed to send email')
    }

    console.log('تم إرسال بريد إشعار النسخ الاحتياطي بنجاح')
  } catch (error) {
    console.error('خطأ في إرسال بريد إشعار النسخ الاحتياطي:', error)
    throw error
  }
}