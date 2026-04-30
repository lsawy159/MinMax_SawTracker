import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

import {
  requireAdmin,
  requireAuth,
  requirePermission,
  toErrorResponse,
} from './auth.ts'

interface MockUserOptions {
  role?: string
  isActive?: boolean
  permissions?: Record<string, Record<string, boolean>>
}

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const ORIGINAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const setAuthEnv = () => {
  Deno.env.set('SUPABASE_URL', 'https://test-project.supabase.co')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
}

const restoreAuthEnv = () => {
  if (ORIGINAL_SUPABASE_URL === undefined) {
    Deno.env.delete('SUPABASE_URL')
  } else {
    Deno.env.set('SUPABASE_URL', ORIGINAL_SUPABASE_URL)
  }

  if (ORIGINAL_SUPABASE_SERVICE_ROLE_KEY === undefined) {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
  } else {
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', ORIGINAL_SUPABASE_SERVICE_ROLE_KEY)
  }
}

const resetTestState = () => {
  globalThis.fetch = ORIGINAL_FETCH
  restoreAuthEnv()
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const setupSupabaseFetchMock = (options: MockUserOptions = {}) => {
  const role = options.role ?? 'admin'
  const isActive = options.isActive ?? true
  const permissions = options.permissions ?? {
    users: { create: true },
    payroll: { view: true },
  }

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('/auth/v1/user')) {
      return Promise.resolve(jsonResponse({ id: 'user-123' }))
    }

    if (url.includes('/rest/v1/users')) {
      return Promise.resolve(
        jsonResponse({
          id: 'user-123',
          role,
          is_active: isActive,
          permissions,
        })
      )
    }

    return Promise.resolve(
      jsonResponse(
        {
          message: `Unexpected URL in test mock: ${url}`,
          method: init?.method ?? 'GET',
        },
        500
      )
    )
  }
}

Deno.test('requireAuth throws NO_TOKEN when Authorization header is missing', async () => {
  try {
    setAuthEnv()

    await assertRejects(
      () => requireAuth(new Request('https://example.com/functions/v1/secure-sessions')),
      Error,
      'Missing Authorization header'
    )
  } finally {
    resetTestState()
  }
})

Deno.test('requireAuth resolves active user context and parses permissions', async () => {
  try {
    setAuthEnv()
    setupSupabaseFetchMock({
      role: 'manager',
      permissions: {
        payroll: { view: true, edit: false },
      },
    })

    const ctx = await requireAuth(
      new Request('https://example.com/functions/v1/secure-sessions', {
        headers: { Authorization: 'Bearer valid-token' },
      })
    )

    assertEquals(ctx.userId, 'user-123')
    assertEquals(ctx.role, 'manager')
    assertEquals(ctx.permissions.payroll.view, true)
    assertEquals(ctx.permissions.payroll.edit, false)
  } finally {
    resetTestState()
  }
})

Deno.test('requireAdmin rejects non-admin user', async () => {
  try {
    setAuthEnv()
    setupSupabaseFetchMock({ role: 'user' })

    await assertRejects(
      () =>
        requireAdmin(
          new Request('https://example.com/functions/v1/trigger-backup', {
            headers: { Authorization: 'Bearer valid-token' },
          })
        ),
      Error,
      'Admin access required'
    )
  } finally {
    resetTestState()
  }
})

Deno.test('requirePermission allows admin bypass and blocks missing permission', async () => {
  try {
    setAuthEnv()
    setupSupabaseFetchMock({ role: 'admin', permissions: {} })

    const adminCtx = await requirePermission(
      new Request('https://example.com/functions/v1/create-user', {
        headers: { Authorization: 'Bearer valid-token' },
      }),
      'users',
      'create'
    )

    assertEquals(adminCtx.role, 'admin')

    setupSupabaseFetchMock({
      role: 'manager',
      permissions: {
        users: { create: false },
      },
    })

    await assertRejects(
      () =>
        requirePermission(
          new Request('https://example.com/functions/v1/create-user', {
            headers: { Authorization: 'Bearer valid-token' },
          }),
          'users',
          'create'
        ),
      Error,
      'Permission denied'
    )
  } finally {
    resetTestState()
  }
})

Deno.test('toErrorResponse preserves status/code and falls back safely', async () => {
  try {
    const customError = Object.assign(new Error('Forbidden operation'), {
      status: 403,
      code: 'PERMISSION_DENIED',
    })

    const customRes = toErrorResponse(customError, {
      'Access-Control-Allow-Origin': '*',
    })

    assertEquals(customRes.status, 403)
    assertEquals(customRes.headers.get('Content-Type'), 'application/json')
    const customBody = await customRes.json()
    assertEquals(customBody.error, 'PERMISSION_DENIED')
    assertEquals(customBody.message, 'Forbidden operation')

    const fallbackRes = toErrorResponse('plain-string-error', {
      'Access-Control-Allow-Origin': '*',
    })

    assertEquals(fallbackRes.status, 500)
    const fallbackBody = await fallbackRes.json()
    assertEquals(fallbackBody.error, 'INTERNAL')
    assertEquals(fallbackBody.message, 'Unexpected error')
  } finally {
    resetTestState()
  }
})
