import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { requireAdmin, requireAuth, toErrorResponse, type AuthContext } from '../_shared/auth.ts'
import { corsHeadersWithGet } from '../_shared/cors.ts'

interface SessionRequest {
  action: 'create' | 'validate' | 'terminate' | 'list' | 'terminate_all'
  session_token?: string
  user_id?: string
  device_info?: Record<string, unknown>
}

interface SessionRow {
  id: string
  user_id: string
  device_info: Record<string, unknown> | null
  ip_address: string | null
  location: string | null
  last_activity: string | null
  created_at: string | null
  is_active: boolean
  expires_at: string
}

interface SessionResponse {
  success: boolean
  data?: unknown
  error?: string
}


const parsePayload = async (req: Request): Promise<SessionRequest> => {
  const body = (await req.json()) as Partial<SessionRequest>
  if (!body.action) {
    throw Object.assign(new Error('action is required'), { status: 400, code: 'MISSING_ACTION' })
  }

  return {
    action: body.action,
    session_token: body.session_token,
    user_id: body.user_id,
    device_info: body.device_info,
  }
}

const getServiceClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw Object.assign(new Error('Supabase credentials are not configured'), { status: 500, code: 'SERVER_CONFIG' })
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

const ensureSessionOwner = (ctx: AuthContext, targetUserId: string) => {
  if (ctx.role !== 'admin' && targetUserId !== ctx.userId) {
    throw Object.assign(new Error('Permission denied'), { status: 403, code: 'PERMISSION_DENIED' })
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = corsHeadersWithGet(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = getServiceClient()
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const payload = await parsePayload(req)
    const ctx = await requireAuth(req)

    let response: SessionResponse

    switch (payload.action) {
      case 'create': {
        const targetUserId = payload.user_id ?? ctx.userId
        ensureSessionOwner(ctx, targetUserId)

        const newSessionToken = `${crypto.randomUUID()}-${Date.now()}`
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 8)

        const location = clientIP !== 'unknown' && clientIP !== '127.0.0.1' ? 'تم تحديده من IP' : 'غير محدد'

        const { data: newSession, error: createError } = await supabase
          .from('user_sessions')
          .insert({
            user_id: targetUserId,
            session_token: newSessionToken,
            device_info: payload.device_info || {
              browser: userAgent,
              platform: 'Web',
              created_at: new Date().toISOString(),
            },
            ip_address: clientIP,
            user_agent: userAgent,
            location,
            is_active: true,
            last_activity: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .select('device_info')
          .single<{ device_info: Record<string, unknown> | null }>()

        if (createError) {
          throw new Error(`CREATE_SESSION_FAILED: ${createError.message}`)
        }

        await supabase.from('login_attempts').insert({
          email: 'system',
          ip_address: clientIP,
          user_agent: userAgent,
          attempt_type: 'success',
        })

        response = {
          success: true,
          data: {
            session_token: newSessionToken,
            expires_at: expiresAt.toISOString(),
            device_info: newSession.device_info,
            location,
          },
        }
        break
      }

      case 'validate': {
        if (!payload.session_token) {
          throw Object.assign(new Error('session_token is required'), { status: 400, code: 'MISSING_FIELD' })
        }

        const { data: session, error: validateError } = await supabase
          .from('user_sessions')
          .select('id, user_id, device_info, expires_at, is_active')
          .eq('session_token', payload.session_token)
          .eq('is_active', true)
          .single<SessionRow>()

        if (validateError || !session) {
          response = { success: false, error: 'جلسة غير صحيحة أو منتهية الصلاحية' }
          break
        }

        ensureSessionOwner(ctx, session.user_id)

        const now = new Date()
        const expiryDate = new Date(session.expires_at)

        if (now > expiryDate) {
          await supabase
            .from('user_sessions')
            .update({ is_active: false })
            .eq('id', session.id)

          response = { success: false, error: 'انتهت صلاحية الجلسة' }
          break
        }

        await supabase
          .from('user_sessions')
          .update({
            last_activity: new Date().toISOString(),
            ip_address: clientIP,
          })
          .eq('id', session.id)

        response = {
          success: true,
          data: {
            user_id: session.user_id,
            session_id: session.id,
            last_activity: new Date().toISOString(),
            expires_at: session.expires_at,
            device_info: session.device_info,
          },
        }
        break
      }

      case 'terminate': {
        if (!payload.session_token) {
          throw Object.assign(new Error('session_token is required'), { status: 400, code: 'MISSING_FIELD' })
        }

        const { data: targetSession, error: targetError } = await supabase
          .from('user_sessions')
          .select('id, user_id')
          .eq('session_token', payload.session_token)
          .single<{ id: string; user_id: string }>()

        if (targetError || !targetSession) {
          throw Object.assign(new Error('Session not found'), { status: 404, code: 'SESSION_NOT_FOUND' })
        }

        ensureSessionOwner(ctx, targetSession.user_id)

        const { error: terminateError } = await supabase
          .from('user_sessions')
          .update({
            is_active: false,
            logged_out_at: new Date().toISOString(),
          })
          .eq('id', targetSession.id)

        if (terminateError) {
          throw new Error(`TERMINATE_SESSION_FAILED: ${terminateError.message}`)
        }

        response = {
          success: true,
          data: { message: 'تم إنهاء الجلسة بنجاح' },
        }
        break
      }

      case 'list': {
        const targetUserId = payload.user_id ?? ctx.userId
        ensureSessionOwner(ctx, targetUserId)

        const { data: sessions, error: listError } = await supabase
          .from('user_sessions')
          .select('id, device_info, ip_address, location, last_activity, created_at, is_active')
          .eq('user_id', targetUserId)
          .eq('is_active', true)
          .order('last_activity', { ascending: false })

        if (listError) {
          throw new Error(`LIST_SESSIONS_FAILED: ${listError.message}`)
        }

        response = {
          success: true,
          data: {
            sessions: sessions || [],
            total_active: sessions?.length || 0,
          },
        }
        break
      }

      case 'terminate_all': {
        const targetUserId = payload.user_id ?? ctx.userId
        if (targetUserId !== ctx.userId) {
          await requireAdmin(req)
        }

        const { data: terminatedSessions, error: terminateAllError } = await supabase
          .from('user_sessions')
          .update({
            is_active: false,
            logged_out_at: new Date().toISOString(),
          })
          .eq('user_id', targetUserId)
          .eq('is_active', true)
          .select('id')

        if (terminateAllError) {
          throw new Error(`TERMINATE_ALL_FAILED: ${terminateAllError.message}`)
        }

        response = {
          success: true,
          data: {
            message: 'تم إنهاء جميع الجلسات بنجاح',
            terminated_count: terminatedSessions?.length || 0,
          },
        }
        break
      }

      default:
        throw new Error('Unsupported action')
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return toErrorResponse(error, corsHeaders)
  }
})