import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TransferProceduresTab from '@/components/import-export/TransferProceduresTab'

const mockTransferOrder = vi.fn()
const mockProjectsOrder = vi.fn()
const mockTransferDeleteEq = vi.fn()
const mockTransferDelete = vi.fn(() => ({ eq: mockTransferDeleteEq }))
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
const mockToastWarning = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'transfer_procedures') {
        return {
          select: vi.fn(() => ({
            order: (...args: unknown[]) => mockTransferOrder(...args),
          })),
          delete: (...args: unknown[]) => mockTransferDelete(...args),
        }
      }

      if (table === 'projects') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: (...args: unknown[]) => mockProjectsOrder(...args),
            })),
          })),
        }
      }

      return {
        select: vi.fn(() => ({ order: vi.fn() })),
      }
    }),
  },
}))

vi.mock('@/components/employees/AddEmployeeModal', () => ({
  default: ({ isOpen, initialData, onSuccess }: {
    isOpen: boolean
    initialData?: { name?: string; residence_number?: string; project_id?: string; joining_date?: string }
    onSuccess: (employee?: {
      id: string
      name: string
      company_id: string
      profession: string
      nationality: string
      birth_date: string
      phone: string
      residence_number: number
      joining_date: string
      residence_expiry: string
      created_at: string
      updated_at: string
      company: { id: string; name: string; unified_number: number; labor_subscription_number: string; created_at: string; updated_at: string }
      project?: { id: string; name: string; created_at: string; updated_at: string }
    }) => void
  }) => {
    if (!isOpen) return null

    return (
      <div data-testid="add-employee-modal">
        <div>{initialData?.name}</div>
        <div>{initialData?.residence_number}</div>
        <button
          type="button"
          onClick={() => onSuccess({
            id: 'employee-1',
            name: initialData?.name || 'عامل منقول',
            company_id: 'company-1',
            profession: 'عامل',
            nationality: 'مصري',
            birth_date: '1990-01-01',
            phone: '0500000000',
            residence_number: Number(initialData?.residence_number || 0),
            joining_date: initialData?.joining_date || '2026-04-22',
            residence_expiry: '2027-04-22',
            created_at: '2026-04-22T00:00:00.000Z',
            updated_at: '2026-04-22T00:00:00.000Z',
            company: {
              id: 'company-1',
              name: 'شركة الاختبار',
              unified_number: 7001234567,
              labor_subscription_number: '123456',
              created_at: '2026-04-22T00:00:00.000Z',
              updated_at: '2026-04-22T00:00:00.000Z',
            },
            project: {
              id: initialData?.project_id || 'project-1',
              name: 'مشروع الرياض',
              created_at: '2026-04-22T00:00:00.000Z',
              updated_at: '2026-04-22T00:00:00.000Z',
            },
          })}
        >
          تأكيد إنشاء الموظف
        </button>
      </div>
    )
  },
}))

vi.mock('@/components/employees/EmployeeCard', () => ({
  default: ({ employee, defaultFinancialOverlayOpen }: { employee: { name: string }; defaultFinancialOverlayOpen?: boolean }) => (
    <div data-testid="employee-card">
      <span>{employee.name}</span>
      <span>{defaultFinancialOverlayOpen ? 'financial-open' : 'financial-closed'}</span>
    </div>
  ),
}))

vi.mock('@/utils/dateFormatter', () => ({
  formatDateShortWithHijri: (value: string) => value,
}))

vi.mock('@/utils/lazyXlsx', () => ({
  loadXlsx: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
    info: vi.fn(),
  },
}))

describe('TransferProceduresTab conversion flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockTransferOrder.mockResolvedValue({
      data: [
        {
          id: 'transfer-1',
          request_date: '2026-04-22',
          name: 'أحمد علي',
          iqama: 2987654321,
          status: 'منقول',
          current_unified_number: 7001234567,
          project_id: 'project-1',
          notes: 'جاهز للتحويل',
          created_at: '2026-04-22T00:00:00.000Z',
          updated_at: '2026-04-22T00:00:00.000Z',
          project: {
            id: 'project-1',
            name: 'مشروع الرياض',
            created_at: '2026-04-22T00:00:00.000Z',
            updated_at: '2026-04-22T00:00:00.000Z',
          },
        },
      ],
      error: null,
    })

    mockProjectsOrder.mockResolvedValue({
      data: [
        {
          id: 'project-1',
          name: 'مشروع الرياض',
          status: 'active',
          created_at: '2026-04-22T00:00:00.000Z',
          updated_at: '2026-04-22T00:00:00.000Z',
        },
      ],
      error: null,
    })

    mockTransferDeleteEq.mockResolvedValue({ data: null, error: null })
  })

  it('opens employee creation with transfer data then deletes the transfer record and opens financial overlay', async () => {
    const user = userEvent.setup()
    render(<TransferProceduresTab canImport={false} canExport={false} />)

    expect(await screen.findByText('أحمد علي')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'تحويل لموظف' }))

    const modal = await screen.findByTestId('add-employee-modal')
    expect(modal).toBeInTheDocument()
    expect(modal).toHaveTextContent('2987654321')

    await user.click(screen.getByRole('button', { name: 'تأكيد إنشاء الموظف' }))

    expect(await screen.findByTestId('employee-card')).toBeInTheDocument()
    expect(screen.getByText('financial-open')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockTransferDelete).toHaveBeenCalled()
      expect(mockTransferDeleteEq).toHaveBeenCalledWith('id', 'transfer-1')
      expect(mockToastSuccess).toHaveBeenCalledWith('تم تحويل سجل النقل إلى موظف وحذف السجل المؤقت')
    })
  })
})
