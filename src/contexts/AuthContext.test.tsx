import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const {
  getSessionMock,
  signOutMock,
  onAuthStateChangeMock,
  userSingleMock,
  userSessionsGtMock,
  userSessionsLimitMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  signOutMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  userSingleMock: vi.fn(),
  userSessionsGtMock: vi.fn(),
  userSessionsLimitMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      signOut: signOutMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: userSingleMock,
        }
      }

      if (table === 'user_sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gt: userSessionsGtMock,
          limit: userSessionsLimitMock,
          update: vi.fn().mockReturnThis(),
        }
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        gt: vi.fn().mockResolvedValue({ data: [], error: null }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }),
  },
}))

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../utils/securityLogger', () => ({
  AuditActionType: {
    LOGIN: 'login',
    LOGOUT: 'logout',
  },
  securityLogger: {
    logAudit: vi.fn().mockResolvedValue(undefined),
    logFailedLogin: vi.fn().mockResolvedValue(undefined),
  },
}))

const mockSession = {
  access_token: 'token',
  refresh_token: 'refresh',
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: 'bearer',
  user: {
    id: 'user-1',
    email: 'admin@test.com',
  },
} as const

const mockUser = {
  id: 'user-1',
  email: 'admin@test.com',
  username: 'admin',
  full_name: 'Admin User',
  role: 'admin' as const,
  permissions: {},
  is_active: true,
  created_at: new Date().toISOString(),
}

function AuthStatus() {
  const { user, loading, error } = useAuth()

  if (loading) {
    return <div>loading</div>
  }

  return (
    <div>
      <span>{user?.email ?? 'no-user'}</span>
      <span>{error ?? 'no-error'}</span>
    </div>
  )
}

describe('AuthProvider session validation', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.spyOn(global, 'setInterval').mockImplementation((((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        queueMicrotask(() => {
          void handler()
        })
      }
      return 1 as unknown as ReturnType<typeof setInterval>
    }) as unknown) as typeof setInterval)
    vi.spyOn(global, 'clearInterval').mockImplementation(() => undefined)

    getSessionMock.mockResolvedValue({ data: { session: mockSession }, error: null })
    signOutMock.mockResolvedValue({ error: null })
    onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })
    userSingleMock.mockResolvedValue({ data: mockUser, error: null })
    userSessionsLimitMock.mockResolvedValue({ data: [], error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('keeps the user signed in and retries when the session check fails بسبب الشبكة', async () => {
    userSessionsGtMock.mockResolvedValue({
      data: null,
      error: { message: 'TypeError: Failed to fetch' },
    })

    render(
      <AuthProvider>
        <AuthStatus />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(signOutMock).not.toHaveBeenCalled()
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
      expect(screen.queryByText('تم إنهاء جلستك من قبل المسؤول')).not.toBeInTheDocument()
    }, { timeout: 4000 })
  })
})
