import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Layout from '@/components/layout/Layout'

const mockHasPermission = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      full_name: 'Ahmed Admin',
      email: 'admin@example.com',
      role: 'admin',
    },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/useAlertsStats', () => ({
  useAlertsStats: () => ({
    alertsStats: {
      employeeUrgent: 0,
      companyUrgent: 0,
      total: 0,
      urgent: 0,
    },
  }),
}))

vi.mock('@/utils/permissions', () => ({
  usePermissions: () => ({
    hasPermission: mockHasPermission,
  }),
}))

vi.mock('@/components/ui/Avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/Tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/layout/MobileBottomNav', () => ({
  MobileBottomNav: () => null,
}))

describe('Layout payroll navigation visibility', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value)
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key)
        }),
        clear: vi.fn(() => {
          storage.clear()
        }),
      },
      configurable: true,
    })
  })

  it('shows payroll navigation when payroll view permission exists', () => {
    mockHasPermission.mockImplementation((section: string, action: string) => {
      if (action !== 'view') {
        return false
      }

      return ['dashboard', 'employees', 'companies', 'projects', 'alerts', 'advancedSearch', 'payroll'].includes(section)
    })

    render(
      <MemoryRouter
        initialEntries={['/dashboard']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Layout>
          <div>content</div>
        </Layout>
      </MemoryRouter>
    )

    expect(screen.getAllByText('الرواتب والاستقطاعات').length).toBeGreaterThan(0)
    expect(screen.queryByText('التقارير')).not.toBeInTheDocument()
  })

  it('hides payroll navigation when only reports view permission exists', () => {
    mockHasPermission.mockImplementation((section: string, action: string) => {
      if (action !== 'view') {
        return false
      }

      return ['dashboard', 'employees', 'companies', 'projects', 'alerts', 'advancedSearch', 'reports'].includes(section)
    })

    render(
      <MemoryRouter
        initialEntries={['/dashboard']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Layout>
          <div>content</div>
        </Layout>
      </MemoryRouter>
    )

    expect(screen.getAllByText('التقارير').length).toBeGreaterThan(0)
    expect(screen.queryByText('الرواتب والاستقطاعات')).not.toBeInTheDocument()
  })
})