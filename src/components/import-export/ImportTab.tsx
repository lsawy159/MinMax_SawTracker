import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FileUp, AlertCircle, CheckCircle, XCircle, Upload } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { parseDate, normalizeDate } from '@/utils/dateParser'
import { formatDateShortWithHijri, formatDateDDMMMYYYY } from '@/utils/dateFormatter'

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
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [isImportCancelled, setIsImportCancelled] = useState(false)
  const [importedIds, setImportedIds] = useState<{ employees: string[], companies: string[] }>({ employees: [], companies: [] })
  const importedIdsRef = useRef<{ employees: string[], companies: string[] }>({ employees: [], companies: [] })
  const cancelImportRef = useRef(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

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

  const handleCancel = () => {
    setFile(null)
    setValidationResults([])
    setPreviewData([])
    setImportResult(null)
    setCurrentPage(1)
    setColumnValidationError(null)
    setSelectedRows(new Set())
    setShouldDeleteBeforeImport(false)
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
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '', // قيمة افتراضية للأعمدة الفارغة
        raw: false // تحويل القيم إلى strings
      })
      
      // معالجة التواريخ من الخلايا مباشرة للحصول على القيم الصحيحة
      jsonData.forEach((row: any, rowIndex: number) => {
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
              } else if (row[colName]) {
                // إذا فشلت قراءة الخلية، احتفظ بالقيمة من jsonData بعد تنظيفها
                row[colName] = String(row[colName] || '').trim()
              } else {
                row[colName] = ''
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
      
      // Debug: طباعة عينة من التواريخ للتحقق
      if (jsonData.length > 0) {
        console.log('🔍 Sample dates from first row:')
        dateColumns.forEach(col => {
          if (jsonData[0][col]) {
            console.log(`  ${col}: "${jsonData[0][col]}"`)
          }
        })
      }

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

        jsonData.forEach((row: any, index: number) => {
          const residenceNumber = row['رقم الإقامة']?.toString().trim()
          if (residenceNumber) {
            if (!residenceNumberMap.has(residenceNumber)) {
              residenceNumberMap.set(residenceNumber, [])
            }
            residenceNumberMap.get(residenceNumber)!.push(index)
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
            if (duplicateIndices.length > 1 && duplicateIndices.indexOf(index) !== duplicateIndices[0]) {
              // This is a duplicate in the sheet (not the first occurrence)
              errors.push({
                row: rowNum,
                field: 'رقم الإقامة',
                message: `رقم الإقامة مكرر في الصف ${duplicateIndices[0] + 2}. سيتم استيراد الصف الأول فقط.`,
                severity: 'error'
              })
            } else if (existingResidenceNumbers.has(residenceNumber)) {
              // Check if already exists in database - this is a warning, not an error
              // The import will proceed and update the existing employee
              errors.push({
                row: rowNum,
                field: 'رقم الإقامة',
                message: 'رقم الإقامة موجود بالفعل في النظام. سيتم تحديث بيانات الموظف الحالي.',
                severity: 'warning'
              })
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
              const result = parseDate(row[field])
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
    if (!file) {
      toast.error('يرجى اختيار ملف أولاً')
      return
    }
    
    // التحقق من الأخطاء في الصفوف المحددة فقط
    let errorsInSelectedRows = 0
    if (selectedRows.size > 0) {
      selectedRows.forEach(rowIndex => {
        const excelRowNumber = rowIndex + 2
        const rowErrors = validationResults.filter(
          e => e.row === excelRowNumber && e.severity === 'error'
        )
        errorsInSelectedRows += rowErrors.length
      })
    } else {
      // إذا لم تكن هناك صفوف محددة، تحقق من جميع الأخطاء
      errorsInSelectedRows = validationResults.filter(e => e.severity === 'error').length
    }
    
    if (errorsInSelectedRows > 0 && selectedRows.size > 0) {
      toast.warning(`يوجد ${errorsInSelectedRows} خطأ في الصفوف المحددة. سيتم استيراد الصفوف التي لا تحتوي على أخطاء فقط.`)
    } else if (errorsInSelectedRows > 0) {
      toast.error('يرجى إصلاح الأخطاء أولاً أو إلغاء تحديد الصفوف التي تحتوي على أخطاء')
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

    // بدء عملية الاستيراد
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
    const cleanProjectName = (name: string | null | undefined): string | null => {
      if (!name) return null
      return name.trim().replace(/\s+/g, ' ')
    }

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      let jsonData = XLSX.utils.sheet_to_json(worksheet)

      // تصفية البيانات حسب الصفوف المحددة واستبعاد الصفوف التي تحتوي على أخطاء
      if (selectedRows.size > 0) {
        jsonData = jsonData.filter((_, index) => {
          // التحقق من أن الصف محدد
          if (!selectedRows.has(index)) return false
          
          // التحقق من أن الصف لا يحتوي على أخطاء
          const excelRowNumber = index + 2 // Excel row number (1 is header, +1 for index)
          const rowErrors = validationResults.filter(
            e => e.row === excelRowNumber && e.severity === 'error'
          )
          
          // استبعاد الصفوف التي تحتوي على أخطاء
          return rowErrors.length === 0
        })
      } else {
        // إذا لم تكن هناك صفوف محددة، استبعد الصفوف التي تحتوي على أخطاء
        jsonData = jsonData.filter((_, index) => {
          const excelRowNumber = index + 2
          const rowErrors = validationResults.filter(
            e => e.row === excelRowNumber && e.severity === 'error'
          )
          return rowErrors.length === 0
        })
      }

      let duplicatesRemoved = 0
      let uniqueJsonData = jsonData
      
      if (importType === 'employees') {
        // Filter duplicates within the sheet based on residence_number (keep first occurrence only)
        const seenResidenceNumbers = new Set<string>()
        uniqueJsonData = (jsonData as any[]).filter((row, index) => {
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
          console.log(`تم إزالة ${duplicatesRemoved} صف مكرر بناءً على رقم الإقامة`)
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
        const companyMapByName = new Map<string, string[]>() // name -> array of ids (for duplicates)
        const companyMapByUnifiedNumber = new Map<number, string>() // unified_number -> id
        const projectMapByName = new Map<string, string>() // name -> id (projects should be unique by name)
        const newProjectsCreated = new Map<string, string>() // Track newly created projects to avoid duplicates
        
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
        for (const row of uniqueJsonData as any[]) {
          // التحقق من حالة الإلغاء
          if (cancelImportRef.current) {
            console.log('تم إلغاء الاستيراد من قبل المستخدم')
            break
          }
          
          currentIndex++
          setImportProgress({ current: currentIndex, total: totalItems })
          
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

            // Handle project matching and creation
            let projectId: string | null = null
            const projectNameRaw = row['المشروع'] || row['اسم المشروع'] || null
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
            if (currentIndex <= 3) { // طباعة أول 3 موظفين فقط للتحقق
              console.log(`📋 Employee ${currentIndex} dates (raw from Excel):`, {
                'تاريخ الميلاد': birthDateRaw,
                'تاريخ الالتحاق': joiningDateRaw,
                'تاريخ انتهاء الإقامة': residenceExpiryRaw,
                'تاريخ انتهاء العقد': contractExpiryRaw,
                'تاريخ انتهاء عقد أجير': hiredWorkerContractExpiryRaw,
                'تاريخ انتهاء التأمين الصحي': healthInsuranceExpiryRaw
              })
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
              project_id: projectId,
              company_id: companyId,
              // التأكد من أن كل حقل تاريخ يُستورد في مكانه الصحيح
              birth_date: normalizeDate(birthDateRaw), // تاريخ الميلاد → birth_date
              joining_date: normalizeDate(joiningDateRaw), // تاريخ الالتحاق → joining_date
              residence_expiry: normalizeDate(residenceExpiryRaw), // تاريخ انتهاء الإقامة → residence_expiry
              contract_expiry: normalizeDate(contractExpiryRaw), // تاريخ انتهاء العقد → contract_expiry
              hired_worker_contract_expiry: normalizeDate(hiredWorkerContractExpiryRaw), // تاريخ انتهاء عقد أجير → hired_worker_contract_expiry
              health_insurance_expiry: normalizeDate(healthInsuranceExpiryRaw), // تاريخ انتهاء التأمين الصحي → health_insurance_expiry
              residence_image_url: row['رابط صورة الإقامة'] || null,
              notes: row['الملاحظات'] || null
            }
            
            // Debug: طباعة القيم بعد normalizeDate للتأكد
            if (currentIndex <= 3) {
              console.log(`✅ Employee ${currentIndex} dates (normalized for DB):`, {
                'birth_date': employeeData.birth_date,
                'joining_date': employeeData.joining_date,
                'residence_expiry': employeeData.residence_expiry,
                'contract_expiry': employeeData.contract_expiry,
                'hired_worker_contract_expiry': employeeData.hired_worker_contract_expiry,
                'health_insurance_expiry': employeeData.health_insurance_expiry
              })
            }

            // دعم التوافق مع الأسماء القديمة والجديدة للتأمين الصحي
            if (!employeeData.health_insurance_expiry && (row['انتهاء التأمين الصحي'] || row['انتهاء اشتراك التأمين'])) {
              const healthInsuranceExpiry = row['انتهاء التأمين الصحي'] || row['انتهاء اشتراك التأمين']
              employeeData.health_insurance_expiry = normalizeDate(healthInsuranceExpiry)
            }

            // Check if residence number already exists - update instead of insert
            const residenceNumberStr = employeeData.residence_number?.toString().trim()
            let operationResult
            
            if (residenceNumberStr && existingEmployeesByResidenceNumber.has(residenceNumberStr)) {
              // Update existing employee
              const existingEmployeeId = existingEmployeesByResidenceNumber.get(residenceNumberStr)!
              const { error: updateError } = await supabase
                .from('employees')
                .update(employeeData)
                .eq('id', existingEmployeeId)
              
              if (updateError) {
                throw updateError
              }
              operationResult = 'updated'
            } else {
              // Insert new employee
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
                      const { error: updateError } = await supabase
                        .from('employees')
                        .update(employeeData)
                        .eq('id', existingEmp.id)
                      
                      if (updateError) throw updateError
                      operationResult = 'updated'
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
                operationResult = 'inserted'
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
          .select('id, unified_number, social_insurance_number, labor_subscription_number')
        
        // Create maps for lookup by unique identifiers
        const companiesByUnifiedNumber = new Map<number, string>() // unified_number -> company_id
        const companiesBySocialInsurance = new Map<string, string>() // social_insurance_number -> company_id
        const companiesByLaborSubscription = new Map<string, string>() // labor_subscription_number -> company_id
        
        existingCompanies?.forEach(company => {
          if (company.unified_number) {
            companiesByUnifiedNumber.set(Number(company.unified_number), company.id)
          }
          if (company.social_insurance_number) {
            companiesBySocialInsurance.set(company.social_insurance_number.toString().trim(), company.id)
          }
          if (company.labor_subscription_number) {
            companiesByLaborSubscription.set(company.labor_subscription_number.toString().trim(), company.id)
          }
        })
        
        let currentIndex = 0
        for (const row of jsonData as any[]) {
          // التحقق من حالة الإلغاء
          if (cancelImportRef.current) {
            console.log('تم إلغاء الاستيراد من قبل المستخدم')
            break
          }
          
          currentIndex++
          setImportProgress({ current: currentIndex, total: totalItems })
          
          try {
            const companyData: any = {
              name: row['اسم المؤسسة'],
              unified_number: row['الرقم الموحد'] ? Number(row['الرقم الموحد']) : null,
              social_insurance_number: row['رقم اشتراك التأمينات الاجتماعية'] || null,
              labor_subscription_number: row['رقم اشتراك قوى'] || null,
              commercial_registration_expiry: normalizeDate(row['تاريخ انتهاء السجل التجاري']),
              social_insurance_expiry: normalizeDate(row['تاريخ انتهاء التأمينات الاجتماعية'] || row['تاريخ انتهاء اشتراك التأمين']),
              ending_subscription_power_date: normalizeDate(row['تاريخ انتهاء اشتراك قوى']),
              ending_subscription_moqeem_date: normalizeDate(row['تاريخ انتهاء اشتراك مقيم']),
              exemptions: row['الاعفاءات'] || null,
              company_type: row['نوع المؤسسة'] || null,
              notes: row['الملاحظات'] || null,
              max_employees: 4 // القيمة الافتراضية
            }

            // Check for existing company by unique identifiers
            let existingCompanyId: string | null = null
            
            // Priority 1: Check by unified_number
            if (companyData.unified_number) {
              existingCompanyId = companiesByUnifiedNumber.get(companyData.unified_number) || null
            }
            
            // Priority 2: Check by social_insurance_number if not found
            if (!existingCompanyId && companyData.social_insurance_number) {
              const socialInsuranceStr = companyData.social_insurance_number.toString().trim()
              existingCompanyId = companiesBySocialInsurance.get(socialInsuranceStr) || null
            }
            
            // Priority 3: Check by labor_subscription_number if not found
            if (!existingCompanyId && companyData.labor_subscription_number) {
              const laborSubscriptionStr = companyData.labor_subscription_number.toString().trim()
              existingCompanyId = companiesByLaborSubscription.get(laborSubscriptionStr) || null
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
                // Check if error is due to duplicate unique identifier (race condition)
                if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
                  // Try to find and update
                  let foundCompanyId: string | null = null
                  
                  if (companyData.unified_number) {
                    const { data: foundCompany } = await supabase
                      .from('companies')
                      .select('id')
                      .eq('unified_number', companyData.unified_number)
                      .single()
                    if (foundCompany) foundCompanyId = foundCompany.id
                  }
                  
                  if (!foundCompanyId && companyData.social_insurance_number) {
                    const { data: foundCompany } = await supabase
                      .from('companies')
                      .select('id')
                      .eq('social_insurance_number', companyData.social_insurance_number)
                      .single()
                    if (foundCompany) foundCompanyId = foundCompany.id
                  }
                  
                  if (!foundCompanyId && companyData.labor_subscription_number) {
                    const { data: foundCompany } = await supabase
                      .from('companies')
                      .select('id')
                      .eq('labor_subscription_number', companyData.labor_subscription_number)
                      .single()
                    if (foundCompany) foundCompanyId = foundCompany.id
                  }
                  
                  if (foundCompanyId) {
                    const { error: updateError } = await supabase
                      .from('companies')
                      .update(companyData)
                      .eq('id', foundCompanyId)
                    
                    if (updateError) throw updateError
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
                    .select('id, unified_number, social_insurance_number, labor_subscription_number')
                    .eq('unified_number', companyData.unified_number)
                    .single()
                  
                  if (newCompany) {
                    companiesByUnifiedNumber.set(Number(newCompany.unified_number), newCompany.id)
                    if (newCompany.social_insurance_number) {
                      companiesBySocialInsurance.set(newCompany.social_insurance_number.toString().trim(), newCompany.id)
                    }
                    if (newCompany.labor_subscription_number) {
                      companiesByLaborSubscription.set(newCompany.labor_subscription_number.toString().trim(), newCompany.id)
                    }
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
                } else if (companyData.social_insurance_number) {
                  const { data: newCompany } = await supabase
                    .from('companies')
                    .select('id, unified_number, social_insurance_number, labor_subscription_number')
                    .eq('social_insurance_number', companyData.social_insurance_number)
                    .single()
                  
                  if (newCompany) {
                    companiesBySocialInsurance.set(companyData.social_insurance_number.toString().trim(), newCompany.id)
                    if (newCompany.unified_number) {
                      companiesByUnifiedNumber.set(Number(newCompany.unified_number), newCompany.id)
                    }
                    if (newCompany.labor_subscription_number) {
                      companiesByLaborSubscription.set(newCompany.labor_subscription_number.toString().trim(), newCompany.id)
                    }
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
                } else if (companyData.labor_subscription_number) {
                  const { data: newCompany } = await supabase
                    .from('companies')
                    .select('id, unified_number, social_insurance_number, labor_subscription_number')
                    .eq('labor_subscription_number', companyData.labor_subscription_number)
                    .single()
                  
                  if (newCompany) {
                    companiesByLaborSubscription.set(companyData.labor_subscription_number.toString().trim(), newCompany.id)
                    if (newCompany.unified_number) {
                      companiesByUnifiedNumber.set(Number(newCompany.unified_number), newCompany.id)
                    }
                    if (newCompany.social_insurance_number) {
                      companiesBySocialInsurance.set(newCompany.social_insurance_number.toString().trim(), newCompany.id)
                    }
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
          console.log(`تم حذف ${idsToDelete.employees.length} موظف تم إضافتهم`)
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
          console.log(`تم حذف ${idsToDelete.companies.length} شركة تم إضافتها`)
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

  // حساب الأخطاء في جميع الصفوف
  const totalErrorCount = validationResults.filter(e => e.severity === 'error').length
  const warningCount = validationResults.filter(e => e.severity === 'warning').length
  
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
  
  const selectedRowsErrorCount = getSelectedRowsErrors()
  // إذا كانت هناك صفوف محددة، استخدم أخطاء الصفوف المحددة، وإلا استخدم جميع الأخطاء
  const errorCount = selectedRows.size > 0 ? selectedRowsErrorCount : totalErrorCount

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
          </div>
          <div className="px-5 py-4 bg-white">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                <span className="text-base">💡</span>
                <span>
                  <strong className="font-semibold">نصيحة:</strong> يمكنك التمرير على أي خلية ملونة لعرض تفاصيل الخطأ أو التحذير. 
                  جميع الأخطاء يجب إصلاحها قبل إمكانية الاستيراد.
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
                          
                          // تحديد ما إذا كان العمود يحتاج إلى truncate (جميع الأعمدة الآن)
                          const needsTruncate = true // جميع الأعمدة تحتاج truncate
                          const isUrlColumn = key === 'رابط صورة الإقامة'
                          
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
                              console.log(`🔍 Parsing date in preview for row ${actualRowIndex + 1}, field "${key}":`, {
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
                              console.log(`✅ Parse result for "${key}":`, {
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
                                console.log(`📅 Display value for "${key}":`, displayValue)
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
                          
                          const isUrl = isUrlColumn && displayValue && !isEmpty && (
                            displayValue.startsWith('http://') || 
                            displayValue.startsWith('https://') ||
                            displayValue.startsWith('www.')
                          )

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
            disabled={importing || errorCount > 0}
            className={`flex items-center gap-3 px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed ${
              errorCount === 0
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                : 'bg-gray-400 text-white cursor-not-allowed opacity-50'
            }`}
          >
            <FileUp className="w-7 h-7" />
            {importing ? (
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

      {/* Preview Modal */}
      {showPreviewModal && previewData.length > 0 && !columnValidationError && (() => {
        const totalPages = Math.ceil(previewData.length / rowsPerPage)
        const startIndex = (currentPage - 1) * rowsPerPage
        const endIndex = startIndex + rowsPerPage
        const paginatedData = previewData.slice(startIndex, endIndex)
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
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                    </div>
                    <div className="px-5 py-4 bg-white">
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <p className="text-xs text-gray-700 leading-relaxed flex items-start gap-2">
                          <span className="text-base">💡</span>
                          <span>
                            <strong className="font-semibold">نصيحة:</strong> يمكنك التمرير على أي خلية ملونة لعرض تفاصيل الخطأ أو التحذير. 
                            جميع الأخطاء يجب إصلاحها قبل إمكانية الاستيراد.
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
                    </div>
                    <div className="text-sm text-gray-700 font-medium bg-white px-3 py-1 rounded-lg border border-gray-200">
                      الصفحة {currentPage} من {totalPages}
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
                                
                                // تحديد ما إذا كان الحقل حقل تاريخ
                                const isDateField = key.includes('تاريخ')
                                const isUrlColumn = key === 'رابط صورة الإقامة'
                                
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
                                
                                const isUrl = isUrlColumn && displayValue && !isEmpty && (
                                  displayValue.startsWith('http://') || 
                                  displayValue.startsWith('https://') ||
                                  displayValue.startsWith('www.')
                                )

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

                {/* Import Button */}
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
                    disabled={importing || errorCount > 0}
                    className={`flex items-center gap-3 px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed ${
                      errorCount === 0
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                        : 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                    }`}
                  >
                    <FileUp className="w-7 h-7" />
                    {importing ? (
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
