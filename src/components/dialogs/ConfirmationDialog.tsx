import { useEffect } from 'react'
import { AlertCircle, CheckCircle, X } from 'lucide-react'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
  icon?: 'alert' | 'question' | 'success' | 'info'
  children?: React.ReactNode
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  isDangerous = false,
  icon = 'question',
  children
}: ConfirmationDialogProps) {
  // معالجة ESC لإغلاق المودال
  useEffect(() => {
    if (!isOpen) return
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getIconColor = () => {
    if (isDangerous) return 'from-red-500 to-red-600'
    switch (icon) {
      case 'alert': return 'from-orange-500 to-orange-600'
      case 'success': return 'from-green-500 to-green-600'
      case 'info': return 'from-blue-500 to-blue-600'
      case 'question': return 'from-indigo-500 to-indigo-600'
      default: return 'from-blue-500 to-blue-600'
    }
  }

  const getHeaderColor = () => {
    if (isDangerous) return 'from-red-50 to-orange-50'
    switch (icon) {
      case 'alert': return 'from-orange-50 to-yellow-50'
      case 'success': return 'from-green-50 to-emerald-50'
      case 'info': return 'from-blue-50 to-cyan-50'
      case 'question': return 'from-indigo-50 to-blue-50'
      default: return 'from-blue-50 to-cyan-50'
    }
  }

  const getBorderColor = () => {
    if (isDangerous) return 'border-red-200'
    switch (icon) {
      case 'alert': return 'border-orange-200'
      case 'success': return 'border-green-200'
      case 'info': return 'border-blue-200'
      case 'question': return 'border-indigo-200'
      default: return 'border-blue-200'
    }
  }

  const getButtonColor = () => {
    if (isDangerous) return 'bg-red-600 hover:bg-red-700'
    switch (icon) {
      case 'alert': return 'bg-orange-600 hover:bg-orange-700'
      case 'success': return 'bg-green-600 hover:bg-green-700'
      case 'info': return 'bg-blue-600 hover:bg-blue-700'
      case 'question': return 'bg-indigo-600 hover:bg-indigo-700'
      default: return 'bg-blue-600 hover:bg-blue-700'
    }
  }

  const getIconComponent = () => {
    switch (icon) {
      case 'alert': return <AlertCircle className="w-7 h-7 text-white" />
      case 'success': return <CheckCircle className="w-7 h-7 text-white" />
      default: return <AlertCircle className="w-7 h-7 text-white" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b-2 ${getBorderColor()} bg-gradient-to-r ${getHeaderColor()}`}>
          <div className="flex items-center gap-4 flex-1">
            <div className={`w-12 h-12 bg-gradient-to-br ${getIconColor()} rounded-full flex items-center justify-center flex-shrink-0 shadow-lg`}>
              {getIconComponent()}
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/10 rounded-lg transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <p className="text-gray-700 text-center mb-6">
            {message}
          </p>

          {children && (
            <div className="mb-6">
              {children}
            </div>
          )}

          {isDangerous && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-red-700 font-medium">
                ⚠️ هذا الإجراء لا يمكن التراجع عنه
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`flex-1 px-4 py-2 ${getButtonColor()} text-white font-medium rounded-lg transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
