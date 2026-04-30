import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requirePermission, toErrorResponse } from '../_shared/auth.ts'
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts'

function normalizePermissionsPayload(input: unknown): string[] {
  if (!input) {
    return []
  }

  if (Array.isArray(input)) {
    return input
      .filter((value): value is string => typeof value === 'string')
      .filter((value) => /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z][a-zA-Z0-9_]*$/.test(value))
  }

  if (typeof input === 'object' && input !== null) {
    const flattened: string[] = []
    for (const [section, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) {
        continue
      }

      for (const [action, enabled] of Object.entries(value as Record<string, unknown>)) {
        if (enabled === true) {
          flattened.push(`${section}.${action}`)
        }
      }
    }

    return flattened
  }

  return []
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // التحقق من صلاحية إنشاء المستخدمين (admin bypass أو users.create permission)
    await requirePermission(req, 'users', 'create')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // قراءة بيانات الطلب
    const { username, email, password, full_name, role, permissions, is_active } = await req.json()

    // التحقق من البيانات المطلوبة
    if (!username || !email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: username, email, password, full_name' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من صحة username (حروف، أرقام، _ أو - أو . فقط)
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Username must contain only letters, numbers, underscores, or hyphens' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من عدم وجود username مكرر
    const { data: existingUser, error: usernameCheckError } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('username', username)
      .single()

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'اسم المستخدم موجود بالفعل. اختر اسماً آخر.' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({ error: { code: 'DATABASE_ERROR', message: 'Failed to check username availability' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // منع إنشاء مستخدمين بدور admin
    if (role === 'admin') {
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Cannot create users with admin role. Only one admin is allowed.' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (role && role !== 'user' && role !== 'manager') {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid role. Allowed roles: user, manager' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // إنشاء المستخدم في auth.users
    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        username
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
      username,
      email,
      full_name,
      role: role || 'user',
      permissions: normalizePermissionsPayload(permissions),
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

  } catch (error: unknown) {
    console.error('Error in create-user function:', error)
    return toErrorResponse(error, corsHeaders)
  }
})

