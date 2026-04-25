// Edge Function: تسجيل العمليات المتطور
// المرحلة 9: نظام تسجيل العمليات مع معلومات الأمان

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ActivityLogRequest {
  entity_type: string
  entity_id: string
  operation: string
  old_data?: any
  new_data?: any
  user_id?: string
  session_id?: string
  details?: string
}

interface SecurityInfo {
  ip_address?: string
  user_agent?: string
  session_id?: string
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // إنشاء عميل Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // استخراج معلومات الأمان من الطلب
    const securityInfo: SecurityInfo = {
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
      session_id: req.headers.get('x-session-id') || undefined
    }

    // قراءة بيانات الطلب
    const requestData: ActivityLogRequest = await req.json()
    const {
      entity_type,
      entity_id,
      operation,
      old_data,
      new_data,
      user_id,
      session_id,
      details
    } = requestData

    // التحقق من المعايير المطلوبة
    if (!entity_type || !operation) {
      return new Response(JSON.stringify({
        success: false,
        error: 'معايير مطلوبة: entity_type, operation'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // حساب الصفوف المتأثرة
    let affectedRows = 1
    if (operation === 'bulk_delete' || operation === 'bulk_update') {
      affectedRows = new_data?.count || old_data?.count || 1
    }

    // تحليل التغييرات للعمليات المهمة
    let changeDetails = details
    if (old_data && new_data && (operation === 'update' || operation === 'modify')) {
      const changes = []
      
      // مقارنة الحقول المهمة
      for (const [key, newValue] of Object.entries(new_data)) {
        const oldValue = old_data[key]
        if (oldValue !== newValue) {
          // إخفاء البيانات الحساسة في السجل
          const sensitiveFields = ['password', 'token', 'secret', 'key', 'bank_account', 'passport_number']
          const isSensitive = sensitiveFields.some(field => key.toLowerCase().includes(field))
          
          changes.push({
            field: key,
            old_value: isSensitive ? '[مشفر]' : oldValue,
            new_value: isSensitive ? '[مشفر]' : newValue
          })
        }
      }
      
      if (changes.length > 0) {
        changeDetails = `تغييرات: ${changes.map(c => `${c.field}: ${c.old_value} → ${c.new_value}`).join(', ')}`
      }
    }

    // تحديد مستوى الخطورة
    let riskLevel = 'low'
    if (['delete', 'bulk_delete', 'admin_action'].includes(operation)) {
      riskLevel = 'high'
    } else if (['update', 'create', 'export'].includes(operation)) {
      riskLevel = 'medium'
    }

    // إدراج سجل النشاط المتطور
    const { error: insertError } = await supabase
      .from('activity_log')
      .insert({
        entity_type,
        entity_id,
        operation,
        old_data: old_data ? JSON.stringify(old_data) : null,
        new_data: new_data ? JSON.stringify(new_data) : null,
        user_id,
        details: changeDetails,
        ip_address: securityInfo.ip_address,
        user_agent: securityInfo.user_agent,
        session_id: session_id || securityInfo.session_id,
        operation_status: 'success',
        affected_rows: affectedRows,
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('خطأ في إدراج سجل النشاط:', insertError)
      return new Response(JSON.stringify({
        success: false,
        error: `فشل في تسجيل النشاط: ${insertError.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // تحديث نشاط الجلسة إذا كانت موجودة
    if (session_id || securityInfo.session_id) {
      await supabase
        .from('user_sessions')
        .update({
          last_activity: new Date().toISOString(),
          ip_address: securityInfo.ip_address
        })
        .eq('session_token', session_id || securityInfo.session_id)
    }

    // تنبيه للعمليات عالية الخطورة
    if (riskLevel === 'high' && user_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id,
          title: 'تنبيه أمني: عملية حساسة',
          message: `تم تنفيذ عملية ${operation} على ${entity_type} من IP: ${securityInfo.ip_address}`,
          priority: 'urgent',
          type: 'security_alert'
        })
    }

    // تنظيف السجلات القديمة (الاحتفاظ بسجلات آخر سنة فقط)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    await supabase
      .from('activity_log')
      .delete()
      .lt('created_at', oneYearAgo.toISOString())

    return new Response(JSON.stringify({
      success: true,
      message: 'تم تسجيل النشاط بنجاح',
      risk_level: riskLevel,
      ip_address: securityInfo.ip_address
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('خطأ في تسجيل النشاط:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})