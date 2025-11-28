import { useState, useEffect, useMemo } from 'react'
import { supabase, Employee, Company } from '@/lib/supabase'
import { FileDown, CheckSquare, Square, Filter, X, Calendar, Shield, FileText, Building2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { differenceInDays } from 'date-fns'

interface CompanyWithStats extends Company {
  employee_count?: number
  available_slots?: number
}

export default function ExportTab() {
  const [exportType, setExportType] = useState<'employees' | 'companies'>('employees')
  const [employees, setEmployees] = useState<(Employee & { company: Company })[]>([])
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showFiltersSidebar, setShowFiltersSidebar] = useState(true)
  
  // Multi-select for companies (replaces filterCompany)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set())
  
  // Employee filters
  const [employeeFilters, setEmployeeFilters] = useState({
    expiredResidence: false,
    expiringResidence30: false,
    expiredHealthInsurance: false,
    expiringHealthInsurance30: false,
    expiredHiredContract: false,
    expiringHiredContract30: false,
    expiredContract: false,
    expiringContract30: false
  })
  
  // Company filters
  const [companyFilters, setCompanyFilters] = useState({
    completed: false,
    vacant1: false,
    vacant2: false,
    vacant3: false,
    vacant4: false,
    expiredCommercialReg: false,
    expiringCommercialReg30: false,
    expiredPowerSub: false,
    expiringPowerSub30: false,
    expiredMoqeemSub: false,
    expiringMoqeemSub30: false,
    expiredSocialInsurance: false,
    expiringSocialInsurance30: false
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [employeesRes, companiesRes] = await Promise.all([
        supabase.from('employees').select('*, company:companies(id, name, unified_number)').order('name'),
        supabase.from('companies').select('*').order('name')
      ])

      if (employeesRes.error) throw employeesRes.error
      if (companiesRes.error) throw companiesRes.error

      setEmployees(employeesRes.data || [])
      
      // [OPTIMIZATION] حساب عدد الموظفين لكل الشركات باستعلام واحد بدلاً من عدة استعلامات
      // استخدام البيانات المحملة بالفعل من employeesRes
      const employeeCounts: Record<string, number> = {}
      employeesRes.data?.forEach(emp => {
        if (emp.company_id) {
          employeeCounts[emp.company_id] = (employeeCounts[emp.company_id] || 0) + 1
        }
      })

      // دمج البيانات
      const companiesWithStats = (companiesRes.data || []).map((company) => {
        const employeeCount = employeeCounts[company.id] || 0
        const maxEmployees = company.max_employees || 4
        const availableSlots = Math.max(0, maxEmployees - employeeCount)
        
        return { 
          ...company, 
          employee_count: employeeCount, 
          available_slots: availableSlots 
        } as CompanyWithStats
      })
      
      setCompanies(companiesWithStats)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  // Helper functions for date checks
  const isExpired = (date: string | null | undefined): boolean => {
    if (!date) return false
    const daysRemaining = differenceInDays(new Date(date), new Date())
    return daysRemaining < 0
  }

  const isExpiringWithin30Days = (date: string | null | undefined): boolean => {
    if (!date) return false
    const daysRemaining = differenceInDays(new Date(date), new Date())
    return daysRemaining >= 0 && daysRemaining <= 30
  }

  const calculateAvailableSlots = (company: CompanyWithStats): number => {
    const employeeCount = company.employee_count || 0
    const maxEmployees = company.max_employees || 4
    return Math.max(0, maxEmployees - employeeCount)
  }

  // Filter employees based on search, company selection, and filter options
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Search filter
      const matchesSearch = !searchQuery || 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.profession.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Company filter - if no companies selected, show all; otherwise only selected companies
      const matchesCompany = selectedCompanyIds.size === 0 || 
        selectedCompanyIds.has(emp.company_id?.toString() || '')
      
      if (!matchesSearch || !matchesCompany) return false
      
      // Apply employee filters (all must match if enabled)
      if (employeeFilters.expiredResidence && !isExpired(emp.residence_expiry)) return false
      if (employeeFilters.expiringResidence30 && !isExpiringWithin30Days(emp.residence_expiry)) return false
      if (employeeFilters.expiredHealthInsurance && !isExpired(emp.health_insurance_expiry)) return false
      if (employeeFilters.expiringHealthInsurance30 && !isExpiringWithin30Days(emp.health_insurance_expiry)) return false
      if (employeeFilters.expiredHiredContract && !isExpired(emp.hired_worker_contract_expiry)) return false
      if (employeeFilters.expiringHiredContract30 && !isExpiringWithin30Days(emp.hired_worker_contract_expiry)) return false
      if (employeeFilters.expiredContract && !isExpired(emp.contract_expiry)) return false
      if (employeeFilters.expiringContract30 && !isExpiringWithin30Days(emp.contract_expiry)) return false
      
      return true
    })
  }, [employees, searchQuery, selectedCompanyIds, employeeFilters])

  // Filter companies based on filter options
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Apply company filters (all must match if enabled)
      if (companyFilters.completed) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 0) return false
      }
      if (companyFilters.vacant1) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 1) return false
      }
      if (companyFilters.vacant2) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 2) return false
      }
      if (companyFilters.vacant3) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 3) return false
      }
      if (companyFilters.vacant4) {
        const availableSlots = calculateAvailableSlots(company)
        if (availableSlots !== 4) return false
      }
      if (companyFilters.expiredCommercialReg && !isExpired(company.commercial_registration_expiry)) return false
      if (companyFilters.expiringCommercialReg30 && !isExpiringWithin30Days(company.commercial_registration_expiry)) return false
      if (companyFilters.expiredPowerSub && !isExpired(company.ending_subscription_power_date)) return false
      if (companyFilters.expiringPowerSub30 && !isExpiringWithin30Days(company.ending_subscription_power_date)) return false
      if (companyFilters.expiredMoqeemSub && !isExpired(company.ending_subscription_moqeem_date)) return false
      if (companyFilters.expiringMoqeemSub30 && !isExpiringWithin30Days(company.ending_subscription_moqeem_date)) return false
      if (companyFilters.expiredSocialInsurance && !isExpired(company.social_insurance_expiry)) return false
      if (companyFilters.expiringSocialInsurance30 && !isExpiringWithin30Days(company.social_insurance_expiry)) return false
      
      return true
    })
  }, [companies, companyFilters])

  const toggleEmployeeSelection = (id: string) => {
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

  // Toggle company selection for employee filter
  const toggleCompanySelectionForEmployees = (id: string) => {
    const newSet = new Set(selectedCompanyIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedCompanyIds(newSet)
  }

  const toggleAllCompaniesForEmployees = () => {
    if (selectedCompanyIds.size === companies.length) {
      setSelectedCompanyIds(new Set())
    } else {
      setSelectedCompanyIds(new Set(companies.map(c => c.id)))
    }
  }

  // Toggle company selection for export
  const toggleCompanySelection = (id: string) => {
    const newSet = new Set(selectedCompanies)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedCompanies(newSet)
  }

  const toggleAllCompanies = () => {
    if (selectedCompanies.size === filteredCompanies.length) {
      setSelectedCompanies(new Set())
    } else {
      setSelectedCompanies(new Set(filteredCompanies.map(c => c.id)))
    }
  }

  // Toggle employee filter options
  const toggleEmployeeFilter = (filterKey: keyof typeof employeeFilters) => {
    setEmployeeFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }))
  }

  // Toggle company filter options
  const toggleCompanyFilter = (filterKey: keyof typeof companyFilters) => {
    setCompanyFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }))
  }

  // Calculate active filters count
  const getActiveEmployeeFiltersCount = useMemo(() => {
    let count = 0
    Object.values(employeeFilters).forEach(val => { if (val) count++ })
    if (selectedCompanyIds.size > 0) count++
    return count
  }, [employeeFilters, selectedCompanyIds])

  const getActiveCompanyFiltersCount = useMemo(() => {
    let count = 0
    Object.values(companyFilters).forEach(val => { if (val) count++ })
    return count
  }, [companyFilters])

  // Reset all filters
  const resetEmployeeFilters = () => {
    setEmployeeFilters({
      expiredResidence: false,
      expiringResidence30: false,
      expiredHealthInsurance: false,
      expiringHealthInsurance30: false,
      expiredHiredContract: false,
      expiringHiredContract30: false,
      expiredContract: false,
      expiringContract30: false
    })
    setSelectedCompanyIds(new Set())
    setSearchQuery('')
    toast.success('تم إعادة تعيين جميع الفلاتر')
  }

  const resetCompanyFilters = () => {
    setCompanyFilters({
      completed: false,
      vacant1: false,
      vacant2: false,
      vacant3: false,
      vacant4: false,
      expiredCommercialReg: false,
      expiringCommercialReg30: false,
      expiredPowerSub: false,
      expiringPowerSub30: false,
      expiredMoqeemSub: false,
      expiringMoqeemSub30: false,
      expiredSocialInsurance: false,
      expiringSocialInsurance30: false
    })
    setSearchQuery('')
    toast.success('تم إعادة تعيين جميع الفلاتر')
  }

  const exportEmployees = () => {
    if (selectedEmployees.size === 0) {
      toast.error('الرجاء اختيار موظف واحد على الأقل')
      return
    }

    setLoading(true)
    try {
      // Export only selected employees from filtered list
      const selectedData = filteredEmployees.filter(e => selectedEmployees.has(e.id))
      
      // Prepare data for Excel
      const excelData = selectedData.map(emp => ({
        'الاسم': emp.name,
        'المهنة': emp.profession || '',
        'الجنسية': emp.nationality || '',
        'رقم الإقامة': emp.residence_number,
        'رقم الجواز': emp.passport_number || '',
        'رقم الهاتف': emp.phone || '',
        'الحساب البنكي': emp.bank_account || '',
        'الراتب': emp.salary || '',
        'المشروع': emp.project_name || '',
        'الشركة أو المؤسسة': emp.company?.name || '',
        'الرقم الموحد': emp.company?.unified_number || '',
        'تاريخ الميلاد': emp.birth_date || '',
        'تاريخ الالتحاق': emp.joining_date || '',
        'تاريخ انتهاء الإقامة': emp.residence_expiry || '',
        'تاريخ انتهاء العقد': emp.contract_expiry || '',
        'تاريخ انتهاء عقد أجير': emp.hired_worker_contract_expiry || '',
        'تاريخ انتهاء التأمين الصحي': emp.health_insurance_expiry || '',
        'رابط صورة الإقامة': emp.residence_image_url || '',
        'الملاحظات': emp.notes || ''
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
        { wch: 15 }, // رقم الإقامة
        { wch: 15 }, // رقم الجواز
        { wch: 15 }, // رقم الهاتف
        { wch: 25 }, // الحساب البنكي
        { wch: 15 }, // الراتب
        { wch: 20 }, // المشروع
        { wch: 25 }, // الشركة أو المؤسسة
        { wch: 15 }, // الرقم الموحد
        { wch: 15 }, // تاريخ الميلاد
        { wch: 15 }, // تاريخ الالتحاق
        { wch: 15 }, // تاريخ انتهاء الإقامة
        { wch: 15 }, // تاريخ انتهاء العقد
        { wch: 15 }, // تاريخ انتهاء عقد أجير
        { wch: 20 }, // تاريخ انتهاء التأمين الصحي
        { wch: 25 }, // رابط صورة الإقامة
        { wch: 25 }  // الملاحظات
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
      // Export only selected companies from filtered list
      const selectedData = filteredCompanies.filter(c => selectedCompanies.has(c.id))
      
      const excelData = selectedData.map(company => ({
        'اسم المؤسسة': company.name,
        'الرقم الموحد': company.unified_number || '',
        'رقم اشتراك التأمينات الاجتماعية': company.social_insurance_number || '',
        'رقم اشتراك قوى': company.labor_subscription_number || '',
        'تاريخ انتهاء السجل التجاري': company.commercial_registration_expiry || '',
        'تاريخ انتهاء التأمينات الاجتماعية': company.social_insurance_expiry || '',
        'تاريخ انتهاء اشتراك قوى': company.ending_subscription_power_date || '',
        'تاريخ انتهاء اشتراك مقيم': company.ending_subscription_moqeem_date || '',
        'عدد الموظفين': company.employee_count || 0,
        'الحد الأقصى للموظفين': company.max_employees || 0,
        'الاعفاءات': company.exemptions || '',
        'نوع المؤسسة': company.company_type || '',
        'الملاحظات': company.notes || ''
      }))

      const ws = XLSX.utils.json_to_sheet(excelData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'المؤسسات')

      const wscols = [
        { wch: 30 }, // اسم المؤسسة
        { wch: 20 }, // الرقم الموحد
        { wch: 25 }, // رقم اشتراك التأمينات الاجتماعية
        { wch: 20 }, // رقم اشتراك قوى
        { wch: 25 }, // تاريخ انتهاء السجل التجاري
        { wch: 25 }, // تاريخ انتهاء التأمينات الاجتماعية
        { wch: 25 }, // تاريخ انتهاء اشتراك قوى
        { wch: 25 }, // تاريخ انتهاء اشتراك مقيم
        { wch: 15 }, // عدد الموظفين
        { wch: 20 }, // الحد الأقصى للموظفين
        { wch: 20 }, // الاعفاءات
        { wch: 20 }, // نوع المؤسسة
        { wch: 25 }  // الملاحظات
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
      {/* Export Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">نوع البيانات المراد تصديرها</label>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setExportType('employees')
              setSelectedEmployees(new Set())
              setSelectedCompanyIds(new Set())
              setSearchQuery('')
            }}
            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
              exportType === 'employees'
                ? 'border-blue-600 bg-blue-50 text-blue-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            موظفين
          </button>
          <button
            onClick={() => {
              setExportType('companies')
              setSelectedCompanies(new Set())
              setSearchQuery('')
            }}
            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition ${
              exportType === 'companies'
                ? 'border-green-600 bg-green-50 text-green-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            مؤسسات
          </button>
        </div>
      </div>

      {/* Export Employees Section */}
      {exportType === 'employees' && (
      <div className="relative">
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

        {/* Search and Filter Toggle */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="بحث بالاسم أو المهنة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFiltersSidebar(!showFiltersSidebar)}
            className="relative px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Filter className="w-5 h-5" />
            <span>الفلاتر</span>
            {getActiveEmployeeFiltersCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                {getActiveEmployeeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Main Content with Sidebar */}
        <div className="relative flex gap-4">
          {/* Filters Sidebar */}
          <div className={`transition-all duration-300 ease-in-out ${
            showFiltersSidebar ? 'w-96 opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}>
            <div className={`bg-white border border-gray-200 rounded-xl shadow-xl p-6 h-[calc(100vh-300px)] overflow-y-auto sticky top-4 ${showFiltersSidebar ? 'block' : 'hidden'}`}>
              {/* Sidebar Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-blue-600" />
                  <h4 className="text-lg font-bold text-gray-900">خيارات التصفية</h4>
                  {getActiveEmployeeFiltersCount > 0 && (
                    <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-1 rounded-full">
                      {getActiveEmployeeFiltersCount} نشط
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowFiltersSidebar(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Reset Button */}
              {getActiveEmployeeFiltersCount > 0 && (
                <button
                  onClick={resetEmployeeFilters}
                  className="w-full mb-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  إعادة تعيين الفلاتر
                </button>
              )}

              {/* Company Multi-Select */}
              <div className="mb-6">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  اختيار المؤسسات:
                </label>
                <div className="border border-gray-200 rounded-lg bg-gray-50 max-h-48 overflow-y-auto p-3">
                  <div className="mb-2 pb-2 border-b border-gray-200">
                    <button
                      onClick={toggleAllCompaniesForEmployees}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {selectedCompanyIds.size === companies.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>تحديد الكل ({companies.length})</span>
                    </button>
                  </div>
              {companies.map(company => (
                    <div
                      key={company.id}
                      className="flex items-center gap-2 py-2 px-2 hover:bg-white rounded cursor-pointer transition"
                      onClick={() => toggleCompanySelectionForEmployees(company.id)}
                    >
                      {selectedCompanyIds.has(company.id) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-sm text-gray-700">
                        {company.name} - {company.unified_number || 'بدون رقم موحد'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Employee Filter Options */}
              <div className="space-y-6">
                {/* Residence Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    تصفية حسب الإقامة:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={employeeFilters.expiredResidence}
                        onChange={() => toggleEmployeeFilter('expiredResidence')}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">الإقامات المنتهية</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={employeeFilters.expiringResidence30}
                        onChange={() => toggleEmployeeFilter('expiringResidence30')}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">الإقامات التي تنتهي خلال 30 يوم</span>
                    </label>
                  </div>
                </div>

                {/* Health Insurance Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Shield className="w-4 h-4 text-blue-600" />
                    تصفية حسب التأمين الصحي:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={employeeFilters.expiredHealthInsurance}
                        onChange={() => toggleEmployeeFilter('expiredHealthInsurance')}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">التأمين الصحي المنتهي</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={employeeFilters.expiringHealthInsurance30}
                        onChange={() => toggleEmployeeFilter('expiringHealthInsurance30')}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">التأمين الصحي الذي ينتهي خلال 30 يوم</span>
                    </label>
                  </div>
                </div>

                {/* Hired Contract Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <FileText className="w-4 h-4 text-blue-600" />
                    تصفية حسب عقد أجير:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={employeeFilters.expiredHiredContract}
                        onChange={() => toggleEmployeeFilter('expiredHiredContract')}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">عقد أجير المنتهي</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={employeeFilters.expiringHiredContract30}
                        onChange={() => toggleEmployeeFilter('expiringHiredContract30')}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">عقد أجير الذي ينتهي خلال 30 يوم</span>
                    </label>
                  </div>
                </div>

                {/* Contract Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <FileText className="w-4 h-4 text-blue-600" />
                    تصفية حسب العقد:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={employeeFilters.expiredContract}
                        onChange={() => toggleEmployeeFilter('expiredContract')}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">عقد منتهى</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={employeeFilters.expiringContract30}
                        onChange={() => toggleEmployeeFilter('expiringContract30')}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">عقد ينتهى خلال 30 يوم</span>
                    </label>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {/* Employees List */}
          <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
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
      </div>
      )}

      {/* Export Companies Section */}
      {exportType === 'companies' && (
      <div className="relative">
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

        {/* Search and Filter Toggle */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setShowFiltersSidebar(!showFiltersSidebar)}
            className="relative px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Filter className="w-5 h-5" />
            <span>الفلاتر</span>
            {getActiveCompanyFiltersCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                {getActiveCompanyFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Main Content with Sidebar */}
        <div className="relative flex gap-4">
          {/* Filters Sidebar */}
          <div className={`transition-all duration-300 ease-in-out ${
            showFiltersSidebar ? 'w-96 opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}>
            <div className={`bg-white border border-gray-200 rounded-xl shadow-xl p-6 h-[calc(100vh-300px)] overflow-y-auto sticky top-4 ${showFiltersSidebar ? 'block' : 'hidden'}`}>
              {/* Sidebar Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-green-600" />
                  <h4 className="text-lg font-bold text-gray-900">خيارات التصفية</h4>
                  {getActiveCompanyFiltersCount > 0 && (
                    <span className="bg-green-100 text-green-600 text-xs font-bold px-2 py-1 rounded-full">
                      {getActiveCompanyFiltersCount} نشط
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowFiltersSidebar(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Reset Button */}
              {getActiveCompanyFiltersCount > 0 && (
                <button
                  onClick={resetCompanyFilters}
                  className="w-full mb-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  إعادة تعيين الفلاتر
                </button>
              )}

              {/* Company Filter Options */}
              <div className="space-y-4">
          
                {/* Vacant Slots Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Building2 className="w-4 h-4 text-green-600" />
                    تصفية حسب الأماكن الشاغرة:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.completed}
                        onChange={() => toggleCompanyFilter('completed')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">المؤسسات المكتملة</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.vacant1}
                        onChange={() => toggleCompanyFilter('vacant1')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">المؤسسات ذات مكان شاغر</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.vacant2}
                        onChange={() => toggleCompanyFilter('vacant2')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">المؤسسات ذات مكانين شاغرين</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.vacant3}
                        onChange={() => toggleCompanyFilter('vacant3')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">المؤسسات ذات 3 أماكن شاغرة</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.vacant4}
                        onChange={() => toggleCompanyFilter('vacant4')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">المؤسسات ذات 4 أماكن شاغرة</span>
                    </label>
                  </div>
                </div>

                {/* Commercial Registration Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <FileText className="w-4 h-4 text-green-600" />
                    تصفية حسب السجل التجاري:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.expiredCommercialReg}
                        onChange={() => toggleCompanyFilter('expiredCommercialReg')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">السجل التجاري المنتهي</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.expiringCommercialReg30}
                        onChange={() => toggleCompanyFilter('expiringCommercialReg30')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">السجل التجاري الذي ينتهي خلال 30 يوم</span>
                    </label>
                  </div>
                </div>

                {/* Power Subscription Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Calendar className="w-4 h-4 text-green-600" />
                    تصفية حسب اشتراك قوى:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.expiredPowerSub}
                        onChange={() => toggleCompanyFilter('expiredPowerSub')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">اشتراك قوى المنتهي</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.expiringPowerSub30}
                        onChange={() => toggleCompanyFilter('expiringPowerSub30')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">اشتراك قوى الذي ينتهي خلال 30 يوم</span>
                    </label>
                  </div>
                </div>

                {/* Moqeem Subscription Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Calendar className="w-4 h-4 text-green-600" />
                    تصفية حسب اشتراك مقيم:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.expiredMoqeemSub}
                        onChange={() => toggleCompanyFilter('expiredMoqeemSub')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">اشتراك مقيم المنتهي</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.expiringMoqeemSub30}
                        onChange={() => toggleCompanyFilter('expiringMoqeemSub30')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">اشتراك مقيم الذي ينتهي خلال 30 يوم</span>
                    </label>
                  </div>
                </div>

                {/* Social Insurance Filters */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Shield className="w-4 h-4 text-green-600" />
                    تصفية حسب التأمينات الاجتماعية:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.expiredSocialInsurance}
                        onChange={() => toggleCompanyFilter('expiredSocialInsurance')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">اشتراك التأمينات الاجتماعية المنتهي</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group hover:bg-white p-2 rounded transition">
                      <input
                        type="checkbox"
                        checked={companyFilters.expiringSocialInsurance30}
                        onChange={() => toggleCompanyFilter('expiringSocialInsurance30')}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">اشتراك التأمينات الاجتماعية الذي ينتهي خلال 30 يوم</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* Companies List */}
          <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
            <button
              onClick={toggleAllCompanies}
              className="text-green-600 hover:text-green-700"
            >
              {selectedCompanies.size === filteredCompanies.length ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="font-medium text-gray-700">
              تحديد الكل ({filteredCompanies.length} مؤسسة)
            </span>
            </div>
            <div className="max-h-96 overflow-y-auto">
            {filteredCompanies.map(company => (
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
                    {company.social_insurance_expiry && `انتهاء التأمينات الاجتماعية: ${company.social_insurance_expiry}`}
                    {company.max_employees && ` | الحد: ${company.max_employees} موظف`}
                    {company.available_slots !== undefined && ` | أماكن شاغرة: ${company.available_slots}`}
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
