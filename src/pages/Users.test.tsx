import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Users from '@/pages/Users'

const mockRpc = vi.fn()
const mockCanView = vi.fn()
const mockCanDelete = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}))

vi.mock('@/components/layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      role: 'admin',
      permissions: {},
      email: 'admin@example.com',
      username: 'admin',
      full_name: 'Admin User',
      is_active: true,
    },
  }),
}))

vi.mock('@/utils/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/utils/permissions')>('@/utils/permissions')
  return {
    ...actual,
    usePermissions: () => ({
      canView: mockCanView,
      canDelete: mockCanDelete,
    }),
  }
})

vi.mock('@/utils/dateFormatter', () => ({
  formatDateTimeWithHijri: () => '14/04/2026',
}))

vi.mock('@/components/ui/HijriDateDisplay', () => ({
  HijriDateDisplay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Users permissions modal', () => {
  beforeEach(() => {
    mockCanView.mockImplementation((section: string) => section === 'users')
    mockCanDelete.mockReturnValue(true)
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'user-1',
          email: 'abood@sawtracker.local',
          username: 'abood',
          full_name: 'عبدالرحمن',
          role: 'user',
          permissions: {
            reports: { view: true, export: false },
          },
          is_active: true,
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          last_login: null,
        },
      ],
      error: null,
    })
  })

  it('shows the standalone payroll permission section inside the edit modal', async () => {
    const user = userEvent.setup()
    render(<Users />)

    await waitFor(() => {
      expect(screen.getByText('إدارة المستخدمين')).toBeInTheDocument()
      expect(screen.getAllByTitle('تعديل').length).toBeGreaterThan(0)
    })

    await user.click(screen.getAllByTitle('تعديل')[0])

    expect(await screen.findByText('تعديل مستخدم')).toBeInTheDocument()
    expect(screen.getByText('صلاحية الرواتب والاستقطاعات أصبحت مستقلة عن صلاحية التقارير، ويمكن منحها أو منعها لكل مستخدم بشكل منفصل.')).toBeInTheDocument()
    expect(screen.getByText('الرواتب والاستقطاعات')).toBeInTheDocument()
  })
})