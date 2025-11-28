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

    // التحقق من أن المستخدم الحالي هو admin
    const { data: currentUserData, error: userError } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', currentUser.id)
      .single()

    if (userError || !currentUserData || currentUserData.role !== 'admin' || !currentUserData.is_active) {
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // قراءة بيانات الطلب
    const { user_id, new_password } = await req.json()

    // التحقق من البيانات المطلوبة
    if (!user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: user_id, new_password' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من طول كلمة المرور
    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters long' } }),
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

    // استخدام service_role لتغيير كلمة المرور
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // تحديث كلمة المرور في auth.users
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (updateError) {
      return new Response(
        JSON.stringify({ error: { code: 'UPDATE_ERROR', message: updateError.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password updated successfully',
        user_id: user_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in update-user-password function:', error)
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

