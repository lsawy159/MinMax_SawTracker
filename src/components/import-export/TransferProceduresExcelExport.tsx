import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { saveAs } from 'file-saver'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { loadXlsx } from '@/utils/lazyXlsx'

interface TransferProceduresExcelExportProps {
  canExport: boolean
}

export default function TransferProceduresExcelExport({
  canExport,
}: TransferProceduresExcelExportProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!canExport) {
      toast.error('ليس لديك صلاحية التصدير')
      return
    }

    try {
      setExporting(true)
      const { data, error } = await supabase
        .from('transfer_procedures')
        .select(
          'id,request_date,name,iqama,status,current_unified_number,project_id,created_by_user_id,notes,created_at,updated_at, project:projects(name)'
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        toast.info('لا توجد طلبات نقل للتصدير')
        return
      }

      const XLSX = await loadXlsx()
      const rows = data.map((row) => ({
        'تاريخ الطلب': row.request_date,
        الاسم: row.name,
        'رقم الإقامة': String(row.iqama),
        الحالة: row.status,
        'الرقم الموحد الحالي': String(row.current_unified_number),
        المشروع:
          typeof row.project === 'object' && row.project && 'name' in row.project
            ? String(row.project.name || '')
            : '',
        ملاحظات: row.notes || '',
      }))

      const worksheet = XLSX.utils.json_to_sheet(rows)
      worksheet['!cols'] = [
        { wch: 16 },
        { wch: 24 },
        { wch: 18 },
        { wch: 24 },
        { wch: 20 },
        { wch: 22 },
        { wch: 28 },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'طلبات النقل')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      saveAs(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'طلبات_النقل.xlsx'
      )
      toast.success(`تم تصدير ${rows.length} سجل بنجاح`)
    } catch (error) {
      console.error(error)
      toast.error('فشل تصدير طلبات النقل')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div>
        <h3 className="text-sm font-bold text-amber-900">تصدير طلبات النقل إلى Excel</h3>
        <p className="mt-1 text-xs text-amber-800">
          يتم التصدير من الجدول الفعلي لطلبات النقل مع المشروع والحالة الحالية لكل سجل.
        </p>
      </div>

      <button
        type="button"
        onClick={handleExport}
        className="app-button-secondary border-amber-300 bg-white px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        disabled={exporting}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {exporting ? 'جارٍ التصدير...' : 'تصدير ملف Excel لطلبات النقل'}
      </button>
    </div>
  )
}
