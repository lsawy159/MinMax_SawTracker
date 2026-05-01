import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PayrollDeductions from '@/pages/PayrollDeductions'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const renderPayrollDeductions = () => {
  const queryClient = createTestQueryClient()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <PayrollDeductions />
    </QueryClientProvider>
  )

  // Keep tests focused on payroll runs flow even if the default tab changes.
  const payrollRunsTabButton = utils.queryByRole('button', { name: 'مسيرات الرواتب' })
  if (payrollRunsTabButton) {
    fireEvent.click(payrollRunsTabButton)
  }

  return {
    ...utils,
    rerenderPayroll: () => {
      utils.rerender(
        <QueryClientProvider client={queryClient}>
          <PayrollDeductions />
        </QueryClientProvider>
      )
      const refreshedPayrollRunsTabButton = utils.queryByRole('button', {
        name: 'مسيرات الرواتب',
      })
      if (refreshedPayrollRunsTabButton) {
        fireEvent.click(refreshedPayrollRunsTabButton)
      }
    },
  }
}

const mockUsePermissions = vi.fn()
const mockUseCompanies = vi.fn()
const mockUseProjects = vi.fn()
const mockUsePayrollRuns = vi.fn()
const mockUsePayrollRunEntries = vi.fn()
const mockUsePayrollRunSlips = vi.fn()
const mockUseScopedPayrollEmployees = vi.fn()
const mockUseCreatePayrollRun = vi.fn()
const mockUseUpsertPayrollEntry = vi.fn()
const mockUseUpdatePayrollRunStatus = vi.fn()
const mockUseDeletePayrollRun = vi.fn()
const mockActivityLogInsert = vi.fn()
const mockPayrollEntriesExportFetch = vi.fn()
const mockSaveAs = vi.fn()
const mockSheetToJson = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
const mockToastWarning = vi.fn()
const mockXlsxRead = vi.fn(() => ({
  SheetNames: ['Sheet1'],
  Sheets: { Sheet1: {} },
}))

const createSupabaseQuery = (
  result: { data: unknown[]; error: null } = { data: [], error: null },
  overrides?: {
    eq?: (...args: unknown[]) => Promise<{ data: unknown[]; error: null }>
    in?: (...args: unknown[]) => Promise<{ data: unknown[]; error: null }>
    order?: (...args: unknown[]) => Promise<{ data: unknown[]; error: null }>
  }
) => ({
  eq: (...args: unknown[]) => (overrides?.eq ? overrides.eq(...args) : Promise.resolve(result)),
  in: (...args: unknown[]) => (overrides?.in ? overrides.in(...args) : Promise.resolve(result)),
  order: (...args: unknown[]) =>
    overrides?.order ? overrides.order(...args) : Promise.resolve(result),
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve(result).then(resolve),
  catch: (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject),
})

function setupDefaultPayrollMocks() {
  mockUsePermissions.mockReturnValue({
    canView: vi.fn((section: string) => section === 'payroll'),
    canExport: vi.fn(() => true),
    canDelete: vi.fn(() => true),
    isAdmin: true,
  })

  mockUseCompanies.mockReturnValue({
    data: [{ id: 'company-1', name: 'شركة مهدي' }],
  })

  mockUseProjects.mockReturnValue({
    data: [],
  })

  mockUsePayrollRuns.mockReturnValue({
    data: [
      {
        id: 'run-1',
        payroll_month: '2026-04-01',
        scope_type: 'company',
        scope_id: 'company-1',
        input_mode: 'manual',
        status: 'draft',
        entry_count: 0,
        total_net_amount: 0,
      },
    ],
    isLoading: false,
    refetch: vi.fn(),
  })

  mockUsePayrollRunEntries.mockReturnValue({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  })

  mockUsePayrollRunSlips.mockReturnValue({
    data: [],
    refetch: vi.fn(),
  })

  mockUseScopedPayrollEmployees.mockReturnValue({
    data: [
      {
        id: 'employee-1',
        name: 'أحمد',
        residence_number: 1234567890,
        salary: 2500,
        suggested_installment_amount: 150,
        company: { name: 'شركة مهدي' },
        project: null,
      },
    ],
    isLoading: false,
  })

  mockUseCreatePayrollRun.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  })

  mockUseUpsertPayrollEntry.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  })

  mockUseUpdatePayrollRunStatus.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  })

  mockUseDeletePayrollRun.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  })
}

