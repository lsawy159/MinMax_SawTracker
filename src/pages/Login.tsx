import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LogIn, Eye, EyeOff, Moon, Sun } from 'lucide-react'
import { useThemeMode } from '@/hooks/useUiPreferences'
import { Button } from '@/components/ui/Button'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, user, loading: authLoading, error } = useAuth()
  const { isDark, toggleTheme } = useThemeMode()
  const navigate = useNavigate()
  const isSubmitting = loading || authLoading

  // إذا كان المستخدم مسجل دخول بالفعل، انتقل إلى Dashboard
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  // إيقاف حالة الإرسال المحلية عند اكتمال دورة المصادقة أو ظهور خطأ
  useEffect(() => {
    if (!loading) {
      return
    }

    if (error || !authLoading) {
      setLoading(false)
    }
  }, [authLoading, error, loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(username, password)
      // لا ننتقل هنا مباشرة، بل ننتظر useEffect أعلاه
      // useEffect سينتقل تلقائياً عندما يكون user موجود و authLoading = false
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="app-login-shell relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="app-login-orb app-login-orb-primary" />
      <div className="app-login-orb app-login-orb-secondary" />
      <div className="app-login-grid" />
      <div className="app-login-ring app-login-ring-1" />
      <div className="app-login-ring app-login-ring-2" />
      <div className="app-login-spark app-login-spark-1" />
      <div className="app-login-spark app-login-spark-2" />

      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur-md transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
        aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/70 shadow-[0_35px_120px_-45px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/40 dark:shadow-[0_35px_120px_-45px_rgba(2,6,23,0.85)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:flex items-center justify-center p-8 text-slate-900 dark:text-white">
          <div className="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-white/60 dark:border-white/10 dark:bg-white/5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(254,206,20,0.18),transparent_55%)]" />
            <div className="absolute h-40 w-40 rounded-full border border-primary/30 animate-pulse" />
            <div className="absolute h-64 w-64 rounded-full border border-sky-300/25" />
            <div className="absolute h-80 w-80 rounded-full border border-slate-300/40 dark:border-white/10" />
            <h1 className="relative z-10 text-5xl font-black tracking-[0.18em] text-slate-900 drop-shadow-[0_10px_30px_rgba(255,255,255,0.55)] dark:text-white dark:drop-shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
              SawTracker
            </h1>
          </div>
        </div>

        <div className="relative p-4 md:p-8">
          <div className="mx-auto w-full max-w-md rounded-[24px] border border-slate-200 bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-yellow-300 to-amber-400 text-slate-950 shadow-[0_20px_40px_-20px_rgba(254,206,20,0.8)]">
                <LogIn className="h-8 w-8" />
              </div>
              <h1 className="text-3xl font-black tracking-[0.16em] text-slate-900 dark:text-white">SawTracker</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-xl border border-red-300 bg-red-50/90 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="app-input"
                  required
                  dir="ltr"
                  placeholder="username أو email"
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9@._\-]+"
                  title="حروف، أرقام، @، _ أو - أو . فقط"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="mb-2 block text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="app-input pr-12"
                    required
                    dir="ltr"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-white"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full justify-center py-3.5 text-base"
              >
                {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
