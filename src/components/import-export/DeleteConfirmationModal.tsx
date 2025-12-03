import { useEffect } from 'react'
import { AlertCircle, CheckCircle, X } from 'lucide-react'

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  deleteMode: 'all' | 'matching'
  importType: 'employees' | 'companies'
  selectedRowsCount: number
  totalRowsCount: number
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  deleteMode,
  importType,
  selectedRowsCount,
  totalRowsCount
}: DeleteConfirmationModalProps) {
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                ⚠️ تأكيد الحذف
              </h2>
              <p className="text-sm text-red-600 font-medium">
                هذا الإجراء لا يمكن التراجع عنه - سيتم حذف البيانات نهائياً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 space-y-4">
            <div className="bg-white border-2 border-red-200 rounded-lg p-4">
              <p className="text-base font-semibold text-gray-800 mb-3 text-center">
                {deleteMode === 'all' 
                  ? `هل أنت متأكد من حذف جميع ${importType === 'companies' ? 'المؤسسات' : 'الموظفين'} من النظام؟`
                  : `هل أنت متأكد من حذف ${importType === 'companies' ? 'المؤسسات المطابقة' : 'الموظفين المطابقين'} قبل الاستيراد؟`
                }
              </p>
              
              {deleteMode === 'all' && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-red-900 mb-2 text-base">سيتم حذف:</p>
                      <ul className="list-disc list-inside space-y-2 text-red-800 text-sm">
                        <li className="font-medium">جميع {importType === 'companies' ? 'المؤسسات' : 'الموظفين'} من النظام</li>
                        <li className="font-medium">جميع البيانات المرتبطة بهم</li>
                      </ul>
                      {importType === 'companies' && (
                        <div className="mt-3 pt-3 border-t-2 border-red-300">
                          <p className="text-red-700 text-xs font-medium bg-red-100 p-2 rounded">
                            <strong>ملاحظة مهمة:</strong> سيتم تحديث الموظفين المرتبطين بهذه المؤسسات ليكونوا بدون شركة (لن يتم حذف الموظفين)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {deleteMode === 'matching' && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-yellow-900 mb-2 text-base">سيتم حذف:</p>
                      <ul className="list-disc list-inside space-y-2 text-yellow-800 text-sm">
                        <li className="font-medium">{importType === 'companies' ? 'المؤسسات' : 'الموظفين'} المطابقة فقط</li>
                        <li className="font-medium">سيتم تحديد المطابقة حسب {importType === 'companies' ? 'الرقم الموحد' : 'رقم الإقامة'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-blue-900 mb-1 text-base">بعد الحذف سيتم استيراد:</p>
                    <p className="text-blue-700 font-semibold text-lg">
                      {selectedRowsCount > 0 
                        ? `${selectedRowsCount} من ${totalRowsCount} صف محدد`
                        : `جميع الصفوف (${totalRowsCount} صف)`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t-2 border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md hover:shadow-lg"
            >
              إلغاء العملية
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              ✓ تأكيد الحذف والمتابعة
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

