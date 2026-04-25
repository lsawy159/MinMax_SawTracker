import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthLoading from './AuthLoading'

const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('AuthLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseAuth.mockReturnValue({
      loading: true,
      error: null,
      clearError: vi.fn(),
      retryLogin: vi.fn().mockResolvedValue(undefined),
    })
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('shows a friendly initial auth loading state', () => {
    render(
      <AuthLoading>
        <div>جاهز</div>
      </AuthLoading>
    )

    expect(screen.getByText('جاري تجهيز الدخول...')).toBeInTheDocument()
    expect(screen.getByText('نستعيد الجلسة ونحمّل البيانات الأساسية بأمان.')).toBeInTheDocument()
  })

  it('shows the extended wait message when loading takes too long', () => {
    render(
      <AuthLoading maxWaitTime={6000}>
        <div>جاهز</div>
      </AuthLoading>
    )

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.getByText('التحميل يستغرق وقتاً أطول من المعتاد')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'إعادة تحميل الصفحة' })).toBeInTheDocument()
  })
})
