import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
  icon?: 'alert' | 'question' | 'success' | 'info'
  children?: React.ReactNode
  dialogId?: string
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
  children,
  dialogId = 'confirmation-dialog'
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

  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const getButtonClass = () => {
    if (isDangerous) return 'app-button-danger'
    switch (icon) {
      case 'alert': return 'app-button-warning'
      case 'success': return 'app-button-success'
      default: return 'app-button-primary'
    }
  }

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true)
      await Promise.resolve(onConfirm())
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const getIconComponent = () => {
    switch (icon) {
      case 'alert': return <AlertCircle className="w-7 h-7 text-white" />
      case 'success': return <CheckCircle className="w-7 h-7 text-white" />
      default: return <AlertCircle className="w-7 h-7 text-white" />
    }
  }

  const titleId = `${dialogId}-title`
  const descriptionId = `${dialogId}-description`

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div 
        className="app-modal-surface max-w-md overflow-hidden flex w-full flex-col animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Modal Header */}
        <div className={`app-modal-header flex items-center justify-between border-b-2 px-6 py-4 ${getBorderColor()} bg-gradient-to-r ${getHeaderColor()}`}>
          <div className="flex items-center gap-4 flex-1">
            <div className={`w-12 h-12 bg-gradient-to-br ${getIconColor()} rounded-full flex items-center justify-center flex-shrink-0 shadow-lg`}>
              {getIconComponent()}
            </div>
            <h2 
              id={titleId}
              className="text-lg font-bold text-gray-900"
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 transition-colors hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <p 
            id={descriptionId}
            className="text-gray-700 text-center mb-6"
          >
            {message}
          </p>

          {children && (
            <div className="mb-6">
              {children}
            </div>
          )}

          {isDangerous && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 mb-6" role="note">
              <p className="text-sm text-red-700 font-medium">
                ⚠️ هذا الإجراء لا يمكن التراجع عنه
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="app-modal-footer flex gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="app-button-secondary flex-1 justify-center"
            aria-label={cancelText}
          >
            {cancelText}
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className={`${getButtonClass()} flex-1 justify-center`}
            aria-label={confirmText}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ التنفيذ...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
