import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuth, toErrorResponse } from '../_shared/auth.ts'
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const ctx = await requireAuth(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // قراءة بيانات الطلب
    const { user_id, new_password } = await req.json()

    // إذا كان المستخدم يحاول تحديث كلمة مروره الخاصة → السماح
    const isUpdatingOwnPassword = ctx.userId === user_id
    const isAdmin = ctx.role === 'admin'

    // إذا لم يكن مدير ولا يحدث كلمة مروره الخاصة → التحقق من الصلاحية
    if (!isUpdatingOwnPassword && !isAdmin) {
      const canEdit = ctx.permissions?.['users']?.['edit'] === true
      if (!canEdit) {
        return new Response(
          JSON.stringify({ error: { code: 'FORBIDDEN', message: 'You do not have permission to update user passwords' } }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

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

    // تحديث كلمة المرور في auth.users
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
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

  } catch (error: unknown) {
    console.error('Error in update-user-password function:', error)
    return toErrorResponse(error, corsHeaders)
  }
})

