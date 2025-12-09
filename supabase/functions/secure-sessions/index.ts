// Edge Function: إدارة الجلسات الآمنة
// المرحلة 9: نظام الجلسات المتعددة مع الأمان

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SessionRequest {
  action: 'create' | 'validate' | 'terminate' | 'list' | 'terminate_all'
  session_token?: string
  user_id?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  device_info?: any
}

interface SessionResponse {
  success: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  error?: string
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

    // استخراج معلومات الأمان
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // قراءة بيانات الطلب
    const requestData: SessionRequest = await req.json()
    const { action, session_token, user_id, device_info } = requestData

    let response: SessionResponse

    switch (action) {
      case 'create': {
        // إنشاء جلسة جديدة
        if (!user_id) {
          throw new Error('معرف المستخدم مطلوب لإنشاء الجلسة')
        }

        // توليد token آمن للجلسة
        const newSessionToken = crypto.randomUUID() + '-' + Date.now()
        
        // مدة انتهاء الجلسة (8 ساعات افتراضياً)
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 8)

        // محاولة تحديد الموقع الجغرافي (محاكاة)
        let location = 'غير محدد'
        try {
          // في الواقع، يمكن استخدام خدمة IP geolocation
          if (clientIP !== 'unknown' && clientIP !== '127.0.0.1') {
            location = 'تم تحديده من IP'
          }
        } catch {
          // تجاهل أخطاء تحديد الموقع
        }

        // إدراج الجلسة الجديدة
        const { data: newSession, error: createError } = await supabase
          .from('user_sessions')
          .insert({
            user_id,
            session_token: newSessionToken,
            device_info: device_info || {
              browser: userAgent,
              platform: 'Web',
              created_at: new Date().toISOString()
            },
            ip_address: clientIP,
            user_agent: userAgent,
            location,
            is_active: true,
            last_activity: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
          })
          .select()
          .single()

        if (createError) {
          throw new Error(`فشل في إنشاء الجلسة: ${createError.message}`)
        }

        // تسجيل محاولة دخول ناجحة
        await supabase
          .from('login_attempts')
          .insert({
            email: 'من النظام', // يمكن تحديث هذا بإيمايل المستخدم
            ip_address: clientIP,
            user_agent: userAgent,
            attempt_type: 'success'
          })

        response = {
          success: true,
          data: {
            session_token: newSessionToken,
            expires_at: expiresAt.toISOString(),
            device_info: newSession.device_info,
            location
          }
        }
        break
      }

      case 'validate': {
        // التحقق من صحة الجلسة
        if (!session_token) {
          throw new Error('رمز الجلسة مطلوب للتحقق')
        }

        const { data: session, error: validateError } = await supabase
          .from('user_sessions')
          .select('*, users(*)')
          .eq('session_token', session_token)
          .eq('is_active', true)
          .single()

        if (validateError || !session) {
          response = {
            success: false,
            error: 'جلسة غير صحيحة أو منتهية الصلاحية'
          }
          break
        }

        // التحقق من انتهاء صلاحية الجلسة
        const now = new Date()
        const expiryDate = new Date(session.expires_at)
        
        if (now > expiryDate) {
          // إنهاء الجلسة المنتهية
          await supabase
            .from('user_sessions')
            .update({ is_active: false })
            .eq('id', session.id)

          response = {
            success: false,
            error: 'انتهت صلاحية الجلسة'
          }
          break
        }

        // تحديث آخر نشاط
        await supabase
          .from('user_sessions')
          .update({
            last_activity: new Date().toISOString(),
            ip_address: clientIP
          })
          .eq('id', session.id)

        response = {
          success: true,
          data: {
            user_id: session.user_id,
            session_id: session.id,
            last_activity: new Date().toISOString(),
            expires_at: session.expires_at,
            device_info: session.device_info
          }
        }
        break
      }

      case 'terminate': {
        // إنهاء جلسة محددة
        if (!session_token) {
          throw new Error('رمز الجلسة مطلوب للإنهاء')
        }

        const { error: terminateError } = await supabase
          .from('user_sessions')
          .update({ 
            is_active: false,
            logged_out_at: new Date().toISOString()
          })
          .eq('session_token', session_token)

        if (terminateError) {
          throw new Error(`فشل في إنهاء الجلسة: ${terminateError.message}`)
        }

        response = {
          success: true,
          data: { message: 'تم إنهاء الجلسة بنجاح' }
        }
        break
      }

      case 'list': {
        // قائمة الجلسات النشطة للمستخدم
        if (!user_id) {
          throw new Error('معرف المستخدم مطلوب لقائمة الجلسات')
        }

        const { data: sessions, error: listError } = await supabase
          .from('user_sessions')
          .select('id, device_info, ip_address, location, last_activity, created_at, is_active')
          .eq('user_id', user_id)
          .eq('is_active', true)
          .order('last_activity', { ascending: false })

        if (listError) {
          throw new Error(`فشل في جلب قائمة الجلسات: ${listError.message}`)
        }

        response = {
          success: true,
          data: {
            sessions: sessions || [],
            total_active: sessions?.length || 0
          }
        }
        break
      }

      case 'terminate_all': {
        // إنهاء جميع الجلسات للمستخدم
        if (!user_id) {
          throw new Error('معرف المستخدم مطلوب لإنهاء جميع الجلسات')
        }

        const { data: terminatedSessions, error: terminateAllError } = await supabase
          .from('user_sessions')
          .update({ 
            is_active: false,
            logged_out_at: new Date().toISOString()
          })
          .eq('user_id', user_id)
          .eq('is_active', true)
          .select('id')

        if (terminateAllError) {
          throw new Error(`فشل في إنهاء جميع الجلسات: ${terminateAllError.message}`)
        }

        response = {
          success: true,
          data: {
            message: 'تم إنهاء جميع الجلسات بنجاح',
            terminated_count: terminatedSessions?.length || 0
          }
        }
        break
      }

      default:
        throw new Error('عملية غير مدعومة')
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('خطأ في إدارة الجلسات:', error)
    
    const errorResponse: SessionResponse = {
      success: false,
      error: error.message
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})