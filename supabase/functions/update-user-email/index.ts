import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // إنشاء عميل Supabase للتحقق من المستخدم الحالي
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // التحقق من المستخدم الحالي
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !currentUser) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من صلاحية تحديث بريد إلكتروني للمستخدمين
    const { data: currentUserData, error: userError } = await supabase
      .from('users')
      .select('role, permissions, is_active')
      .eq('id', currentUser.id)
      .single()

    if (userError || !currentUserData || !currentUserData.is_active) {
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'User is not active' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // إذا كان مدير → السماح
    const isAdmin = currentUserData.role === 'admin' && currentUserData.is_active
    
    // إذا لم يكن مدير → التحقق من الصلاحية
    if (!isAdmin) {
      const permissions = currentUserData.permissions || {}
      const canEdit = permissions?.users?.edit === true
      if (!canEdit) {
        return new Response(
          JSON.stringify({ error: { code: 'FORBIDDEN', message: 'You do not have permission to update user emails' } }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // قراءة بيانات الطلب
    const { user_id, new_email } = await req.json()

    // التحقق من البيانات المطلوبة
    if (!user_id || !new_email) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: user_id, new_email' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من صيغة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(new_email)) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من وجود المستخدم
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', user_id)
      .single()

    if (targetUserError || !targetUser) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'User not found' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من عدم استخدام البريد الجديد من قبل مستخدم آخر
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', new_email)
      .neq('id', user_id)
      .single()

    if (!checkError && existingUser) {
      return new Response(
        JSON.stringify({ error: { code: 'CONFLICT', message: 'Email already in use by another user' } }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // استخدام service_role لتحديث البريد الإلكتروني
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // تحديث البريد الإلكتروني في auth.users
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { email: new_email }
    )

    if (updateAuthError) {
      return new Response(
        JSON.stringify({ error: { code: 'UPDATE_ERROR', message: updateAuthError.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // تحديث البريد الإلكتروني في public.users
    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({ email: new_email })
      .eq('id', user_id)

    if (updateUserError) {
      return new Response(
        JSON.stringify({ error: { code: 'UPDATE_ERROR', message: updateUserError.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Email updated successfully',
        user_id: user_id,
        new_email: new_email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error in update-user-email function:', error)
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
