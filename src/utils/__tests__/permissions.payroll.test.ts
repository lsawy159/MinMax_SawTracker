import { describe, expect, it } from 'vitest'

import { PERMISSION_SECTIONS } from '@/utils/PERMISSIONS_SCHEMA'
import { normalizePermissions } from '@/utils/permissions'

describe('payroll permissions', () => {
  it('defines payroll as a standalone permission section', () => {
    expect(PERMISSION_SECTIONS.payroll.label).toBe('الرواتب والاستقطاعات')
    expect(PERMISSION_SECTIONS.payroll.actions).toEqual(['view', 'export'])
  })

  it('does not grant payroll access when only reports permissions exist', () => {
    const normalized = normalizePermissions({
      reports: {
        view: true,
        export: true,
      },
    }, 'user')

    expect(normalized.reports.view).toBe(true)
    expect(normalized.reports.export).toBe(true)
    expect(normalized.payroll.view).toBe(false)
    expect(normalized.payroll.export).toBe(false)
  })
})