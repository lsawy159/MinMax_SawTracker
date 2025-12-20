import { useState, useEffect, useMemo, ReactNode } from 'react'
import { supabase, Employee, Company, Project } from '@/lib/supabase'
import { FileDown, CheckSquare, Square, Calendar, Shield, FileText, Building2, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { differenceInDays } from 'date-fns'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'

interface CompanyWithStats extends Company {
  employee_count?: number
  available_slots?: number
}

export default function ExportTab() {
  const [exportType, setExportType] = useState<'employees' | 'companies'>('employees')
  const [employees, setEmployees] = useState<(Employee & { company: Company; project?: Project })[]>([])
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [companiesFilterQuery, setCompaniesFilterQuery] = useState('')
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [selectedProjectName, setSelectedProjectName] = useState<string>('')
  const [projectFilterQuery, setProjectFilterQuery] = useState<string>('')
  const [expandedFilterGroup, setExpandedFilterGroup] = useState<string | null>(null)
  const [expandedCompanyFilterGroup, setExpandedCompanyFilterGroup] = useState<string | null>(null)
  
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

  // UI chip component
  const Chip = ({
    active,
    onClick,
    children,
    color = 'blue'
  }: {
    active: boolean
    onClick: () => void
    children: ReactNode
    color?: 'blue' | 'green'
  }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] leading-4 font-medium transition border ${
        active
          ? (color === 'blue'
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-green-600 text-white border-green-600 hover:bg-green-700')
          : (color === 'blue'
              ? 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-green-50')
      }`}
    >
      {children}
    </button>
  )

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [employeesRes, companiesRes] = await Promise.all([
        supabase.from('employees').select('*, company:companies(id, name, unified_number), project:projects(id, name)').order('name'),
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

  // Date status helpers for colored indicators
  const getDaysRemaining = (date?: string | null): number | null => {
    if (!date) return null
    return differenceInDays(new Date(date), new Date())
  }

  // Thresholds similar to main Employees page (fallback values)
  const STATUS_THRESHOLDS = {
    urgent: 7,
    high: 15,
    medium: 30
  }

  const getDateTextColor = (days: number | null): string => {
    if (days === null) return 'text-gray-700'
    if (days < 0) return 'text-red-700'
    if (days <= STATUS_THRESHOLDS.urgent) return 'text-red-600'
    if (days <= STATUS_THRESHOLDS.high) return 'text-orange-600'
    if (days <= STATUS_THRESHOLDS.medium) return 'text-amber-600'
    return 'text-gray-700'
  }

  const formatDateStatus = (days: number | null, expiredLabel: string): string => {
    if (days === null) return ''
    if (days < 0) return expiredLabel
    if (days === 0) return 'اليوم'
    return `بعد ${days} يوم`
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
        emp.profession.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(emp.residence_number ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      
      // Company filter - if no companies selected, show all; otherwise only selected companies
      const matchesCompany = selectedCompanyIds.size === 0 || 
        selectedCompanyIds.has(emp.company_id?.toString() || '')
      
      // Project filter
      const matchesProject = !selectedProjectName || ((emp.project?.name || emp.project_name || '').toLowerCase() === selectedProjectName.toLowerCase())

      if (!matchesSearch || !matchesCompany || !matchesProject) return false
      
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
  }, [employees, searchQuery, selectedCompanyIds, selectedProjectName, employeeFilters])

  // Filter companies list inside employee sidebar by query
  const companiesForEmployeeFilter = useMemo(() => {
    if (!companiesFilterQuery) return companies
    const q = companiesFilterQuery.toLowerCase()
    return companies.filter(c =>
      (c.name || '').toLowerCase().includes(q) || String(c.unified_number ?? '').toLowerCase().includes(q)
    )
  }, [companies, companiesFilterQuery])

  // Unique projects for filter
  const projectsForEmployeeFilter = useMemo(() => {
    const all = employees
      .map(e => (e.project?.name || e.project_name || '').trim())
      .filter(Boolean) as string[]
    const unique = Array.from(new Set(all))
    if (!projectFilterQuery) return unique.sort()
    const q = projectFilterQuery.toLowerCase()
    return unique.filter(name => name.toLowerCase().includes(q)).sort()
  }, [employees, projectFilterQuery])

  // Filter companies based on filter options
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Search filter by name or unified number
      const matchesSearch = !companySearchQuery ||
        (company.name || '').toLowerCase().includes(companySearchQuery.toLowerCase()) ||
        String(company.unified_number ?? '').toLowerCase().includes(companySearchQuery.toLowerCase())
      if (!matchesSearch) return false
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
  }, [companies, companyFilters, companySearchQuery])

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

  // Toggle filter groups
  const toggleFilterGroup = (group: string) => {
    setExpandedFilterGroup(expandedFilterGroup === group ? null : group)
  }

  const toggleCompanyFilterGroup = (group: string) => {
    setExpandedCompanyFilterGroup(expandedCompanyFilterGroup === group ? null : group)
  }

  // Calculate active filters count
  const getActiveEmployeeFiltersCount = useMemo(() => {
    let count = 0
    Object.values(employeeFilters).forEach(val => { if (val) count++ })
    if (selectedCompanyIds.size > 0) count++
    if (selectedProjectName) count++
    return count
  }, [employeeFilters, selectedCompanyIds, selectedProjectName])

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
        'تاريخ الميلاد': emp.birth_date ? formatDateShortWithHijri(emp.birth_date) : '',
        'تاريخ الالتحاق': emp.joining_date ? formatDateShortWithHijri(emp.joining_date) : '',
        'تاريخ انتهاء الإقامة': emp.residence_expiry ? formatDateShortWithHijri(emp.residence_expiry) : '',
        'تاريخ انتهاء العقد': emp.contract_expiry ? formatDateShortWithHijri(emp.contract_expiry) : '',
        'تاريخ انتهاء عقد أجير': emp.hired_worker_contract_expiry ? formatDateShortWithHijri(emp.hired_worker_contract_expiry) : '',
        'تاريخ انتهاء التأمين الصحي': emp.health_insurance_expiry ? formatDateShortWithHijri(emp.health_insurance_expiry) : '',
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
        'تاريخ انتهاء السجل التجاري': company.commercial_registration_expiry ? formatDateShortWithHijri(company.commercial_registration_expiry) : '',
        'تاريخ انتهاء التأمينات الاجتماعية': company.social_insurance_expiry ? formatDateShortWithHijri(company.social_insurance_expiry) : '',
        'تاريخ انتهاء اشتراك قوى': company.ending_subscription_power_date ? formatDateShortWithHijri(company.ending_subscription_power_date) : '',
        'تاريخ انتهاء اشتراك مقيم': company.ending_subscription_moqeem_date ? formatDateShortWithHijri(company.ending_subscription_moqeem_date) : '',
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
    <div className="space-y-3 text-[13px] leading-5">
      {/* Export Type Selection */}
      <div>
        <label className="block text-[12px] font-medium text-gray-700 mb-1">نوع البيانات المراد تصديرها</label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setExportType('employees')
              setSelectedEmployees(new Set())
              setSelectedCompanyIds(new Set())
              setSearchQuery('')
            }}
            className={`flex-1 px-3 py-2 rounded-md border font-medium transition ${
              exportType === 'employees'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
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
            className={`flex-1 px-3 py-2 rounded-md border font-medium transition ${
              exportType === 'companies'
                ? 'border-green-600 bg-green-50 text-green-700'
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-bold text-gray-900">تصدير الموظفين</h3>
          <button
            onClick={exportEmployees}
            disabled={loading || selectedEmployees.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <FileDown className="w-5 h-5" />
            تصدير المحدد ({selectedEmployees.size})
          </button>
        </div>

        {/* Search and Filter Toggle */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="بحث بالاسم أو المهنة أو رقم الإقامة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Active Filters Bar */}
        {(getActiveEmployeeFiltersCount > 0 || selectedCompanyIds.size > 0 || companiesFilterQuery) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {employeeFilters.expiredResidence && (
              <Chip active={true} onClick={() => toggleEmployeeFilter('expiredResidence')} color="blue">الإقامات المنتهية ✕</Chip>
            )}
            {employeeFilters.expiringResidence30 && (
              <Chip active={true} onClick={() => toggleEmployeeFilter('expiringResidence30')} color="blue">تنتهي خلال 30 يوم ✕</Chip>
            )}
            {employeeFilters.expiredHealthInsurance && (
              <Chip active={true} onClick={() => toggleEmployeeFilter('expiredHealthInsurance')} color="blue">تأمين صحي منتهي ✕</Chip>
            )}
            {employeeFilters.expiringHealthInsurance30 && (
              <Chip active={true} onClick={() => toggleEmployeeFilter('expiringHealthInsurance30')} color="blue">تأمين صحي ينتهي خلال 30 يوم ✕</Chip>
            )}
            {employeeFilters.expiredHiredContract && (
              <Chip active={true} onClick={() => toggleEmployeeFilter('expiredHiredContract')} color="blue">أجير منتهي ✕</Chip>
            )}
            {employeeFilters.expiringHiredContract30 && (
              <Chip active={true} onClick={() => toggleEmployeeFilter('expiringHiredContract30')} color="blue">أجير ينتهي خلال 30 يوم ✕</Chip>
            )}
            {employeeFilters.expiredContract && (
              <Chip active={true} onClick={() => toggleEmployeeFilter('expiredContract')} color="blue">عقد منتهي ✕</Chip>
            )}
            {employeeFilters.expiringContract30 && (
              <Chip active={true} onClick={() => toggleEmployeeFilter('expiringContract30')} color="blue">عقد ينتهي خلال 30 يوم ✕</Chip>
            )}
            {selectedCompanyIds.size > 0 && (
              <Chip active={true} onClick={() => setSelectedCompanyIds(new Set())} color="blue">مؤسسات محددة ({selectedCompanyIds.size}) ✕</Chip>
            )}
            {companiesFilterQuery && (
              <Chip active={true} onClick={() => setCompaniesFilterQuery('')} color="blue">تصفية المؤسسات ✕</Chip>
            )}
            {selectedProjectName && (
              <Chip active={true} onClick={() => setSelectedProjectName('')} color="blue">المشروع: {selectedProjectName} ✕</Chip>
            )}
          </div>
        )}

        {/* Horizontal Collapsible Filter Groups */}
        <div className="flex gap-1.5 mb-2 flex-wrap">
          <button
            onClick={() => toggleFilterGroup('companies')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedFilterGroup === 'companies'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 inline mr-1" />
            المؤسسات
          </button>
          <button
            onClick={() => toggleFilterGroup('residence')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedFilterGroup === 'residence'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            الإقامة
          </button>
          <button
            onClick={() => toggleFilterGroup('insurance')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedFilterGroup === 'insurance'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 inline mr-1" />
            التأمين الصحي
          </button>
          <button
            onClick={() => toggleFilterGroup('project')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedFilterGroup === 'project'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            المشروع
          </button>
          <button
            onClick={() => toggleFilterGroup('hiredContract')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedFilterGroup === 'hiredContract'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            عقد أجير
          </button>
          <button
            onClick={() => toggleFilterGroup('employeeContract')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedFilterGroup === 'employeeContract'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            العقد
          </button>
          {getActiveEmployeeFiltersCount > 0 && (
            <button
              onClick={resetEmployeeFilters}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-red-50 text-red-700 hover:bg-red-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
              إعادة تعيين
            </button>
          )}
        </div>

        {/* Expanded Filter Group Content */}
        {expandedFilterGroup === 'companies' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 space-y-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" />
              <input
                type="text"
                value={companiesFilterQuery}
                onChange={(e) => setCompaniesFilterQuery(e.target.value)}
                placeholder="فلترة المؤسسات بالاسم أو الرقم الموحد"
                className="w-full pr-8 pl-3 py-1.5 text-[12px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAllCompaniesForEmployees}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
              >
                {selectedCompanyIds.size === companies.length ? 'إلغاء تحديد الكل' : `تحديد الكل (${companies.length})`}
              </button>
            </div>
            <div className="border border-gray-200 rounded-md bg-white max-h-40 overflow-y-auto p-2 space-y-1">
              {companiesForEmployeeFilter.map(company => (
                <div
                  key={company.id}
                  className="flex items-center gap-2 py-1 px-2 hover:bg-blue-50 rounded cursor-pointer transition"
                  onClick={() => toggleCompanySelectionForEmployees(company.id)}
                >
                  {selectedCompanyIds.has(company.id) ? (
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-[12px] text-gray-700">
                    {company.name} - {company.unified_number || 'بدون رقم موحد'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {expandedFilterGroup === 'residence' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
            <Chip active={employeeFilters.expiredResidence} onClick={() => toggleEmployeeFilter('expiredResidence')} color="blue">الإقامات المنتهية</Chip>
            <Chip active={employeeFilters.expiringResidence30} onClick={() => toggleEmployeeFilter('expiringResidence30')} color="blue">تنتهي خلال 30 يوم</Chip>
          </div>
        )}

        {expandedFilterGroup === 'insurance' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
            <Chip active={employeeFilters.expiredHealthInsurance} onClick={() => toggleEmployeeFilter('expiredHealthInsurance')} color="blue">منتهي</Chip>
            <Chip active={employeeFilters.expiringHealthInsurance30} onClick={() => toggleEmployeeFilter('expiringHealthInsurance30')} color="blue">ينتهي خلال 30 يوم</Chip>
          </div>
        )}

        {expandedFilterGroup === 'project' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 space-y-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" />
              <input
                type="text"
                value={projectFilterQuery}
                onChange={(e) => setProjectFilterQuery(e.target.value)}
                placeholder="بحث باسم المشروع"
                className="w-full pr-8 pl-3 py-1.5 text-[12px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="border border-gray-200 rounded-md bg-white max-h-40 overflow-y-auto p-2 space-y-1">
              <div
                className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition ${selectedProjectName === '' ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                onClick={() => setSelectedProjectName('')}
              >
                <span className="text-[12px] text-gray-700">الكل (بدون تحديد مشروع)</span>
              </div>
              {projectsForEmployeeFilter.map(name => (
                <div
                  key={name}
                  className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition ${selectedProjectName === name ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                  onClick={() => setSelectedProjectName(name)}
                >
                  <span className="text-[12px] text-gray-700">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {expandedFilterGroup === 'hiredContract' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
            <Chip active={employeeFilters.expiredHiredContract} onClick={() => toggleEmployeeFilter('expiredHiredContract')} color="blue">منتهي</Chip>
            <Chip active={employeeFilters.expiringHiredContract30} onClick={() => toggleEmployeeFilter('expiringHiredContract30')} color="blue">ينتهي خلال 30 يوم</Chip>
          </div>
        )}

        {expandedFilterGroup === 'employeeContract' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
            <Chip active={employeeFilters.expiredContract} onClick={() => toggleEmployeeFilter('expiredContract')} color="blue">منتهي</Chip>
            <Chip active={employeeFilters.expiringContract30} onClick={() => toggleEmployeeFilter('expiringContract30')} color="blue">ينتهي خلال 30 يوم</Chip>
          </div>
        )}

        {/* Employees List - Compact Table */}
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-1.5 text-center text-[11px] font-medium text-gray-700 uppercase w-10">
                    <button onClick={toggleAllEmployees} className="flex items-center justify-center w-4 h-4">
                      {selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">الاسم</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">المهنة</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">الجنسية</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">الشركة</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">المشروع</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">رقم الإقامة</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">انتهاء العقد</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">عقد أجير</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">انتهاء الإقامة</th>
                  <th className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-700 uppercase">التأمين الصحي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleEmployeeSelection(emp.id)}>
                    <td className="px-3 py-1.5 text-center">
                      {selectedEmployees.has(emp.id) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-[12px] font-medium text-gray-900">{emp.name}</td>
                    <td className="px-3 py-1.5 text-[12px] text-gray-700">{emp.profession}</td>
                    <td className="px-3 py-1.5 text-[12px] text-gray-700">{emp.nationality}</td>
                    <td className="px-3 py-1.5 text-[12px] text-gray-700">{(() => {
                      const companyName = emp.company?.name || ''
                      const unifiedNumber = emp.company?.unified_number
                      return unifiedNumber ? `${companyName} (${unifiedNumber})` : companyName
                    })()}</td>
                    <td className="px-3 py-1.5 text-[12px] text-gray-700">{emp.project?.name || emp.project_name || '-'}</td>
                    <td className="px-3 py-1.5 text-[12px] font-mono text-gray-900">{emp.residence_number || '-'}</td>
                    <td className="px-3 py-1.5 text-[12px]">
                      {(() => {
                        const d = getDaysRemaining(emp.contract_expiry)
                        return (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className={getDateTextColor(d)}>
                              {emp.contract_expiry ? formatDateShortWithHijri(emp.contract_expiry) : '-'}
                            </span>
                            {emp.contract_expiry && (
                              <span className="text-[11px] text-gray-500">
                                {formatDateStatus(d, 'منتهي')}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-1.5 text-[12px]">
                      {(() => {
                        const d = getDaysRemaining(emp.hired_worker_contract_expiry)
                        return (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className={getDateTextColor(d)}>
                              {emp.hired_worker_contract_expiry ? formatDateShortWithHijri(emp.hired_worker_contract_expiry) : '-'}
                            </span>
                            {emp.hired_worker_contract_expiry && (
                              <span className="text-[11px] text-gray-500">
                                {formatDateStatus(d, 'منتهي')}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-1.5 text-[12px]">
                      {(() => {
                        const d = getDaysRemaining(emp.residence_expiry)
                        return (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className={getDateTextColor(d)}>
                              {emp.residence_expiry ? formatDateShortWithHijri(emp.residence_expiry) : '-'}
                            </span>
                            {emp.residence_expiry && (
                              <span className="text-[11px] text-gray-500">
                                {formatDateStatus(d, 'منتهية')}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-1.5 text-[12px]">
                      {(() => {
                        const d = getDaysRemaining(emp.health_insurance_expiry)
                        return (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className={getDateTextColor(d)}>
                              {emp.health_insurance_expiry ? formatDateShortWithHijri(emp.health_insurance_expiry) : '-'}
                            </span>
                            {emp.health_insurance_expiry && (
                              <span className="text-[11px] text-gray-500">
                                {formatDateStatus(d, 'منتهي')}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Export Companies Section */}
      {exportType === 'companies' && (
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-bold text-gray-900">تصدير المؤسسات</h3>
          <button
            onClick={exportCompanies}
            disabled={loading || selectedCompanies.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <FileDown className="w-5 h-5" />
            تصدير المحدد ({selectedCompanies.size})
          </button>
        </div>

        {/* Company Search */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="بحث باسم المؤسسة أو الرقم الموحد..."
              value={companySearchQuery}
              onChange={(e) => setCompanySearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Active Filters Bar */}
        {getActiveCompanyFiltersCount > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {companyFilters.completed && (
              <Chip active={true} onClick={() => toggleCompanyFilter('completed')} color="green">مكتملة ✕</Chip>
            )}
            {companyFilters.vacant1 && (
              <Chip active={true} onClick={() => toggleCompanyFilter('vacant1')} color="green">مكان شاغر ✕</Chip>
            )}
            {companyFilters.vacant2 && (
              <Chip active={true} onClick={() => toggleCompanyFilter('vacant2')} color="green">مكانين شاغرين ✕</Chip>
            )}
            {companyFilters.vacant3 && (
              <Chip active={true} onClick={() => toggleCompanyFilter('vacant3')} color="green">3 أماكن ✕</Chip>
            )}
            {companyFilters.vacant4 && (
              <Chip active={true} onClick={() => toggleCompanyFilter('vacant4')} color="green">4 أماكن ✕</Chip>
            )}
            {companyFilters.expiredCommercialReg && (
              <Chip active={true} onClick={() => toggleCompanyFilter('expiredCommercialReg')} color="green">سجل تجاري منتهي ✕</Chip>
            )}
            {companyFilters.expiringCommercialReg30 && (
              <Chip active={true} onClick={() => toggleCompanyFilter('expiringCommercialReg30')} color="green">سجل ينتهي خلال 30 يوم ✕</Chip>
            )}
            {companyFilters.expiredPowerSub && (
              <Chip active={true} onClick={() => toggleCompanyFilter('expiredPowerSub')} color="green">اشتراك قوى منتهي ✕</Chip>
            )}
            {companyFilters.expiringPowerSub30 && (
              <Chip active={true} onClick={() => toggleCompanyFilter('expiringPowerSub30')} color="green">قوى ينتهي خلال 30 يوم ✕</Chip>
            )}
            {companyFilters.expiredMoqeemSub && (
              <Chip active={true} onClick={() => toggleCompanyFilter('expiredMoqeemSub')} color="green">اشتراك مقيم منتهي ✕</Chip>
            )}
            {companyFilters.expiringMoqeemSub30 && (
              <Chip active={true} onClick={() => toggleCompanyFilter('expiringMoqeemSub30')} color="green">مقيم ينتهي خلال 30 يوم ✕</Chip>
            )}
            {companyFilters.expiredSocialInsurance && (
              <Chip active={true} onClick={() => toggleCompanyFilter('expiredSocialInsurance')} color="green">تأمينات منتهية ✕</Chip>
            )}
            {companyFilters.expiringSocialInsurance30 && (
              <Chip active={true} onClick={() => toggleCompanyFilter('expiringSocialInsurance30')} color="green">تأمينات تنتهي خلال 30 يوم ✕</Chip>
            )}
          </div>
        )}

        {/* Horizontal Collapsible Filter Groups */}
        <div className="flex gap-1.5 mb-2 flex-wrap">
          <button
            onClick={() => toggleCompanyFilterGroup('slots')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedCompanyFilterGroup === 'slots'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 inline mr-1" />
            الأماكن الشاغرة
          </button>
          <button
            onClick={() => toggleCompanyFilterGroup('commercial')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedCompanyFilterGroup === 'commercial'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            السجل التجاري
          </button>
          <button
            onClick={() => toggleCompanyFilterGroup('subscriptions')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedCompanyFilterGroup === 'subscriptions'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            الاشتراكات
          </button>
          <button
            onClick={() => toggleCompanyFilterGroup('insurance')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition ${
              expandedCompanyFilterGroup === 'insurance'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 inline mr-1" />
            التأمينات الاجتماعية
          </button>
          {getActiveCompanyFiltersCount > 0 && (
            <button
              onClick={resetCompanyFilters}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-red-50 text-red-700 hover:bg-red-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
              إعادة تعيين
            </button>
          )}
        </div>

        {/* Expanded Filter Group Content */}
        {expandedCompanyFilterGroup === 'slots' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
            <Chip active={companyFilters.completed} onClick={() => toggleCompanyFilter('completed')} color="green">مكتملة</Chip>
            <Chip active={companyFilters.vacant1} onClick={() => toggleCompanyFilter('vacant1')} color="green">مكان شاغر</Chip>
            <Chip active={companyFilters.vacant2} onClick={() => toggleCompanyFilter('vacant2')} color="green">مكانين شاغرين</Chip>
            <Chip active={companyFilters.vacant3} onClick={() => toggleCompanyFilter('vacant3')} color="green">3 أماكن</Chip>
            <Chip active={companyFilters.vacant4} onClick={() => toggleCompanyFilter('vacant4')} color="green">4 أماكن</Chip>
          </div>
        )}

        {expandedCompanyFilterGroup === 'commercial' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
            <Chip active={companyFilters.expiredCommercialReg} onClick={() => toggleCompanyFilter('expiredCommercialReg')} color="green">سجل منتهي</Chip>
            <Chip active={companyFilters.expiringCommercialReg30} onClick={() => toggleCompanyFilter('expiringCommercialReg30')} color="green">ينتهي خلال 30 يوم</Chip>
          </div>
        )}

        {expandedCompanyFilterGroup === 'subscriptions' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] font-semibold text-gray-600">اشتراك قوى:</span>
              <Chip active={companyFilters.expiredPowerSub} onClick={() => toggleCompanyFilter('expiredPowerSub')} color="green">منتهي</Chip>
              <Chip active={companyFilters.expiringPowerSub30} onClick={() => toggleCompanyFilter('expiringPowerSub30')} color="green">ينتهي خلال 30 يوم</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] font-semibold text-gray-600">اشتراك مقيم:</span>
              <Chip active={companyFilters.expiredMoqeemSub} onClick={() => toggleCompanyFilter('expiredMoqeemSub')} color="green">منتهي</Chip>
              <Chip active={companyFilters.expiringMoqeemSub30} onClick={() => toggleCompanyFilter('expiringMoqeemSub30')} color="green">ينتهي خلال 30 يوم</Chip>
            </div>
          </div>
        )}

        {expandedCompanyFilterGroup === 'insurance' && (
          <div className="bg-gray-50 rounded-md p-2 mb-2 flex flex-wrap gap-2">
            <Chip active={companyFilters.expiredSocialInsurance} onClick={() => toggleCompanyFilter('expiredSocialInsurance')} color="green">منتهي</Chip>
            <Chip active={companyFilters.expiringSocialInsurance30} onClick={() => toggleCompanyFilter('expiringSocialInsurance30')} color="green">ينتهي خلال 30 يوم</Chip>
          </div>
        )}

        {/* Companies List */}
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center gap-2 text-[13px] overflow-x-auto">
            <button
              onClick={toggleAllCompanies}
              className="text-green-600 hover:text-green-700 flex-shrink-0"
            >
              {selectedCompanies.size === filteredCompanies.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <span className="font-medium text-gray-700 whitespace-nowrap">
              تحديد الكل ({filteredCompanies.length})
            </span>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
            {filteredCompanies.map(company => (
              <div
                key={company.id}
                className="px-3 py-2 border-b border-gray-100 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                onClick={() => toggleCompanySelection(company.id)}
              >
                {selectedCompanies.has(company.id) ? (
                  <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{company.unified_number ? `${company.name} (${company.unified_number})` : company.name}</div>
                  <div className="text-gray-600">
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
      )}
    </div>
  )
}
