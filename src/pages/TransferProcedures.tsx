import TransferProceduresTab from '@/components/import-export/TransferProceduresTab'
import { RefreshCcw } from 'lucide-react'
import { usePermissions } from '@/utils/permissions'

export default function TransferProcedures() {
  const { canView, canImport, canExport } = usePermissions()

  if (!canView('transferProcedures')) {
    return (
      <>
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            لا تملك صلاحية الوصول إلى صفحة إجراءات النقل.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="app-page app-tech-grid space-y-4">
        <div className="mb-4 flex items-start gap-2 sm:mb-6 sm:items-center sm:gap-3">
          <div className="app-icon-chip flex-shrink-0">
            <RefreshCcw className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="text-left sm:text-right">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
              إجراءات النقل
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
              إدارة طلبات النقل وتحويلها لاحقاً إلى موظفين بعد اكتمال الحالة
            </p>
          </div>
        </div>

        <TransferProceduresTab
          canImport={canImport('transferProcedures')}
          canExport={canExport('transferProcedures')}
        />
      </div>
    </>
  )
}
