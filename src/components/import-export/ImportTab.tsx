import { useState } from 'react'
import { supabase } from '../../lib/supabase'
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

export default function ImportTab() {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationError[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importType, setImportType] = useState<'employees' | 'companies'>('employees')

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
    } else {
      toast.error('يرجى إسقاط ملف Excel فقط (.xlsx, .xls)')
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const validateData = async () => {
    if (!file) return

    setValidating(true)
    const errors: ValidationError[] = []

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      setPreviewData(jsonData.slice(0, 10)) // Preview first 10 rows

      if (importType === 'employees') {
        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2 // Excel row number (1 is header)

          // Required fields validation
          if (!row['الاسم'] || !row['الاسم'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'الاسم',
              message: 'الاسم مطلوب',
              severity: 'error'
            })
          }

          if (!row['المهنة'] || !row['المهنة'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'المهنة',
              message: 'المهنة مطلوبة',
              severity: 'error'
            })
          }

          if (!row['الجنسية'] || !row['الجنسية'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'الجنسية',
              message: 'الجنسية مطلوبة',
              severity: 'error'
            })
          }

          // Mobile validation
          if (row['رقم الجوال']) {
            const mobile = row['رقم الجوال'].toString().replace(/\s/g, '')
            if (!/^[0-9+]{10,15}$/.test(mobile)) {
              errors.push({
                row: rowNum,
                field: 'رقم الجوال',
                message: 'رقم الجوال غير صحيح',
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

          // Passport validation
          if (!row['رقم الجواز'] || !row['رقم الجواز'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'رقم الجواز',
              message: 'رقم الجواز مطلوب',
              severity: 'error'
            })
          }

          // Residence validation
          if (!row['رقم الإقامة'] || !row['رقم الإقامة'].toString().trim()) {
            errors.push({
              row: rowNum,
              field: 'رقم الإقامة',
              message: 'رقم الإقامة مطلوب',
              severity: 'error'
            })
          }

          if (!row['انتهاء الإقامة']) {
            errors.push({
              row: rowNum,
              field: 'انتهاء الإقامة',
              message: 'تاريخ انتهاء الإقامة مطلوب',
              severity: 'error'
            })
          } else {
            const residenceExpiry = new Date(row['انتهاء الإقامة'])
            if (isNaN(residenceExpiry.getTime())) {
              errors.push({
                row: rowNum,
                field: 'انتهاء الإقامة',
                message: 'تاريخ انتهاء الإقامة غير صحيح',
                severity: 'error'
              })
            }
          }

          // Joining date validation
          if (!row['تاريخ الالتحاق']) {
            errors.push({
              row: rowNum,
              field: 'تاريخ الالتحاق',
              message: 'تاريخ الالتحاق مطلوب',
              severity: 'error'
            })
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

          // Validation for numeric fields
          if (row['عدد الموظفين'] && isNaN(Number(row['عدد الموظفين']))) {
            errors.push({
              row: rowNum,
              field: 'عدد الموظفين',
              message: 'عدد الموظفين يجب أن يكون رقماً',
              severity: 'error'
            })
          }
          
          if (row['الحد الأقصى للموظفين'] && isNaN(Number(row['الحد الأقصى للموظفين']))) {
            errors.push({
              row: rowNum,
              field: 'الحد الأقصى للموظفين',
              message: 'الحد الأقصى للموظفين يجب أن يكون رقماً',
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

  const importData = async () => {
    if (!file || validationResults.filter(e => e.severity === 'error').length > 0) {
      toast.error('يرجى إصلاح الأخطاء أولاً')
      return
    }

    setImporting(true)
    let successCount = 0
    let failCount = 0

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (importType === 'employees') {
        // Get companies for lookup
        const { data: companies } = await supabase.from('companies').select('id, name')
        const companyMap = new Map(companies?.map(c => [c.name, c.id]) || [])

        for (const row of jsonData as any[]) {
          try {
            const companyId = row['المؤسسة'] ? companyMap.get(row['المؤسسة']) : null

            const employeeData: any = {
              name: row['الاسم'],
              profession: row['المهنة'],
              nationality: row['الجنسية'],
              birth_date: row['تاريخ الميلاد'] ? new Date(row['تاريخ الميلاد']).toISOString().split('T')[0] : null,
              phone: row['رقم الجوال']?.toString() || null,
              passport_number: row['رقم الجواز'] || null,
              residence_number: row['رقم الإقامة'] || null,
              joining_date: row['تاريخ الالتحاق'] ? new Date(row['تاريخ الالتحاق']).toISOString().split('T')[0] : null,
              contract_expiry: row['انتهاء العقد'] ? new Date(row['انتهاء العقد']).toISOString().split('T')[0] : null,
              residence_expiry: row['انتهاء الإقامة'] ? new Date(row['انتهاء الإقامة']).toISOString().split('T')[0] : null,
              project_name: row['اسم المشروع'] || null,
              bank_account: row['الحساب البنكي'] || null,
              residence_image_url: row['رابط صورة الإقامة'] || null,
              company_id: companyId
            }

            // Handle salary and insurance subscription expiry in additional_fields
            if (row['الراتب']) {
              if (employeeData.additional_fields) {
                employeeData.additional_fields.salary = row['الراتب']
              } else {
                employeeData.additional_fields = { salary: row['الراتب'] }
              }
            }

            if (row['انتهاء اشتراك التأمين']) {
              if (employeeData.additional_fields) {
                employeeData.additional_fields.ending_subscription_insurance_date = row['انتهاء اشتراك التأمين']
              } else {
                employeeData.additional_fields = { ending_subscription_insurance_date: row['انتهاء اشتراك التأمين'] }
              }
            }

            // Handle additional fields
            if (row['حقول إضافية']) {
              try {
                employeeData.additional_fields = JSON.parse(row['حقول إضافية'])
              } catch {
                // Ignore invalid JSON
              }
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
            const companyData: any = {
              name: row['اسم المؤسسة'],
              tax_number: row['الرقم التأميني'] ? Number(row['الرقم التأميني']) : null,
              unified_number: row['الرقم الموحد'] ? Number(row['الرقم الموحد']) : null,
              labor_subscription_number: row['رقم اشتراك قوى'] || null,
              company_type: row['نوع المؤسسة'] || null,
              commercial_registration_expiry: row['تاريخ انتهاء السجل التجاري'] || null,
              insurance_subscription_expiry: row['تاريخ انتهاء اشتراك التأمين'] || null,
              government_docs_renewal: row['تاريخ تجديد الوثائق الحكومية'] || null,
              employee_count: row['عدد الموظفين'] ? Number(row['عدد الموظفين']) : 0,
              max_employees: row['الحد الأقصى للموظفين'] ? Number(row['الحد الأقصى للموظفين']) : 0
            }

            // Handle additional fields
            const additionalFields: any = {}
            
            if (row['تاريخ انتهاء اشتراك قوى']) {
              additionalFields.ending_subscription_power_date = row['تاريخ انتهاء اشتراك قوى']
            }
            
            if (row['حد الموظفين']) {
              additionalFields.employee_limit = Number(row['حد الموظفين'])
            }
            
            if (Object.keys(additionalFields).length > 0) {
              companyData.additional_fields = additionalFields
            }

            if (row['حقول إضافية']) {
              try {
                companyData.additional_fields = JSON.parse(row['حقول إضافية'])
              } catch {
                // Ignore invalid JSON
              }
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
            onClick={() => setImportType('employees')}
            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
              importType === 'employees'
                ? 'border-blue-600 bg-blue-50 text-blue-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            موظفين
          </button>
          <button
            onClick={() => setImportType('companies')}
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

      {/* Validation Results */}
      {validationResults.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h4 className="font-bold text-gray-900">نتائج التحقق</h4>
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
          <div className="max-h-64 overflow-y-auto">
            {validationResults.map((error, index) => (
              <div
                key={index}
                className={`px-4 py-3 border-b border-gray-100 flex items-start gap-3 ${
                  error.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50'
                }`}
              >
                {error.severity === 'error' ? (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    الصف {error.row}: {error.field}
                  </div>
                  <div className="text-sm text-gray-600">{error.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Data */}
      {previewData.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h4 className="font-bold text-gray-900">معاينة البيانات (أول 10 صفوف)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  {Object.keys(previewData[0]).map((key, index) => (
                    <th key={index} className="px-4 py-2 text-right font-medium text-gray-700 whitespace-nowrap">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-gray-100 hover:bg-gray-50">
                    {Object.values(row).map((value: any, colIndex) => (
                      <td key={colIndex} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                        {value?.toString() || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Button */}
      {file && validationResults.length > 0 && errorCount === 0 && (
        <div className="flex justify-center">
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
