import { useState, useRef, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FileUp, AlertCircle, CheckCircle, XCircle, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/utils/logger'
import * as XLSX from 'xlsx'
import { parseDate, normalizeDate } from '@/utils/dateParser'
import { formatDateDDMMMYYYY } from '@/utils/dateFormatter'
import DeleteConfirmationModal from './DeleteConfirmationModal'

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

interface ImportTabProps {
  initialImportType?: 'employees' | 'companies'
  onImportSuccess?: () => void
  isInModal?: boolean // تحديد ما إذا كان المكون داخل modal
}

export default function ImportTab({ initialImportType = 'employees', onImportSuccess, isInModal = false }: ImportTabProps = {}) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationError[]>([])
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importType, setImportType] = useState<'employees' | 'companies'>(initialImportType)
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
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 })
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImportCancelled, setIsImportCancelled] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<Map<number, 'keep' | 'replace'>>(new Map())
  const [dbConflicts, setDbConflicts] = useState<Set<number>>(new Set())
  const [, setImportedIds] = useState<{ employees: string[], companies: string[] }>({ employees: [], companies: [] })
  const importedIdsRef = useRef<{ employees: string[], companies: string[] }>({ employees: [], companies: [] })
  const cancelImportRef = useRef(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [validationFilter, setValidationFilter] = useState<'all' | 'errors' | 'warnings'>('all')


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
      setValidationFilter('all')
      setConflictResolution(new Map())
      setDbConflicts(new Set())
    }
  }

  const handleCancel = () => {
    setFile(null)
    setValidationResults([])
    setPreviewData([])
    setImportResult(null)
    setCurrentPage(1)
    setColumnValidationError(null)
    setSelectedRows(new Set())
    setShouldDeleteBeforeImport(false)
    setValidationFilter('all')
    setConflictResolution(new Map())
    setDbConflicts(new Set())
    // إعادة تعيين input file
    const fileInput = document.getElementById('file-upload') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
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
      setValidationFilter('all')
      setConflictResolution(new Map())
      setDbConflicts(new Set())
    } else {
      toast.error('يرجى إسقاط ملف Excel فقط (.xlsx, .xls)')
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  // Helper function to check if a cell value is empty
  const isCellEmpty = (value: unknown): boolean => {
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

  // Helper functions for row selection and visibility
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

  const getRowIssues = (rowIndex: number) => {
    const excelRowNumber = rowIndex + 2
    const rowValidation = validationResults.filter(error => error.row === excelRowNumber)
    const hasError = rowValidation.some(error => error.severity === 'error')
    const hasWarning = rowValidation.some(error => error.severity === 'warning')
    return { hasError, hasWarning, rowValidation }
  }

  const getVisibleRowIndices = () => {
    return previewData
      .map((_, index) => index)
      .filter(index => {
        const { hasError, hasWarning } = getRowIssues(index)
        if (validationFilter === 'errors') return hasError
        if (validationFilter === 'warnings') return !hasError && hasWarning
        return true
      })
  }

  const toggleSelectAll = useCallback(() => {
    const visibleIndices = previewData
      .map((_, index) => index)
      .filter(index => {
        const { hasError, hasWarning } = getRowIssues(index)
        if (validationFilter === 'errors') return hasError
        if (validationFilter === 'warnings') return !hasError && hasWarning
        return true
      })
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      const allVisibleSelected = visibleIndices.length > 0 && visibleIndices.every(index => newSet.has(index))
      if (allVisibleSelected) {
        visibleIndices.forEach(index => newSet.delete(index))
      } else {
        visibleIndices.forEach(index => newSet.add(index))
      }
      return newSet
    })
  }, [previewData, validationFilter, validationResults])

  const updateConflictChoice = useCallback((rowIndex: number, choice: 'keep' | 'replace') => {
    setConflictResolution(prev => {
      const next = new Map(prev)
      next.set(rowIndex, choice)
      return next
    })
  }, [])

  const visibleRowIndices = getVisibleRowIndices()
  const isAllSelected = visibleRowIndices.length > 0 && visibleRowIndices.every(index => selectedRows.has(index))
  const isSomeSelected = visibleRowIndices.some(index => selectedRows.has(index)) && !isAllSelected

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
            logger.debug(`❌ Missing column: "${requiredCol}" (normalized: "${normalizedRequired}")`)
            logger.debug(`   Available columns:`, excelColumns)
            logger.debug(`   Normalized available:`, normalizedExcelColumns)
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
  const getOrderedColumns = (dataColumns: string[], allData?: Record<string, unknown>[]): string[] => {
    if (importType === 'employees') {
      // ترتيب الأعمدة حسب EMPLOYEE_COLUMNS_ORDER - عرض الأعمدة المطلوبة فقط
      const ordered: string[] = []
      // الأعمدة التي نريد إخفاءها من العرض (لأنها طويلة أو غير ضرورية للعرض)
      const hiddenColumnNames = ['الشركة أو المؤسسة', 'رابط صورة الإقامة']
      
      // دالة للتحقق من أن العمود مخفي
      const isColumnHidden = (columnName: string): boolean => {
        const normalized = normalizeColumnName(columnName)
        // إخفاء أي عمود يحتوي على "صورة" و "إقامة"
        if (normalized.includes('صورة') && normalized.includes('إقامة')) {
          return true
        }
        // إخفاء الأعمدة المحددة
        return hiddenColumnNames.some(hidden => {
          const normalizedHidden = normalizeColumnName(hidden)
          return columnName === hidden || normalized === normalizedHidden
        })
      }

      // إضافة الأعمدة المطلوبة بالترتيب المحدد فقط (باستثناء المخفية)
      EMPLOYEE_COLUMNS_ORDER.forEach(col => {
        // التحقق من أن العمود موجود في البيانات
        const existsInData = dataColumns.includes(col) || 
                            dataColumns.some(dc => normalizeColumnName(dc) === normalizeColumnName(col))
        
        // التحقق من أن العمود غير مخفي
        const isHidden = isColumnHidden(col)
        
        if (existsInData && !isHidden) {
          // إضافة الاسم من البيانات الفعلية
          const actualName = dataColumns.find(dc => 
            dc === col || normalizeColumnName(dc) === normalizeColumnName(col)
          ) || col
          
          if (!isColumnHidden(actualName)) {
            ordered.push(actualName)
          }
        }
      })
      
      // التأكد من إزالة أي أعمدة مخفية قد تكون تبقيت
      return ordered.filter(col => !isColumnHidden(col))

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
      
      // تحديد أعمدة التواريخ
      const dateColumns = [
        'تاريخ الميلاد',
        'تاريخ الالتحاق',
        'تاريخ انتهاء الإقامة',
        'تاريخ انتهاء العقد',
        'تاريخ انتهاء عقد أجير',
        'تاريخ انتهاء التأمين الصحي'
      ]
      
      // الحصول على indices الأعمدة للتواريخ بناءً على excelColumns
      const dateColumnIndices: { [key: string]: number } = {}
      excelColumns.forEach((col, index) => {
        if (dateColumns.includes(col)) {
          dateColumnIndices[col] = index
        }
      })
      
      // دالة لقراءة التاريخ من خلية Excel بشكل صحيح
      const readDateFromCell = (cell: XLSX.CellObject | undefined): string => {
        if (!cell) return ''
        
        // إذا كان هناك نص منسق (cell.w)، استخدمه مباشرة - هذا هو النص المعروض في Excel
        if (cell.w) {
          const formattedText = String(cell.w).trim()
          // التحقق من أن النص ليس فارغاً أو مساوياً لقيمة افتراضية
          if (formattedText && formattedText !== '#N/A' && formattedText !== '#VALUE!') {
            return formattedText
          }
        }
        
        // إذا كانت القيمة رقم تسلسلي (Excel date serial number)
        if (cell.t === 'n' && typeof cell.v === 'number') {
          // التحقق من أن الرقم ضمن نطاق تاريخ Excel المعقول
          if (cell.v > 0 && cell.v < 1000000) {
            try {
              // تحويل الرقم التسلسلي إلى تاريخ
              const excelEpoch = new Date(1900, 0, 1)
              const days = Math.floor(cell.v) - 2 // Excel incorrectly treats 1900 as leap year
              const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000)
              
              // التحقق من أن التاريخ صحيح
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear()
                // التحقق من أن السنة منطقية (بين 1900 و 2100)
                if (year >= 1900 && year <= 2100) {
                  // تنسيق التاريخ بصيغة DD-Mon-YYYY
                  const day = String(date.getDate()).padStart(2, '0')
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  const month = monthNames[date.getMonth()]
                  return `${day}-${month}-${year}`
                }
              }
            } catch (e) {
              console.warn('Error converting Excel serial date:', e, 'value:', cell.v)
            }
          }
        }
        
        // إذا كانت القيمة نص، استخدمها مباشرة
        if (cell.v !== undefined && cell.v !== null) {
          const strValue = String(cell.v).trim()
          if (strValue && strValue !== 'null' && strValue !== 'undefined') {
            return strValue
          }
        }
        
        return ''
      }
      
      // قراءة البيانات
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { 
        defval: '', // قيمة افتراضية للأعمدة الفارغة
        raw: false // تحويل القيم إلى strings
      })
      
      // معالجة التواريخ من الخلايا مباشرة للحصول على القيم الصحيحة
      jsonData.forEach((row: Record<string, unknown>, rowIndex: number) => {
        // rowIndex + 1 لأن الصف الأول (0) في Excel هو header row
        const excelRowIndex = rowIndex + 1
        
        // معالجة كل عمود تاريخ
        dateColumns.forEach(colName => {
          const colIndex = dateColumnIndices[colName]
          if (colIndex !== undefined && colIndex !== -1) {
            // الحصول على عنوان الخلية (مثل A2, B3, إلخ)
            const cellAddress = XLSX.utils.encode_cell({ r: excelRowIndex, c: colIndex })
            const cell = worksheet[cellAddress]
            
            if (cell) {
              // قراءة التاريخ من الخلية مباشرة
              const dateValue = readDateFromCell(cell)
              if (dateValue) {
                // استبدال القيمة في jsonData بالقيمة الصحيحة من الخلية
                row[colName] = dateValue
                // Debug: طباعة التواريخ التي تم قراءتها بنجاح (معطل لتقليل الضوضاء)
                // if (rowIndex < 3) {
                //   logger.debug(`  ✅ Row ${rowIndex + 2}, Column "${colName}": Successfully read "${dateValue}" from cell ${cellAddress}`)
                // }
              } else {
                // إذا فشلت قراءة الخلية، احتفظ بالقيمة من jsonData بعد تنظيفها
                const fallbackValue = row[colName] ? String(row[colName] || '').trim() : ''
                row[colName] = fallbackValue
                // Debug: طباعة التواريخ التي فشلت قراءتها (معطل لتقليل الضوضاء)
                // if (rowIndex < 3 && fallbackValue) {
                //   logger.debug(`  ⚠️ Row ${rowIndex + 2}, Column "${colName}": Using fallback value "${fallbackValue}" (readDateFromCell returned empty)`)
                // }
              }
            } else if (row[colName]) {
              // إذا لم تكن هناك خلية، احتفظ بالقيمة من jsonData
              row[colName] = String(row[colName] || '').trim()
              // Debug: طباعة التواريخ التي لم تكن هناك خلية لها (معطل لتقليل الضوضاء)
              // if (rowIndex < 3) {
              //   logger.debug(`  📝 Row ${rowIndex + 2}, Column "${colName}": No cell found, using jsonData value "${row[colName]}"`)
              // }
            } else {
              row[colName] = ''
            }
          }
        })
      })
      
      // Debug: طباعة عينة من التواريخ للتحقق (معطل لتقليل الضوضاء)
      // if (jsonData.length > 0) {
      //   logger.debug('🔍 Sample dates from first 3 rows after readDateFromCell:')
      //   for (let i = 0; i < Math.min(3, jsonData.length); i++) {
      //     logger.debug(`  Row ${i + 1}:`)
      //     dateColumns.forEach(col => {
      //       const value = jsonData[i][col]
      //       if (value) {
      //         logger.debug(`    ${col}: "${value}" (type: ${typeof value})`)
      //       } else {
      //         logger.debug(`    ${col}: (empty)`)
      //       }
      //     })
      //   }
      // }

      // Debug: طباعة الأعمدة للتحقق (معطل لتقليل الضوضاء)
      // logger.debug('🔍 Excel Columns (from header):', excelColumns)
      // logger.debug('🔍 Excel Columns (from jsonData):', jsonData.length > 0 ? Object.keys(jsonData[0]) : [])
      // logger.debug('🔍 Required Columns:', importType === 'companies' ? COMPANY_COLUMNS_ORDER : EMPLOYEE_COLUMNS_ORDER)
      
      // التحقق من تطابق الأعمدة
      if (excelColumns.length > 0) {
        const columnValidation = validateExcelColumns(excelColumns)
        
        // Debug: طباعة نتائج التحقق (معطل لتقليل الضوضاء)
        // logger.debug('🔍 Validation Result:', columnValidation)

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

      setPreviewData(jsonData as Record<string, unknown>[]) // Store all data for preview

      const newDbConflicts = new Set<number>()

      if (importType === 'employees') {
        // Load companies for validation
        const { data: companies } = await supabase.from('companies').select('id, name, unified_number')
        const companyMapByUnifiedNumber = new Map<number, { id: string; name: string; unified_number?: number }>()
        companies?.forEach(c => {
          if (c.unified_number) {
            companyMapByUnifiedNumber.set(Number(c.unified_number), { id: c.id, name: c.name, unified_number: c.unified_number ? Number(c.unified_number) : undefined })
          }
        })

        // Load existing residence numbers from database for duplicate check
        const { data: existingEmployees } = await supabase.from('employees').select('residence_number')
        const existingResidenceNumbers = new Set<string>()
        existingEmployees?.forEach(emp => {
          if (emp.residence_number) {
            existingResidenceNumbers.add(emp.residence_number.toString().trim())
          }
        })

        // Track residence numbers in the sheet to detect duplicates within the sheet
        const residenceNumberMap = new Map<string, number[]>() // residence_number -> array of row indices

        jsonData.forEach((row: Record<string, unknown>, index: number) => {
          const residenceNumber = row['رقم الإقامة']?.toString().trim()
          if (residenceNumber) {
            if (!residenceNumberMap.has(residenceNumber)) {
              residenceNumberMap.set(residenceNumber, [])
            }
            residenceNumberMap.get(residenceNumber)!.push(index)
          }
        })

        jsonData.forEach((row: Record<string, unknown>, index: number) => {
          const rowNum = index + 2 // Excel row number (1 is header)
          
          // Check for company matching issues - search by unified number
          const unifiedNumber = row['الرقم الموحد'] || row['unified_number'] || ''
          const unifiedNumberStr = String(unifiedNumber).trim()
          
          if (unifiedNumberStr) {
            const unifiedNum = Number(unifiedNumberStr)
            if (!isNaN(unifiedNum)) {
              const company = companyMapByUnifiedNumber.get(unifiedNum)
              if (!company) {
                // Company not found by unified number
                errors.push({
                  row: rowNum,
                  field: 'الرقم الموحد',
                  message: `المؤسسة برقم موحد ${unifiedNum} غير موجودة في النظام`,
                  severity: 'error'
                })
              }
            } else {
              // Invalid unified number format
              errors.push({
                row: rowNum,
                field: 'الرقم الموحد',
                message: 'الرقم الموحد يجب أن يكون رقماً صحيحاً',
                severity: 'error'
              })
            }
          } else {
            // No unified number provided
            errors.push({
              row: rowNum,
              field: 'الرقم الموحد',
              message: 'الرقم الموحد للمؤسسة مطلوب للبحث عن المؤسسة',
              severity: 'error'
            })
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
          const residenceNumber = row['رقم الإقامة']?.toString().trim()
          if (!residenceNumber) {
            errors.push({
              row: rowNum,
              field: 'رقم الإقامة',
              message: 'رقم الإقامة مطلوب',
              severity: 'error'
            })
          } else {
            // Check for duplicates within the sheet
            const duplicateIndices = residenceNumberMap.get(residenceNumber) || []
            const [firstOccurrence] = duplicateIndices

            if (duplicateIndices.length > 1 && firstOccurrence !== undefined && duplicateIndices.indexOf(index) !== firstOccurrence) {
              // This is a duplicate in the sheet (not the first occurrence)
              errors.push({
                row: rowNum,
                field: 'رقم الإقامة',
                message: `رقم الإقامة مكرر في الصف ${firstOccurrence + 2}. سيتم استيراد الصف الأول فقط.`,
                severity: 'error'
              })
            } else if (existingResidenceNumbers.has(residenceNumber)) {
              // Conflict with existing employee in DB - let user decide Keep/Replace
              errors.push({
                row: rowNum,
                field: 'رقم الإقامة',
                message: 'يوجد سجل بنفس رقم الإقامة في النظام. اختر الاحتفاظ بالسجل الحالي أو استبداله.',
                severity: 'warning'
              })
              newDbConflicts.add(index)
            }
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

          // Date validation using parseDate
          const dateFields = [
            'تاريخ الميلاد',
            'تاريخ الالتحاق',
            'تاريخ انتهاء الإقامة',
            'تاريخ انتهاء العقد',
            'تاريخ انتهاء عقد أجير',
            'تاريخ انتهاء التأمين الصحي'
          ]

          for (const field of dateFields) {
            if (row[field]) {
              const result = parseDate(String(row[field]))
              if (!result.date) {
                errors.push({
                  row: rowNum,
                  field: field,
                  message: result.error || `${field} غير صحيح`,
                  severity: 'error'
                })
              }
            }
          }
        })
      } else if (importType === 'companies') {
        const { data: existingCompanies } = await supabase
          .from('companies')
          .select('unified_number')

        const existingUnifiedNumbers = new Set<number>()
        existingCompanies?.forEach(c => {
          if (c.unified_number) {
            const n = Number(c.unified_number)
            if (!isNaN(n)) existingUnifiedNumbers.add(n)
          }
        })

        jsonData.forEach((row: Record<string, unknown>, index: number) => {
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

          // تعارض مع سجل موجود في النظام باستخدام الرقم الموحد فقط
          const unifiedNumber = row['الرقم الموحد'] ? Number(row['الرقم الموحد']) : null
          if (unifiedNumber !== null && !isNaN(unifiedNumber) && existingUnifiedNumbers.has(unifiedNumber)) {
            errors.push({
              row: rowNum,
              field: 'الرقم الموحد',
              message: 'يوجد سجل بنفس الرقم الموحد في النظام. اختر الاحتفاظ بالسجل الحالي أو استبداله.',
              severity: 'warning'
            })
            newDbConflicts.add(index)
          }
        })
      }

      setValidationResults(errors)
      setDbConflicts(newDbConflicts)
      setConflictResolution(new Map())

      if (errors.filter(e => e.severity === 'error').length === 0) {
        toast.success(`✓ تم التحقق من ${jsonData.length} سجل بنجاح`)
      } else {
        toast.warning(`تم العثور على ${errors.filter(e => e.severity === 'error').length} خطأ`)
      }

      // فتح modal المعاينة إذا كانت هناك بيانات للعرض وليس هناك أخطاء في الأعمدة
      if (jsonData.length > 0 && !columnValidationError) {
        setShowPreviewModal(true)
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
      logger.debug('🗑️ Starting deleteDataBeforeImport:', { deleteMode, importType })
      
      if (deleteMode === 'all') {
        // حذف جميع البيانات
        if (importType === 'companies') {
          logger.debug('🗑️ Deleting all companies...')
          setIsDeleting(true)
          setDeleteProgress({ current: 0, total: 0 })
          
          // جلب عدد المؤسسات المراد حذفها
          const { count: totalCount } = await supabase
            .from('companies')
            .select('*', { count: 'exact', head: true })
            .neq('id', '00000000-0000-0000-0000-000000000000')
          
          const totalCompanies = totalCount || 0
          setDeleteProgress({ current: 0, total: totalCompanies })
          
          // قبل حذف المؤسسات، تحديث الموظفين المرتبطين بها ليكونوا بدون شركة
          const { error: updateError } = await supabase
            .from('employees')
            .update({ company_id: null })
            .not('company_id', 'is', null)
          
          if (updateError) {
            console.error('❌ Error updating employees:', updateError)
            toast.error(`فشل تحديث الموظفين: ${updateError.message}`)
            setIsDeleting(false)
            setDeleteProgress({ current: 0, total: 0 })
            return false
          } else {
            logger.debug('✅ Successfully updated employees')
          }
          
          // حذف المؤسسات على دفعات
          const batchSize = 500
          let deletedCount = 0
          
          while (deletedCount < totalCompanies) {
            // جلب دفعة من المؤسسات للحذف
            const { data: batch, error: fetchError } = await supabase
              .from('companies')
              .select('id')
              .neq('id', '00000000-0000-0000-0000-000000000000')
              .limit(batchSize)
            
            if (fetchError) {
              console.error('❌ Error fetching companies batch:', fetchError)
              throw fetchError
            }
            
            if (!batch || batch.length === 0) {
              break
            }
            
            const batchIds = batch.map(c => c.id)
            
            // حذف الدفعة
            const { error } = await supabase
              .from('companies')
              .delete()
              .in('id', batchIds)
            
            if (error) {
              console.error('❌ Error deleting companies batch:', error)
              throw error
            }
            
            deletedCount += batch.length
            setDeleteProgress({ current: deletedCount, total: totalCompanies })
            
            // إعطاء وقت للواجهة للتحديث
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          logger.debug('✅ Successfully deleted all companies')
          setIsDeleting(false)
          setDeleteProgress({ current: 0, total: 0 })
          toast.success(`تم حذف جميع المؤسسات بنجاح`)
        } else {
          logger.debug('🗑️ Deleting all employees...')
          setIsDeleting(true)
          setDeleteProgress({ current: 0, total: 0 })
          
          // جلب عدد الموظفين المراد حذفهم
          const { count: totalCount } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .neq('id', '00000000-0000-0000-0000-000000000000')
          
          const totalEmployees = totalCount || 0
          setDeleteProgress({ current: 0, total: totalEmployees })
          
          // حذف الموظفين على دفعات
          const batchSize = 500
          let deletedCount = 0
          
          while (deletedCount < totalEmployees) {
            // جلب دفعة من الموظفين للحذف
            const { data: batch, error: fetchError } = await supabase
              .from('employees')
              .select('id')
              .neq('id', '00000000-0000-0000-0000-000000000000')
              .limit(batchSize)
            
            if (fetchError) {
              console.error('❌ Error fetching employees batch:', fetchError)
              throw fetchError
            }
            
            if (!batch || batch.length === 0) {
              break
            }
            
            const batchIds = batch.map(e => e.id)
            
            // حذف الدفعة
            const { error } = await supabase
              .from('employees')
              .delete()
              .in('id', batchIds)
            
            if (error) {
              console.error('❌ Error deleting employees batch:', error)
              throw error
            }
            
            deletedCount += batch.length
            setDeleteProgress({ current: deletedCount, total: totalEmployees })
            
            // إعطاء وقت للواجهة للتحديث
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          logger.debug('✅ Successfully deleted all employees')
          setIsDeleting(false)
          setDeleteProgress({ current: 0, total: 0 })
          toast.success(`تم حذف جميع الموظفين بنجاح`)
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
          for (const row of jsonData as Record<string, unknown>[]) {
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
          logger.debug('🗑️ Deleting matching employees by residence number...')
          // حذف الموظفين بنفس رقم الإقامة
          let deletedCount = 0
          for (const row of jsonData as Record<string, unknown>[]) {
            const residenceNumber = row['رقم الإقامة']
            if (residenceNumber) {
              const { error } = await supabase
                .from('employees')
                .delete()
                .eq('residence_number', residenceNumber)
              
              if (error) {
                console.error(`❌ Error deleting employee with residence number ${residenceNumber}:`, error)
                toast.warning(`فشل حذف موظف برقم إقامة ${residenceNumber}`)
              } else {
                deletedCount += 1
              }
            }
          }
          logger.debug(`✅ Successfully deleted ${deletedCount} matching employees`)
          toast.success(`تم حذف ${deletedCount} موظف مطابق`)
        }
      }
      logger.debug('✅ deleteDataBeforeImport completed successfully')
      setIsDeleting(false)
      setDeleteProgress({ current: 0, total: 0 })
      return true
    } catch (error: unknown) {
      console.error('❌ Error in deleteDataBeforeImport:', error)
      setIsDeleting(false)
      setDeleteProgress({ current: 0, total: 0 })
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
      toast.error(`فشل حذف البيانات: ${errorMessage}`)
      return false
    }
  }

  const importData = async () => {
    if (!file) {
      toast.error('يرجى اختيار ملف أولاً')
      return
    }
    
    const blockingErrors = getBlockingErrorCount
    if (selectedRows.size > 0 && blockingErrors > 0) {
      toast.error('الصفوف المحددة تحتوي على أخطاء. يرجى إصلاحها أو إلغاء تحديدها قبل الاستيراد.')
      return
    }
    if (selectedRows.size === 0 && blockingErrors > 0) {
      toast.warning('ستتم متابعة الاستيراد مع تجاهل الصفوف التي تحتوي على أخطاء غير محددة.')
    }

    // التحقق من الحذف قبل الاستيراد
    if (shouldDeleteBeforeImport) {
      logger.debug('🔄 shouldDeleteBeforeImport is true, showing confirmation dialog')
      // التأكد من أن modal المعاينة مفتوح
      if (!showPreviewModal) {
        setShowPreviewModal(true)
      }
      // عرض مودال التأكيد بدلاً من window.confirm
      setPendingImport(() => async () => {
        logger.debug('🔄 pendingImport callback called')
        try {
          // التأكد من إعادة تعيين حالة الحذف
          setIsDeleting(false)
          setDeleteProgress({ current: 0, total: 0 })
          
          const deleted = await deleteDataBeforeImport()
          logger.debug('🔄 deleteDataBeforeImport returned:', deleted)
          
          if (!deleted) {
            logger.debug('❌ Delete failed, aborting import')
            setIsDeleting(false)
            setDeleteProgress({ current: 0, total: 0 })
            setShowConfirmDialog(false)
            setPendingImport(null)
            return
          }
          
          logger.debug('✅ Delete successful, proceeding with import')
          // التأكد من إعادة تعيين حالة الحذف قبل بدء الاستيراد
          setIsDeleting(false)
          setDeleteProgress({ current: 0, total: 0 })
          setShowConfirmDialog(false)
          setPendingImport(null)
          
          // متابعة الاستيراد
          logger.debug('🔄 Starting executeImport after delete')
          await executeImport()
          logger.debug('✅ executeImport completed')
        } catch (error) {
          console.error('❌ Error in pendingImport callback:', error)
          setIsDeleting(false)
          setDeleteProgress({ current: 0, total: 0 })
          const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
          toast.error(`فشل العملية: ${errorMessage}`)
          setShowConfirmDialog(false)
          setPendingImport(null)
        }
      })
      logger.debug('🔄 Setting showConfirmDialog to true')
      setShowConfirmDialog(true)
      return
    }

    // إذا لم يكن هناك حذف، مباشرة إلى الاستيراد
    logger.debug('🔄 No delete needed, proceeding directly to import')
    await executeImport()
  }

  const executeImport = async () => {
    logger.debug('🚀 executeImport started')
    if (!file) {
      console.error('❌ No file selected')
      toast.error('يرجى اختيار ملف أولاً')
      return
    }

    // بدء عملية الاستيراد
    logger.debug('🚀 Setting importing to true')
    setImporting(true)

    // إعادة تعيين حالة الإلغاء والسجلات المضافة
    setIsImportCancelled(false)
    cancelImportRef.current = false
    const emptyIds = { employees: [], companies: [] }
    setImportedIds(emptyIds)
    importedIdsRef.current = emptyIds

    let successCount = 0
    let failCount = 0

    // Helper function to clean project name (remove extra spaces, trim)
    // ترجع null إذا كان الاسم فارغاً أو "-" فقط (يعني الموظف ليس في مشروع)
    const cleanProjectName = (name: string | null | undefined): string | null => {
      if (!name) return null
      const cleaned = name.trim().replace(/\s+/g, ' ')
      // إذا كان الاسم فارغاً بعد التنظيف أو يساوي "-" فقط، لا نعتبره مشروعاً
      if (!cleaned || cleaned === '-' || cleaned.length === 0) return null
      return cleaned
    }

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      let jsonData = XLSX.utils.sheet_to_json(worksheet)

      // ===== معالجة التواريخ من Excel =====
      // دالة لقراءة التاريخ من خلية Excel بشكل صحيح (نفس المنطق المستخدم في validateData)
      const readDateFromCell = (cell: XLSX.CellObject | undefined): string => {
        if (!cell) return ''
        
        // إذا كان هناك نص منسق (cell.w)، استخدمه مباشرة - هذا هو النص المعروض في Excel
        if (cell.w) {
          const formattedText = String(cell.w).trim()
          // التحقق من أن النص ليس فارغاً أو مساوياً لقيمة افتراضية
          if (formattedText && formattedText !== '#N/A' && formattedText !== '#VALUE!') {
            return formattedText
          }
        }
        
        // إذا كانت القيمة رقم تسلسلي (Excel date serial number)
        if (cell.t === 'n' && typeof cell.v === 'number') {
          // التحقق من أن الرقم ضمن نطاق تاريخ Excel المعقول
          if (cell.v > 0 && cell.v < 1000000) {
            try {
              // تحويل الرقم التسلسلي إلى تاريخ
              const excelEpoch = new Date(1900, 0, 1)
              const days = Math.floor(cell.v) - 2 // Excel incorrectly treats 1900 as leap year
              const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000)
              
              // التحقق من أن التاريخ صحيح
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear()
                // التحقق من أن السنة منطقية (بين 1900 و 2100)
                if (year >= 1900 && year <= 2100) {
                  // تنسيق التاريخ بصيغة DD-Mon-YYYY
                  const day = String(date.getDate()).padStart(2, '0')
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  const month = monthNames[date.getMonth()]
                  return `${day}-${month}-${year}`
                }
              }
            } catch (e) {
              console.warn('Error converting Excel serial date:', e, 'value:', cell.v)
            }
          }
        }
        
        // إذا كانت القيمة نص، استخدمها مباشرة
        if (cell.v !== undefined && cell.v !== null) {
          const strValue = String(cell.v).trim()
          if (strValue && strValue !== 'null' && strValue !== 'undefined') {
            return strValue
          }
        }
        
        return ''
      }

      // تحديد أعمدة التواريخ
      const dateColumns = importType === 'employees' 
        ? [
            'تاريخ الميلاد',
            'تاريخ الالتحاق',
            'تاريخ انتهاء الإقامة',
            'تاريخ انتهاء العقد',
            'تاريخ انتهاء عقد أجير',
            'تاريخ انتهاء التأمين الصحي'
          ]
        : [
            'تاريخ انتهاء السجل التجاري',
            'تاريخ انتهاء التأمينات الاجتماعية',
            'تاريخ انتهاء اشتراك قوى',
            'تاريخ انتهاء اشتراك مقيم'
          ]

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

      // الحصول على indices الأعمدة للتواريخ بناءً على excelColumns
      const dateColumnIndices: { [key: string]: number } = {}
      excelColumns.forEach((col, index) => {
        if (dateColumns.includes(col)) {
          dateColumnIndices[col] = index
        }
      })

      // معالجة التواريخ من الخلايا مباشرة للحصول على القيم الصحيحة
      jsonData.forEach((row: Record<string, unknown>, rowIndex: number) => {
        // rowIndex + 1 لأن الصف الأول (0) في Excel هو header row
        const excelRowIndex = rowIndex + 1
        
        // معالجة كل عمود تاريخ
        dateColumns.forEach(colName => {
          const colIndex = dateColumnIndices[colName]
          if (colIndex !== undefined && colIndex !== -1) {
            // الحصول على عنوان الخلية (مثل A2, B3, إلخ)
            const cellAddress = XLSX.utils.encode_cell({ r: excelRowIndex, c: colIndex })
            const cell = worksheet[cellAddress]
            
            if (cell) {
              // قراءة التاريخ من الخلية مباشرة
              const dateValue = readDateFromCell(cell)
              if (dateValue) {
                // استبدال القيمة في jsonData بالقيمة الصحيحة من الخلية
                row[colName] = dateValue
              } else {
                // إذا فشلت قراءة الخلية، احتفظ بالقيمة من jsonData بعد تنظيفها
                const fallbackValue = row[colName] ? String(row[colName] || '').trim() : ''
                row[colName] = fallbackValue
              }
            } else if (row[colName]) {
              // إذا لم تكن هناك خلية، احتفظ بالقيمة من jsonData
              row[colName] = String(row[colName] || '').trim()
            } else {
              row[colName] = ''
            }
          }
        })
      })
      // ===== نهاية معالجة التواريخ =====

      // تصفية البيانات حسب التحديد مع احترام التعارضات والتكرارات
      const targetIndices = selectedRows.size > 0
        ? new Set(Array.from(selectedRows))
        : new Set(jsonData.map((_, idx) => idx))

      const missingConflictChoices: number[] = []

      let rowsWithIndex = (jsonData as Record<string, unknown>[]).map((row, index) => ({ row, index }))

      const hasErrorSeverity = (idx: number) => {
        const excelRowNumber = idx + 2
        const rowErrors = validationResults.filter(
          e => e.row === excelRowNumber && e.severity === 'error'
        )
        return rowErrors.length > 0
      }

      // تطبيق التحديد واستبعاد أخطاء التحقق
      rowsWithIndex = rowsWithIndex.filter(({ row, index }) => {
        if (!targetIndices.has(index)) return false

        // استبعاد الصفوف ذات الأخطاء غير المحددة (أو المحددة لكن المفروض أن الزر لن يُفعّل حينها)
        if (hasErrorSeverity(index)) return false

        // معالجة التعارض مع بيانات DB
        if (dbConflicts.has(index)) {
          const choice = conflictResolution.get(index)
          if (choice === 'keep') return false // تجاهل الصف
          if (!choice) {
            // لا يوجد اختيار بعد: نتجاهل الصف بشكل آمن ونبلغ المستخدم
            missingConflictChoices.push(index)
            return false
          }
        }

        return true
      })

      if (missingConflictChoices.length > 0) {
        toast.warning('تم تجاهل بعض الصفوف المتعارضة بدون اختيار (إبقاء/استبدال). يرجى تحديد القرار إذا رغبت بتحديثها.')
      }

      // إزالة التكرارات ديناميكياً بناءً على الصفوف المستهدفة
      const seenKeys = new Set<string>()
      rowsWithIndex = rowsWithIndex.filter(({ row }) => {
        const keyRaw = importType === 'employees'
          ? row['رقم الإقامة']?.toString().trim()
          : row['الرقم الموحد']?.toString().trim()
        if (!keyRaw) return true
        if (seenKeys.has(keyRaw)) return false
        seenKeys.add(keyRaw)
        return true
      })

      jsonData = rowsWithIndex.map(r => r.row)

      let duplicatesRemoved = 0
      let uniqueJsonData = jsonData
      
      if (importType === 'employees') {
        // Filter duplicates within the sheet based on residence_number (keep first occurrence only)
        const seenResidenceNumbers = new Set<string>()
        uniqueJsonData = (jsonData as Record<string, unknown>[]).filter((row) => {
          const residenceNumber = row['رقم الإقامة']?.toString().trim()
          if (!residenceNumber) {
            return true // Keep rows without residence number (they will fail validation anyway)
          }
          if (seenResidenceNumbers.has(residenceNumber)) {
            return false // Skip duplicate
          }
          seenResidenceNumbers.add(residenceNumber)
          return true
        })

        duplicatesRemoved = jsonData.length - uniqueJsonData.length
        if (duplicatesRemoved > 0) {
          logger.debug(`تم إزالة ${duplicatesRemoved} صف مكرر بناءً على رقم الإقامة`)
        }

        // Get companies for lookup with unified_number
        const { data: companies } = await supabase.from('companies').select('id, name, unified_number')
        
        // Get projects for lookup
        const { data: projects } = await supabase.from('projects').select('id, name')
        
        // Load existing employees from database with their IDs for update operations
        const { data: existingEmployees } = await supabase.from('employees').select('id, residence_number')
        const existingEmployeesByResidenceNumber = new Map<string, string>() // residence_number -> employee_id
        existingEmployees?.forEach(emp => {
          if (emp.residence_number) {
            existingEmployeesByResidenceNumber.set(emp.residence_number.toString().trim(), emp.id)
          }
        })
        
        // Create maps for lookup
        const companyMapByUnifiedNumber = new Map<number, string>() // unified_number -> id
        const projectMapByName = new Map<string, string>() // name -> id (projects should be unique by name)
        const newProjectsCreated = new Map<string, string>() // Track newly created projects to avoid duplicates
        
        companies?.forEach(c => {
          // Map by unified_number (should be unique - primary lookup method)
          if (c.unified_number) {
            companyMapByUnifiedNumber.set(Number(c.unified_number), c.id)
          }
        })

        // Create project map from existing projects
        projects?.forEach(p => {
          if (p.name) {
            const cleaned = cleanProjectName(p.name)
            if (cleaned) {
              projectMapByName.set(cleaned.toLowerCase(), p.id)
            }
          }
        })
        
        // تحديد العدد الإجمالي للعناصر المستوردة بعد التصفية
        const totalItems = uniqueJsonData.length
        
        // تهيئة شريط التقدم
        setImportProgress({ current: 0, total: totalItems })

        let currentIndex = 0
        for (const row of uniqueJsonData as Record<string, unknown>[]) {
          // التحقق من حالة الإلغاء
          if (cancelImportRef.current) {
            logger.debug('تم إلغاء الاستيراد من قبل المستخدم')
            break
          }
          
          currentIndex++
          setImportProgress({ current: currentIndex, total: totalItems })
          
          try {
            let companyId: string | null = null
            
            // Find company by unified_number (primary key for company lookup)
            const unifiedNumber = row['الرقم الموحد']
            if (unifiedNumber) {
              const unifiedNum = Number(unifiedNumber)
              if (!isNaN(unifiedNum)) {
                companyId = companyMapByUnifiedNumber.get(unifiedNum) || null
              }
            }

            // Handle project matching and creation
            let projectId: string | null = null
            const projectNameRaw = (row['المشروع'] || row['اسم المشروع'] || null) as string | null
            const projectNameClean = cleanProjectName(projectNameRaw)
            
            if (projectNameClean) {
              const projectNameLower = projectNameClean.toLowerCase()
              
              // 1. Check if project already exists in map
              if (projectMapByName.has(projectNameLower)) {
                projectId = projectMapByName.get(projectNameLower) || null
              }
              // 2. Check if we already created this project in this import session
              else if (newProjectsCreated.has(projectNameLower)) {
                projectId = newProjectsCreated.get(projectNameLower) || null
              }
              // 3. Create new project
              else {
                try {
                  const { data: newProject, error: projectError } = await supabase
                    .from('projects')
                    .insert({
                      name: projectNameClean,
                      status: 'active'
                    })
                    .select()
                    .single()

                  if (projectError) {
                    // If project already exists (race condition), try to fetch it
                    if (projectError.code === '23505') {
                      const { data: existingProject } = await supabase
                        .from('projects')
                        .select('id, name')
                        .eq('name', projectNameClean)
                        .single()
                      
                      if (existingProject) {
                        projectId = existingProject.id
                        projectMapByName.set(projectNameLower, existingProject.id)
                      }
                    } else {
                      console.warn(`Failed to create project "${projectNameClean}":`, projectError)
                    }
                  } else if (newProject) {
                    projectId = newProject.id
                    projectMapByName.set(projectNameLower, newProject.id)
                    newProjectsCreated.set(projectNameLower, newProject.id)
                  }
                } catch (createError) {
                  console.error(`Error creating project "${projectNameClean}":`, createError)
                }
              }
            }

            // التحقق من أن كل حقل تاريخ يُستورد في مكانه الصحيح
            const birthDateRaw = row['تاريخ الميلاد']
            const joiningDateRaw = row['تاريخ الالتحاق']
            const residenceExpiryRaw = row['تاريخ انتهاء الإقامة']
            const contractExpiryRaw = row['تاريخ انتهاء العقد']
            const hiredWorkerContractExpiryRaw = row['تاريخ انتهاء عقد أجير']
            const healthInsuranceExpiryRaw = row['تاريخ انتهاء التأمين الصحي']
            
            // Debug: طباعة القيم الأولية للتأكد من عدم الخلط
            if (currentIndex <= 5) { // طباعة أول 5 موظفين للتحقق
              logger.debug(`📋 Employee ${currentIndex + 1} (${row['الاسم']}) - Raw dates from Excel:`, {
                'تاريخ الميلاد': birthDateRaw ? `${birthDateRaw} (type: ${typeof birthDateRaw})` : '(فارغ)',
                'تاريخ الالتحاق': joiningDateRaw ? `${joiningDateRaw} (type: ${typeof joiningDateRaw})` : '(فارغ)',
                'تاريخ انتهاء الإقامة': residenceExpiryRaw ? `${residenceExpiryRaw} (type: ${typeof residenceExpiryRaw})` : '(فارغ)',
                'تاريخ انتهاء العقد': contractExpiryRaw ? `${contractExpiryRaw} (type: ${typeof contractExpiryRaw})` : '(فارغ)',
                'تاريخ انتهاء عقد أجير': hiredWorkerContractExpiryRaw ? `${hiredWorkerContractExpiryRaw} (type: ${typeof hiredWorkerContractExpiryRaw})` : '(فارغ)',
                'تاريخ انتهاء التأمين الصحي': healthInsuranceExpiryRaw ? `${healthInsuranceExpiryRaw} (type: ${typeof healthInsuranceExpiryRaw})` : '(فارغ)'
              })
            }
            
            // تحويل التواريخ باستخدام normalizeDate - مع معالجة أفضل للقيم الفارغة
            const normalizedBirthDate = birthDateRaw ? normalizeDate(String(birthDateRaw)) : null
            const normalizedJoiningDate = joiningDateRaw ? normalizeDate(String(joiningDateRaw)) : null
            const normalizedResidenceExpiry = residenceExpiryRaw ? normalizeDate(String(residenceExpiryRaw)) : null
            const normalizedContractExpiry = contractExpiryRaw ? normalizeDate(String(contractExpiryRaw)) : null
            const normalizedHiredWorkerContractExpiry = hiredWorkerContractExpiryRaw ? normalizeDate(String(hiredWorkerContractExpiryRaw)) : null
            const normalizedHealthInsuranceExpiry = healthInsuranceExpiryRaw ? normalizeDate(String(healthInsuranceExpiryRaw)) : null
            
            // Debug: طباعة نتائج normalizeDate
            if (currentIndex <= 5) {
              logger.debug(`🔄 Employee ${currentIndex + 1} (${row['الاسم']}) - After normalizeDate:`, {
                'birth_date': normalizedBirthDate || '(null - will not be saved)',
                'joining_date': normalizedJoiningDate || '(null - will not be saved)',
                'residence_expiry': normalizedResidenceExpiry || '(null - will not be saved)',
                'contract_expiry': normalizedContractExpiry || '(null - will not be saved)',
                'hired_worker_contract_expiry': normalizedHiredWorkerContractExpiry || '(null - will not be saved)',
                'health_insurance_expiry': normalizedHealthInsuranceExpiry || '(null - will not be saved)'
              })
            }
            
            const employeeData: Record<string, unknown> = {
              name: row['الاسم'],
              profession: row['المهنة'] || null,
              nationality: row['الجنسية'] || null,
              residence_number: row['رقم الإقامة'] || null,
              passport_number: row['رقم الجواز'] || null,
              phone: row['رقم الهاتف']?.toString() || row['رقم الجوال']?.toString() || null,
              bank_account: row['الحساب البنكي'] || null,
              salary: row['الراتب'] ? Number(row['الراتب']) : null,
              project_id: projectId,
              company_id: companyId,
              // التأكد من أن كل حقل تاريخ يُستورد في مكانه الصحيح
              // عند INSERT: نحفظ جميع التواريخ (حتى null) لأنها حقول جديدة
              // عند UPDATE: سنزيل null في cleanEmployeeDataForUpdate
              birth_date: normalizedBirthDate, // تاريخ الميلاد → birth_date
              joining_date: normalizedJoiningDate, // تاريخ الالتحاق → joining_date
              residence_expiry: normalizedResidenceExpiry, // تاريخ انتهاء الإقامة → residence_expiry
              contract_expiry: normalizedContractExpiry, // تاريخ انتهاء العقد → contract_expiry
              hired_worker_contract_expiry: normalizedHiredWorkerContractExpiry, // تاريخ انتهاء عقد أجير → hired_worker_contract_expiry
              health_insurance_expiry: normalizedHealthInsuranceExpiry, // تاريخ انتهاء التأمين الصحي → health_insurance_expiry
              residence_image_url: row['رابط صورة الإقامة'] || null,
              notes: row['الملاحظات'] || null
            }
            
            // Debug: طباعة القيم النهائية قبل الحفظ
            if (currentIndex <= 5) {
              logger.debug(`✅ Employee ${currentIndex + 1} (${row['الاسم']}) - Final employeeData before save:`, {
                'birth_date': employeeData.birth_date || '(null)',
                'joining_date': employeeData.joining_date || '(null)',
                'residence_expiry': employeeData.residence_expiry || '(null)',
                'contract_expiry': employeeData.contract_expiry || '(null)',
                'hired_worker_contract_expiry': employeeData.hired_worker_contract_expiry || '(null)',
                'health_insurance_expiry': employeeData.health_insurance_expiry || '(null)'
              })
            }

            // دعم التوافق مع الأسماء القديمة والجديدة للتأمين الصحي
            if (!employeeData.health_insurance_expiry && (row['انتهاء التأمين الصحي'] || row['انتهاء اشتراك التأمين'])) {
              const healthInsuranceExpiry = row['انتهاء التأمين الصحي'] || row['انتهاء اشتراك التأمين']
              employeeData.health_insurance_expiry = normalizeDate(String(healthInsuranceExpiry))
            }

            // دالة لتنظيف البيانات قبل التحديث - إزالة الحقول null/undefined للحفاظ على القيم الموجودة
            const cleanEmployeeDataForUpdate = (data: Record<string, unknown>): Record<string, unknown> => {
              const cleaned: Record<string, unknown> = {}
              // قائمة الحقول المطلوبة التي يجب الحفاظ عليها حتى لو كانت null
              const requiredFields = ['name', 'residence_number', 'company_id']
              
              Object.keys(data).forEach(key => {
                // الحفاظ على الحقول المطلوبة دائماً
                if (requiredFields.includes(key)) {
                  cleaned[key] = data[key]
                }
                // للحقول الأخرى: الحفاظ عليها فقط إذا لم تكن null/undefined
                else if (data[key] !== null && data[key] !== undefined) {
                  cleaned[key] = data[key]
                }
                // للحقول التواريخ: إذا كانت null، لا نضيفها (للحفاظ على القيم الموجودة في DB)
                // (لا نحتاج إلى فعل شيء هنا لأننا نتحقق من null/undefined أعلاه)
              })
              return cleaned
            }

            // Check if residence number already exists - update instead of insert
            const residenceNumberStr = employeeData.residence_number?.toString().trim()
            
            if (residenceNumberStr && existingEmployeesByResidenceNumber.has(residenceNumberStr)) {
              // Update existing employee - تنظيف البيانات لإزالة الحقول null
              const existingEmployeeId = existingEmployeesByResidenceNumber.get(residenceNumberStr)!
              const cleanedEmployeeData = cleanEmployeeDataForUpdate(employeeData)
              
              // Debug: طباعة البيانات قبل وبعد التنظيف
              if (currentIndex <= 5) {
                logger.debug(`🔄 Employee ${currentIndex + 1} (${row['الاسم']}) - UPDATE operation:`, {
                  'operation': 'UPDATE',
                  'residence_number': residenceNumberStr,
                  'before_cleaning': {
                    'birth_date': employeeData.birth_date || '(null)',
                    'residence_expiry': employeeData.residence_expiry || '(null)',
                    'joining_date': employeeData.joining_date || '(null)',
                    'contract_expiry': employeeData.contract_expiry || '(null)'
                  },
                  'after_cleaning': {
                    'birth_date': cleanedEmployeeData.birth_date || '(removed - will keep existing)',
                    'residence_expiry': cleanedEmployeeData.residence_expiry || '(removed - will keep existing)',
                    'joining_date': cleanedEmployeeData.joining_date || '(removed - will keep existing)',
                    'contract_expiry': cleanedEmployeeData.contract_expiry || '(removed - will keep existing)'
                  }
                })
              }
              
              const { error: updateError } = await supabase
                .from('employees')
                .update(cleanedEmployeeData)
                .eq('id', existingEmployeeId)
              
              if (updateError) {
                throw updateError
              }
            } else {
              // Insert new employee
              if (currentIndex <= 5) {
                logger.debug(`➕ Employee ${currentIndex + 1} (${row['الاسم']}) - INSERT operation:`, {
                  'operation': 'INSERT',
                  'residence_number': residenceNumberStr,
                  'dates_to_insert': {
                    'birth_date': employeeData.birth_date || '(null)',
                    'residence_expiry': employeeData.residence_expiry || '(null)',
                    'joining_date': employeeData.joining_date || '(null)',
                    'contract_expiry': employeeData.contract_expiry || '(null)'
                  }
                })
              }
              const { error: insertError } = await supabase.from('employees').insert(employeeData)
              if (insertError) {
                // Check if error is due to duplicate residence number (race condition)
                if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
                  // Try to update instead
                  if (residenceNumberStr) {
                    const { data: existingEmp } = await supabase
                      .from('employees')
                      .select('id')
                      .eq('residence_number', residenceNumberStr)
                      .single()
                    
                    if (existingEmp) {
                      // تنظيف البيانات قبل التحديث
                      const cleanedEmployeeData = cleanEmployeeDataForUpdate(employeeData)
                      const { error: updateError } = await supabase
                        .from('employees')
                        .update(cleanedEmployeeData)
                        .eq('id', existingEmp.id)
                      
                      if (updateError) throw updateError
                    } else {
                      throw insertError
                    }
                  } else {
                    throw insertError
                  }
                } else {
                  throw insertError
                }
              } else {
                // Add to map for future checks in same batch and track for rollback
                if (residenceNumberStr) {
                  const { data: newEmp } = await supabase
                    .from('employees')
                    .select('id, residence_number')
                    .eq('residence_number', residenceNumberStr)
                    .single()
                  
                  if (newEmp) {
                    existingEmployeesByResidenceNumber.set(residenceNumberStr, newEmp.id)
                    // تتبع ID للموظف المضاف (لحذفه عند الإلغاء)
                    setImportedIds(prev => {
                      const updated = {
                        ...prev,
                        employees: [...prev.employees, newEmp.id]
                      }
                      importedIdsRef.current = updated
                      return updated
                    })
                  }
                }
              }
            }
            
            // إذا كان التحديث، لا نضيف ID لأننا لا نريد حذف السجلات المحدثة
            successCount++
          } catch (error) {
            console.error('Error inserting employee:', error)
            failCount++
          }
        }
      } else if (importType === 'companies') {
        // تحديد العدد الإجمالي للعناصر المستوردة
        const totalItems = jsonData.length
        
        // تهيئة شريط التقدم
        setImportProgress({ current: 0, total: totalItems })
        
        // Load existing companies for update operations
        const { data: existingCompanies } = await supabase
          .from('companies')
          .select('id, unified_number')
        
        // Create maps for lookup by unique identifiers
        const companiesByUnifiedNumber = new Map<number, string>() // unified_number -> company_id
        
        existingCompanies?.forEach(company => {
          if (company.unified_number) {
            companiesByUnifiedNumber.set(Number(company.unified_number), company.id)
          }
        })
        
        let currentIndex = 0
        for (const row of jsonData as Record<string, unknown>[]) {
          // التحقق من حالة الإلغاء
          if (cancelImportRef.current) {
            logger.debug('تم إلغاء الاستيراد من قبل المستخدم')
            break
          }
          
          currentIndex++
          setImportProgress({ current: currentIndex, total: totalItems })
          
          try {
            const companyData: Record<string, unknown> = {
              name: row['اسم المؤسسة'],
              unified_number: row['الرقم الموحد'] ? Number(row['الرقم الموحد']) : null,
              social_insurance_number: row['رقم اشتراك التأمينات الاجتماعية'] || null,
              labor_subscription_number: row['رقم اشتراك قوى'] || null,
              commercial_registration_expiry: normalizeDate(String(row['تاريخ انتهاء السجل التجاري'] ?? '')),
              social_insurance_expiry: normalizeDate(String(row['تاريخ انتهاء التأمينات الاجتماعية'] ?? row['تاريخ انتهاء اشتراك التأمين'] ?? '')),
              ending_subscription_power_date: normalizeDate(String(row['تاريخ انتهاء اشتراك قوى'] ?? '')),
              ending_subscription_moqeem_date: normalizeDate(String(row['تاريخ انتهاء اشتراك مقيم'] ?? '')),
              exemptions: row['الاعفاءات'] || null,
              company_type: row['نوع المؤسسة'] || null,
              notes: row['الملاحظات'] || null,
              max_employees: 4 // القيمة الافتراضية
            }

            // Check for existing company by unique identifiers
            let existingCompanyId: string | null = null
            
            // التفرد بالرقم الموحد فقط
            if (companyData.unified_number) {
              existingCompanyId = companiesByUnifiedNumber.get(Number(companyData.unified_number)) || null
            }
            
            if (existingCompanyId) {
              // Update existing company
              const { error: updateError } = await supabase
                .from('companies')
                .update(companyData)
                .eq('id', existingCompanyId)
              
              if (updateError) throw updateError
            } else {
              // Insert new company
              const { error: insertError } = await supabase.from('companies').insert(companyData)
              if (insertError) {
                // تكرار محتمل بسبب الرقم الموحد فقط
                if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
                  if (companyData.unified_number) {
                    const { data: foundCompany } = await supabase
                      .from('companies')
                      .select('id')
                      .eq('unified_number', companyData.unified_number)
                      .single()
                    if (foundCompany) {
                      const { error: updateError } = await supabase
                        .from('companies')
                        .update(companyData)
                        .eq('id', foundCompany.id)
                      if (updateError) throw updateError
                    } else {
                      throw insertError
                    }
                  } else {
                    throw insertError
                  }
                } else {
                  throw insertError
                }
              } else {
                // Add to maps for future checks in same batch
                // Try to find the newly inserted company by its unique identifiers
                if (companyData.unified_number) {
                  const { data: newCompany } = await supabase
                    .from('companies')
                    .select('id, unified_number')
                    .eq('unified_number', companyData.unified_number)
                    .single()
                  
                  if (newCompany) {
                    companiesByUnifiedNumber.set(Number(newCompany.unified_number), newCompany.id)
                    // تتبع ID للشركة المضافة (لحذفها عند الإلغاء)
                    setImportedIds(prev => {
                      const updated = {
                        ...prev,
                        companies: [...prev.companies, newCompany.id]
                      }
                      importedIdsRef.current = updated
                      return updated
                    })
                  }
                }
              }
            }
            // إذا كان التحديث، لا نضيف ID لأننا لا نريد حذف السجلات المحدثة
            successCount++
          } catch (error) {
            console.error('Error inserting/updating company:', error)
            failCount++
          }
        }
      }

      // التحقق من حالة الإلغاء
      if (cancelImportRef.current) {
        // حذف السجلات المضافة في هذه الجلسة
        await rollbackImportedData()
        toast.warning('تم إلغاء الاستيراد وحذف السجلات المضافة')
        const totalProcessed = importType === 'employees' ? uniqueJsonData.length : jsonData.length
        setImportResult({
          total: totalProcessed,
          success: 0,
          failed: failCount,
          errors: []
        })
        // لا نستدعي onImportSuccess في حالة الإلغاء
      } else {
        const totalProcessed = importType === 'employees' ? uniqueJsonData.length : jsonData.length
        
        setImportResult({
          total: totalProcessed,
          success: successCount,
          failed: failCount,
          errors: []
        })

        if (successCount > 0) {
          const duplicateMessage = duplicatesRemoved > 0 ? ` (تم استبعاد ${duplicatesRemoved} صف مكرر)` : ''
          toast.success(`✓ تم الاستيراد بنجاح: ${successCount} ${importType === 'employees' ? 'موظف' : 'مؤسسة'}${duplicateMessage}`)
          
          // استدعاء callback النجاح إذا كان موجوداً (حتى لو كان هناك بعض الأخطاء)
          if (onImportSuccess) {
            onImportSuccess()
          }
          
          // Close preview and reset after successful import
          setTimeout(() => {
            setShowPreviewModal(false)
            setFile(null)
            setPreviewData([])
            setValidationResults([])
            setSelectedRows(new Set())
            setImportResult(null)
            setCurrentPage(1)
            setColumnValidationError(null)
          }, 1500)
        } else {
          // إذا لم يكن هناك أي نجاح، لا نستدعي onImportSuccess
          toast.error('لم يتم استيراد أي سجلات. يرجى التحقق من البيانات والمحاولة مرة أخرى.')
        }
        
        if (failCount > 0) {
          toast.error(`✗ فشل استيراد ${failCount} سجل`)
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      // في حالة الخطأ، حاول حذف السجلات المضافة
      if (importedIdsRef.current.employees.length > 0 || importedIdsRef.current.companies.length > 0) {
        await rollbackImportedData()
      }
      toast.error('فشل عملية الاستيراد')
    } finally {
      setImporting(false)
      setImportProgress({ current: 0, total: 0 })
      setIsImportCancelled(false)
      cancelImportRef.current = false
      const emptyIds = { employees: [], companies: [] }
      setImportedIds(emptyIds)
      importedIdsRef.current = emptyIds
      
    }
  }

  // دالة لحذف السجلات المضافة عند الإلغاء
  const rollbackImportedData = async () => {
    try {
      const idsToDelete = importedIdsRef.current
      
      // حذف الموظفين المضافة
      if (idsToDelete.employees.length > 0) {
        const { error: employeesError } = await supabase
          .from('employees')
          .delete()
          .in('id', idsToDelete.employees)
        
        if (employeesError) {
          console.error('Error deleting imported employees:', employeesError)
        } else {
          logger.debug(`تم حذف ${idsToDelete.employees.length} موظف تم إضافتهم`)
        }
      }

      // حذف الشركات المضافة
      if (idsToDelete.companies.length > 0) {
        const { error: companiesError } = await supabase
          .from('companies')
          .delete()
          .in('id', idsToDelete.companies)
        
        if (companiesError) {
          console.error('Error deleting imported companies:', companiesError)
        } else {
          logger.debug(`تم حذف ${idsToDelete.companies.length} شركة تم إضافتها`)
        }
      }
    } catch (error) {
      console.error('Error in rollback:', error)
    }
  }

  // دالة لإلغاء الاستيراد
  const cancelImport = async () => {
    if (!importing) return
    
    cancelImportRef.current = true
    setIsImportCancelled(true)
    toast.info('جاري إلغاء الاستيراد وحذف السجلات المضافة...')
  }

  const handleFilterChange = (filter: 'all' | 'errors' | 'warnings') => {
    setValidationFilter(filter)
    setCurrentPage(1)
  }

  const exportValidationReport = () => {
    if (previewData.length === 0) return

    const dataColumns = getOrderedColumns(Object.keys(previewData[0]), previewData)
    const header = ['Status', 'Excel Row', ...dataColumns, 'Issue Details']

    const rows = previewData.map((row, index) => {
      const excelRowNumber = index + 2
      const rowIssues = validationResults.filter(error => error.row === excelRowNumber)
      const hasError = rowIssues.some(error => error.severity === 'error')
      const hasWarning = rowIssues.some(error => error.severity === 'warning')
      const status = hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'OK'
      const issueDetails = rowIssues.map(issue => `[${issue.field}] ${issue.message}`).join(' | ')
      const rowValues = dataColumns.map(column => row[column] ?? '')
      return [status, excelRowNumber, ...rowValues, issueDetails || '']
    })

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Validation Report')
    const fileName = `import-validation-${importType}-${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(workbook, fileName)
    toast.success('تم تصدير تقرير التحقق إلى Excel')
  }

  // حساب الأخطاء في جميع الصفوف
  const totalErrorCount = validationResults.filter(e => e.severity === 'error').length
  const warningCount = validationResults.filter(e => e.severity === 'warning').length
  const errorRowCount = new Set(validationResults.filter(e => e.severity === 'error').map(e => e.row)).size
  const warningRowCount = new Set(validationResults.filter(e => e.severity === 'warning').map(e => e.row)).size
  
  // حساب الأخطاء في الصفوف المحددة فقط
  const getSelectedRowsErrors = (): number => {
    if (selectedRows.size === 0) {
      // إذا لم تكن هناك صفوف محددة، نتحقق من جميع الصفوف
      return totalErrorCount
    }
    
    // حساب الأخطاء في الصفوف المحددة فقط
    let errorCount = 0
    selectedRows.forEach(rowIndex => {
      const excelRowNumber = rowIndex + 2 // Excel row number (1 is header, +1 for index)
      const rowErrors = validationResults.filter(
        e => e.row === excelRowNumber && e.severity === 'error'
      )
      if (rowErrors.length > 0) {
        errorCount += rowErrors.length
      }
    })
    return errorCount
  }

  // حساب أخطاء مانعة ديناميكياً بناءً على الصفوف المحددة فقط والتكرارات الفعلية
  const getBlockingErrorCount = useMemo((): number => {
    const targetIndices = selectedRows.size > 0
      ? Array.from(selectedRows)
      : previewData.map((_, idx) => idx)

    const errorRows = new Set<number>()

    // أخطاء التحقق الأصلية للصفوف المستهدفة
    targetIndices.forEach(idx => {
      const excelRowNumber = idx + 2
      const rowErrors = validationResults.filter(
        e => e.row === excelRowNumber && e.severity === 'error'
      )
      if (rowErrors.length > 0) {
        errorRows.add(idx)
      }
    })

    // إعادة تقييم التكرارات ديناميكياً بناءً على الصفوف المستهدفة
    const duplicateGroups = new Map<string, number[]>()
    targetIndices.forEach(idx => {
      const row = previewData[idx]
      if (!row) return
      const key = importType === 'employees'
        ? row['رقم الإقامة']?.toString().trim()
        : row['الرقم الموحد']?.toString().trim()
      if (!key) return
      const list = duplicateGroups.get(key) || []
      list.push(idx)
      duplicateGroups.set(key, list)
    })

    duplicateGroups.forEach(indices => {
      if (indices.length > 1) {
        indices.forEach(i => errorRows.add(i))
      }
    })

    return errorRows.size
  }, [previewData, selectedRows, validationResults, importType])
  
  const selectedRowsErrorCount = getSelectedRowsErrors()
  const blockingErrorCount = getBlockingErrorCount
  const errorCount = blockingErrorCount

  return (
    <div className="space-y-6">
      {/* Import Type Selection and Color Legend - يظهر فقط خارج الـ modal */}
      {!isInModal && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column: Import Type Selection + File Upload */}
          <div className="space-y-4">
            {/* Import Type Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">نوع البيانات المراد استيرادها</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setImportType('employees')
                    setCurrentPage(1)
                    setSelectedRows(new Set())
                    setShouldDeleteBeforeImport(false)
                  }}
                  className={`flex-1 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition ${
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
                  className={`flex-1 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition ${
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
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700 mb-1">اسحب وأفلت ملف Excel هنا</p>
              <p className="text-xs text-gray-500 mb-3">أو انقر لتحديد ملف</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition text-sm"
              >
                <FileUp className="w-4 h-4" />
                اختيار ملف Excel
              </label>
            </div>
          </div>
          
          {/* Right Column: Color Legend - Always Visible */}
          <div className="border-2 border-gray-300 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-2 border-b border-gray-200">
            <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <span>🎨</span>
              دلالة الألوان في الجدول:
            </h5>
          </div>
          <div className="px-3 py-3 bg-white">
            <div className="grid grid-cols-1 gap-2">
              {/* Error Color Explanation */}
              <div className="flex items-start gap-2 p-2 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-red-800 mb-0.5 text-xs">خلفية حمراء - خطأ</div>
                  <p className="text-[10px] text-red-700 leading-tight">
                    حقول مطلوبة أو غير صحيحة. يجب إصلاحها قبل الاستيراد.
                  </p>
                </div>
              </div>
              
              {/* Warning Color Explanation */}
              <div className="flex items-start gap-2 p-2 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-yellow-800 mb-0.5 text-xs">خلفية صفراء - تحذير</div>
                  <p className="text-[10px] text-yellow-700 leading-tight">
                    بيانات قد تحتاج مراجعة. لا تمنع الاستيراد.
                  </p>
                </div>
              </div>
              
              {/* Empty Cell Explanation */}
              <div className="flex items-start gap-2 p-2 bg-white border-l-4 border-gray-300 rounded-lg">
                <div className="w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center">
                  <span className="text-red-600 font-bold text-xs">!</span>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800 mb-0.5 text-xs">حقل فارغ</div>
                  <p className="text-[10px] text-gray-700 leading-tight">
                    يظهر النص "<span className="font-bold text-red-600">غير موجود</span>" بخط أحمر Bold بدون خلفية.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Selected File - يظهر فقط خارج الـ modal */}
      {!isInModal && file && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <FileUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-bold text-blue-900 text-sm mb-0.5">{file.name}</div>
                <div className="text-xs text-blue-700 font-medium flex items-center gap-1">
                  <span>📁</span>
                  <span>{(file.size / 1024).toFixed(2)} KB</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={validateData}
                disabled={validating}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium text-sm shadow-md hover:shadow-lg flex items-center gap-1.5"
              >
                {validating ? (
                  <>
                    <span className="animate-spin text-xs">⏳</span>
                    <span>جارٍ التحقق...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>التحقق من البيانات</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm shadow-md hover:shadow-lg flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>إلغاء</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Results Summary - يظهر فقط خارج الـ modal */}
      {!isInModal && validationResults.length > 0 && (
        <div className="border-2 border-gray-300 rounded-xl overflow-hidden shadow-md">
          <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-5 py-4 border-b-2 border-gray-300 flex items-center justify-between">
            <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-blue-600" />
              ملخص نتائج التحقق
            </h4>
            <div className="flex items-center gap-4">
              {errorCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-lg border-2 border-red-400">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-bold text-red-700">{errorCount} خطأ</span>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 rounded-lg border-2 border-yellow-400">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="font-bold text-yellow-700">{warningCount} تحذير</span>
                </div>
              )}
              {errorCount === 0 && warningCount === 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg border-2 border-green-400">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-bold text-green-700">جاهز للاستيراد</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
              <span className="font-semibold text-gray-900">إجمالي الصفوف: {previewData.length}</span>
              <span className="text-red-600 font-semibold">صفوف بها أخطاء: {errorRowCount}</span>
              <span className="text-yellow-600 font-semibold">صفوف بها تحذيرات: {warningRowCount}</span>
            </div>
          </div>
          <div className="px-5 py-4 bg-white">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                <span className="text-base">💡</span>
                <span>
                  <strong className="font-semibold">نصيحة:</strong> يمكنك التمرير على أي خلية ملونة لعرض تفاصيل الخطأ أو التحذير. 
                  التحذيرات ستُستورد، والصفوف ذات الأخطاء غير المحددة سيتم تجاهلها. للتعارض مع بيانات النظام اختر إبقاء السجل الحالي أو استبداله.
                </span>
              </p>
            </div>
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

      {/* Preview Data - Hidden, shown in modal instead */}
      {/* eslint-disable-next-line no-constant-binary-expression */}
      {false && previewData.length > 0 && !columnValidationError && (() => {
        const totalPages = Math.ceil(previewData.length / rowsPerPage)
        const startIndex = (currentPage - 1) * rowsPerPage
        const endIndex = startIndex + rowsPerPage
        const paginatedData = previewData.slice(startIndex, endIndex)
        const dataColumns = Object.keys(previewData[0])
        const columns = getOrderedColumns(dataColumns, previewData)

        return (
          <div className="border-2 border-gray-300 rounded-xl overflow-hidden shadow-lg w-full" style={{ maxWidth: '100%' }}>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b-2 border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <h4 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-blue-600" />
                  معاينة البيانات ({previewData.length} صف)
                </h4>
                {selectedRows.size > 0 && (
                  <span className="px-3 py-1 text-xs text-blue-700 bg-blue-100 rounded-full font-semibold">
                    {selectedRows.size} صف محدد
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-700 font-medium bg-white px-3 py-1 rounded-lg border border-gray-200">
                الصفحة {currentPage} من {totalPages}
              </div>
            </div>
            <div className="relative w-full bg-gray-50" style={{ maxWidth: '100%', overflow: 'hidden' }}>
              <div 
                className="overflow-y-auto" 
                style={{ 
                  maxHeight: 'calc(100vh - 350px)',
                  width: '100%',
                  maxWidth: '100%'
                }}
              >
                <table className="text-[11px] w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: '100%', maxWidth: '100%' }}>
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                  <tr>
                    <th className="px-0.5 py-1 text-center font-semibold text-gray-800 whitespace-nowrap bg-gray-200 text-[11px]" style={{ width: '2%' }}>
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
                    <th className="px-0.5 py-1 text-center font-semibold text-gray-800 whitespace-nowrap bg-gray-200 text-[11px]" style={{ width: '3%' }}>
                      رقم الصف
                    </th>
                    {columns.map((key, index) => {
                      // تحديد عرض أصغر لكل عمود بناءً على نوعه لتتناسب مع الشاشة
                      let columnWidth = '4%' // العرض الافتراضي كنسبة مئوية
                      
                      if (key === 'الاسم') columnWidth = '6%'
                      else if (key === 'المهنة') columnWidth = '5%'
                      else if (key === 'الجنسية') columnWidth = '3%' // تصغير عرض عمود الجنسية
                      else if (key === 'رقم الإقامة') columnWidth = '4%' // 10 أرقام
                      else if (key === 'رقم الجواز') columnWidth = '4%' // 9-10 أرقام + حرف
                      else if (key === 'رقم الهاتف') columnWidth = '4%' // 10 أرقام
                      else if (key === 'الحساب البنكي') columnWidth = '5%'
                      else if (key === 'الراتب') columnWidth = '4%'
                      else if (key === 'المشروع') columnWidth = '6%'
                      else if (key === 'الرقم الموحد') columnWidth = '4%' // 10 أرقام
                      else if (key.includes('تاريخ')) columnWidth = '6%' // زيادة العرض للتواريخ لعرضها بالكامل
                      else if (key === 'الملاحظات') columnWidth = '6%'
                      
                      // تحديد ما إذا كان العمود حقل تاريخ
                      const isDateColumn = key.includes('تاريخ')
                      
                      return (
                        <th 
                          key={index} 
                          className={`px-0.5 py-1 font-semibold text-gray-800 whitespace-nowrap text-[11px] ${
                            isDateColumn ? 'text-left' : 'text-right'
                          }`}
                          style={{ 
                            width: columnWidth,
                            ...(isDateColumn ? { direction: 'ltr' } : {})
                          }}
                        >
                          {key}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, localRowIndex) => {
                    const actualRowIndex = startIndex + localRowIndex
                    const excelRowNumber = actualRowIndex + 2
                    const isEven = localRowIndex % 2 === 0
                    return (
                      <tr key={actualRowIndex} className={`border-b border-gray-200 transition-colors ${isEven ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-100`}>
                        <td 
                          className="px-0.5 py-0.5 text-center text-[11px]" 
                          style={{ backgroundColor: isEven ? '#ffffff' : '#f9fafb' }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRows.has(actualRowIndex)}
                            onChange={() => toggleRowSelection(actualRowIndex)}
                            className="w-3 h-3 cursor-pointer"
                          />
                        </td>
                        <td 
                          className="px-0.5 py-0.5 text-center font-semibold text-gray-700 text-[11px]" 
                          style={{ backgroundColor: isEven ? '#ffffff' : '#f9fafb' }}
                        >
                          {excelRowNumber}
                        </td>
                        {columns.map((key, colIndex) => {
                          const value = row[key]
                          const isEmpty = isCellEmpty(value)
                          const cellErrors = getCellErrors(actualRowIndex, key)
                          const hasError = cellErrors.some(e => e.severity === 'error')
                          const hasWarning = cellErrors.some(e => e.severity === 'warning')
                          
                          // الخلفية الحمراء فقط للحقول المطلوبة التي لديها خطأ (severity: error)
                          let cellClassName = `px-0.5 py-0.5 text-[11px] overflow-hidden `
                          if (hasError) {
                            // خلفية حمراء فقط للحقول المطلوبة (التي تمنع الاستيراد)
                            cellClassName += 'bg-red-100 text-red-900 border-l-2 border-red-500 font-medium'
                          } else if (hasWarning) {
                            cellClassName += 'bg-yellow-50 text-yellow-900 border-l-2 border-yellow-500'
                          } else {
                            // الحقول الفارغة العادية: لا خلفية حمراء - فقط نص أحمر Bold
                            // الخلايا العادية تأخذ لون الصف
                            cellClassName += 'text-gray-800'
                          }

                          // تحديد ما إذا كان الحقل حقل تاريخ
                          const isDateField = key.includes('تاريخ')
                          
                          // الحصول على القيمة الأصلية مباشرة
                          const fullValue = value?.toString() || ''
                          
                          // معالجة خاصة للتواريخ
                          let displayValue = isEmpty 
                            ? (importType === 'companies' ? 'فارغ' : 'غير موجود') 
                            : fullValue
                          
                          let parsedDate: Date | null = null
                          let dateParseError: string | undefined = undefined
                          
                          // إذا كان الحقل تاريخ، محاولة تحليل التاريخ
                          if (isDateField && !isEmpty && fullValue) {
                            // تنظيف القيمة من "..." في البداية أو النهاية وأي مسافات
                            const cleanedValue = fullValue.trim()
                                .replace(/^\.\.\.+/, '') // إزالة "..." من البداية
                                .replace(/\.\.\.+$/, '') // إزالة "..." من النهاية
                                .trim()
                            
                            // Debug: طباعة القيمة للتحقق (أول 3 صفوف فقط)
                            if (actualRowIndex < 3 && colIndex === columns.length - 6) { // آخر عمود تاريخ
                              logger.debug(`🔍 Parsing date in preview for row ${actualRowIndex + 1}, field "${key}":`, {
                                'fullValue': fullValue,
                                'cleanedValue': cleanedValue
                              })
                            }
                            
                            // محاولة تحليل التاريخ
                            let dateResult = parseDate(cleanedValue)
                            
                            // إذا فشل التحليل، حاول بالقيمة الأصلية الكاملة
                            if (!dateResult.date && cleanedValue !== fullValue.trim()) {
                              dateResult = parseDate(fullValue.trim())
                            }
                            
                            // إذا فشل التحليل، حاول بعد إزالة جميع "..." من أي مكان
                            if (!dateResult.date) {
                              const fullyCleaned = fullValue.trim().replace(/\.\.\./g, '').trim()
                              if (fullyCleaned && fullyCleaned !== cleanedValue) {
                                dateResult = parseDate(fullyCleaned)
                              }
                            }
                            
                            // Debug: طباعة نتيجة التحليل
                            if (actualRowIndex < 3 && colIndex === columns.length - 6) {
                              logger.debug(`✅ Parse result for "${key}":`, {
                                'success': !!dateResult.date,
                                'error': dateResult.error,
                                'format': dateResult.format,
                                'date': dateResult.date
                              })
                            }
                            
                            if (dateResult.date) {
                              parsedDate = dateResult.date
                              // عرض التاريخ بصيغة dd-mmm-yyyy (مثل: 03-May-2026)
                              displayValue = formatDateDDMMMYYYY(dateResult.date)
                              
                              // Debug: طباعة القيمة المعروضة
                              if (actualRowIndex < 3 && colIndex === columns.length - 6) {
                                logger.debug(`📅 Display value for "${key}":`, displayValue)
                              }
                            } else {
                              // فشل التحليل - عرض القيمة الأصلية الكاملة بدون truncate
                              dateParseError = dateResult.error
                              // عرض القيمة الأصلية بدون "..." في البداية/النهاية
                              displayValue = fullValue.trim().replace(/^\.\.\.+/, '').replace(/\.\.\.+$/, '') || fullValue
                              
                              // Debug: طباعة خطأ التحليل
                              if (actualRowIndex < 3 && colIndex === columns.length - 6) {
                                console.error(`❌ Failed to parse date "${key}":`, {
                                  'original': fullValue,
                                  'cleaned': cleanedValue,
                                  'error': dateResult.error,
                                  'displayValue': displayValue
                                })
                              }
                            }
                          }
                          
                          // تطبيق truncate على النصوص الطويلة
                          // ملاحظة: أعمدة التواريخ لا يتم قطعها أبداً - تُعرض بالكامل
                          if (displayValue && !isEmpty && !isDateField) {
                            let maxLength = 10 // الطول الافتراضي
                            if (key === 'الحساب البنكي') maxLength = 10
                            else if (key === 'المشروع') maxLength = 12
                            else if (key === 'الملاحظات') maxLength = 10
                            else if (key === 'الاسم') maxLength = 15
                            else if (key === 'المهنة') maxLength = 12
                            else if (key === 'الجنسية') maxLength = 8 // تصغير عرض عمود الجنسية
                            else if (key === 'رقم الإقامة') maxLength = 10 // 10 أرقام
                            else if (key === 'رقم الجواز') maxLength = 11 // 9-10 أرقام + حرف
                            else if (key === 'رقم الهاتف') maxLength = 10 // 10 أرقام
                            else if (key === 'الرقم الموحد') maxLength = 10 // 10 أرقام
                            
                            if (displayValue.length > maxLength) {
                              displayValue = displayValue.substring(0, maxLength) + '...'
                            }
                          }
                          // التواريخ (المحللة أو غير المحللة) تُعرض بالكامل بدون truncate
                          
                          // جمع رسائل الأخطاء والتحذيرات
                          const errorMessages = cellErrors.map(e => e.message).join(' • ')
                          
                          // إعداد tooltip للتواريخ
                          let tooltipText = fullValue
                          if (isDateField && !isEmpty) {
                            if (parsedDate) {
                              // إذا تم تحليل التاريخ بنجاح، عرض القيمة الأصلية والتاريخ المحلل
                              tooltipText = `الأصل: ${fullValue}\nالمحلل: ${formatDateDDMMMYYYY(parsedDate)}`
                            } else if (dateParseError) {
                              // إذا فشل التحليل، عرض القيمة الأصلية ورسالة الخطأ
                              tooltipText = `القيمة: ${fullValue}\nخطأ: ${dateParseError}`
                            }
                          }
                          if (errorMessages) {
                            tooltipText = errorMessages + (tooltipText !== fullValue ? `\n${tooltipText}` : '')
                          }

                          // تحديد تنسيق الحقل الفارغ (بدون خلفية حمراء، فقط نص أحمر Bold)
                          const isEmptyWithNoError = isEmpty && !hasError
                          
                          return (
                            <td
                              key={colIndex}
                              className={cellClassName}
                              title={tooltipText}
                              style={{ 
                                // أعمدة التواريخ: عرض كامل بدون truncate مع محاذاة يسار واتجاه LTR
                                ...(isDateField ? {
                                  minWidth: 'fit-content',
                                  width: 'auto',
                                  whiteSpace: 'nowrap',
                                  overflow: 'visible',
                                  textOverflow: 'clip',
                                  textAlign: 'left', // محاذاة يسار
                                  direction: 'ltr' // اتجاه من اليسار إلى اليمين
                                } : {
                                  maxWidth: '100%',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                })
                              }}
                            >
                              <div className={`flex items-center gap-0.5 ${isDateField ? 'overflow-visible justify-start' : 'overflow-hidden'}`}>
                                {hasError && <XCircle className="w-2.5 h-2.5 text-red-600 flex-shrink-0" />}
                                {hasWarning && !hasError && <AlertCircle className="w-2.5 h-2.5 text-yellow-600 flex-shrink-0" />}
                                <span 
                                  className={`${isDateField ? 'whitespace-nowrap overflow-visible' : 'truncate'} ${
                                    hasError ? 'font-semibold' : 
                                    isEmptyWithNoError ? 'font-bold text-red-600' : 
                                    ''
                                  }`}
                                  style={isDateField ? { 
                                    overflow: 'visible', 
                                    textOverflow: 'clip',
                                    direction: 'ltr', // اتجاه من اليسار إلى اليمين
                                    textAlign: 'left' // محاذاة يسار
                                  } : {}}
                                  title={tooltipText}
                                >
                                  {displayValue}
                                </span>
                              </div>
                              {cellErrors.length > 0 && (
                                <div className="mt-0.5 text-[9px] opacity-75 leading-tight truncate" title={errorMessages}>
                                  {errorMessages.length > 15 ? errorMessages.substring(0, 15) + '...' : errorMessages}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t-2 border-gray-300 flex items-center justify-between">
                <div className="text-sm text-gray-700 font-medium">
                  عرض <span className="font-bold text-blue-600">{startIndex + 1}</span> - <span className="font-bold text-blue-600">{Math.min(endIndex, previewData.length)}</span> من <span className="font-bold text-gray-900">{previewData.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors disabled:border-gray-200"
                  >
                    ← السابق
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-800 font-semibold bg-white border-2 border-gray-300 rounded-lg">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors disabled:border-gray-200"
                  >
                    التالي →
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Delete Options - Hidden, shown in modal instead */}
      {/* eslint-disable-next-line no-constant-binary-expression */}
      {false && file && previewData.length > 0 && !columnValidationError && errorCount === 0 && (
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

      {/* Import Button - Hidden, shown in modal instead */}
      {/* eslint-disable-next-line no-constant-binary-expression */}
      {false && file && previewData.length > 0 && !columnValidationError && (
        <div className={`flex flex-col items-center gap-4 border-2 rounded-xl p-6 shadow-lg ${
          errorCount === 0 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' 
            : 'bg-red-50 border-red-300'
        }`}>
          {errorCount > 0 && selectedRows.size > 0 && (
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold text-base">تنبيه</span>
              </div>
              <p className="text-sm text-orange-600 text-center">
                الصفوف المحددة تحتوي على {errorCount} خطأ. سيتم استيراد الصفوف المحددة التي لا تحتوي على أخطاء فقط.
              </p>
            </div>
          )}
          {errorCount > 0 && selectedRows.size === 0 && (
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-5 h-5" />
                <span className="font-bold text-base">لا يمكن الاستيراد</span>
              </div>
              <p className="text-sm text-red-600 text-center">
                يرجى إصلاح جميع الأخطاء ({errorCount} خطأ) أو إلغاء تحديد الصفوف التي تحتوي على أخطاء قبل إمكانية الاستيراد
              </p>
            </div>
          )}
          <div className="text-base text-gray-700 font-medium text-center">
            {selectedRows.size > 0 
              ? (
                <>
                  سيتم استيراد <span className="font-bold text-green-700">{selectedRows.size}</span> صف محدد {errorCount > 0 && <span className="text-orange-600">(بعد استبعاد الصفوف التي تحتوي على أخطاء)</span>}
                </>
              ) : (
                <>
                  سيتم استيراد جميع الصفوف (<span className="font-bold text-green-700">{previewData.length}</span> صف) {errorCount > 0 && <span className="text-orange-600">(بعد استبعاد الصفوف التي تحتوي على أخطاء)</span>}
                </>
              )
            }
          </div>
          {/* شريط التقدم أثناء الحذف */}
          {isDeleting && (
            <div className="w-full mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                  <span className="text-sm font-semibold text-red-900">
                    جاري الحذف...
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {deleteProgress.total > 0 && (
                    <span className="text-sm font-bold text-red-700">
                      {deleteProgress.current} / {deleteProgress.total}
                    </span>
                  )}
                </div>
              </div>
              {deleteProgress.total > 0 ? (
                <>
                  <div className="bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out flex items-center justify-center relative bg-gradient-to-r from-red-500 via-red-600 to-orange-500"
                      style={{ width: `${Math.min((deleteProgress.current / deleteProgress.total) * 100, 100)}%` }}
                    >
                      {deleteProgress.current > 0 && (
                        <span className="text-xs font-bold text-white px-2 z-10">
                          {Math.round((deleteProgress.current / deleteProgress.total) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-center text-sm text-gray-700">
                    جارٍ حذف <span className="font-bold text-red-700">{deleteProgress.current}</span> من <span className="font-bold text-red-700">{deleteProgress.total}</span> {importType === 'employees' ? 'موظف' : 'مؤسسة'}...
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-gray-600">
                  جاري تحضير عملية الحذف...
                </div>
              )}
            </div>
          )}
          
          {/* شريط التقدم أثناء الاستيراد */}
          {importing && (
            <div className="w-full mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm font-semibold text-blue-900">
                    {isImportCancelled ? 'جاري إلغاء الاستيراد...' : 'جاري الاستيراد...'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {importProgress.total > 0 && (
                    <span className="text-sm font-bold text-blue-700">
                      {importProgress.current} / {importProgress.total}
                    </span>
                  )}
                  {!isImportCancelled && (
                    <button
                      onClick={cancelImport}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      إلغاء الاستيراد
                    </button>
                  )}
                </div>
              </div>
              {importProgress.total > 0 ? (
                <>
                  <div className="bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out flex items-center justify-center relative ${
                        isImportCancelled 
                          ? 'bg-gradient-to-r from-red-500 to-red-600' 
                          : 'bg-gradient-to-r from-blue-500 via-blue-600 to-emerald-500'
                      }`}
                      style={{ width: `${Math.min((importProgress.current / importProgress.total) * 100, 100)}%` }}
                    >
                      {importProgress.current > 0 && (
                        <span className="text-xs font-bold text-white px-2 z-10">
                          {Math.round((importProgress.current / importProgress.total) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-center text-sm text-gray-700">
                    {isImportCancelled ? (
                      <span className="text-red-700 font-semibold">جاري إلغاء الاستيراد وحذف السجلات المضافة...</span>
                    ) : (
                      <>
                        جارٍ استيراد <span className="font-bold text-blue-700">{importProgress.current}</span> من <span className="font-bold text-blue-700">{importProgress.total}</span> {importType === 'employees' ? 'موظف' : 'مؤسسة'}...
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-gray-600">
                  {isImportCancelled ? 'جاري إلغاء الاستيراد...' : 'جاري تحضير البيانات للاستيراد...'}
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={importData}
            disabled={importing || isDeleting || blockingErrorCount > 0}
            className={`flex items-center gap-3 px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed ${
              errorCount === 0
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                : 'bg-gray-400 text-white cursor-not-allowed opacity-50'
            }`}
          >
            <FileUp className="w-7 h-7" />
            {isDeleting ? (
              <>
                <span className="animate-spin">🗑️</span>
                <span>جاري الحذف...</span>
              </>
            ) : importing ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>جارٍ الاستيراد...</span>
              </>
            ) : (
              <span>استيراد البيانات</span>
            )}
          </button>
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

      {/* Preview Modal */}
      {showPreviewModal && previewData.length > 0 && !columnValidationError && (() => {
        const filteredRows = previewData
          .map((row, index) => ({ row, index, status: getRowIssues(index) }))
          .filter(({ status }) => {
            if (validationFilter === 'errors') return status.hasError
            if (validationFilter === 'warnings') return !status.hasError && status.hasWarning
            return true
          })

        const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage))
        const safeCurrentPage = Math.min(currentPage, totalPages)
        const startIndex = (safeCurrentPage - 1) * rowsPerPage
        const endIndex = startIndex + rowsPerPage
        const visibleRowCount = filteredRows.length
        const displayStart = visibleRowCount === 0 ? 0 : startIndex + 1
        const displayEnd = visibleRowCount === 0 ? 0 : Math.min(endIndex, visibleRowCount)
        const paginatedData = filteredRows.slice(startIndex, endIndex)
        const dataColumns = Object.keys(previewData[0])
        const columns = getOrderedColumns(dataColumns, previewData)

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
                      معاينة البيانات ({previewData.length} صف)
                    </h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      تحقق من البيانات قبل الاستيراد
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                    <span className="font-semibold text-gray-800">إجمالي الصفوف: {previewData.length}</span>
                    <span className="text-red-600 font-semibold">صفوف بها أخطاء: {errorRowCount}</span>
                    <span className="text-yellow-600 font-semibold">صفوف بها تحذيرات: {warningRowCount}</span>
                  </div>
                  <button
                    onClick={exportValidationReport}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold shadow-md hover:bg-black/80 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>تصدير تقرير الأخطاء</span>
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (!isDeleting && !importing && !showConfirmDialog) {
                      setShowPreviewModal(false)
                    } else {
                      toast.warning('لا يمكن إغلاق النافذة أثناء عملية الحذف أو الاستيراد')
                    }
                  }}
                  disabled={isDeleting || importing || showConfirmDialog}
                  className={`p-2 rounded-lg transition-colors ${
                    isDeleting || importing || showConfirmDialog
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-gray-100'
                  }`}
                  aria-label="إغلاق"
                >
                  <XCircle className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Validation Results Summary */}
                {validationResults.length > 0 && (
                  <div className="border-2 border-gray-300 rounded-xl overflow-hidden shadow-md">
                    <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-5 py-4 border-b-2 border-gray-300 flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-blue-600" />
                        ملخص نتائج التحقق
                      </h4>
                      <div className="flex items-center gap-4">
                        {errorCount > 0 && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-lg border-2 border-red-400">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="font-bold text-red-700">{errorCount} خطأ</span>
                          </div>
                        )}
                        {warningCount > 0 && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 rounded-lg border-2 border-yellow-400">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            <span className="font-bold text-yellow-700">{warningCount} تحذير</span>
                          </div>
                        )}
                        {errorCount === 0 && warningCount === 0 && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-lg border-2 border-green-400">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-bold text-green-700">جاهز للاستيراد</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                        <span className="font-semibold text-gray-900">إجمالي الصفوف: {previewData.length}</span>
                        <span className="text-red-600 font-semibold">صفوف بها أخطاء: {errorRowCount}</span>
                        <span className="text-yellow-600 font-semibold">صفوف بها تحذيرات: {warningRowCount}</span>
                      </div>
                    </div>
                    <div className="px-5 py-4 bg-white">
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <p className="text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                          <span className="text-base">💡</span>
                          <span>
                            <strong className="font-semibold">نصيحة:</strong> يمكنك التمرير على أي خلية ملونة لعرض تفاصيل الخطأ أو التحذير. 
                            التحذيرات ستُستورد، والصفوف ذات الأخطاء غير المحددة سيتم تجاهلها. للتعارض مع بيانات النظام اختر إبقاء السجل الحالي أو استبداله.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Data Table */}
                <div className="border-2 border-gray-300 rounded-xl overflow-hidden shadow-lg w-full" style={{ maxWidth: '100%' }}>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b-2 border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        <FileUp className="w-5 h-5 text-blue-600" />
                        جدول البيانات
                      </h4>
                      {selectedRows.size > 0 && (
                        <span className="px-3 py-1 text-xs text-blue-700 bg-blue-100 rounded-full font-semibold">
                          {selectedRows.size} صف محدد
                        </span>
                      )}
                      {selectedRows.size > 0 && (
                        <span className="px-3 py-1 text-xs text-red-700 bg-red-100 rounded-full font-semibold">
                          أخطاء في الصفوف المحددة: {selectedRowsErrorCount}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm text-gray-700 font-medium bg-white px-3 py-1 rounded-lg border border-gray-200">
                        الصفحة {safeCurrentPage} من {totalPages}
                      </div>
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm">
                        <button
                          onClick={() => handleFilterChange('all')}
                          className={`px-2 py-1 text-xs rounded-md border font-semibold transition ${validationFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                        >
                          عرض الكل
                        </button>
                        <button
                          onClick={() => handleFilterChange('errors')}
                          className={`px-2 py-1 text-xs rounded-md border font-semibold transition ${validationFilter === 'errors' ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                        >
                          الأخطاء فقط ({errorRowCount})
                        </button>
                        <button
                          onClick={() => handleFilterChange('warnings')}
                          className={`px-2 py-1 text-xs rounded-md border font-semibold transition ${validationFilter === 'warnings' ? 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                        >
                          التحذيرات فقط ({warningRowCount})
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="relative w-full bg-gray-50" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                    <div 
                      className="overflow-y-auto" 
                      style={{ 
                        maxHeight: 'calc(95vh - 500px)',
                        width: '100%',
                        maxWidth: '100%'
                      }}
                    >
                      <table className="text-[11px] w-full" style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: '100%', maxWidth: '100%' }}>
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                        <tr>
                          <th className="px-0.5 py-1 text-center font-semibold text-gray-800 whitespace-nowrap bg-gray-200 text-[11px]" style={{ width: '2%' }}>
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
                          <th className="px-0.5 py-1 text-center font-semibold text-gray-800 whitespace-nowrap bg-gray-200 text-[11px]" style={{ width: '3%' }}>
                            رقم الصف
                          </th>
                          <th className="px-0.5 py-1 text-center font-semibold text-gray-800 whitespace-nowrap bg-gray-200 text-[11px]" style={{ width: '6%' }}>
                            الحالة
                          </th>
                          {columns.map((key, index) => {
                            // تحديد عرض أصغر لكل عمود بناءً على نوعه لتتناسب مع الشاشة
                            let columnWidth = '4%' // العرض الافتراضي كنسبة مئوية
                            
                            if (key === 'الاسم') columnWidth = '6%'
                            else if (key === 'المهنة') columnWidth = '5%'
                            else if (key === 'الجنسية') columnWidth = '3%' // تصغير عرض عمود الجنسية
                            else if (key === 'رقم الإقامة') columnWidth = '4%' // 10 أرقام
                            else if (key === 'رقم الجواز') columnWidth = '4%' // 9-10 أرقام + حرف
                            else if (key === 'رقم الهاتف') columnWidth = '4%' // 10 أرقام
                            else if (key === 'الحساب البنكي') columnWidth = '5%'
                            else if (key === 'الراتب') columnWidth = '4%'
                            else if (key === 'المشروع') columnWidth = '6%'
                            else if (key === 'الرقم الموحد') columnWidth = '4%' // 10 أرقام
                            else if (key.includes('تاريخ')) columnWidth = '6%' // زيادة العرض للتواريخ لعرضها بالكامل
                            else if (key === 'الملاحظات') columnWidth = '6%'
                            
                            // تحديد ما إذا كان العمود حقل تاريخ
                            const isDateColumn = key.includes('تاريخ')
                            
                            return (
                              <th 
                                key={index} 
                                className={`px-0.5 py-1 font-semibold text-gray-800 whitespace-nowrap text-[11px] ${
                                  isDateColumn ? 'text-left' : 'text-right'
                                }`}
                                style={{ 
                                  width: columnWidth,
                                  ...(isDateColumn ? { direction: 'ltr' } : {})
                                }}
                              >
                                {key}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map(({ row, index: originalIndex, status }, localRowIndex) => {
                          const excelRowNumber = originalIndex + 2
                          const isEven = localRowIndex % 2 === 0
                          const isConflictRow = dbConflicts.has(originalIndex)
                          const conflictChoice = conflictResolution.get(originalIndex)
                          return (
                            <tr key={originalIndex} className={`border-b border-gray-200 transition-colors ${isEven ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-100`}>
                              <td 
                                className="px-0.5 py-0.5 text-center text-[11px]" 
                                style={{ backgroundColor: isEven ? '#ffffff' : '#f9fafb' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(originalIndex)}
                                  onChange={() => toggleRowSelection(originalIndex)}
                                  className="w-3 h-3 cursor-pointer"
                                />
                              </td>
                              <td 
                                className="px-0.5 py-0.5 text-center font-semibold text-gray-700 text-[11px]" 
                                style={{ backgroundColor: isEven ? '#ffffff' : '#f9fafb' }}
                              >
                                {excelRowNumber}
                              </td>
                              <td className="px-0.5 py-0.5 text-center text-[11px]" style={{ backgroundColor: isEven ? '#ffffff' : '#f9fafb' }}>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                                    status.hasError
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : status.hasWarning
                                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                        : 'bg-green-50 text-green-700 border-green-200'
                                  }`}
                                  title={
                                    [
                                      ...status.rowValidation.map(issue => issue.message),
                                      isConflictRow && !conflictChoice ? 'الرجاء اختيار إبقاء السجل الحالي أو استبداله' : null
                                    ].filter(Boolean).join(' • ')
                                  }
                                >
                                  {status.hasError ? 'خطأ' : status.hasWarning ? 'تحذير' : 'سليم'}
                                  {isConflictRow && !conflictChoice && (
                                    <span className="ml-1 text-[9px] font-semibold text-orange-700">قرار مطلوب</span>
                                  )}
                                </span>
                                {isConflictRow && (
                                  <div className="mt-1 flex items-center gap-2 justify-center text-[10px] text-gray-700">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`conflict-${originalIndex}`}
                                        value="keep"
                                        checked={conflictChoice === 'keep'}
                                        onChange={() => updateConflictChoice(originalIndex, 'keep')}
                                        className="w-3 h-3"
                                      />
                                      <span>إبقاء</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`conflict-${originalIndex}`}
                                        value="replace"
                                        checked={conflictChoice === 'replace'}
                                        onChange={() => updateConflictChoice(originalIndex, 'replace')}
                                        className="w-3 h-3"
                                      />
                                      <span>استبدال</span>
                                    </label>
                                  </div>
                                )}
                              </td>
                              {columns.map((key, colIndex) => {
                                const value = row[key]
                                const isEmpty = isCellEmpty(value)
                                const cellErrors = getCellErrors(originalIndex, key)
                                const hasError = cellErrors.some(e => e.severity === 'error')
                                const hasWarning = cellErrors.some(e => e.severity === 'warning')
                                
                                // تحديد ما إذا كان الحقل حقل تاريخ
                                const isDateField = key.includes('تاريخ')
                                
                                // الخلفية الحمراء فقط للحقول المطلوبة التي لديها خطأ (severity: error)
                                let cellClassName = `px-0.5 py-0.5 text-[11px] overflow-hidden `
                                if (hasError) {
                                  // خلفية حمراء فقط للحقول المطلوبة (التي تمنع الاستيراد)
                                  cellClassName += 'bg-red-100 text-red-900 border-l-2 border-red-500 font-medium'
                                } else if (hasWarning) {
                                  cellClassName += 'bg-yellow-50 text-yellow-900 border-l-2 border-yellow-500'
                                } else {
                                  // الحقول الفارغة العادية: لا خلفية حمراء - فقط نص أحمر Bold
                                  // الخلايا العادية تأخذ لون الصف
                                  cellClassName += 'text-gray-800'
                                }

                                // الحصول على القيمة الأصلية مباشرة
                                const fullValue = value?.toString() || ''
                                
                                // معالجة خاصة للتواريخ
                                let displayValue = isEmpty 
                                  ? (importType === 'companies' ? 'فارغ' : 'غير موجود') 
                                  : fullValue
                                
                                let parsedDate: Date | null = null
                                let dateParseError: string | undefined = undefined
                                
                                // إذا كان الحقل تاريخ، محاولة تحليل التاريخ
                                if (isDateField && !isEmpty && fullValue) {
                                  // تنظيف القيمة من "..." في البداية أو النهاية وأي مسافات
                                  const cleanedValue = fullValue.trim()
                                      .replace(/^\.\.\.+/, '') // إزالة "..." من البداية
                                      .replace(/\.\.\.+$/, '') // إزالة "..." من النهاية
                                      .trim()
                                  
                                  // محاولات متعددة لتحليل التاريخ
                                  let dateResult = parseDate(cleanedValue)
                                  
                                  // إذا فشل التحليل، حاول بالقيمة الأصلية الكاملة
                                  if (!dateResult.date && cleanedValue !== fullValue.trim()) {
                                    dateResult = parseDate(fullValue.trim())
                                  }
                                  
                                  // إذا فشل التحليل، حاول بعد إزالة جميع "..." من أي مكان
                                  if (!dateResult.date) {
                                    const fullyCleaned = fullValue.trim().replace(/\.\.\./g, '').trim()
                                    if (fullyCleaned && fullyCleaned !== cleanedValue) {
                                      dateResult = parseDate(fullyCleaned)
                                    }
                                  }
                                  
                                  if (dateResult.date) {
                                    parsedDate = dateResult.date
                                    // عرض التاريخ بصيغة dd-mmm-yyyy (مثل: 03-May-2026)
                                    displayValue = formatDateDDMMMYYYY(dateResult.date)
                                  } else {
                                    // فشل التحليل - عرض القيمة الأصلية الكاملة بدون truncate
                                    dateParseError = dateResult.error
                                    displayValue = fullValue.trim().replace(/^\.\.\.+/, '').replace(/\.\.\.+$/, '') || fullValue
                                  }
                                }
                                
                                // تطبيق truncate على النصوص الطويلة
                                // ملاحظة: أعمدة التواريخ لا يتم قطعها أبداً - تُعرض بالكامل
                                if (displayValue && !isEmpty && !isDateField) {
                                  let maxLength = 10 // الطول الافتراضي
                                  if (key === 'الحساب البنكي') maxLength = 10
                                  else if (key === 'المشروع') maxLength = 12
                                  else if (key === 'الملاحظات') maxLength = 10
                                  else if (key === 'الاسم') maxLength = 15
                                  else if (key === 'المهنة') maxLength = 12
                                  else if (key === 'الجنسية') maxLength = 8 // تصغير عرض عمود الجنسية
                                  else if (key === 'رقم الإقامة') maxLength = 10 // 10 أرقام
                                  else if (key === 'رقم الجواز') maxLength = 11 // 9-10 أرقام + حرف
                                  else if (key === 'رقم الهاتف') maxLength = 10 // 10 أرقام
                                  else if (key === 'الرقم الموحد') maxLength = 10 // 10 أرقام
                                  
                                  if (displayValue.length > maxLength) {
                                    displayValue = displayValue.substring(0, maxLength) + '...'
                                  }
                                }
                                // التواريخ (المحللة أو غير المحللة) تُعرض بالكامل بدون truncate
                                
                                // جمع رسائل الأخطاء والتحذيرات
                                const errorMessages = cellErrors.map(e => e.message).join(' • ')
                                
                                // إعداد tooltip للتواريخ
                                let tooltipText = fullValue
                                if (isDateField && !isEmpty) {
                                  if (parsedDate) {
                                    // إذا تم تحليل التاريخ بنجاح، عرض القيمة الأصلية والتاريخ المحلل
                                    tooltipText = `الأصل: ${fullValue}\nالمحلل: ${formatDateDDMMMYYYY(parsedDate)}`
                                  } else if (dateParseError) {
                                    // إذا فشل التحليل، عرض القيمة الأصلية ورسالة الخطأ
                                    tooltipText = `القيمة: ${fullValue}\nخطأ: ${dateParseError}`
                                  }
                                }
                                if (errorMessages) {
                                  tooltipText = errorMessages + (tooltipText !== fullValue ? `\n${tooltipText}` : '')
                                }

                                // تحديد تنسيق الحقل الفارغ (بدون خلفية حمراء، فقط نص أحمر Bold)
                                const isEmptyWithNoError = isEmpty && !hasError
                                
                                return (
                                  <td
                                    key={colIndex}
                                    className={cellClassName}
                                    title={tooltipText}
                                    style={{ 
                                      // أعمدة التواريخ: عرض كامل بدون truncate مع محاذاة يسار واتجاه LTR
                                      ...(isDateField ? {
                                        minWidth: 'fit-content',
                                        width: 'auto',
                                        whiteSpace: 'nowrap',
                                        overflow: 'visible',
                                        textOverflow: 'clip',
                                        textAlign: 'left', // محاذاة يسار
                                        direction: 'ltr' // اتجاه من اليسار إلى اليمين
                                      } : {
                                        maxWidth: '100%',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      })
                                    }}
                                  >
                                    <div className={`flex items-center gap-0.5 ${isDateField ? 'overflow-visible justify-start' : 'overflow-hidden'}`}>
                                      {hasError && <XCircle className="w-2.5 h-2.5 text-red-600 flex-shrink-0" />}
                                      {hasWarning && !hasError && <AlertCircle className="w-2.5 h-2.5 text-yellow-600 flex-shrink-0" />}
                                      <span 
                                        className={`${isDateField ? 'whitespace-nowrap overflow-visible' : 'truncate'} ${
                                          hasError ? 'font-semibold' : 
                                          isEmptyWithNoError ? 'font-bold text-red-600' : 
                                          ''
                                        }`}
                                        style={isDateField ? { 
                                          overflow: 'visible', 
                                          textOverflow: 'clip',
                                          direction: 'ltr', // اتجاه من اليسار إلى اليمين
                                          textAlign: 'left' // محاذاة يسار
                                        } : {}}
                                        title={tooltipText}
                                      >
                                        {displayValue}
                                      </span>
                                    </div>
                                    {cellErrors.length > 0 && (
                                      <div className="mt-0.5 text-[9px] opacity-75 leading-tight truncate" title={errorMessages}>
                                        {errorMessages.length > 15 ? errorMessages.substring(0, 15) + '...' : errorMessages}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t-2 border-gray-300 flex items-center justify-between">
                      <div className="text-sm text-gray-700 font-medium">
                        عرض <span className="font-bold text-blue-600">{displayStart}</span> - <span className="font-bold text-blue-600">{displayEnd}</span> من <span className="font-bold text-gray-900">{visibleRowCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={safeCurrentPage === 1}
                          className="px-4 py-2 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors disabled:border-gray-200"
                        >
                          ← السابق
                        </button>
                        <span className="px-4 py-2 text-sm text-gray-800 font-semibold bg-white border-2 border-gray-300 rounded-lg">
                          {safeCurrentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={safeCurrentPage === totalPages}
                          className="px-4 py-2 text-sm border-2 border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors disabled:border-gray-200"
                        >
                          التالي →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delete Options */}
                {errorCount === 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="delete-before-import-modal"
                        checked={shouldDeleteBeforeImport}
                        onChange={(e) => setShouldDeleteBeforeImport(e.target.checked)}
                        className="mt-1 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="delete-before-import-modal" className="flex-1 cursor-pointer">
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
                            id="delete-all-modal"
                            name="delete-mode-modal"
                            value="all"
                            checked={deleteMode === 'all'}
                            onChange={(e) => setDeleteMode(e.target.value as 'all' | 'matching')}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor="delete-all-modal" className="cursor-pointer text-sm text-gray-700">
                            حذف جميع البيانات ({importType === 'companies' ? 'جميع المؤسسات' : 'جميع الموظفين'})
                          </label>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            id="delete-matching-modal"
                            name="delete-mode-modal"
                            value="matching"
                            checked={deleteMode === 'matching'}
                            onChange={(e) => setDeleteMode(e.target.value as 'all' | 'matching')}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor="delete-matching-modal" className="cursor-pointer text-sm text-gray-700">
                            حذف البيانات المطابقة فقط ({importType === 'companies' ? 'المؤسسات بنفس الرقم الموحد' : 'الموظفين بنفس رقم الإقامة'})
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Delete Confirmation Modal */}
                <DeleteConfirmationModal
                  isOpen={showConfirmDialog}
                  onClose={() => {
                    setShowConfirmDialog(false)
                    setPendingImport(null)
                  }}
                  onConfirm={async () => {
                    logger.debug('🔄 Confirm delete button clicked')
                    if (pendingImport) {
                      logger.debug('🔄 Calling pendingImport callback')
                      try {
                        await pendingImport()
                        logger.debug('✅ pendingImport callback completed')
                      } catch (error) {
                        console.error('❌ Error executing pendingImport:', error)
                        const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
                        toast.error(`فشل العملية: ${errorMessage}`)
                      }
                    } else {
                      console.error('❌ pendingImport is null!')
                      toast.error('خطأ: لم يتم تهيئة عملية الحذف بشكل صحيح')
                    }
                  }}
                  deleteMode={deleteMode}
                  importType={importType}
                  selectedRowsCount={selectedRows.size}
                  totalRowsCount={previewData.length}
                />

                {/* Import Button */}
                <div className={`flex flex-col items-center gap-4 border-2 rounded-xl p-6 shadow-lg ${
                    errorCount === 0 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' 
                      : 'bg-red-50 border-red-300'
                  }`}>
                    {blockingErrorCount > 0 ? (
                      <div className="flex flex-col items-center gap-2 mb-2 text-center">
                        <div className="flex items-center gap-2 text-red-700">
                          <XCircle className="w-5 h-5" />
                          <span className="font-bold text-base">لا يمكن الاستيراد</span>
                        </div>
                        <p className="text-sm text-red-700">
                          يوجد {blockingErrorCount} خطأ في الملف. يجب إصلاح جميع الأخطاء قبل المتابعة. التحذيرات لا تمنع الاستيراد.
                        </p>
                      </div>
                    ) : (
                      <div className="text-base text-gray-700 font-medium text-center">
                        {selectedRows.size > 0 
                          ? (
                            <>
                              سيتم استيراد <span className="font-bold text-green-700">{selectedRows.size}</span> صف محدد (التحذيرات ستُستورد)
                            </>
                          ) : (
                            <>
                              سيتم استيراد جميع الصفوف (<span className="font-bold text-green-700">{previewData.length}</span> صف) (التحذيرات ستُستورد)
                            </>
                          )
                        }
                      </div>
                    )}
                  {/* شريط التقدم أثناء الحذف */}
                  {isDeleting && (
                    <div className="w-full mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                          <span className="text-sm font-semibold text-red-900">
                            جاري الحذف...
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {deleteProgress.total > 0 && (
                            <span className="text-sm font-bold text-red-700">
                              {deleteProgress.current} / {deleteProgress.total}
                            </span>
                          )}
                        </div>
                      </div>
                      {deleteProgress.total > 0 ? (
                        <>
                          <div className="bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner mb-2">
                            <div
                              className="h-full rounded-full transition-all duration-300 ease-out flex items-center justify-center relative bg-gradient-to-r from-red-500 via-red-600 to-orange-500"
                              style={{ width: `${Math.min((deleteProgress.current / deleteProgress.total) * 100, 100)}%` }}
                            >
                              {deleteProgress.current > 0 && (
                                <span className="text-xs font-bold text-white px-2 z-10">
                                  {Math.round((deleteProgress.current / deleteProgress.total) * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-center text-sm text-gray-700">
                            جارٍ حذف <span className="font-bold text-red-700">{deleteProgress.current}</span> من <span className="font-bold text-red-700">{deleteProgress.total}</span> {importType === 'employees' ? 'موظف' : 'مؤسسة'}...
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-sm text-gray-600">
                          جاري تحضير عملية الحذف...
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* شريط التقدم أثناء الاستيراد */}
                  {importing && (
                    <div className="w-full mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                          <span className="text-sm font-semibold text-blue-900">
                            {isImportCancelled ? 'جاري إلغاء الاستيراد...' : 'جاري الاستيراد...'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {importProgress.total > 0 && (
                            <span className="text-sm font-bold text-blue-700">
                              {importProgress.current} / {importProgress.total}
                            </span>
                          )}
                          {!isImportCancelled && (
                            <button
                              onClick={cancelImport}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              إلغاء الاستيراد
                            </button>
                          )}
                        </div>
                      </div>
                      {importProgress.total > 0 ? (
                        <>
                          <div className="bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner mb-2">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ease-out flex items-center justify-center relative ${
                                isImportCancelled 
                                  ? 'bg-gradient-to-r from-red-500 to-red-600' 
                                  : 'bg-gradient-to-r from-blue-500 via-blue-600 to-emerald-500'
                              }`}
                              style={{ width: `${Math.min((importProgress.current / importProgress.total) * 100, 100)}%` }}
                            >
                              {importProgress.current > 0 && (
                                <span className="text-xs font-bold text-white px-2 z-10">
                                  {Math.round((importProgress.current / importProgress.total) * 100)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-center text-sm text-gray-700">
                            {isImportCancelled ? (
                              <span className="text-red-700 font-semibold">جاري إلغاء الاستيراد وحذف السجلات المضافة...</span>
                            ) : (
                              <>
                                جارٍ استيراد <span className="font-bold text-blue-700">{importProgress.current}</span> من <span className="font-bold text-blue-700">{importProgress.total}</span> {importType === 'employees' ? 'موظف' : 'مؤسسة'}...
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-sm text-gray-600">
                          {isImportCancelled ? 'جاري إلغاء الاستيراد...' : 'جاري تحضير البيانات للاستيراد...'}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <button
                    onClick={importData}
                    disabled={importing || isDeleting || blockingErrorCount > 0}
                    className={`flex items-center gap-3 px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed ${
                      errorCount === 0
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                        : 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                    }`}
                  >
                    <FileUp className="w-7 h-7" />
                    {isDeleting ? (
                      <>
                        <span className="animate-spin">🗑️</span>
                        <span>جاري الحذف...</span>
                      </>
                    ) : importing ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>جارٍ الاستيراد...</span>
                      </>
                    ) : (
                      <span>استيراد البيانات</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
