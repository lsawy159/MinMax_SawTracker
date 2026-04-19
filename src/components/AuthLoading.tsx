import { useState, useEffect, ReactNode } from 'react'
import { Loader2, AlertCircle, RefreshCw, WifiOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface AuthLoadingProps {
  children: ReactNode
  fallback?: ReactNode
  showError?: boolean
  maxWaitTime?: number
}

interface AuthErrorProps {
  error: string
  onRetry: () => Promise<void>
  onDismiss: () => void
}

const EXTENDED_WAIT_THRESHOLD_MS = 3500

function getSeconds(milliseconds: number) {
  return Math.max(0, Math.ceil(milliseconds / 1000))
}

export default function AuthLoading({
  children,
  fallback,
  showError = true,
  maxWaitTime = 10000
}: AuthLoadingProps) {
  const { loading, error, clearError, retryLogin } = useAuth()
  const [showExtendedState, setShowExtendedState] = useState(false)
  const [timeLeft, setTimeLeft] = useState(getSeconds(maxWaitTime))

  useEffect(() => {
    if (!loading || maxWaitTime <= 0) {
      setShowExtendedState(false)
      setTimeLeft(getSeconds(maxWaitTime))
      return
    }

    setShowExtendedState(false)
    setTimeLeft(getSeconds(maxWaitTime))

    const extendedDelay = Math.min(EXTENDED_WAIT_THRESHOLD_MS, Math.max(1500, maxWaitTime - 2000))
    const extendedTimer = setTimeout(() => {
      setShowExtendedState(true)
    }, extendedDelay)

    const countdownTimer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      clearTimeout(extendedTimer)
      clearInterval(countdownTimer)
    }
  }, [loading, maxWaitTime])

  if (loading && !showExtendedState) {
    return fallback || <DefaultLoading />
  }

  if (loading && showExtendedState) {
    return <ExtendedLoading timeLeft={timeLeft} />
  }

  if (error && showError) {
    return <AuthError error={error} onRetry={retryLogin} onDismiss={clearError} />
  }

  return <>{children}</>
}

function DefaultLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/80 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-xl dark:border-white/10 dark:bg-slate-900/90">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">جاري تجهيز الدخول...</h2>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          نستعيد الجلسة ونحمّل البيانات الأساسية بأمان.
        </p>
      </div>
    </div>
  )
}

function ExtendedLoading({ timeLeft }: { timeLeft: number }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/80 px-4 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white/95 p-8 text-center shadow-xl dark:border-amber-500/20 dark:bg-slate-900/90">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          <WifiOff className="h-7 w-7" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">التحميل يستغرق وقتاً أطول من المعتاد</h2>
        <p className="mb-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          قد تكون هناك مشكلة مؤقتة في الشبكة. سنستمر بالمحاولة تلقائياً.
        </p>
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>مهلة المتابعة التقريبية: {timeLeft} ثانية</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="app-button-primary mx-auto justify-center"
        >
          <RefreshCw className="ml-2 h-4 w-4" />
          إعادة تحميل الصفحة
        </button>
      </div>
    </div>
  )
}

function AuthError({ error, onRetry, onDismiss }: AuthErrorProps) {
  const [showDetails, setShowDetails] = useState(false)

  const getErrorType = (errorMessage: string) => {
    if (errorMessage.includes('403') || errorMessage.includes('permission')) {
      return { type: 'permission', title: 'خطأ في الصلاحيات', iconClass: 'text-red-500' }
    }

    if (errorMessage.includes('406') || errorMessage.includes('not acceptable')) {
      return { type: 'format', title: 'خطأ في تنسيق البيانات', iconClass: 'text-amber-500' }
    }

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return { type: 'network', title: 'خطأ في الاتصال', iconClass: 'text-sky-500' }
    }

    return { type: 'general', title: 'خطأ عام', iconClass: 'text-slate-500' }
  }

  const errorInfo = getErrorType(error)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-4">
          <AlertCircle className={`ml-3 h-8 w-8 ${errorInfo.iconClass}`} />
          <h2 className="text-xl font-semibold text-gray-900">{errorInfo.title}</h2>
        </div>

        <p className="text-gray-600 mb-4">
          {errorMessageMap(error, errorInfo.type)}
        </p>

        {showDetails && (
          <div className="bg-gray-100 p-3 rounded-lg mb-4 text-sm text-gray-700 font-mono">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { void onRetry() }}
            className="app-button-primary flex-1 justify-center"
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            إعادة المحاولة
          </button>

          <button
            onClick={() => window.location.reload()}
            className="app-button-secondary flex-1 justify-center"
          >
            إعادة تحميل الصفحة
          </button>

          <button
            onClick={onDismiss}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            تجاهل
          </button>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="app-button-secondary mt-3 w-full justify-center text-sm"
        >
          {showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل التقنية'}
        </button>
      </div>
    </div>
  )
}

function errorMessageMap(error: string, type: string): string {
  const messages = {
    permission: 'ليس لديك صلاحية للوصول إلى هذه البيانات. قد تحتاج إلى تسجيل الدخول مرة أخرى أو التواصل مع المدير.',
    format: 'يبدو أن هناك مشكلة في تنسيق البيانات المطلوبة. يرجى المحاولة مرة أخرى.',
    network: 'حدث خطأ مؤقت في الاتصال بالخادم. يرجى التحقق من الشبكة والمحاولة مرة أخرى.',
    general: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو تحديث الصفحة.'
  }

  if (error.includes('بيانات الدخول غير صحيحة')) {
    return 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.'
  }

  if (error.includes('يرجى تأكيد البريد الإلكتروني')) {
    return 'يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول.'
  }

  if (error.includes('فشل في تحميل بيانات الجلسة')) {
    return 'فشل في تحميل بيانات جلستك. يرجى إعادة تسجيل الدخول.'
  }

  return messages[type as keyof typeof messages] || messages.general
}