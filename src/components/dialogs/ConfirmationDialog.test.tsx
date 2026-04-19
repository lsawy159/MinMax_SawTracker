import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ConfirmationDialog from './ConfirmationDialog'

describe('ConfirmationDialog', () => {
  it('does not render when closed', () => {
    render(
      <ConfirmationDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="تأكيد الحذف"
        message="هل أنت متأكد؟"
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a loading state during async confirm and closes after completion', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    let resolveConfirm: (() => void) | undefined
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve
        })
    )

    render(
      <ConfirmationDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="تأكيد الإجراء"
        message="سيتم تطبيق التغيير مباشرة"
        confirmText="تنفيذ"
      />
    )

    await user.click(screen.getByRole('button', { name: 'تنفيذ' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText('جارٍ التنفيذ...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeDisabled()

    resolveConfirm?.()

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('shows the danger warning when the dialog is destructive', () => {
    render(
      <ConfirmationDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="حذف الموظف"
        message="لن يمكن التراجع عن هذا الإجراء"
        isDangerous
      />
    )

    expect(screen.getByRole('note')).toHaveTextContent('هذا الإجراء لا يمكن التراجع عنه')
  })
})
