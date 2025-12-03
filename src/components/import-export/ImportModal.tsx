import { useEffect } from 'react'
import { X, FileUp } from 'lucide-react'
import ImportTab from './ImportTab'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  importType: 'employees' | 'companies'
  onImportSuccess?: () => void
}

export default function ImportModal({ isOpen, onClose, importType, onImportSuccess }: ImportModalProps) {
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col my-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <FileUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                استيراد {importType === 'employees' ? 'الموظفين' : 'المؤسسات'}
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                قم برفع ملف Excel للتحقق من البيانات واستيرادها
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6 text-gray-600" />
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