vi.mock('@/components/layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'activity_log') {
        return {
          insert: (...args: unknown[]) => mockActivityLogInsert(...args),
        }
      }

      if (table === 'payroll_entries') {
        return {
          select: () =>
            createSupabaseQuery(
              { data: [], error: null },
              {
                eq: (_column: unknown, value: unknown) => mockPayrollEntriesExportFetch(value),
              }
            ),
        }
      }

      if (table === 'payroll_entry_components') {
        return {
          select: () => createSupabaseQuery({ data: [], error: null }),
        }
      }

      if (table === 'employees') {
        return {
          select: () => createSupabaseQuery({ data: [], error: null }),
        }
      }

      if (table === 'employee_obligation_lines') {
        return {
          select: () => createSupabaseQuery({ data: [], error: null }),
        }
      }

      return {
        insert: (...args: unknown[]) => mockActivityLogInsert(...args),
      }
    }),
  },
}))

vi.mock('xlsx', () => ({
  read: (...args: unknown[]) => mockXlsxRead(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
    json_to_sheet: vi.fn(() => ({})),
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => new ArrayBuffer(8)),
}))

vi.mock('file-saver', () => ({
  saveAs: (...args: unknown[]) => mockSaveAs(...args),
}))

vi.mock('@/utils/permissions', () => ({
  usePermissions: () => mockUsePermissions(),
}))

vi.mock('@/hooks/useCompanies', () => ({
  useCompanies: () => mockUseCompanies(),
}))

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => mockUseProjects(),
}))

