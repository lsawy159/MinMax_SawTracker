import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react'
import { ReactNode } from 'react'

interface ErrorMessageProps {
  title?: string
  message: string
  type?: 'error' | 'warning' | 'info'
  onRetry?: () => void
  children?: ReactNode
  fullPage?: boolean
}

export function ErrorMessage({
  title,
  message,
  type = 'error',
  onRetry,
  children,
  fullPage = false,
}: ErrorMessageProps) {
  const containerClass = fullPage
    ? 'min-h-screen flex items-center justify-center bg-gray-50'
    : 'w-full'

  const icons = {
    error: <XCircle className="w-12 h-12 text-red-500" />,
    warning: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
    info: <AlertTriangle className="w-12 h-12 text-blue-500" />,
  }

  const colors = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-900',
      subtext: 'text-red-700',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-900',
      subtext: 'text-yellow-700',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      subtext: 'text-blue-700',
    },
  }

  const colorScheme = colors[type]

  return (
    <div className={containerClass}>
      <div
        className={`max-w-md w-full ${colorScheme.bg} border ${colorScheme.border} rounded-xl p-6`}
      >
        <div className="flex flex-col items-center text-center gap-4">
          {icons[type]}
          
          <div>
            {title && (
              <h3 className={`text-lg font-semibold ${colorScheme.text} mb-2`}>
                {title}
              </h3>
            )}
            <p className={`${colorScheme.subtext}`}>{message}</p>
          </div>

          {children}

          {onRetry && (
            <button
              onClick={onRetry}
              className={`flex items-center gap-2 px-4 py-2 bg-white border ${colorScheme.border} rounded-lg hover:bg-gray-50 transition-colors ${colorScheme.text} font-medium`}
            >
              <RefreshCw className="w-4 h-4" />
              إعادة المحاولة
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Inline error (for forms, etc)
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-sm">
      <XCircle className="w-4 h-4" />
      <span>{message}</span>
    </div>
  )
}

// Success message
export function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-900">
      <div className="flex-shrink-0">
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}
