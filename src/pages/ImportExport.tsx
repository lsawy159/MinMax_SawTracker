import { useState } from 'react'
import Layout from '@/components/layout/Layout'
import { FileDown, FileUp, FileText, Download, Loader2 } from 'lucide-react'
import ExportTab from '@/components/import-export/ExportTab'
import ImportTab from '@/components/import-export/ImportTab'
import TemplatesTab from '@/components/import-export/TemplatesTab'
import TransferProceduresExcelImport from '@/components/import-export/TransferProceduresExcelImport'
import TransferProceduresExcelExport from '@/components/import-export/TransferProceduresExcelExport'
import { usePermissions } from '@/utils/permissions'
import { supabase } from '@/lib/supabase'
import { loadXlsx } from '@/utils/lazyXlsx'
import { saveAs } from 'file-saver'
import { toast } from 'sonner'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'

type TabType = 'export' | 'import' | 'templates'
type DataEntityType = 'employees' | 'companies' | 'transferProcedures'

export default function ImportExport() {
  const { canImport, canExport } = usePermissions()
  const [activeTab, setActiveTab] = useState<TabType>('export')
  const [importEntityType, setImportEntityType] = useState<DataEntityType>('employees')
  const [exportEntityType, setExportEntityType] = useState<DataEntityType>('employees')
  const [exportingAll, setExportingAll] = useState(false)

  const exportAll = async () => {
    if (!canExport('importExport')) {
      toast.error('ليس لديك صلاحية التصدير')
      return
    }
    setExportingAll(true)
    try {
      const XLSX = await loadXlsx()
      const dateLabel = new Date().toISOString().split('T')[0]

      // تصدير الموظفين
      const { data: rawEmp, error: empErr } = await supabase
        .from('employees')
        .select(
          'name,profession,nationality,birth_date,phone,passport_number,residence_number,' +
          'joining_date,contract_expiry,hired_worker_contract_expiry,residence_expiry,' +
          'project_name,bank_account,residence_image_url,health_insurance_expiry,' +
          'salary,notes,additional_fields,' +
          'company:companies(name,unified_number),project:projects(name)'
        )
        .eq('is_deleted', false)
        .order('name')
      if (empErr) throw empErr

      const employees = (rawEmp ?? []) as unknown[]
      if (employees.length > 0) {
        const fmtDate = (d: unknown) =>
          d && typeof d === 'string' ? formatDateShortWithHijri(d) : ''
        const empData = employees.map((e) => {
          const emp = e as Record<string, unknown>
          const company = emp.company as Record<string, unknown> | null
          const project = emp.project as Record<string, unknown> | null
          let bankName = ''
          let hiredStatus = ''
          try {
            const af = emp.additional_fields as Record<string, unknown> | null
            if (af) {
              bankName = String(af.bank_name ?? '')
              hiredStatus = String(af.hired_worker_contract_status ?? '')
            }
          } catch { /* ignore */ }
          return {
            الاسم: emp.name ?? '',
            المهنة: emp.profession ?? '',
            الجنسية: emp.nationality ?? '',
            'رقم الإقامة': emp.residence_number ?? '',
            'رقم الجواز': emp.passport_number ?? '',
            'رقم الهاتف': emp.phone ?? '',
            'الحساب البنكي': emp.bank_account ?? '',
            'اسم البنك': bankName,
            الراتب: emp.salary ?? '',
            'حالة عقد أجير': hiredStatus,
            المشروع: String(project?.name ?? emp.project_name ?? ''),
            'الشركة أو المؤسسة': String(company?.name ?? ''),
            'الرقم الموحد': String(company?.unified_number ?? ''),
            'تاريخ الميلاد': fmtDate(emp.birth_date),
            'تاريخ الالتحاق': fmtDate(emp.joining_date),
            'تاريخ انتهاء الإقامة': fmtDate(emp.residence_expiry),
            'تاريخ انتهاء العقد': fmtDate(emp.contract_expiry),
            'تاريخ انتهاء عقد أجير': fmtDate(emp.hired_worker_contract_expiry),
            'تاريخ انتهاء التأمين الصحي': fmtDate(emp.health_insurance_expiry),
            'رابط صورة الإقامة': emp.residence_image_url ?? '',
            الملاحظات: emp.notes ?? '',
          }
        })
        const wsE = XLSX.utils.json_to_sheet(empData)
        const wbE = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wbE, wsE, 'الموظفين')
        wsE['!cols'] = Array(21).fill({ wch: 18 })
        const bufE = XLSX.write(wbE, { bookType: 'xlsx', type: 'array' })
        saveAs(
          new Blob([bufE], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          `employees_export_${dateLabel}.xlsx`
        )
      }

      // تصدير المؤسسات
      const { data: rawComp, error: compErr } = await supabase
        .from('companies')
        .select(
          'name,unified_number,social_insurance_number,labor_subscription_number,' +
          'commercial_registration_expiry,ending_subscription_power_date,' +
          'ending_subscription_moqeem_date,exemptions,company_type,notes'
        )
        .order('name')
      if (compErr) throw compErr

      const companies = (rawComp ?? []) as unknown[]
      if (companies.length > 0) {
        const fmtDate = (d: unknown) =>
          d && typeof d === 'string' ? formatDateShortWithHijri(d) : ''
        const compData = companies.map((c) => {
          const comp = c as Record<string, unknown>
          return {
            'اسم المؤسسة': comp.name ?? '',
            'الرقم الموحد': comp.unified_number ?? '',
            'رقم اشتراك التأمينات الاجتماعية': comp.social_insurance_number ?? '',
            'رقم اشتراك قوى': comp.labor_subscription_number ?? '',
            'تاريخ انتهاء السجل التجاري': fmtDate(comp.commercial_registration_expiry),
            'تاريخ انتهاء اشتراك قوى': fmtDate(comp.ending_subscription_power_date),
            'تاريخ انتهاء اشتراك مقيم': fmtDate(comp.ending_subscription_moqeem_date),
            الاعفاءات: comp.exemptions ?? '',
            'نوع المؤسسة': comp.company_type ?? '',
            الملاحظات: comp.notes ?? '',
          }
        })
        const wsC = XLSX.utils.json_to_sheet(compData)
        const wbC = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wbC, wsC, 'المؤسسات')
        wsC['!cols'] = [
          { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 20 },
          { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
        ]
        const bufC = XLSX.write(wbC, { bookType: 'xlsx', type: 'array' })
        saveAs(
          new Blob([bufC], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          `companies_export_${dateLabel}.xlsx`
        )
      }

      toast.success(`تم تصدير ${employees.length} موظف و${companies.length} مؤسسة`)
    } catch (error) {
      console.error('Export all error:', error)
      toast.error('فشل تصدير البيانات')
    } finally {
      setExportingAll(false)
    }
  }

  const tabs = [
    {
      id: 'export' as TabType,
      label: 'التصدير',
      icon: FileDown,
      description: 'تصدير البيانات إلى ملفات Excel',
      color: 'blue',
    },
    {
      id: 'import' as TabType,
      label: 'الاستيراد',
      icon: FileUp,
      description: 'استيراد البيانات من ملفات Excel',
      color: 'green',
    },
    {
      id: 'templates' as TabType,
      label: 'القوالب',
      icon: FileText,
      description: 'تحميل قوالب Excel الجاهزة',
      color: 'purple',
    },
  ]

  const renderEntitySelector = (
    current: DataEntityType,
    setCurrent: (value: DataEntityType) => void
  ) => (
    <div className="mb-4">
      <label className="mb-2 block text-xs font-medium text-neutral-600">نوع البيانات</label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setCurrent('employees')}
          className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
            current === 'employees'
              ? 'border-primary bg-primary/15 text-foreground'
              : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
          }`}
        >
          الموظفين
        </button>
        <button
          type="button"
          onClick={() => setCurrent('companies')}
          className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
            current === 'companies'
              ? 'border-green-600 bg-green-50 text-success-700'
              : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
          }`}
        >
          المؤسسات
        </button>
        <button
          type="button"
          onClick={() => setCurrent('transferProcedures')}
          className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
            current === 'transferProcedures'
              ? 'border-amber-500 bg-amber-50 text-amber-800'
              : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
          }`}
        >
          طلبات النقل
        </button>
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="app-page app-tech-grid">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="app-icon-chip flex-shrink-0">
              <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="text-left sm:text-right">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-neutral-900">
                استيراد وتصدير
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 mt-0.5 sm:mt-1">إدارة البيانات</p>
            </div>
          </div>
          {canExport('importExport') && (
            <button
              onClick={exportAll}
              disabled={exportingAll}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-primary/20 disabled:opacity-50"
            >
              {exportingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              تصدير الكل
            </button>
          )}
        </div>

        {/* Tabs Navigation - Responsive */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-4 sm:flex-row mb-4 sm:mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            const activeStyles = 'bg-primary/15 border-primary/60 text-foreground shadow-soft'
            const inactiveStyles =
              'bg-surface border-neutral-200 text-neutral-600 hover:border-neutral-300'

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 transition-all duration-200 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-3 ${
                  isActive ? activeStyles : inactiveStyles
                }`}
              >
                <div
                  className={`rounded-lg p-1.5 sm:p-2 ${
                    isActive ? 'bg-primary/20' : 'bg-neutral-100'
                  }`}
                >
                  <Icon
                    className={`h-3 w-3 sm:h-4 sm:w-4 ${
                      isActive ? 'text-foreground' : 'text-neutral-500'
                    }`}
                  />
                </div>
                <span className="font-medium text-xs sm:text-sm text-center leading-tight">
                  {tab.label}
                </span>
                <p
                  className={`hidden text-center text-[10px] leading-tight line-clamp-1 sm:inline sm:text-xs ${
                    isActive ? 'text-foreground-secondary' : 'text-neutral-500'
                  }`}
                >
                  {tab.description}
                </p>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="app-panel p-3 sm:p-4">
          {activeTab === 'export' && canExport('importExport') && (
            <>
              {renderEntitySelector(exportEntityType, setExportEntityType)}
              {exportEntityType === 'employees' && (
                <ExportTab key="export-employees" initialExportType="employees" hideTypeSelector />
              )}
              {exportEntityType === 'companies' && (
                <ExportTab key="export-companies" initialExportType="companies" hideTypeSelector />
              )}
              {exportEntityType === 'transferProcedures' && (
                <TransferProceduresExcelExport canExport={canExport('importExport')} />
              )}
            </>
          )}
          {activeTab === 'import' && canImport('importExport') && (
            <>
              {renderEntitySelector(importEntityType, setImportEntityType)}
              {importEntityType === 'employees' && (
                <ImportTab key="import-employees" initialImportType="employees" isInModal={true} />
              )}
              {importEntityType === 'companies' && (
                <ImportTab key="import-companies" initialImportType="companies" isInModal={true} />
              )}
              {importEntityType === 'transferProcedures' && (
                <TransferProceduresExcelImport canImport={canImport('importExport')} />
              )}
            </>
          )}
          {activeTab === 'templates' && <TemplatesTab />}
        </div>
      </div>
    </Layout>
  )
}
