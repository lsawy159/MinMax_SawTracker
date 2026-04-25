import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import PermissionGuard from '@/components/PermissionGuard'

const mockCheckPermissions = vi.fn()
const mockHasAnyPermission = vi.fn()

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    checkPermissions: mockCheckPermissions,
    hasAnyPermission: mockHasAnyPermission,
  }),
}))

describe('PermissionGuard', () => {
  it('renders children when all permissions check passes', () => {
    mockCheckPermissions.mockReturnValue(true)
    mockHasAnyPermission.mockReturnValue(false)

    render(
      <PermissionGuard permissions={['reports.view', 'reports.export']}>
        <div>allowed-content</div>
      </PermissionGuard>
    )

    expect(screen.getByText('allowed-content')).toBeInTheDocument()
  })

  it('renders fallback when permission check fails', () => {
    mockCheckPermissions.mockReturnValue(false)
    mockHasAnyPermission.mockReturnValue(false)

    render(
      <PermissionGuard
        permissions={['payroll.view']}
        fallback={<div>no-access-fallback</div>}
      >
        <div>hidden-content</div>
      </PermissionGuard>
    )

    expect(screen.queryByText('hidden-content')).not.toBeInTheDocument()
    expect(screen.getByText('no-access-fallback')).toBeInTheDocument()
  })

  it('supports any mode for partial permission access', () => {
    mockCheckPermissions.mockReturnValue(false)
    mockHasAnyPermission.mockReturnValue(true)

    render(
      <PermissionGuard permissions={['users.edit', 'users.delete']} mode="any">
        <div>any-mode-content</div>
      </PermissionGuard>
    )

    expect(screen.getByText('any-mode-content')).toBeInTheDocument()
  })
})
