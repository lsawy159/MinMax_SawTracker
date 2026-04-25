import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'

const signInMock = vi.fn()
const navigateMock = vi.fn()
const toggleThemeMock = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: signInMock,
    user: null,
    loading: false,
    error: 'اسم المستخدم أو البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  }),
}))

vi.mock('@/hooks/useUiPreferences', () => ({
  useThemeMode: () => ({
    isDark: false,
    toggleTheme: toggleThemeMock,
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

describe('Login page', () => {
  beforeEach(() => {
    signInMock.mockReset()
    navigateMock.mockReset()
    toggleThemeMock.mockReset()
  })

  it('stops the submit spinner when sign in fails', async () => {
    signInMock.mockRejectedValueOnce(new Error('Invalid login credentials'))

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('username أو email'), {
      target: { value: 'wrong-user' },
    })

    const passwordInput = document.querySelector(
      'input[type="password"]'
    ) as HTMLInputElement | null
    expect(passwordInput).not.toBeNull()

    fireEvent.change(passwordInput as HTMLInputElement, {
      target: { value: 'wrong-pass' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toHaveTextContent('تسجيل الدخول')
    })
  })
})
