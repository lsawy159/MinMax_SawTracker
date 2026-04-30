import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface PermissionMap {
  [section: string]: {
    [action: string]: boolean
  }
}

export interface AuthContext {
  userId: string
  role: string
  permissions: PermissionMap
}

interface UserRow {
  id: string
  role: string
  is_active: boolean
  permissions: PermissionMap | null
}

interface HttpError extends Error {
  status: number
  code: string
}

const createHttpError = (status: number, code: string, message: string): HttpError => {
  const err = new Error(message) as HttpError
  err.status = status
  err.code = code
  return err
}

const parsePermissions = (value: unknown): PermissionMap => {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const permissions: PermissionMap = {}

  for (const [section, actions] of Object.entries(value as Record<string, unknown>)) {
    if (!actions || typeof actions !== 'object') {
      continue
    }

    permissions[section] = {}
    for (const [action, allowed] of Object.entries(actions as Record<string, unknown>)) {
      permissions[section][action] = allowed === true
    }
  }

  return permissions
}

const getBearerToken = (req: Request): string => {
  const header = req.headers.get('authorization')
  if (!header) {
    throw createHttpError(401, 'NO_TOKEN', 'Missing Authorization header')
  }

  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createHttpError(401, 'INVALID_TOKEN', 'Invalid bearer token format')
  }

  return token
}

const createServiceClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw createHttpError(500, 'SERVER_CONFIG', 'Supabase credentials are not configured')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export const requireAuth = async (req: Request): Promise<AuthContext> => {
  const token = getBearerToken(req)
  const supabase = createServiceClient()

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    throw createHttpError(401, 'INVALID_TOKEN', 'Invalid or expired token')
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, role, is_active, permissions')
    .eq('id', authData.user.id)
    .single<UserRow>()

  if (userError || !user) {
    throw createHttpError(403, 'INACTIVE_USER', 'Unable to resolve active user profile')
  }

  if (!user.is_active) {
    throw createHttpError(403, 'INACTIVE_USER', 'User is inactive')
  }

  return {
    userId: user.id,
    role: user.role,
    permissions: parsePermissions(user.permissions),
  }
}

export const requireAdmin = async (req: Request): Promise<AuthContext> => {
  const ctx = await requireAuth(req)
  if (ctx.role !== 'admin') {
    throw createHttpError(403, 'ADMIN_REQUIRED', 'Admin access required')
  }
  return ctx
}

export const requirePermission = async (
  req: Request,
  section: string,
  action: string
): Promise<AuthContext> => {
  const ctx = await requireAuth(req)

  if (ctx.role === 'admin') {
    return ctx
  }

  const hasPermission = ctx.permissions?.[section]?.[action] === true
  if (!hasPermission) {
    throw createHttpError(403, 'PERMISSION_DENIED', 'Permission denied')
  }

  return ctx
}

export const toErrorResponse = (error: unknown, headers: HeadersInit): Response => {
  const httpError = error as Partial<HttpError>
  const status = typeof httpError.status === 'number' ? httpError.status : 500
  const code = typeof httpError.code === 'string' ? httpError.code : 'INTERNAL'
  const message = error instanceof Error ? error.message : 'Unexpected error'

  return new Response(
    JSON.stringify({ success: false, error: code, message }),
    {
      status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    }
  )
}
