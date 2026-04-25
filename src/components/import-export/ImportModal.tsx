import { useEffect } from 'react'
import { X, FileUp } from 'lucide-react'
import ImportTab from './ImportTab'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  importType: 'employees' | 'companies'
  onImportSuccess?: () => void
}

export default function ImportModal({
  isOpen,
  onClose,
  importType,
  onImportSuccess,
}: ImportModalProps) {
  // معالجة ESC لإغلاق المودال
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // التحقق من أن المستخدم لا يكتب في حقل إدخال
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

  const handleImportSuccess = () => {
    if (onImportSuccess) {
      onImportSuccess()
    }
    // إغلاق الـ modal بعد نجاح الاستيراد
    setTimeout(() => {
      onClose()
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="app-modal-surface my-4 flex max-h-[95vh] w-full max-w-[95vw] flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="app-modal-header flex items-center justify-between border-b-2 border-neutral-200 bg-gradient-to-r from-slate-50 to-primary/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="app-icon-chip flex h-10 w-10 items-center justify-center">
              <FileUp className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                استيراد {importType === 'employees' ? 'الموظفين' : 'المؤسسات'}
              </h2>
              <p className="text-sm text-neutral-600 mt-0.5">
                قم برفع ملف Excel للتحقق من البيانات واستيرادها
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6 text-neutral-600" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <ImportTab
            key={importType}
            initialImportType={importType}
            onImportSuccess={handleImportSuccess}
            isInModal={true}
          />
        </div>
      </div>
    </div>
  )
}
