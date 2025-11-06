import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface AuthLoadingProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  showError?: boolean
  maxWaitTime?: number
}

// مكون تحميل شامل للمصادقة
export default function AuthLoading({ 
  children, 
  fallback,
  showError = true,
  maxWaitTime = 10000 
}: AuthLoadingProps) {
  const { loading, error, clearError, retryLogin } = useAuth()
  const [isWaiting, setIsWaiting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(maxWaitTime / 1000)

  useEffect(() => {
    if (loading && maxWaitTime > 0) {
      setIsWaiting(true)
      setTimeLeft(maxWaitTime / 1000)

      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            setIsWaiting(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    } else {
      setIsWaiting(false)
    }
  }, [loading, maxWaitTime])

  // حالة التحميل العادي
  if (loading && !isWaiting) {
    return fallback || <DefaultLoading />
  }

  // حالة الانتظار المطول
  if (loading && isWaiting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">جاري التحميل...</h2>
          <p className="text-gray-600 mb-4">يرجى الانتظار بينما نتحقق من بياناتك</p>
          <div className="flex items-center justify-center text-sm text-gray-500 mb-6">
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
            سيتم الانتقال خلال {timeLeft} ثانية
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            إعادة تحميل الصفحة
          </button>
        </div>
      </div>
    )
  }

  // حالة الخطأ
  if (error && showError) {
    return <AuthError error={error} onRetry={retryLogin} onDismiss={clearError} />
  }

  return <>{children}</>
}

// مكون التحميل الافتراضي
function DefaultLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">جاري التحميل...</p>
      </div>
    </div>
  )
}

// مكون عرض الأخطاء
interface AuthErrorProps {
  error: string
  onRetry: () => void
  onDismiss: () => void
}

function AuthError({ error, onRetry, onDismiss }: AuthErrorProps) {
  const [showDetails, setShowDetails] = useState(false)

  const getErrorType = (errorMessage: string) => {
    if (errorMessage.includes('403') || errorMessage.includes('permission')) {
      return { type: 'permission', title: 'خطأ في الصلاحيات', color: 'red' }
    } else if (errorMessage.includes('406') || errorMessage.includes('not acceptable')) {
      return { type: 'format', title: 'خطأ في تنسيق البيانات', color: 'yellow' }
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return { type: 'network', title: 'خطأ في الاتصال', color: 'blue' }
    } else {
      return { type: 'general', title: 'خطأ عام', color: 'gray' }
    }
  }

  const errorInfo = getErrorType(error)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-4">
          <AlertCircle className={`w-8 h-8 text-${errorInfo.color}-500 ml-3`} />
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
            onClick={onRetry}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            إعادة المحاولة
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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
          className="w-full mt-3 text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          {showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل التقنية'}
        </button>
      </div>
    </div>
  )
}

// خريطة رسائل الأخطاء
function errorMessageMap(error: string, type: string): string {
  const messages = {
    permission: 'ليس لديك صلاحية للوصول إلى هذه البيانات. قد تحتاج إلى تسجيل دخول مرة أخرى أو التواصل مع管理员.',
    format: 'يبدو أن هناك مشكلة في تنسيق البيانات المطلوبة. يرجى المحاولة مرة أخرى.',
    network: 'حدث خطأ في الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.',
    general: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو تحديث الصفحة.'
  }

  // إذا كان الخطأ يحتوي على رسالة مخصصة، استخدمها
  if (error.includes('بيانات الدخول غير صحيحة')) {
    return 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.'
  } else if (error.includes('يرجى تأكيد البريد الإلكتروني')) {
    return 'يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول.'
  } else if (error.includes('فشل في تحميل بيانات الجلسة')) {
    return 'فشل في تحميل بيانات جلستك. يرجى إعادة تسجيل الدخول.'
  }

  return messages[type as keyof typeof messages] || messages.general
}