vi.mock('@/hooks/usePayroll', () => ({
  usePayrollRuns: () => mockUsePayrollRuns(),
  usePayrollRunEntries: () => mockUsePayrollRunEntries(),
  usePayrollRunSlips: () => mockUsePayrollRunSlips(),
  useScopedPayrollEmployees: () => mockUseScopedPayrollEmployees(),
  useCreatePayrollRun: () => mockUseCreatePayrollRun(),
  useUpsertPayrollEntry: () => mockUseUpsertPayrollEntry(),
  useUpdatePayrollRunStatus: () => mockUseUpdatePayrollRunStatus(),
  useDeletePayrollRun: () => mockUseDeletePayrollRun(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}))

describe('PayrollDeductions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-04-01T00:00:00.000Z'), toFake: ['Date'] })
    vi.clearAllMocks()
    setupDefaultPayrollMocks()
    mockActivityLogInsert.mockResolvedValue({ error: null })
    mockPayrollEntriesExportFetch.mockResolvedValue({
      data: [
        {
          id: 'entry-1',
          employee_id: 'employee-1',
          employee_name_snapshot: 'أحمد',
          residence_number_snapshot: 1234567890,
          gross_amount: 2500,
          deductions_amount: 50,
          installment_deducted_amount: 0,
          net_amount: 2450,
          attendance_days: 30,
          paid_leave_days: 0,
          entry_status: 'calculated',
        },
      ],
      error: null,
    })
    mockSheetToJson.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows an unauthorized state when payroll view permission is missing', () => {
    mockUsePermissions.mockReturnValue({
      canView: vi.fn(() => false),
      canExport: vi.fn(() => false),
      canDelete: vi.fn(() => false),
      isAdmin: false,
    })

    renderPayrollDeductions()

    expect(screen.getByText('غير مصرح')).toBeInTheDocument()
    expect(
      screen.getByText('عذراً، ليس لديك صلاحية لعرض صفحة الرواتب والاستقطاعات.')
    ).toBeInTheDocument()
  })

  it('reopens the existing run instead of creating a duplicate one for the same month and scope', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'new-run' })

    mockUseCreatePayrollRun.mockReturnValue({
      isPending: false,
      mutateAsync,
    })

    renderPayrollDeductions()

    await user.click(screen.getByRole('button', { name: 'مسير جديد' }))
    await user.click(screen.getByRole('button', { name: 'إنشاء المسير' }))

    expect(mutateAsync).not.toHaveBeenCalled()
    expect(mockToastWarning).toHaveBeenCalled()
  })

  it('allows creating a project payroll run for the same month even when a company payroll run already exists', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'project-run-1' })

    mockUseProjects.mockReturnValue({
      data: [{ id: 'project-1', name: 'مشروع النخبة' }],
    })

    mockUseCreatePayrollRun.mockReturnValue({
      isPending: false,
      mutateAsync,
    })

    renderPayrollDeductions()

    await user.click(screen.getByRole('button', { name: 'مسير جديد' }))
    const dialog = await screen.findByRole('dialog')
    const modal = within(dialog)
    const selects = modal.getAllByRole('combobox')

    fireEvent.change(selects[0], { target: { value: 'project' } })
    fireEvent.change(selects[1], { target: { value: 'project-1' } })

    await user.click(modal.getByRole('button', { name: 'إنشاء المسير' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          payroll_month: '2026-04-01',
          scope_type: 'project',
          scope_id: 'project-1',
        })
      )
    })
  })

  it('shows focused empty-state actions for a selected empty payroll run', async () => {
    renderPayrollDeductions()
    fireEvent.click(screen.getByRole('button', { name: 'عرض المسير' }))

    await waitFor(() => {
      expect(screen.getByText('المسير المحدد جاهز لإدخال الرواتب')).toBeInTheDocument()
    })

    expect(screen.getAllByRole('button', { name: 'إدخال راتب يدوي' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'استيراد من Excel' }).length).toBeGreaterThan(0)
    expect(screen.getByText('للبدء السريع:')).toBeInTheDocument()
    expect(
      screen.getByText('1. اضغط على زر إدخال راتب يدوي لإضافة راتب أول موظف داخل هذا المسير.')
    ).toBeInTheDocument()
    expect(screen.getByText('الموظفون المتاحون داخل نطاق هذا المسير: 1')).toBeInTheDocument()
    expect(screen.getByText('حالة المسير: مسودة')).toBeInTheDocument()
  })

  it('shows a clear notice and disables manual entry when no employees exist in the selected scope', async () => {
    mockUseScopedPayrollEmployees.mockReturnValue({
      data: [],
      isLoading: false,
    })

    renderPayrollDeductions()
    fireEvent.click(screen.getByRole('button', { name: 'عرض المسير' }))

    await waitFor(() => {
      expect(screen.getByText('المسير المحدد جاهز لإدخال الرواتب')).toBeInTheDocument()
    })

    expect(screen.getByText('الموظفون المتاحون داخل نطاق هذا المسير: 0')).toBeInTheDocument()
    expect(
      screen.getByText(
        'لا يوجد موظفون داخل نطاق هذا المسير حاليًا، لذلك تم تعطيل الإدخال اليدوي والاستيراد حتى إضافة موظفين لهذا النطاق أولًا.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'إدخال راتب يدوي' })).toBeDisabled()
  })

  it('shows a clear blocked state for cancelled runs and allows reopening them', async () => {
    mockUsePayrollRuns.mockReturnValue({
      data: [
        {
          id: 'run-1',
          payroll_month: '2026-04-01',
          scope_type: 'company',
          scope_id: 'company-1',
          input_mode: 'manual',
          status: 'cancelled',
          entry_count: 0,
          total_net_amount: 0,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    renderPayrollDeductions()
    fireEvent.click(screen.getByRole('button', { name: 'عرض المسير' }))

    await waitFor(() => {
      expect(screen.getByText('حالة المسير: ملغي')).toBeInTheDocument()
    })

    expect(
      screen.getByText(
        'هذا المسير ملغي حاليًا، لذلك لا يمكن إدخال رواتب أو استيراد بيانات بداخله حتى إعادة فتحه.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'إعادة فتح المسير' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'إدخال راتب يدوي' })).toBeDisabled()
  })

  it('shows an in-app delete confirmation for cancelled runs and deletes them after approval', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue(undefined)

    mockUsePayrollRuns.mockReturnValue({
      data: [
        {
          id: 'run-1',
          payroll_month: '2026-04-01',
          scope_type: 'company',
          scope_id: 'company-1',
          input_mode: 'manual',
          status: 'cancelled',
          entry_count: 0,
          total_net_amount: 0,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    mockUseDeletePayrollRun.mockReturnValue({
      isPending: false,
      mutateAsync,
    })

    renderPayrollDeductions()
    fireEvent.click(screen.getByRole('button', { name: 'عرض المسير' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'حذف المسير' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'حذف المسير' }))

    expect(screen.getByText('تأكيد حذف المسير')).toBeInTheDocument()
    expect(
      screen.getByText('سيتم حذف هذا المسير وكل الرواتب المرتبطة به نهائيًا.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'تأكيد الحذف' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('run-1')
    })
  })

  it('locks editable actions for finalized payroll runs and shows revert action instead', async () => {
    mockUsePayrollRuns.mockReturnValue({
      data: [
        {
          id: 'run-1',
          payroll_month: '2026-04-01',
          scope_type: 'company',
          scope_id: 'company-1',
          input_mode: 'manual',
          status: 'finalized',
          entry_count: 1,
          total_net_amount: 2500,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    mockUsePayrollRunEntries.mockReturnValue({
      data: [
        {
          id: 'entry-1',
          employee_id: 'employee-1',
          employee_name_snapshot: 'أحمد',
          residence_number_snapshot: 1234567890,
          gross_amount: 2500,
          deductions_amount: 0,
          installment_deducted_amount: 0,
          net_amount: 2500,
          entry_status: 'paid',
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    renderPayrollDeductions()
    fireEvent.click(screen.getByRole('button', { name: 'عرض المسير' }))

    await waitFor(() => {
      expect(screen.getByText('حالة المسير: نهائي')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'إدخال راتب يدوي' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'اعتماد المسير' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'استيراد Excel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'إعادة إلى مسودة' })).toBeInTheDocument()
  })

  it('exports selected payroll runs as separate excel files', async () => {
    const user = userEvent.setup()

    mockUsePayrollRuns.mockReturnValue({
      data: [
        {
          id: 'run-1',
          payroll_month: '2026-04-01',
          scope_type: 'company',
          scope_id: 'company-1',
          input_mode: 'manual',
          status: 'draft',
          entry_count: 1,
          total_net_amount: 2450,
        },
        {
          id: 'run-2',
          payroll_month: '2026-04-01',
          scope_type: 'project',
          scope_id: 'project-1',
          input_mode: 'excel',
          status: 'finalized',
          entry_count: 1,
          total_net_amount: 3000,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    mockUseProjects.mockReturnValue({
      data: [{ id: 'project-1', name: 'مشروع النخبة' }],
    })

    mockPayrollEntriesExportFetch
      .mockResolvedValueOnce({
        data: [
          {
            id: 'entry-1',
            employee_id: 'employee-1',
            employee_name_snapshot: 'أحمد',
            residence_number_snapshot: 1234567890,
            gross_amount: 2500,
            deductions_amount: 50,
            installment_deducted_amount: 0,
            net_amount: 2450,
            attendance_days: 30,
            paid_leave_days: 0,
            entry_status: 'calculated',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'entry-2',
            employee_id: 'employee-2',
            employee_name_snapshot: 'سالم',
            residence_number_snapshot: 9876543210,
            gross_amount: 3100,
            deductions_amount: 100,
            installment_deducted_amount: 0,
            net_amount: 3000,
            attendance_days: 30,
            paid_leave_days: 0,
            entry_status: 'finalized',
          },
        ],
        error: null,
      })

    renderPayrollDeductions()

    await user.click(screen.getByRole('checkbox', { name: 'تحديد جميع المسيرات' }))
    await user.click(screen.getByRole('button', { name: 'تصدير المسيرات المحددة' }))

    await waitFor(() => {
      expect(mockSaveAs).toHaveBeenCalledTimes(2)
    })
  })

  it('shows export only when payroll export permission exists and entries are available', async () => {
    const user = userEvent.setup()

    mockUsePermissions.mockReturnValue({
      canView: vi.fn((section: string) => section === 'payroll'),
      canExport: vi.fn(() => false),
      canDelete: vi.fn(() => true),
      isAdmin: true,
    })

    mockUsePayrollRuns.mockReturnValue({
      data: [
        {
          id: 'run-1',
          payroll_month: '2026-04-01',
          scope_type: 'company',
          scope_id: 'company-1',
          input_mode: 'manual',
          status: 'draft',
          entry_count: 1,
          total_net_amount: 2500,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    mockUsePayrollRunEntries.mockReturnValue({
      data: [
        {
          id: 'entry-1',
          employee_id: 'employee-1',
          employee_name_snapshot: 'أحمد',
          residence_number_snapshot: 1234567890,
          gross_amount: 2500,
          deductions_amount: 0,
          installment_deducted_amount: 0,
          net_amount: 2500,
          entry_status: 'calculated',
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    const { rerenderPayroll } = renderPayrollDeductions()
    const openRunButton = await screen.findByRole('button', { name: 'عرض المسير' })
    await user.click(openRunButton)

    await waitFor(() => {
      expect(screen.getByText('أحمد')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'تصدير كشف المسير' })).not.toBeInTheDocument()

    mockUsePermissions.mockReturnValue({
      canView: vi.fn((section: string) => section === 'payroll'),
      canExport: vi.fn((section: string) => section === 'payroll'),
      isAdmin: true,
    })

    rerenderPayroll()

    expect(screen.getByRole('button', { name: 'تصدير كشف المسير' })).toBeInTheDocument()
  })

  it('saves a manual payroll entry with the expected payload', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue(undefined)

    mockUseUpsertPayrollEntry.mockReturnValue({
      isPending: false,
      mutateAsync,
    })

    renderPayrollDeductions()
    const openRunButton = await screen.findByRole('button', { name: 'عرض المسير' })
    await user.click(openRunButton)

    await user.click(screen.getAllByRole('button', { name: 'إدخال راتب يدوي' })[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'حفظ راتب الموظف' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'حفظ راتب الموظف' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          payroll_run_id: 'run-1',
          employee_id: 'employee-1',
          employee_name_snapshot: 'أحمد',
          basic_salary_snapshot: 2500,
          daily_rate_snapshot: 83.33,
          attendance_days: 30,
          installment_deducted_amount: expect.any(Number),
          gross_amount: 2500,
          net_amount: expect.any(Number),
          entry_status: 'calculated',
        })
      )
    })
  })

  it('previews and confirms excel import rows before saving them', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue(undefined)

    mockUseUpsertPayrollEntry.mockReturnValue({
      isPending: false,
      mutateAsync,
    })

    mockSheetToJson.mockReturnValue([
      {
        'رقم الإقامة': '1234567890',
        'أيام الحضور': 30,
        'الإجازات المدفوعة': 0,
        الإضافي: 200,
        الخصومات: 50,
        'خصم الأقساط': 25,
        ملاحظات: 'مراجعة',
      },
    ])

    renderPayrollDeductions()
    const openRunButton = await screen.findByRole('button', { name: 'عرض المسير' })
    await user.click(openRunButton)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['demo'], 'payroll.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    })

    fireEvent.change(fileInput, {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByText('معاينة استيراد الرواتب')).toBeInTheDocument()
    })

    expect(screen.getByText(/الملف: payroll.xlsx/)).toBeInTheDocument()
    expect(screen.getByText('أحمد')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'اعتماد الاستيراد' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          payroll_run_id: 'run-1',
          employee_id: 'employee-1',
          attendance_days: 30,
          overtime_amount: 200,
          deductions_amount: 50,
          installment_deducted_amount: 25,
          notes: 'مراجعة',
          entry_status: 'calculated',
        })
      )
    })
  })

  it('submits the expected payload when finalizing and reverting a payroll run', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue(undefined)

    mockUseUpdatePayrollRunStatus.mockReturnValue({
      isPending: false,
      mutateAsync,
    })

    mockUsePayrollRuns.mockReturnValue({
      data: [
        {
          id: 'run-1',
          payroll_month: '2026-04-01',
          scope_type: 'company',
          scope_id: 'company-1',
          input_mode: 'manual',
          status: 'draft',
          entry_count: 1,
          total_net_amount: 2500,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    mockUsePayrollRunEntries.mockReturnValue({
      data: [
        {
          id: 'entry-1',
          employee_id: 'employee-1',
          employee_name_snapshot: 'أحمد',
          residence_number_snapshot: 1234567890,
          gross_amount: 2500,
          deductions_amount: 0,
          installment_deducted_amount: 0,
          net_amount: 2500,
          entry_status: 'calculated',
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    const { rerenderPayroll } = renderPayrollDeductions()
    const openRunButton = await screen.findByRole('button', { name: 'عرض المسير' })
    await user.click(openRunButton)

    await user.click(screen.getByRole('button', { name: 'اعتماد المسير' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          status: 'finalized',
          approved_at: expect.any(String),
        })
      )
    })

    expect(mockActivityLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'payroll',
        entity_id: 'run-1',
        action: 'payroll_run_status_updated',
      })
    )

    mockUsePayrollRuns.mockReturnValue({
      data: [
        {
          id: 'run-1',
          payroll_month: '2026-04-01',
          scope_type: 'company',
          scope_id: 'company-1',
          input_mode: 'manual',
          status: 'finalized',
          entry_count: 1,
          total_net_amount: 2500,
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    })

    rerenderPayroll()

    await user.click(screen.getByRole('button', { name: 'إعادة إلى مسودة' }))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        runId: 'run-1',
        status: 'draft',
        approved_at: null,
      })
    })
  })
})
