import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import GeneralSettings from '@/pages/GeneralSettings'

const mockCanView = vi.fn()
const mockCanEdit = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      role: 'admin',
      permissions: ['adminSettings.view', 'adminSettings.edit', 'users.view'],
      email: 'admin@example.com',
      username: 'admin',
      full_name: 'Admin User',
      is_active: true,
    },
  }),
}))

vi.mock('@/utils/permissions', () => ({
  usePermissions: () => ({
    canView: mockCanView,
    canEdit: mockCanEdit,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

vi.mock('@/components/layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}))

vi.mock('@/components/settings/SessionsManager', () => ({
  default: () => <div>sessions-manager</div>,
}))

vi.mock('@/components/settings/AuditDashboard', () => ({
  default: () => <div>audit-dashboard</div>,
}))

vi.mock('@/pages/Permissions', () => ({
  PermissionsPanel: () => <div>permissions-panel-content</div>,
}))

vi.mock('@/components/dialogs/ConfirmationDialog', () => ({
  default: () => null,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('GeneralSettings permissions deep-link', () => {
  it('opens permissions tab when URL query contains tab=permissions', async () => {
    mockCanView.mockImplementation((section: string) => section === 'adminSettings')
    mockCanEdit.mockImplementation((section: string) => section === 'adminSettings')

    render(
      <MemoryRouter
        initialEntries={['/admin-settings?tab=permissions']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/admin-settings" element={<GeneralSettings />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('permissions-panel-content')).toBeInTheDocument()
    })
  })
})
