import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requirePermission, toErrorResponse } from '../_shared/auth.ts'
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // التحقق من صلاحية تحديث البريد الإلكتروني (admin bypass أو users.edit permission)
    await requirePermission(req, 'users', 'edit')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // قراءة بيانات الطلب
    const { user_id, new_email, new_username } = await req.json()

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

    // التحقق من صحة username إذا تم إرساله
    if (new_username && !/^[a-zA-Z0-9_.-]+$/.test(new_username)) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid username format' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // التحقق من تكرار username إذا تم إرساله
    if (new_username) {
      const { data: existingUsername, error: usernameCheckError } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('username', new_username)
        .neq('id', user_id)
        .single()

      if (existingUsername) {
        return new Response(
          JSON.stringify({ error: { code: 'CONFLICT', message: 'Username already in use by another user' } }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
        return new Response(
          JSON.stringify({ error: { code: 'DATABASE_ERROR', message: 'Failed to check username availability' } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // التحقق من وجود المستخدم
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
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
    const { data: existingUser, error: checkError } = await supabaseAdmin
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

    // تحديث البريد الإلكتروني في auth.users
    const authUpdatePayload: { email: string; user_metadata?: Record<string, unknown> } = {
      email: new_email
    }

    if (new_username) {
      authUpdatePayload.user_metadata = { username: new_username }
    }

    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      authUpdatePayload
    )

    if (updateAuthError) {
      return new Response(
        JSON.stringify({ error: { code: 'UPDATE_ERROR', message: updateAuthError.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // تحديث البريد الإلكتروني واسم المستخدم في public.users
    const updatePayload: { email: string; username?: string } = { email: new_email }
    if (new_username) {
      updatePayload.username = new_username
    }

    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
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

  } catch (error: unknown) {
    console.error('Error in update-user-email function:', error)
    return toErrorResponse(error, corsHeaders)
  }
})
