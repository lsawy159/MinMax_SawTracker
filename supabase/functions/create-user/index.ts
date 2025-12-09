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

    // التحقق من صلاحية إنشاء المستخدمين
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
      const canCreate = permissions?.users?.create === true
      if (!canCreate) {
        return new Response(
          JSON.stringify({ error: { code: 'FORBIDDEN', message: 'You do not have permission to create users' } }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // قراءة بيانات الطلب
    const { email, password, full_name, role, permissions, is_active } = await req.json()

    // التحقق من البيانات المطلوبة
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: email, password, full_name' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // منع إنشاء مستخدمين بدور admin
    if (role === 'admin') {
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Cannot create users with admin role. Only one admin is allowed.' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من عدم وجود مدير آخر (للأمان الإضافي)
    const { error: adminCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)

    if (adminCheckError) {
      return new Response(
        JSON.stringify({ error: { code: 'DATABASE_ERROR', message: 'Failed to check existing admins' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // استخدام service_role لإنشاء المستخدم في auth.users
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // إنشاء المستخدم في auth.users
    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // تأكيد البريد تلقائياً
      user_metadata: {
        full_name
      }
    })

    if (createAuthError || !authUser.user) {
      return new Response(
        JSON.stringify({ error: { code: 'CREATE_USER_ERROR', message: createAuthError?.message || 'Failed to create user in auth' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // إنشاء سجل في public.users
    const newUser = {
      id: authUser.user.id,
      email,
      full_name,
      role: role || 'user',
      permissions: permissions || {},
      is_active: is_active !== undefined ? is_active : true
    }

    const { data: createdUser, error: createUserError } = await supabaseAdmin
      .from('users')
      .insert([newUser])
      .select()
      .single()

    if (createUserError) {
      // إذا فشل إنشاء السجل في public.users، نحاول حذف المستخدم من auth.users
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return new Response(
        JSON.stringify({ error: { code: 'CREATE_USER_ERROR', message: createUserError.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user: createdUser
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error in create-user function:', error)
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

