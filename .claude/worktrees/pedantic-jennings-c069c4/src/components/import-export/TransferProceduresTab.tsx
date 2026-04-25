import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { saveAs } from 'file-saver'
import { AlertCircle, CheckCircle2, Download, Loader2, Plus, RefreshCcw, Trash2, Upload, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import AddEmployeeModal from '@/components/employees/AddEmployeeModal'
import EmployeeCard from '@/components/employees/EmployeeCard'
import { Company, Employee, Project, supabase, TransferProcedure } from '@/lib/supabase'
import { parseDate, normalizeDate } from '@/utils/dateParser'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { loadXlsx } from '@/utils/lazyXlsx'
import {
  isNewTransferProcedureStatus,
  NEW_TRANSFER_PROCEDURE_STATUS_OPTIONS,
  TRANSFER_PROCEDURE_STATUS_OPTIONS,
  TRANSFER_PROCEDURE_TEMPLATE_COLUMNS,
} from '@/utils/transferProcedures'

type TransferProcedureRow = TransferProcedure & { project?: Project | null }

type TransferProcedureFormData = {
  request_date: string
  name: string
  iqama: string
  status: string
  current_unified_number: string
  project_id: string
  notes: string
}

type TransferImportRow = {
  request_date: string
  name: string
  iqama: number
  status: string
  current_unified_number: number
  project_id: string
  notes?: string
}

const createDefaultForm = (): TransferProcedureFormData => ({
  request_date: new Date().toISOString().slice(0, 10),
  name: '',
  iqama: '',
  status: 'تحت إجراء النقل',
  current_unified_number: '',
  project_id: '',
  notes: '',
})

const isStatusAllowed = (status: string): boolean => {
  return TRANSFER_PROCEDURE_STATUS_OPTIONS.includes(status as (typeof TRANSFER_PROCEDURE_STATUS_OPTIONS)[number])
}

export default function TransferProceduresTab({ canImport, canExport }: { canImport: boolean; canExport: boolean }) {
  const [transferRows, setTransferRows] = useState<TransferProcedureRow[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<TransferProcedureFormData>(createDefaultForm())
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({})
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [conversionSource, setConversionSource] = useState<TransferProcedureRow | null>(null)
  const [newEmployeeCard, setNewEmployeeCard] = useState<(Employee & { company: Company; project?: Project }) | null>(null)
  const [showEmployeeCard, setShowEmployeeCard] = useState(false)

  useEffect(() => {
    void loadTransferData()
  }, [])

  const loadTransferData = async () => {
    try {
      setLoading(true)
      const [transferRes, projectsRes] = await Promise.all([
        supabase
          .from('transfer_procedures')
          .select('*, project:projects(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .eq('status', 'active')
          .order('name'),
      ])

      if (transferRes.error) throw transferRes.error
      if (projectsRes.error) throw projectsRes.error

      const transferData = (transferRes.data || []) as TransferProcedureRow[]
      setTransferRows(transferData)
      setProjects((projectsRes.data || []) as Project[])
      setStatusDrafts(
        transferData.reduce<Record<string, string>>((acc, row) => {
          acc[row.id] = row.status
          return acc
        }, {})
      )
    } catch (error) {
      console.error(error)
      toast.error('تعذر تحميل بيانات إجراءات النقل')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const done = transferRows.filter((row) => row.status === 'منقول').length
    return {
      total: transferRows.length,
      inProgress: transferRows.length - done,
      done,
    }
  }, [transferRows])

  const resetForm = () => {
    setFormData(createDefaultForm())
  }

  const handleCreateTransferProcedure = async (event: FormEvent) => {
    event.preventDefault()

    const requestDateParsed = parseDate(formData.request_date)
    if (!requestDateParsed.date) {
      toast.error('تاريخ الطلب غير صحيح')
      return
    }

    if (!formData.name.trim()) {
      toast.error('اسم العامل مطلوب')
      return
    }

    if (!formData.project_id) {
      toast.error('المشروع مطلوب')
      return
    }

    if (!isStatusAllowed(formData.status)) {
      toast.error('حالة النقل غير صالحة')
      return
    }

    const iqama = Number(formData.iqama)
    const unifiedNumber = Number(formData.current_unified_number)

    if (!Number.isInteger(iqama) || iqama <= 0) {
      toast.error('رقم الإقامة غير صالح')
      return
    }

    if (!Number.isInteger(unifiedNumber) || unifiedNumber <= 0) {
      toast.error('الرقم الموحد الحالي غير صالح')
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase.from('transfer_procedures').insert({
        request_date: normalizeDate(formData.request_date),
        name: formData.name.trim(),
        iqama,
        status: formData.status,
        current_unified_number: unifiedNumber,
        project_id: formData.project_id,
        notes: formData.notes.trim() || null,
      })

      if (error) {
        if (error.code === '23505') {
          toast.error('يوجد طلب نقل نشط بنفس رقم الإقامة')
          return
        }
        throw error
      }

      toast.success('تم تسجيل إجراء النقل بنجاح')
      resetForm()
      await loadTransferData()
    } catch (error) {
      console.error(error)
      toast.error('فشل تسجيل إجراء النقل')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (row: TransferProcedureRow) => {
    const nextStatus = statusDrafts[row.id] || row.status
    if (!isStatusAllowed(nextStatus)) {
      toast.error('حالة النقل غير صالحة')
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase
        .from('transfer_procedures')
        .update({ status: nextStatus })
        .eq('id', row.id)

      if (error) throw error

      toast.success('تم تحديث الحالة')
      await loadTransferData()
    } catch (error) {
      console.error(error)
      toast.error('فشل تحديث الحالة')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTransfer = async (rowId: string) => {
    try {
      setSaving(true)
      const { error } = await supabase.from('transfer_procedures').delete().eq('id', rowId)
      if (error) throw error

      toast.success('تم حذف طلب النقل')
      await loadTransferData()
    } catch (error) {
      console.error(error)
      toast.error('فشل حذف طلب النقل')
    } finally {
      setSaving(false)
    }
  }

  const handleExportTransfers = async () => {
    if (!canExport) {
      toast.error('ليس لديك صلاحية التصدير')
      return
    }

    if (transferRows.length === 0) {
      toast.info('لا توجد بيانات للتصدير')
      return
    }

    try {
      const XLSX = await loadXlsx()
      const exportRows = transferRows.map((row) => ({
        'تاريخ الطلب': row.request_date,
        'الاسم': row.name,
        'رقم الإقامة': String(row.iqama),
        'الحالة': row.status,
        'الرقم الموحد الحالي': String(row.current_unified_number),
        'المشروع': row.project?.name || '',
        'ملاحظات': row.notes || '',
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportRows)
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'إجراءات النقل')
      const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'تقرير_إجراءات_النقل.xlsx')
      toast.success('تم تصدير إجراءات النقل بنجاح')
    } catch (error) {
      console.error(error)
      toast.error('فشل تصدير إجراءات النقل')
    }
  }

  const parseTransferImportRows = (
    rows: Record<string, unknown>[],
    projectNameMap: Map<string, string>
  ): { validRows: TransferImportRow[]; errors: string[] } => {
    const validRows: TransferImportRow[] = []
    const errors: string[] = []

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2
      const requestDateRaw = String(rawRow['تاريخ الطلب'] || '').trim()
      const name = String(rawRow['الاسم'] || '').trim()
      const iqamaRaw = String(rawRow['رقم الإقامة'] || '').trim()
      const status = String(rawRow['الحالة'] || '').trim()
      const currentUnifiedRaw = String(rawRow['الرقم الموحد الحالي'] || '').trim()
      const projectName = String(rawRow['المشروع'] || '').trim().toLowerCase()
      const notes = String(rawRow['ملاحظات'] || '').trim()

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
        errors.push(`الصف ${rowNumber}: حالة الطلب يجب أن تكون واحدة من: ${NEW_TRANSFER_PROCEDURE_STATUS_OPTIONS.join('، ')}`)
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

    return { validRows, errors }
  }

  const handleImportTransfers = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canImport) {
      toast.error('ليس لديك صلاحية الاستيراد')
      return
    }

    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile) {
      return
    }

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error('يرجى اختيار ملف Excel بصيغة xlsx أو xls')
      return
    }

    try {
      setSaving(true)
      const XLSX = await loadXlsx()
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })

      if (rows.length === 0) {
        toast.error('الملف لا يحتوي على بيانات')
        return
      }

      const fileColumns = Object.keys(rows[0])
      const missingColumns = TRANSFER_PROCEDURE_TEMPLATE_COLUMNS.filter((column) => !fileColumns.includes(column))
      if (missingColumns.length > 0) {
        toast.error(`الأعمدة التالية مفقودة: ${missingColumns.join('، ')}`)
        return
      }

      const projectNameMap = new Map(projects.map((project) => [project.name.trim().toLowerCase(), project.id]))
      const { validRows, errors } = parseTransferImportRows(rows, projectNameMap)

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

      await loadTransferData()

      if (errors.length > 0) {
        toast.warning(`تم الاستيراد مع ملاحظات: ${successCount} نجاح، ${failedCount + errors.length} تعثر`)
      } else if (failedCount > 0) {
        toast.warning(`تم استيراد ${successCount} صفوف، وتعذر ${failedCount} صفوف`) 
      } else {
        toast.success(`تم استيراد ${successCount} صفوف بنجاح`)
      }
    } catch (error) {
      console.error(error)
      toast.error('فشل استيراد إجراءات النقل')
    } finally {
      setSaving(false)
    }
  }

  const handleStartConversion = (row: TransferProcedureRow) => {
    if (row.status !== 'منقول') {
      toast.error('يمكن تحويل السجل إلى موظف فقط بعد حالة "منقول"')
      return
    }

    setConversionSource(row)
    setShowEmployeeModal(true)
  }

  const handleEmployeeCreatedFromTransfer = (createdEmployee?: Employee & { company: Company; project?: Project }) => {
    if (!createdEmployee || !conversionSource) {
      return
    }

    setNewEmployeeCard(createdEmployee)
    setShowEmployeeCard(true)

    void (async () => {
      const { error } = await supabase
        .from('transfer_procedures')
        .delete()
        .eq('id', conversionSource.id)

      if (error) {
        toast.warning('تم إنشاء الموظف لكن لم يتم حذف سجل النقل تلقائياً')
      } else {
        toast.success('تم تحويل سجل النقل إلى موظف وحذف السجل المؤقت')
      }

      setConversionSource(null)
      await loadTransferData()
    })()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">إجمالي الطلبات</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-700">قيد المعالجة</div>
          <div className="mt-1 text-2xl font-bold text-amber-700">{stats.inProgress}</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-sm text-green-700">جاهزة للتحويل</div>
          <div className="mt-1 text-2xl font-bold text-green-700">{stats.done}</div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">تسجيل طلب نقل جديد</h3>
            <p className="text-xs text-gray-500 mt-1">المشروع إلزامي قبل حفظ السجل</p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="app-button-secondary px-3 py-2 text-sm"
            disabled={saving}
          >
            <RefreshCcw className="h-4 w-4" />
            تفريغ النموذج
          </button>
        </div>

        <form onSubmit={handleCreateTransferProcedure} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            type="date"
            value={formData.request_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, request_date: e.target.value }))}
            className="app-input"
            required
            disabled={saving}
          />
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className="app-input"
            placeholder="اسم العامل"
            required
            disabled={saving}
          />
          <input
            type="text"
            value={formData.iqama}
            onChange={(e) => setFormData((prev) => ({ ...prev, iqama: e.target.value }))}
            className="app-input"
            placeholder="رقم الإقامة"
            required
            disabled={saving}
          />
          <select
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
            className="app-input"
            required
            disabled={saving}
          >
            {NEW_TRANSFER_PROCEDURE_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={formData.current_unified_number}
            onChange={(e) => setFormData((prev) => ({ ...prev, current_unified_number: e.target.value }))}
            className="app-input"
            placeholder="الرقم الموحد الحالي"
            required
            disabled={saving}
          />
          <select
            value={formData.project_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, project_id: e.target.value }))}
            className="app-input"
            required
            disabled={saving}
          >
            <option value="">اختر المشروع</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            className="app-input min-h-[88px] md:col-span-2 lg:col-span-2"
            placeholder="ملاحظات إضافية (اختياري)"
            disabled={saving}
          />
          <button type="submit" className="app-button-primary h-[44px] self-start" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            حفظ طلب النقل
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">إدارة طلبات النقل</h3>
            <p className="text-xs text-gray-500 mt-1">التحويل إلى موظف متاح فقط عند اكتمال الحالة: منقول</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canImport && (
              <label className="app-button-secondary cursor-pointer px-3 py-2 text-sm">
                <Upload className="h-4 w-4" />
                استيراد
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportTransfers} disabled={saving} />
              </label>
            )}
            {canExport && (
              <button type="button" onClick={handleExportTransfers} className="app-button-secondary px-3 py-2 text-sm" disabled={saving}>
                <Download className="h-4 w-4" />
                تصدير
              </button>
            )}
            <button type="button" onClick={() => void loadTransferData()} className="app-button-secondary px-3 py-2 text-sm" disabled={loading || saving}>
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            جاري تحميل بيانات إجراءات النقل...
          </div>
        ) : transferRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            لا توجد سجلات حالياً. أضف طلب نقل جديد أو استورد ملف Excel.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">الاسم</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">رقم الإقامة</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">تاريخ الطلب</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">المشروع</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">الحالة</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transferRows.map((row) => {
                  const isDone = row.status === 'منقول'
                  return (
                    <tr key={row.id} className="bg-white">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        {row.notes ? <div className="text-xs text-gray-500 mt-1">{row.notes}</div> : null}
                      </td>
                      <td className="px-3 py-3 font-mono">{row.iqama}</td>
                      <td className="px-3 py-3">{formatDateShortWithHijri(row.request_date)}</td>
                      <td className="px-3 py-3">{row.project?.name || '-'}</td>
                      <td className="px-3 py-3 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <select
                            value={statusDrafts[row.id] || row.status}
                            onChange={(e) => setStatusDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                            className="app-input py-2 text-sm"
                            disabled={saving}
                          >
                            {TRANSFER_PROCEDURE_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleUpdateStatus(row)}
                            className="app-button-secondary px-2.5 py-2"
                            disabled={saving}
                            title="حفظ الحالة"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartConversion(row)}
                            disabled={!isDone || saving}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                              isDone
                                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <UserPlus className="h-4 w-4 inline ml-1" />
                            تحويل لموظف
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTransfer(row.id)}
                            className="app-button-secondary px-2.5 py-2 text-red-600 hover:bg-red-50"
                            disabled={saving}
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              عند الضغط على «تحويل لموظف» سيتم فتح نموذج الموظف الكامل. بعد الحفظ الناجح: يفتح كرت الموظف مباشرة مع شاشة الالتزامات المالية، ثم يُحذف سجل النقل المؤقت تلقائياً.
            </p>
          </div>
        </div>
      </div>

      <AddEmployeeModal
        isOpen={showEmployeeModal}
        onClose={() => {
          setShowEmployeeModal(false)
          setConversionSource(null)
        }}
        onSuccess={handleEmployeeCreatedFromTransfer}
        initialData={conversionSource ? {
          name: conversionSource.name,
          residence_number: String(conversionSource.iqama),
          project_id: conversionSource.project_id,
          notes: conversionSource.notes || '',
          joining_date: conversionSource.request_date,
        } : undefined}
      />

      {showEmployeeCard && newEmployeeCard && (
        <EmployeeCard
          employee={newEmployeeCard}
          onClose={() => {
            setShowEmployeeCard(false)
            setNewEmployeeCard(null)
          }}
          onUpdate={() => {
            void loadTransferData()
          }}
          defaultFinancialOverlayOpen
        />
      )}
    </div>
  )
}
