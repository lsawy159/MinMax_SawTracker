import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FileUp, AlertCircle, CheckCircle, XCircle, Upload } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface ValidationError {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

interface ImportResult {
  total: number
  success: number
  failed: number
  errors: ValidationError[]
}

// ترتيب الأعمدة المطلوب لعرض بيانات الموظفين
const EMPLOYEE_COLUMNS_ORDER = [
  'الاسم',
  'المهنة',
  'الجنسية',
  'رقم الإقامة',
  'رقم الجواز',
  'رقم الهاتف',
  'الحساب البنكي',
  'الراتب',
  'المشروع',
  'الشركة أو المؤسسة',
  'الرقم الموحد',
  'تاريخ الميلاد',
  'تاريخ الالتحاق',
  'تاريخ انتهاء الإقامة',
  'تاريخ انتهاء العقد',
  'تاريخ انتهاء عقد أجير',
  'تاريخ انتهاء التأمين الصحي',
  'رابط صورة الإقامة',
  'الملاحظات'
]

// ترتيب الأعمدة المطلوب لعرض بيانات المؤسسات
const COMPANY_COLUMNS_ORDER = [
  'اسم المؤسسة',
  'الرقم الموحد',
  'رقم اشتراك التأمينات الاجتماعية',
  'رقم اشتراك قوى',
  'تاريخ انتهاء السجل التجاري',
  'تاريخ انتهاء التأمينات الاجتماعية',
  'تاريخ انتهاء اشتراك قوى',
  'تاريخ انتهاء اشتراك مقيم',
  'الاعفاءات',
  'نوع المؤسسة',
  'الملاحظات'
]

export default function ImportTab() {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationError[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importType, setImportType] = useState<'employees' | 'companies'>('employees')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 200
  const [columnValidationError, setColumnValidationError] = useState<{
    missing: string[]
    extra: string[]
  } | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [shouldDeleteBeforeImport, setShouldDeleteBeforeImport] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'all' | 'matching'>('all')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingImport, setPendingImport] = useState<(() => void) | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error('يرجى اختيار ملف Excel فقط (.xlsx, .xls)')
        return
      }
      setFile(selectedFile)
      setValidationResults([])
      setPreviewData([])
      setImportResult(null)
      setCurrentPage(1)
      setColumnValidationError(null)
      setSelectedRows(new Set())
      setShouldDeleteBeforeImport(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile)
      setValidationResults([])
      setPreviewData([])
      setImportResult(null)
      setCurrentPage(1)
      setColumnValidationError(null)
      setSelectedRows(new Set())
      setShouldDeleteBeforeImport(false)
    } else {
      toast.error('يرجى إسقاط ملف Excel فقط (.xlsx, .xls)')
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  // Helper function to check if a cell value is empty
  const isCellEmpty = (value: any): boolean => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string' && value.trim() === '') return true
    if (typeof value === 'number' && isNaN(value)) return true
    return false
  }

  // Helper function to get errors for a specific cell
  const getCellErrors = (rowIndex: number, fieldName: string): ValidationError[] => {
    const excelRowNumber = rowIndex + 2 // Excel row number (1 is header, +1 for index)
    return validationResults.filter(
      error => error.row === excelRowNumber && error.field === fieldName
    )
  }

  // Helper functions for row selection
  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex)
      } else {
        newSet.add(rowIndex)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedRows.size === previewData.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(Array.from({ length: previewData.length }, (_, i) => i)))
    }
  }

  const isAllSelected = selectedRows.size === previewData.length && previewData.length > 0
  const isSomeSelected = selectedRows.size > 0 && selectedRows.size < previewData.length

  // Helper function to normalize column names (remove extra spaces and invisible characters)
  const normalizeColumnName = (col: string): string => {
    if (!col) return ''
    // إزالة جميع المسافات والرموز غير المرئية
    return col
      .toString()
      .trim()
      .replace(/\s+/g, ' ') // استبدال المسافات المتعددة بمسافة واحدة
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // إزالة رموز Unicode غير المرئية
      .replace(/[\u00A0]/g, ' ') // استبدال non-breaking space بمسافة عادية
      .replace(/[\u2009-\u200F]/g, '') // إزالة مسافات Unicode أخرى
      .trim()
  }
  
  // Helper function to compare columns (more flexible comparison)
  const columnsMatch = (col1: string, col2: string): boolean => {
    if (!col1 || !col2) return false
    const normalized1 = normalizeColumnName(col1)
    const normalized2 = normalizeColumnName(col2)
    // مقارنة مباشرة
    if (normalized1 === normalized2) return true
    // مقارنة بدون مسافات (في حالة وجود مسافات إضافية)
    const noSpaces1 = normalized1.replace(/\s/g, '')
    const noSpaces2 = normalized2.replace(/\s/g, '')
    return noSpaces1 === noSpaces2
  }

  // Helper function to validate Excel columns against required columns
  const validateExcelColumns = (excelColumns: string[]): { isValid: boolean; missing: string[]; extra: string[] } => {
    // تطبيع أسماء الأعمدة من Excel
    const normalizedExcelColumns = excelColumns.map(col => normalizeColumnName(col))
    
    if (importType === 'employees') {
      const missing: string[] = []
      const extra: string[] = []

      // التحقق من الأعمدة المطلوبة
      EMPLOYEE_COLUMNS_ORDER.forEach(requiredCol => {
        const normalizedRequired = normalizeColumnName(requiredCol)
        if (!normalizedExcelColumns.includes(normalizedRequired)) {
          missing.push(requiredCol)
        }
      })

      // التحقق من الأعمدة الإضافية
      normalizedExcelColumns.forEach((excelCol, index) => {
        const normalizedRequired = EMPLOYEE_COLUMNS_ORDER.map(c => normalizeColumnName(c))
        if (!normalizedRequired.includes(excelCol)) {
          extra.push(excelColumns[index]) // استخدام الاسم الأصلي
        }
      })

      return {
        isValid: missing.length === 0,
        missing,
        extra
      }
    } else {
      // للمؤسسات، التحقق من الأعمدة المطلوبة مثل الموظفين
      const missing: string[] = []
      const extra: string[] = []

      // قائمة الأعمدة التي يجب تجاهلها (تم استبدالها)
      const excludedColumns = [
        'رقم اشتراك التأمينات للشركات',
        'رقم اشتراك التامينات للشركات',
        'اشتراك التأمينات للشركات',
        'اشتراك التامينات للشركات'
      ].map(c => normalizeColumnName(c))

      // التحقق من الأعمدة المطلوبة
      COMPANY_COLUMNS_ORDER.forEach(requiredCol => {
        const normalizedRequired = normalizeColumnName(requiredCol)
        // البحث عن تطابق في الأعمدة المطبعة
        const found = normalizedExcelColumns.some(excelCol => 
          columnsMatch(excelCol, normalizedRequired)
        )
        if (!found) {
          // محاولة أخرى: البحث بدون تطبيع (مباشرة)
          const directMatch = excelColumns.some(excelCol => 
            columnsMatch(excelCol, requiredCol)
          )
          if (!directMatch) {
            missing.push(requiredCol)
            console.log(`❌ Missing column: "${requiredCol}" (normalized: "${normalizedRequired}")`)
            console.log(`   Available columns:`, excelColumns)
            console.log(`   Normalized available:`, normalizedExcelColumns)
          }
        }
      })

      // التحقق من الأعمدة الإضافية (مع تجاهل الأعمدة المستبعدة)
      normalizedExcelColumns.forEach((excelCol, index) => {
        const isExcluded = excludedColumns.some(excluded => 
          excelCol.includes(excluded) || excluded.includes(excelCol)
        )
        const normalizedRequired = COMPANY_COLUMNS_ORDER.map(c => normalizeColumnName(c))
        if (!normalizedRequired.includes(excelCol) && !isExcluded) {
          extra.push(excelColumns[index]) // استخدام الاسم الأصلي
        }
      })

      return {
        isValid: missing.length === 0,
        missing,
        extra
      }
    }
  }

  // Helper function to get ordered columns based on predefined order
  const getOrderedColumns = (dataColumns: string[], allData?: any[]): string[] => {
    if (importType === 'employees') {
      // ترتيب الأعمدة حسب EMPLOYEE_COLUMNS_ORDER - عرض الأعمدة المطلوبة فقط
      const ordered: string[] = []

      // إضافة الأعمدة المطلوبة بالترتيب المحدد فقط
      EMPLOYEE_COLUMNS_ORDER.forEach(col => {
        if (dataColumns.includes(col)) {
          ordered.push(col)
        }
      })

      // إرجاع الأعمدة المطلوبة فقط، بدون أي أعمدة إضافية
      return ordered
    } else {
      // للمؤسسات، نبدأ بالأعمدة المتوقعة ثم نضيف أي أعمدة إضافية
      const ordered: string[] = []
      const allColumnsSet = new Set<string>()
      
      // قائمة الأعمدة التي يجب تجاهلها (تم استبدالها)
      const excludedColumns = [
        'رقم اشتراك التأمينات للشركات',
        'رقم اشتراك التامينات للشركات',
        'اشتراك التأمينات للشركات',
        'اشتراك التامينات للشركات'
      ]
      
      // دالة للتحقق من أن العمود يجب تجاهله
      const shouldExcludeColumn = (columnName: string): boolean => {
        return excludedColumns.some(excluded => 
          columnName.includes(excluded) || excluded.includes(columnName)
        )
      }
      
      // أولاً: إضافة جميع الأعمدة المتوقعة بالترتيب المحدد
      COMPANY_COLUMNS_ORDER.forEach(col => {
        ordered.push(col)
        allColumnsSet.add(col)
      })
      
      // ثانياً: جمع جميع الأعمدة الإضافية من البيانات (إن وجدت) مع تجاهل الأعمدة المستبعدة
      if (allData && allData.length > 0) {
        allData.forEach(row => {
          Object.keys(row).forEach(key => {
            if (!allColumnsSet.has(key) && !shouldExcludeColumn(key)) {
              allColumnsSet.add(key)
              ordered.push(key)
            }
          })
        })
      } else if (dataColumns) {
        // إذا لم يتم توفير البيانات، نستخدم الأعمدة من الصف الأول
        dataColumns.forEach(key => {
          if (!allColumnsSet.has(key) && !shouldExcludeColumn(key)) {
            allColumnsSet.add(key)
            ordered.push(key)
          }
        })
      }
      
      return ordered
    }
  }

  const validateData = async () => {
    if (!file) return

    setValidating(true)
    const errors: ValidationError[] = []

    try {
      // إنشاء نسخة من الملف لتجنب مشكلة NotReadableError
      let data: ArrayBuffer
      try {
        data = await file.arrayBuffer()
      } catch (error) {
        // إذا فشلت القراءة، حاول قراءة الملف مرة أخرى
        console.warn('First read attempt failed, retrying...', error)
        // إعادة تعيين الملف
        const fileInput = document.getElementById('file-upload') as HTMLInputElement
        if (fileInput && fileInput.files && fileInput.files[0]) {
          data = await fileInput.files[0].arrayBuffer()
        } else {
          throw new Error('لا يمكن قراءة الملف. يرجى المحاولة مرة أخرى.')
        }
      }
      
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      
      // قراءة الأعمدة من header row مباشرة (للتأكد من قراءة جميع الأعمدة حتى الفارغة)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      const excelColumns: string[] = []
      
      // قراءة الأعمدة من الصف الأول (header row)
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
        const cell = worksheet[cellAddress]
        if (cell) {
          const cellValue = cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : ''
          if (cellValue) {
            excelColumns.push(cellValue)
          }
        }
      }
      
      // قراءة البيانات مع ضمان قراءة جميع الأعمدة حتى الفارغة
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '', // قيمة افتراضية للأعمدة الفارغة
        raw: false // تحويل القيم إلى strings
      })

      // Debug: طباعة الأعمدة للتحقق
      console.log('🔍 Excel Columns (from header):', excelColumns)
      console.log('🔍 Excel Columns (from jsonData):', jsonData.length > 0 ? Object.keys(jsonData[0]) : [])
      console.log('🔍 Required Columns:', importType === 'companies' ? COMPANY_COLUMNS_ORDER : EMPLOYEE_COLUMNS_ORDER)
      
      // التحقق من تطابق الأعمدة
      if (excelColumns.length > 0) {
        const columnValidation = validateExcelColumns(excelColumns)
        
        // Debug: طباعة نتائج التحقق
        console.log('🔍 Validation Result:', columnValidation)

        if (!columnValidation.isValid) {
          // إضافة خطأ عام يمنع الاستيراد
          errors.push({
            row: 0,
            field: 'الأعمدة',
            message: `الأعمدة في ملف Excel لا تطابق الأعمدة المطلوبة. الأعمدة المفقودة: ${columnValidation.missing.join(', ')}`,
            severity: 'error'
          })

          setValidationResults(errors)
          setPreviewData([]) // عدم عرض البيانات حتى يتم إصلاح الأعمدة
          setColumnValidationError({
            missing: columnValidation.missing,
            extra: columnValidation.extra
          })
          
          toast.error('❌ أعمدة Excel غير متطابقة! يرجى مراجعة الأعمدة المطلوبة أدناه.')
          
          setValidating(false)
          return
        } else {
          // إذا كانت الأعمدة متطابقة، مسح أي خطأ سابق
          setColumnValidationError(null)
        }
      }

      setPreviewData(jsonData) // Store all data for preview

      if (importType === 'employees') {
        // Load companies for validation
        const { data: companies } = await supabase.from('companies').select('id, name, unified_number')
        const companyMapByName = new Map<string, Array<{ id: string; name: string; unified_number?: number }>>()
        companies?.forEach(c => {
          if (c.name) {
            const existing = companyMapByName.get(c.name) || []
            existing.push({ id: c.id, name: c.name, unified_number: c.unified_number ? Number(c.unified_number) : undefined })
            companyMapByName.set(c.name, existing)
          }
        })

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2 // Excel row number (1 is header)
          
          // Check for company matching issues
          const companyName = row['الشركة أو المؤسسة'] || row['المؤسسة'] || ''
          const unifiedNumber = row['الرقم الموحد']
          
          if (companyName) {
            const matchingCompanies = companyMapByName.get(companyName) || []
            if (matchingCompanies.length > 1) {
              // Multiple companies with same name
              errors.push({
                row: rowNum,
                field: 'الشركة أو المؤسسة',
                message: `يوجد ${matchingCompanies.length} مؤسسات بنفس الاسم. يرجى استخدام الرقم الموحد للتمييز.`,
                severity: 'warning'
              })
            } else if (matchingCompanies.length === 0) {
              // Company not found
              errors.push({
                row: rowNum,
                field: 'الشركة أو المؤسسة',
                message: 'المؤسسة غير موجودة في النظام',
                severity: 'error'
              })
            }
          }

          // Required fields validation
          if (!row['الاسم'] || !row['الاسم'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'الاسم',
              message: 'الاسم مطلوب',
              severity: 'error'
            })
          }

          // Residence validation (required)
          if (!row['رقم الإقامة'] || !row['رقم الإقامة'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'رقم الإقامة',
              message: 'رقم الإقامة مطلوب',
              severity: 'error'
            })
          }

          // Mobile validation
          if (row['رقم الهاتف']) {
            const mobile = row['رقم الهاتف'].toString().replace(/\s/g, '')
            if (!/^[0-9+]{10,15}$/.test(mobile)) {
              errors.push({
                row: rowNum,
                field: 'رقم الهاتف',
                message: 'رقم الهاتف غير صحيح',
                severity: 'warning'
              })
            }
          }

          // Date validation
          if (row['تاريخ الميلاد']) {
            const birthDate = new Date(row['تاريخ الميلاد'])
            if (isNaN(birthDate.getTime())) {
              errors.push({
                row: rowNum,
                field: 'تاريخ الميلاد',
                message: 'تاريخ الميلاد غير صحيح',
                severity: 'error'
              })
            }
          }

          // Date validation for joining date
          if (row['تاريخ الالتحاق']) {
            const joiningDate = new Date(row['تاريخ الالتحاق'])
            if (isNaN(joiningDate.getTime())) {
              errors.push({
                row: rowNum,
                field: 'تاريخ الالتحاق',
                message: 'تاريخ الالتحاق غير صحيح',
                severity: 'error'
              })
            }
          }

          // Date validation for residence expiry
          if (row['تاريخ انتهاء الإقامة']) {
            const residenceExpiry = new Date(row['تاريخ انتهاء الإقامة'])
            if (isNaN(residenceExpiry.getTime())) {
              errors.push({
                row: rowNum,
                field: 'تاريخ انتهاء الإقامة',
                message: 'تاريخ انتهاء الإقامة غير صحيح',
                severity: 'error'
              })
            }
          }
        })
      } else if (importType === 'companies') {
        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2

          if (!row['اسم المؤسسة'] || !row['اسم المؤسسة'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'اسم المؤسسة',
              message: 'اسم المؤسسة مطلوب',
              severity: 'error'
            })
          }

          // التحقق من الرقم الموحد (مطلوب)
          if (!row['الرقم الموحد'] || !row['الرقم الموحد'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'الرقم الموحد',
              message: 'الرقم الموحد مطلوب',
              severity: 'error'
            })
          } else if (isNaN(Number(row['الرقم الموحد']))) {
            errors.push({
              row: rowNum,
              field: 'الرقم الموحد',
              message: 'الرقم الموحد يجب أن يكون رقماً',
              severity: 'error'
            })
          }
        })
      }

      setValidationResults(errors)

      if (errors.filter(e => e.severity === 'error').length === 0) {
        toast.success(`✓ تم التحقق من ${jsonData.length} سجل بنجاح`)
      } else {
        toast.warning(`تم العثور على ${errors.filter(e => e.severity === 'error').length} خطأ`)
      }
    } catch (error) {
      console.error('Validation error:', error)
      toast.error('فشل التحقق من البيانات')
    } finally {
      setValidating(false)
    }
  }

  const deleteDataBeforeImport = async (): Promise<boolean> => {
    try {
      if (deleteMode === 'all') {
        // حذف جميع البيانات
        if (importType === 'companies') {
          // قبل حذف المؤسسات، تحديث الموظفين المرتبطين بها ليكونوا بدون شركة
          const { error: updateError } = await supabase
            .from('employees')
            .update({ company_id: null })
            .not('company_id', 'is', null)
          
          if (updateError) {
            console.error('Error updating employees:', updateError)
            toast.warning('حدث خطأ أثناء تحديث الموظفين')
          } else {
            toast.success('تم تحديث الموظفين المرتبطين بالمؤسسات')
          }
          
          // حذف جميع المؤسسات
          const { error } = await supabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
          if (error) throw error
        } else {
          const { error } = await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000')
          if (error) throw error
        }
      } else {
        // حذف البيانات المطابقة فقط
        let data: ArrayBuffer
        try {
          data = await file!.arrayBuffer()
        } catch (error) {
          console.warn('First read attempt failed, retrying...', error)
          const fileInput = document.getElementById('file-upload') as HTMLInputElement
          if (fileInput && fileInput.files && fileInput.files[0]) {
            data = await fileInput.files[0].arrayBuffer()
          } else {
            throw new Error('لا يمكن قراءة الملف. يرجى المحاولة مرة أخرى.')
          }
        }
        const workbook = XLSX.read(data)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: '',
          raw: false
        })
        
        if (importType === 'companies') {
          // حذف المؤسسات بنفس الرقم الموحد
          for (const row of jsonData as any[]) {
            const unifiedNumber = row['الرقم الموحد']
            if (unifiedNumber) {
              const unifiedNum = Number(unifiedNumber)
              if (!isNaN(unifiedNum)) {
                // البحث عن المؤسسات بنفس الرقم الموحد
                const { data: companiesToDelete } = await supabase
                  .from('companies')
                  .select('id')
                  .eq('unified_number', unifiedNum)
                
                if (companiesToDelete && companiesToDelete.length > 0) {
                  const companyIds = companiesToDelete.map(c => c.id)
                  
                  // تحديث الموظفين المرتبطين بهذه المؤسسات ليكونوا بدون شركة
                  const { error: updateError } = await supabase
                    .from('employees')
                    .update({ company_id: null })
                    .in('company_id', companyIds)
                  
                  if (updateError) {
                    console.error('Error updating employees:', updateError)
                  }
                  
                  // حذف المؤسسات
                  const { error } = await supabase
                    .from('companies')
                    .delete()
                    .eq('unified_number', unifiedNum)
                  
                  if (error) throw error
                }
              }
            }
          }
        } else {
          // حذف الموظفين بنفس رقم الإقامة
          for (const row of jsonData as any[]) {
            const residenceNumber = row['رقم الإقامة']
            if (residenceNumber) {
              await supabase.from('employees').delete().eq('residence_number', residenceNumber)
            }
          }
        }
      }
      return true
    } catch (error) {
      console.error('Error deleting data:', error)
      toast.error('فشل حذف البيانات')
      return false
    }
  }

  const importData = async () => {
    if (!file || validationResults.filter(e => e.severity === 'error').length > 0) {
      toast.error('يرجى إصلاح الأخطاء أولاً')
      return
    }

    // التحقق من الحذف قبل الاستيراد
    if (shouldDeleteBeforeImport) {
      // عرض مودال التأكيد بدلاً من window.confirm
      setPendingImport(() => async () => {
        const deleted = await deleteDataBeforeImport()
        if (!deleted) {
          setShowConfirmDialog(false)
          setPendingImport(null)
          return
        }
        
        toast.success(`تم حذف البيانات بنجاح`)
        setShowConfirmDialog(false)
        setPendingImport(null)
        
        // متابعة الاستيراد
        await executeImport()
      })
      setShowConfirmDialog(true)
      return
    }

    // إذا لم يكن هناك حذف، مباشرة إلى الاستيراد
    await executeImport()
  }

  const executeImport = async () => {
    if (!file) return

    let successCount = 0
    let failCount = 0

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      let jsonData = XLSX.utils.sheet_to_json(worksheet)

      // تصفية البيانات حسب الصفوف المحددة
      if (selectedRows.size > 0) {
        jsonData = jsonData.filter((_, index) => selectedRows.has(index))
      }

      if (importType === 'employees') {
        // Get companies for lookup with unified_number
        const { data: companies } = await supabase.from('companies').select('id, name, unified_number')
        
        // Create maps for lookup
        const companyMapByName = new Map<string, string[]>() // name -> array of ids (for duplicates)
        const companyMapByUnifiedNumber = new Map<number, string>() // unified_number -> id
        
        companies?.forEach(c => {
          // Map by name (support multiple companies with same name)
          if (c.name) {
            const existing = companyMapByName.get(c.name) || []
            existing.push(c.id)
            companyMapByName.set(c.name, existing)
          }
          
          // Map by unified_number (should be unique)
          if (c.unified_number) {
            companyMapByUnifiedNumber.set(Number(c.unified_number), c.id)
          }
        })

        for (const row of jsonData as any[]) {
          try {
            let companyId: string | null = null
            
            // 1. Try to find by unified_number first (most accurate)
            const unifiedNumber = row['الرقم الموحد']
            if (unifiedNumber) {
              const unifiedNum = Number(unifiedNumber)
              if (!isNaN(unifiedNum)) {
                companyId = companyMapByUnifiedNumber.get(unifiedNum) || null
              }
            }
            
            // 2. If not found by unified_number, try by name
            if (!companyId) {
              const companyName = row['الشركة أو المؤسسة'] || row['المؤسسة'] || ''
              if (companyName) {
                const matchingIds = companyMapByName.get(companyName)
                if (matchingIds && matchingIds.length === 1) {
                  // Single match - use it
                  companyId = matchingIds[0]
                } else if (matchingIds && matchingIds.length > 1) {
                  // Multiple matches - use first one and log warning
                  companyId = matchingIds[0]
                  console.warn(`Multiple companies found with name "${companyName}". Using first match. Consider using unified_number for accuracy.`)
                }
              }
            }

            const employeeData: any = {
              name: row['الاسم'],
              profession: row['المهنة'] || null,
              nationality: row['الجنسية'] || null,
              residence_number: row['رقم الإقامة'] || null,
              passport_number: row['رقم الجواز'] || null,
              phone: row['رقم الهاتف']?.toString() || row['رقم الجوال']?.toString() || null,
              bank_account: row['الحساب البنكي'] || null,
              salary: row['الراتب'] ? Number(row['الراتب']) : null,
              project_name: row['المشروع'] || row['اسم المشروع'] || null,
              company_id: companyId,
              birth_date: row['تاريخ الميلاد'] ? new Date(row['تاريخ الميلاد']).toISOString().split('T')[0] : null,
              joining_date: row['تاريخ الالتحاق'] ? new Date(row['تاريخ الالتحاق']).toISOString().split('T')[0] : null,
              residence_expiry: row['تاريخ انتهاء الإقامة'] ? new Date(row['تاريخ انتهاء الإقامة']).toISOString().split('T')[0] : null,
              contract_expiry: row['تاريخ انتهاء العقد'] ? new Date(row['تاريخ انتهاء العقد']).toISOString().split('T')[0] : null,
              hired_worker_contract_expiry: row['تاريخ انتهاء عقد أجير'] ? new Date(row['تاريخ انتهاء عقد أجير']).toISOString().split('T')[0] : null,
              health_insurance_expiry: row['تاريخ انتهاء التأمين الصحي'] ? new Date(row['تاريخ انتهاء التأمين الصحي']).toISOString().split('T')[0] : null,
              residence_image_url: row['رابط صورة الإقامة'] || null,
              notes: row['الملاحظات'] || null
            }

            // دعم التوافق مع الأسماء القديمة والجديدة للتأمين الصحي
            if (!employeeData.health_insurance_expiry && (row['انتهاء التأمين الصحي'] || row['انتهاء اشتراك التأمين'])) {
              const healthInsuranceExpiry = row['انتهاء التأمين الصحي'] || row['انتهاء اشتراك التأمين']
              employeeData.health_insurance_expiry = healthInsuranceExpiry ? new Date(healthInsuranceExpiry).toISOString().split('T')[0] : null
            }

            const { error } = await supabase.from('employees').insert(employeeData)
            if (error) throw error
            successCount++
          } catch (error) {
            console.error('Error inserting employee:', error)
            failCount++
          }
        }
      } else if (importType === 'companies') {
        for (const row of jsonData as any[]) {
          try {
            // معالجة التواريخ
            const formatDate = (dateStr: string | undefined): string | null => {
              if (!dateStr || !dateStr.trim()) return null
              const trimmed = dateStr.trim()
              if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return trimmed
              }
              try {
                const date = new Date(trimmed)
                if (!isNaN(date.getTime())) {
                  return date.toISOString().split('T')[0]
                }
              } catch {
                // ignore
              }
              return null
            }

            const companyData: any = {
              name: row['اسم المؤسسة'],
              unified_number: row['الرقم الموحد'] ? Number(row['الرقم الموحد']) : null,
              social_insurance_number: row['رقم اشتراك التأمينات الاجتماعية'] || null,
              labor_subscription_number: row['رقم اشتراك قوى'] || null,
              commercial_registration_expiry: formatDate(row['تاريخ انتهاء السجل التجاري']),
              social_insurance_expiry: formatDate(row['تاريخ انتهاء التأمينات الاجتماعية'] || row['تاريخ انتهاء اشتراك التأمين']),
              ending_subscription_power_date: formatDate(row['تاريخ انتهاء اشتراك قوى']),
              ending_subscription_moqeem_date: formatDate(row['تاريخ انتهاء اشتراك مقيم']),
              exemptions: row['الاعفاءات'] || null,
              company_type: row['نوع المؤسسة'] || null,
              notes: row['الملاحظات'] || null,
              max_employees: 4 // القيمة الافتراضية
            }

            const { error } = await supabase.from('companies').insert(companyData)
            if (error) throw error
            successCount++
          } catch (error) {
            console.error('Error inserting company:', error)
            failCount++
          }
        }
      }

      setImportResult({
        total: jsonData.length,
        success: successCount,
        failed: failCount,
        errors: []
      })

      if (successCount > 0) {
        toast.success(`✓ تم استيراد ${successCount} سجل بنجاح`)
      }
      if (failCount > 0) {
        toast.error(`✗ فشل استيراد ${failCount} سجل`)
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('فشل عملية الاستيراد')
    } finally {
      setImporting(false)
    }
  }

  const errorCount = validationResults.filter(e => e.severity === 'error').length
  const warningCount = validationResults.filter(e => e.severity === 'warning').length

  return (
    <div className="space-y-6">
      {/* Import Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">نوع البيانات المراد استيرادها</label>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setImportType('employees')
              setCurrentPage(1)
              setSelectedRows(new Set())
              setShouldDeleteBeforeImport(false)
            }}
            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
              importType === 'employees'
                ? 'border-blue-600 bg-blue-50 text-blue-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            موظفين
          </button>
          <button
            onClick={() => {
              setImportType('companies')
              setCurrentPage(1)
              setSelectedRows(new Set())
              setShouldDeleteBeforeImport(false)
            }}
            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
              importType === 'companies'
                ? 'border-green-600 bg-green-50 text-green-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            مؤسسات
          </button>
        </div>
      </div>

      {/* File Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition"
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">اسحب وأفلت ملف Excel هنا</p>
        <p className="text-sm text-gray-500 mb-4">أو انقر لتحديد ملف</p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition"
        >
          <FileUp className="w-5 h-5" />
          اختيار ملف Excel
        </label>
      </div>

      {/* Selected File */}
      {file && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileUp className="w-6 h-6 text-blue-600" />
              <div>
                <div className="font-medium text-blue-900">{file.name}</div>
                <div className="text-sm text-blue-700">{(file.size / 1024).toFixed(2)} KB</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={validateData}
                disabled={validating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition"
              >
                {validating ? 'جارٍ التحقق...' : 'التحقق من البيانات'}
              </button>
              <button
                onClick={() => setFile(null)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Results Summary */}
      {validationResults.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h4 className="font-bold text-gray-900">ملخص نتائج التحقق</h4>
            <div className="flex items-center gap-4">
              {errorCount > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">{errorCount} خطأ</span>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">{warningCount} تحذير</span>
                </div>
              )}
              {errorCount === 0 && warningCount === 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">جاهز للاستيراد</span>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 py-3 bg-white">
            <p className="text-sm text-gray-600">
              يتم عرض جميع الأخطاء والتحذيرات مباشرة في الجدول أدناه. الخلايا التي بها أخطاء تظهر بخلفية حمراء، 
              والخلايا التي بها تحذيرات تظهر بخلفية صفراء. يمكنك التمرير على الخلايا لعرض تفاصيل الخطأ.
            </p>
          </div>
        </div>
      )}

      {/* Column Validation Error Message */}
      {columnValidationError && (
        <div className="border-2 border-red-500 rounded-lg overflow-hidden bg-red-50">
          <div className="bg-red-600 px-4 py-3 border-b border-red-700">
            <div className="flex items-center gap-2">
              <XCircle className="w-6 h-6 text-white" />
              <h4 className="font-bold text-white text-lg">❌ أعمدة Excel غير متطابقة!</h4>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <p className="text-red-800 font-medium mb-3">
                الأعمدة في ملف Excel لا تطابق الأعمدة المطلوبة من النظام.
              </p>
              <p className="text-red-700 text-sm mb-4">
                <strong>يرجى إعادة تسمية أعمدة Excel لتطابق الأعمدة المطلوبة أدناه حتى يتم الاستيراد بنجاح.</strong>
              </p>
              
              {columnValidationError.missing.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-bold text-red-900 mb-2">الأعمدة المفقودة ({columnValidationError.missing.length}):</h5>
                  <div className="bg-red-100 rounded p-3">
                    <ul className="list-disc list-inside space-y-1">
                      {columnValidationError.missing.map((col, index) => (
                        <li key={index} className="text-red-800 font-medium">{col}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {columnValidationError.extra.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-bold text-yellow-900 mb-2">الأعمدة الإضافية (غير مطلوبة):</h5>
                  <div className="bg-yellow-100 rounded p-3">
                    <ul className="list-disc list-inside space-y-1">
                      {columnValidationError.extra.map((col, index) => (
                        <li key={index} className="text-yellow-800">{col}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-red-200">
                <h5 className="font-bold text-gray-900 mb-3">
                  الأعمدة المطلوبة ({importType === 'employees' ? EMPLOYEE_COLUMNS_ORDER.length : COMPANY_COLUMNS_ORDER.length} عمود):
                </h5>
                <div className="bg-gray-50 rounded p-4 border border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(importType === 'employees' ? EMPLOYEE_COLUMNS_ORDER : COMPANY_COLUMNS_ORDER).map((col, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-gray-600 font-mono text-xs">{index + 1}.</span>
                        <span className="text-gray-800 font-medium">{col}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Data */}
      {previewData.length > 0 && !columnValidationError && (() => {
        const totalPages = Math.ceil(previewData.length / rowsPerPage)
        const startIndex = (currentPage - 1) * rowsPerPage
        const endIndex = startIndex + rowsPerPage
        const paginatedData = previewData.slice(startIndex, endIndex)
        const dataColumns = Object.keys(previewData[0])
        const columns = getOrderedColumns(dataColumns, previewData)

        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="font-bold text-gray-900 text-sm">
                  معاينة البيانات ({previewData.length} صف)
                </h4>
                {selectedRows.size > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    ({selectedRows.size} صف محدد)
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600">
                الصفحة {currentPage} من {totalPages}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-1.5 py-1 text-center font-medium text-gray-700 whitespace-nowrap bg-gray-200 text-[10px] w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = isSomeSelected
                        }}
                        onChange={toggleSelectAll}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </th>
                    <th className="px-1.5 py-1 text-right font-medium text-gray-700 whitespace-nowrap bg-gray-200 text-[10px]">
                      رقم الصف
                    </th>
                    {columns.map((key, index) => (
                      <th key={index} className="px-1.5 py-1 text-right font-medium text-gray-700 whitespace-nowrap text-[10px]">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, localRowIndex) => {
                    const actualRowIndex = startIndex + localRowIndex
                    const excelRowNumber = actualRowIndex + 2
                    return (
                      <tr key={actualRowIndex} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-1.5 py-1 text-center bg-gray-50 text-[10px]">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(actualRowIndex)}
                            onChange={() => toggleRowSelection(actualRowIndex)}
                            className="w-3 h-3 cursor-pointer"
                          />
                        </td>
                        <td className="px-1.5 py-1 text-center font-medium text-gray-600 bg-gray-50 text-[10px]">
                          {excelRowNumber}
                        </td>
                        {columns.map((key, colIndex) => {
                          const value = row[key]
                          const isEmpty = isCellEmpty(value)
                          const cellErrors = getCellErrors(actualRowIndex, key)
                          const hasError = cellErrors.some(e => e.severity === 'error')
                          const hasWarning = cellErrors.some(e => e.severity === 'warning')
                          
                          let cellClassName = 'px-1.5 py-1 whitespace-nowrap text-[10px] '
                          if (hasError) {
                            cellClassName += 'bg-red-100 text-red-800 border-2 border-red-400 font-medium'
                          } else if (hasWarning) {
                            cellClassName += 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400'
                          } else if (isEmpty) {
                            cellClassName += 'bg-red-50 text-red-700 border border-red-200 font-medium'
                          } else {
                            cellClassName += 'text-gray-700'
                          }

                          return (
                            <td
                              key={colIndex}
                              className={cellClassName}
                              title={cellErrors.length > 0 ? cellErrors.map(e => e.message).join('; ') : ''}
                            >
                              <div className="flex items-center gap-0.5">
                                {hasError && <XCircle className="w-3 h-3 text-red-600 flex-shrink-0" />}
                                {hasWarning && !hasError && <AlertCircle className="w-3 h-3 text-yellow-600 flex-shrink-0" />}
                                <span className="truncate max-w-[150px]">{isEmpty ? (importType === 'companies' ? 'فارغ' : 'غير موجود') : value?.toString() || ''}</span>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  عرض {startIndex + 1} - {Math.min(endIndex, previewData.length)} من {previewData.length}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    السابق
                  </button>
                  <span className="px-2 py-1 text-xs text-gray-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Delete Options */}
      {file && previewData.length > 0 && !columnValidationError && errorCount === 0 && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              id="delete-before-import"
              checked={shouldDeleteBeforeImport}
              onChange={(e) => setShouldDeleteBeforeImport(e.target.checked)}
              className="mt-1 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="delete-before-import" className="flex-1 cursor-pointer">
              <span className="font-medium text-gray-900">حذف البيانات الموجودة قبل الاستيراد</span>
              <p className="text-xs text-gray-600 mt-1">
                سيتم حذف البيانات الموجودة في النظام قبل إضافة البيانات المستوردة
              </p>
            </label>
          </div>
          
          {shouldDeleteBeforeImport && (
            <div className="ml-7 space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="delete-all"
                  name="delete-mode"
                  value="all"
                  checked={deleteMode === 'all'}
                  onChange={(e) => setDeleteMode(e.target.value as 'all' | 'matching')}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="delete-all" className="cursor-pointer text-sm text-gray-700">
                  حذف جميع البيانات ({importType === 'companies' ? 'جميع المؤسسات' : 'جميع الموظفين'})
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id="delete-matching"
                  name="delete-mode"
                  value="matching"
                  checked={deleteMode === 'matching'}
                  onChange={(e) => setDeleteMode(e.target.value as 'all' | 'matching')}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="delete-matching" className="cursor-pointer text-sm text-gray-700">
                  حذف البيانات المطابقة فقط ({importType === 'companies' ? 'المؤسسات بنفس الرقم الموحد' : 'الموظفين بنفس رقم الإقامة'})
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Button */}
      {file && previewData.length > 0 && !columnValidationError && errorCount === 0 && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm text-gray-600">
            {selectedRows.size > 0 
              ? `سيتم استيراد ${selectedRows.size} من ${previewData.length} صف`
              : `سيتم استيراد جميع الصفوف (${previewData.length} صف)`
            }
          </div>
          <button
            onClick={importData}
            disabled={importing}
            className="flex items-center gap-2 px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 text-lg font-medium transition"
          >
            <FileUp className="w-6 h-6" />
            {importing ? 'جارٍ الاستيراد...' : 'استيراد البيانات'}
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    تأكيد الحذف
                  </h3>
                  <p className="text-sm text-gray-500">
                    هذا الإجراء لا يمكن التراجع عنه
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  {deleteMode === 'all' 
                    ? `هل أنت متأكد من حذف جميع ${importType === 'companies' ? 'المؤسسات' : 'الموظفين'} من النظام؟`
                    : `هل أنت متأكد من حذف ${importType === 'companies' ? 'المؤسسات المطابقة' : 'الموظفين المطابقين'} قبل الاستيراد؟`
                  }
                </p>
                
                {deleteMode === 'all' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-red-800">
                        <p className="font-medium mb-1">سيتم حذف:</p>
                        <ul className="list-disc list-inside space-y-1 text-red-700">
                          <li>جميع {importType === 'companies' ? 'المؤسسات' : 'الموظفين'} من النظام</li>
                        </ul>
                        {importType === 'companies' && (
                          <div className="mt-2 pt-2 border-t border-red-200">
                            <p className="text-red-700 text-xs">
                              <strong>ملاحظة:</strong> سيتم تحديث الموظفين المرتبطين بهذه المؤسسات ليكونوا بدون شركة (لن يتم حذفهم)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {deleteMode === 'matching' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium mb-1">سيتم حذف:</p>
                        <ul className="list-disc list-inside space-y-1 text-yellow-700">
                          <li>{importType === 'companies' ? 'المؤسسات' : 'الموظفين'} المطابقة فقط</li>
                          <li>سيتم تحديد المطابقة حسب {importType === 'companies' ? 'الرقم الموحد' : 'رقم الإقامة'}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">بعد الحذف سيتم استيراد:</p>
                      <p className="text-blue-700">
                        {selectedRows.size > 0 
                          ? `${selectedRows.size} من ${previewData.length} صف`
                          : `جميع الصفوف (${previewData.length} صف)`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false)
                    setPendingImport(null)
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={async () => {
                    if (pendingImport) {
                      await pendingImport()
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                >
                  تأكيد الحذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <h4 className="text-xl font-bold text-green-900">اكتملت عملية الاستيراد</h4>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{importResult.total}</div>
              <div className="text-sm text-gray-600">إجمالي السجلات</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{importResult.success}</div>
              <div className="text-sm text-gray-600">تم بنجاح</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{importResult.failed}</div>
              <div className="text-sm text-gray-600">فشل</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
