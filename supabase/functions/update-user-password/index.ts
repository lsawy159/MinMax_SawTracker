import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { requireAuth, toErrorResponse } from '../_shared/auth.ts'
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts'
import { checkRateLimit, getIdentifier, rateLimitHeaders } from '../_shared/rateLimit.ts'
import { logAudit } from '../_shared/audit.ts'

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    // T-110: Rate limiting — max 30 per minute per IP
    const supabaseRl = createClient(
      // @ts-expect-error Deno global
      Deno.env.get('SUPABASE_URL')!,
      // @ts-expect-error Deno global
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const rl = await checkRateLimit(supabaseRl, {
      identifier: getIdentifier(req, 'update-user-password'),
      maxRequests: 30,
    })
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } }),
        { status: 429, headers: { ...corsHeaders, ...rateLimitHeaders(rl.retryAfterSecs), 'Content-Type': 'application/json' } }
      )
    }

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

    // T-208: Validate password against policy (min 8 chars, upper, lower, digit, symbol)
    if (!new_password || new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!/[A-Z]/.test(new_password)) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!/[a-z]/.test(new_password)) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!/\d/.test(new_password)) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(new_password)) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل' } }),
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

    // T-408: Log audit trail for password update
    await logAudit(supabaseAdmin, ctx.userId, {
      entity_type: 'users',
      entity_id: user_id,
      action: 'update',
      changed_fields: {
        password_updated_at: new Date().toISOString(),
        updated_by_self: isUpdatingOwnPassword,
      },
      changes_summary: isUpdatingOwnPassword ? 'Updated own password' : `Admin updated password for user ${user_id}`,
    })

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

