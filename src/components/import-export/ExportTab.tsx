// @ts-nocheck
import { useState, useEffect } from 'react'
import { supabase, Employee, Company } from '../../lib/supabase'
import { FileDown, CheckSquare, Square, Filter } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export default function ExportTab() {
  const [employees, setEmployees] = useState<(Employee & { company: Company })[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set())
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCompany, setFilterCompany] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [employeesRes, companiesRes] = await Promise.all([
        supabase.from('employees').select('*, company:companies(*)').order('name'),
        supabase.from('companies').select('*').order('name')
      ])

      if (employeesRes.error) throw employeesRes.error
      if (companiesRes.error) throw companiesRes.error

      setEmployees(employeesRes.data || [])
      setCompanies(companiesRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('فشل تحميل البيانات')
    }
  }

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.profession.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCompany = filterCompany === 'all' || emp.company_id?.toString() === filterCompany
    return matchesSearch && matchesCompany
  })

  const toggleEmployeeSelection = (id: number) => {
    const newSet = new Set(selectedEmployees)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedEmployees(newSet)
  }

  const toggleAllEmployees = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set())
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map(e => e.id)))
    }
  }

  const toggleCompanySelection = (id: number) => {
    const newSet = new Set(selectedCompanies)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedCompanies(newSet)
  }

  const toggleAllCompanies = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set())
    } else {
      setSelectedCompanies(new Set(companies.map(c => c.id)))
    }
  }

  const exportEmployees = () => {
    if (selectedEmployees.size === 0) {
      toast.error('الرجاء اختيار موظف واحد على الأقل')
      return
    }

    setLoading(true)
    try {
      const selectedData = employees.filter(e => selectedEmployees.has(e.id))
      
      // Prepare data for Excel
      const excelData = selectedData.map(emp => ({
        'الاسم': emp.name,
        'المهنة': emp.profession,
        'الجنسية': emp.nationality,
        'تاريخ الميلاد': emp.birth_date,
        'الجوال': emp.mobile,
        'الجواز': emp.passport,
        'رقم الإقامة': emp.residence_number,
        'تاريخ الالتحاق': emp.joining_date,
        'انتهاء العقد': emp.contract_expiry || '',
        'انتهاء الإقامة': emp.residence_expiry,
        'المشروع': emp.project || '',
        'الحساب البنكي': emp.bank_account || '',
        'رقم التأميني': emp.insurance_number || '',
        'المؤسسة': emp.company?.name || '',
        'حقول إضافية': emp.additional_fields ? JSON.stringify(emp.additional_fields) : ''
      }))

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'الموظفين')

      // Set column widths
      const wscols = [
        { wch: 20 }, // الاسم
        { wch: 20 }, // المهنة
        { wch: 15 }, // الجنسية
        { wch: 15 }, // تاريخ الميلاد
        { wch: 15 }, // الجوال
        { wch: 15 }, // الجواز
        { wch: 15 }, // رقم الإقامة
        { wch: 15 }, // تاريخ الالتحاق
        { wch: 15 }, // انتهاء العقد
        { wch: 15 }, // انتهاء الإقامة
        { wch: 20 }, // المشروع
        { wch: 20 }, // الحساب البنكي
        { wch: 15 }, // رقم التأميني
        { wch: 25 }, // المؤسسة
        { wch: 30 }  // حقول إضافية
      ]
      ws['!cols'] = wscols

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(data, `employees_export_${new Date().toISOString().split('T')[0]}.xlsx`)

      toast.success(`تم تصدير ${selectedEmployees.size} موظف بنجاح`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('فشل تصدير البيانات')
    } finally {
      setLoading(false)
    }
  }

  const exportCompanies = () => {
    if (selectedCompanies.size === 0) {
      toast.error('الرجاء اختيار مؤسسة واحدة على الأقل')
      return
    }

    setLoading(true)
    try {
      const selectedData = companies.filter(c => selectedCompanies.has(c.id))
      
      const excelData = selectedData.map(company => ({
        'اسم المؤسسة': company.name,
        'الرقم التأميني': company.insurance_number || '',
        'الرقم الموحد': company.unified_number || '',
        'رقم اشتراك قوى': company.qiwa_subscription || '',
        'حد الموظفين': company.employee_limit || 0,
        'حقول إضافية': company.additional_fields ? JSON.stringify(company.additional_fields) : ''
      }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'المؤسسات')

      const wscols = [
        { wch: 30 }, // اسم المؤسسة
        { wch: 20 }, // الرقم التأميني
        { wch: 20 }, // الرقم الموحد
        { wch: 20 }, // رقم اشتراك قوى
        { wch: 15 }, // حد الموظفين
        { wch: 30 }  // حقول إضافية
      ]
      ws['!cols'] = wscols

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(data, `companies_export_${new Date().toISOString().split('T')[0]}.xlsx`)

      toast.success(`تم تصدير ${selectedCompanies.size} مؤسسة بنجاح`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('فشل تصدير البيانات')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Export Employees Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">تصدير الموظفين</h3>
          <button
            onClick={exportEmployees}
            disabled={loading || selectedEmployees.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <FileDown className="w-5 h-5" />
            تصدير المحدد ({selectedEmployees.size})
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="بحث بالاسم أو المهنة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-64">
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع المؤسسات</option>
              {companies.map(company => (
                <option key={company.id} value={company.id.toString()}>{company.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Employees List */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
            <button
              onClick={toggleAllEmployees}
              className="text-blue-600 hover:text-blue-700"
            >
              {selectedEmployees.size === filteredEmployees.length ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="font-medium text-gray-700">
              تحديد الكل ({filteredEmployees.length} موظف)
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredEmployees.map(employee => (
              <div
                key={employee.id}
                className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                onClick={() => toggleEmployeeSelection(employee.id)}
              >
                {selectedEmployees.has(employee.id) ? (
                  <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{employee.name}</div>
                  <div className="text-sm text-gray-600">
                    {employee.profession} | {employee.nationality} | {employee.company?.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Companies Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">تصدير المؤسسات</h3>
          <button
            onClick={exportCompanies}
            disabled={loading || selectedCompanies.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <FileDown className="w-5 h-5" />
            تصدير المحدد ({selectedCompanies.size})
          </button>
        </div>

        {/* Companies List */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
            <button
              onClick={toggleAllCompanies}
              className="text-green-600 hover:text-green-700"
            >
              {selectedCompanies.size === companies.length ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="font-medium text-gray-700">
              تحديد الكل ({companies.length} مؤسسة)
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {companies.map(company => (
              <div
                key={company.id}
                className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                onClick={() => toggleCompanySelection(company.id)}
              >
                {selectedCompanies.has(company.id) ? (
                  <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{company.name}</div>
                  <div className="text-sm text-gray-600">
                    {company.insurance_number && `تأميني: ${company.insurance_number}`}
                    {company.employee_limit && ` | الحد: ${company.employee_limit} موظف`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
