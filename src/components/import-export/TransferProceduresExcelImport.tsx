import { ChangeEvent, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { parseDate, normalizeDate } from '@/utils/dateParser'
import { loadXlsx } from '@/utils/lazyXlsx'
import {
  isNewTransferProcedureStatus,
  NEW_TRANSFER_PROCEDURE_STATUS_OPTIONS,
  TRANSFER_PROCEDURE_TEMPLATE_COLUMNS,
} from '@/utils/transferProcedures'

interface TransferProceduresExcelImportProps {
  canImport: boolean
}

export default function TransferProceduresExcelImport({
  canImport,
}: TransferProceduresExcelImportProps) {
  const [importing, setImporting] = useState(false)

  const handleImportTransfers = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canImport) {
      toast.error('ليس لديك صلاحية الاستيراد')
      event.target.value = ''
      return
    }

    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error('يرجى اختيار ملف Excel بصيغة xlsx أو xls')
      return
    }

    try {
      setImporting(true)
      const XLSX = await loadXlsx()
      const [projectsRes] = await Promise.all([
        supabase.from('projects').select('id, name').eq('status', 'active').order('name'),
      ])

      if (projectsRes.error) throw projectsRes.error

      const projectNameMap = new Map(
        (projectsRes.data || []).map((project) => [project.name.trim().toLowerCase(), project.id])
      )

      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })

      if (rows.length === 0) {
        toast.error('الملف لا يحتوي على بيانات')
        return
      }

      const fileColumns = Object.keys(rows[0])
      const missingColumns = TRANSFER_PROCEDURE_TEMPLATE_COLUMNS.filter(
        (column) => !fileColumns.includes(column)
      )
      if (missingColumns.length > 0) {
        toast.error(`الأعمدة التالية مفقودة: ${missingColumns.join('، ')}`)
        return
      }

      const errors: string[] = []
      const validRows: Array<{
        request_date: string
        name: string
        iqama: number
        status: string
        current_unified_number: number
        project_id: string
        notes?: string
      }> = []

      rows.forEach((row, index) => {
        const rowNumber = index + 2
        const requestDateRaw = String(row['تاريخ الطلب'] || '').trim()
        const name = String(row['الاسم'] || '').trim()
        const iqamaRaw = String(row['رقم الإقامة'] || '').trim()
        const status = String(row['الحالة'] || '').trim()
        const currentUnifiedRaw = String(row['الرقم الموحد الحالي'] || '').trim()
        const projectName = String(row['المشروع'] || '')
          .trim()
          .toLowerCase()
        const notes = String(row['ملاحظات'] || '').trim()

        const requestDateParsed = parseDate(requestDateRaw)
        if (!requestDateParsed.date) {
          errors.push(`الصف ${rowNumber}: تاريخ الطلب غير صالح`)
          return
        }

        if (!name) {
          errors.push(`الصف ${rowNumber}: الاسم مطلوب`)
          return
        }

        if (!isNewTransferProcedureStatus(status)) {
          errors.push(
            `الصف ${rowNumber}: حالة الطلب يجب أن تكون واحدة من: ${NEW_TRANSFER_PROCEDURE_STATUS_OPTIONS.join('، ')}`
          )
          return
        }

        const iqama = Number(iqamaRaw)
        if (!Number.isInteger(iqama) || iqama <= 0) {
          errors.push(`الصف ${rowNumber}: رقم الإقامة غير صالح`)
          return
        }

        const currentUnifiedNumber = Number(currentUnifiedRaw)
        if (!Number.isInteger(currentUnifiedNumber) || currentUnifiedNumber <= 0) {
          errors.push(`الصف ${rowNumber}: الرقم الموحد الحالي غير صالح`)
          return
        }

        const projectId = projectNameMap.get(projectName)
        if (!projectId) {
          errors.push(`الصف ${rowNumber}: المشروع غير موجود بالنظام`)
          return
        }

        validRows.push({
          request_date: normalizeDate(requestDateRaw) || requestDateRaw,
          name,
          iqama,
          status,
          current_unified_number: currentUnifiedNumber,
          project_id: projectId,
          notes: notes || undefined,
        })
      })

      if (validRows.length === 0) {
        toast.error(errors[0] || 'لا توجد صفوف صالحة للاستيراد')
        return
      }

      let successCount = 0
      let failedCount = 0

      for (const row of validRows) {
        const { error } = await supabase.from('transfer_procedures').insert({
          request_date: row.request_date,
          name: row.name,
          iqama: row.iqama,
          status: row.status,
          current_unified_number: row.current_unified_number,
          project_id: row.project_id,
          notes: row.notes || null,
        })

        if (error) {
          failedCount += 1
        } else {
          successCount += 1
        }
      }

      if (errors.length > 0 || failedCount > 0) {
        toast.warning(`تم استيراد ${successCount} صفوف، وتعذر ${failedCount + errors.length} صفوف`)
      } else {
        toast.success(`تم استيراد ${successCount} طلب نقل بنجاح`)
      }
    } catch (error) {
      console.error(error)
      toast.error('فشل استيراد طلبات النقل')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div>
        <h3 className="text-sm font-bold text-amber-900">استيراد طلبات النقل من Excel</h3>
        <p className="mt-1 text-xs text-amber-800">
          هذا القسم مخصص لرفع طلبات نقل جديدة فقط، لذلك لا يقبل الحالة «منقول» داخل الملف.
        </p>
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-3 text-sm font-medium text-amber-900 transition hover:bg-amber-100">
        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {importing ? 'جارٍ الاستيراد...' : 'اختيار ملف Excel وبدء الاستيراد'}
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportTransfers}
          disabled={importing}
        />
      </label>
    </div>
  )
}
