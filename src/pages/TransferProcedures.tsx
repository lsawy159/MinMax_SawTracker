import Layout from '@/components/layout/Layout'
import TransferProceduresTab from '@/components/import-export/TransferProceduresTab'
import { RefreshCcw, Send } from 'lucide-react'
import { usePermissions } from '@/utils/permissions'

export default function TransferProcedures() {
  const { canView, canImport, canExport } = usePermissions()

  if (!canView('transferProcedures')) {
    return (
      <Layout>
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            لا تملك صلاحية الوصول إلى صفحة إجراءات النقل.
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid space-y-5">
        <div className="mb-2 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50/80 via-white to-indigo-50/60 p-5 sm:p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 rounded-xl bg-gradient-to-br from-sky-100 to-indigo-100 shadow-sm">
              <Send className="h-5 w-5 sm:h-6 sm:w-6 text-sky-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900">
                إجراءات النقل
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                إدارة طلبات النقل والعمال الجدد، وتحويلهم لاحقاً إلى موظفين مسجلين بعد اكتمال كافة الإجراءات المطلوبة
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-sky-100/80 transition text-slate-600 hover:text-sky-700"
              title="تحديث الصفحة"
            >
              <RefreshCcw className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </div>

        <TransferProceduresTab
          canImport={canImport('transferProcedures')}
          canExport={canExport('transferProcedures')}
        />
      </div>
    </Layout>
  )
}
