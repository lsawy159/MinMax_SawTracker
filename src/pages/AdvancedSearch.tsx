import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { Search, Filter, X, Save, Download, Star, ChevronDown, ChevronUp, Grid3X3, List, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Fuse from 'fuse.js'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { useAuth } from '@/contexts/AuthContext'

interface Employee {
  id: string
  company_id: string
  name: string
  profession: string
  nationality: string
  phone: string
  residence_expiry: string
  contract_expiry: string
  project_name?: string
  additional_fields?: Record<string, any>
  companies?: { name: string }
}

interface Company {
  id: string
  name: string
  tax_number: number
  unified_number: number
  commercial_registration_expiry: string
  insurance_subscription_expiry: string
  additional_fields?: Record<string, any>
  company_type?: string
  commercial_registration_status?: string
  insurance_subscription_status?: string
}

interface SavedSearch {
  id: string
  name: string
  search_query: string
  search_type: string
  filters: any
}

type SearchType = 'employees' | 'companies' | 'both'
type ResidenceStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type ContractStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type CompanyStatus = 'all' | 'active' | 'inactive'
type ViewMode = 'grid' | 'table'

export default function AdvancedSearch() {
  const { user } = useAuth()
  const [searchType, setSearchType] = useState<SearchType>('employees')
  const [searchQuery, setSearchQuery] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  
  // View and Pagination State
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  // Filter states for employees
  const [selectedNationality, setSelectedNationality] = useState<string>('all')
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [selectedProfession, setSelectedProfession] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [residenceStatus, setResidenceStatus] = useState<ResidenceStatus>('all')
  const [contractStatus, setContractStatus] = useState<ContractStatus>('all')

  // Filter states for companies
  const [selectedCompanyType, setSelectedCompanyType] = useState<string>('all')
  const [commercialRegStatus, setCommercialRegStatus] = useState<CompanyStatus>('all')
  const [insuranceStatus, setInsuranceStatus] = useState<CompanyStatus>('all')
  const [companyDateFilter, setCompanyDateFilter] = useState<'all' | 'commercial_expiring' | 'insurance_expiring'>('all')

  // Filter lists
  const [nationalities, setNationalities] = useState<string[]>([])
  const [companyList, setCompanyList] = useState<{ id: string; name: string }[]>([])
  const [professions, setProfessions] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [companyTypes, setCompanyTypes] = useState<string[]>([])

  // Pagination calculations
  const totalEmployees = filteredEmployees.length
  const totalCompanies = filteredCompanies.length
  const totalResults = searchType === 'employees' ? totalEmployees : searchType === 'companies' ? totalCompanies : totalEmployees + totalCompanies
  const totalPages = Math.ceil(totalResults / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage

  // Get paginated results
  const paginatedEmployees = searchType === 'both' 
    ? filteredEmployees.slice(startIndex, Math.min(endIndex, filteredEmployees.length))
    : filteredEmployees.slice(startIndex, endIndex)
  
  const paginatedCompanies = searchType === 'both'
    ? filteredCompanies.slice(Math.max(0, startIndex - filteredEmployees.length), Math.max(0, endIndex - filteredEmployees.length))
    : filteredCompanies.slice(startIndex, endIndex)

  useEffect(() => {
    loadData()
    loadSavedSearches()
  }, [])

  useEffect(() => {
    applyFilters()
    setCurrentPage(1) // Reset to first page when filters change
  }, [
    searchQuery,
    searchType,
    employees,
    companies,
    selectedNationality,
    selectedCompany,
    selectedProfession,
    selectedProject,
    residenceStatus,
    contractStatus,
    selectedCompanyType,
    commercialRegStatus,
    insuranceStatus,
    companyDateFilter
  ])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load employees with additional_fields
      const { data: employeesData } = await supabase
        .from('employees')
        .select('*, companies(name)')
        .order('name')

      if (employeesData) {
        setEmployees(employeesData)
        
        // Extract unique values for filters
        const uniqueNationalities = [...new Set(employeesData.map(e => e.nationality).filter(Boolean))]
        setNationalities(uniqueNationalities.sort())
        
        const uniqueProfessions = [...new Set(employeesData.map(e => e.profession).filter(Boolean))]
        setProfessions(uniqueProfessions.sort())
        
        const uniqueProjects = [...new Set(employeesData.map(e => e.project_name).filter(Boolean))]
        setProjects(uniqueProjects.sort())
      }

      // Load companies with additional_fields
      const { data: companiesData } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      if (companiesData) {
        setCompanies(companiesData)
        setCompanyList(companiesData.map(c => ({ id: c.id, name: c.name })))
        
        // Extract company types from additional_fields or company_type column
        const companyTypesSet = new Set<string>()
        companiesData.forEach(company => {
          // Check company_type column first
          if (company.company_type) {
            companyTypesSet.add(company.company_type)
          }
          // Check additional_fields for company_type
          if (company.additional_fields && company.additional_fields.company_type) {
            companyTypesSet.add(company.additional_fields.company_type)
          }
          // Check additional_fields for type
          if (company.additional_fields && company.additional_fields.type) {
            companyTypesSet.add(company.additional_fields.type)
          }
        })
        setCompanyTypes(Array.from(companyTypesSet).sort())
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }

  const loadSavedSearches = async () => {
    if (!user?.id) return
    
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading saved searches:', error)
      return
    }
    
    if (data) setSavedSearches(data)
  }

  const applyFilters = () => {
    let filteredEmps = [...employees]
    let filteredComps = [...companies]

    // Apply search query using Fuse.js for fuzzy search (including additional_fields)
    if (searchQuery.trim()) {
      if (searchType === 'employees' || searchType === 'both') {
        // Create searchable data with additional_fields flattened
        const searchableEmployees = filteredEmps.map(emp => ({
          ...emp,
          searchableText: [
            emp.name,
            emp.profession,
            emp.nationality,
            emp.phone,
            // Add additional_fields values to search
            ...(emp.additional_fields ? Object.values(emp.additional_fields).filter(v => v && typeof v === 'string') : [])
          ].filter(Boolean).join(' ')
        }))

        const fuseEmployees = new Fuse(searchableEmployees, {
          keys: ['name', 'profession', 'nationality', 'phone', 'searchableText'],
          threshold: 0.3,
          includeScore: true
        })
        const employeeResults = fuseEmployees.search(searchQuery)
        filteredEmps = employeeResults.map(result => result.item)
      }

      if (searchType === 'companies' || searchType === 'both') {
        // Create searchable data with additional_fields flattened
        const searchableCompanies = filteredComps.map(comp => ({
          ...comp,
          searchableText: [
            comp.name,
            comp.tax_number?.toString(),
            comp.unified_number?.toString(),
            comp.company_type,
            // Add additional_fields values to search
            ...(comp.additional_fields ? Object.values(comp.additional_fields).filter(v => v && typeof v === 'string') : [])
          ].filter(Boolean).join(' ')
        }))

        const fuseCompanies = new Fuse(searchableCompanies, {
          keys: ['name', 'tax_number', 'unified_number', 'company_type', 'searchableText'],
          threshold: 0.3,
          includeScore: true
        })
        const companyResults = fuseCompanies.search(searchQuery)
        filteredComps = companyResults.map(result => result.item)
      }
    }

    // Apply employee filters
    if (searchType === 'employees' || searchType === 'both') {
      if (selectedNationality !== 'all') {
        filteredEmps = filteredEmps.filter(e => e.nationality === selectedNationality)
      }

      if (selectedCompany !== 'all') {
        filteredEmps = filteredEmps.filter(e => e.company_id === selectedCompany)
      }

      if (selectedProfession !== 'all') {
        filteredEmps = filteredEmps.filter(e => e.profession === selectedProfession)
      }

      if (selectedProject !== 'all') {
        filteredEmps = filteredEmps.filter(e => e.project_name === selectedProject)
      }

      // Residence status filter
      if (residenceStatus !== 'all') {
        const today = new Date()
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

        filteredEmps = filteredEmps.filter(e => {
          if (!e.residence_expiry) return false
          const expiryDate = new Date(e.residence_expiry)
          
          if (residenceStatus === 'expired') return expiryDate < today
          if (residenceStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
          if (residenceStatus === 'valid') return expiryDate > thirtyDaysLater
          return true
        })
      }

      // Contract status filter
      if (contractStatus !== 'all') {
        const today = new Date()
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

        filteredEmps = filteredEmps.filter(e => {
          if (!e.contract_expiry) return false
          const expiryDate = new Date(e.contract_expiry)
          
          if (contractStatus === 'expired') return expiryDate < today
          if (contractStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
          if (contractStatus === 'valid') return expiryDate > thirtyDaysLater
          return true
        })
      }
    }

    // Apply company filters
    if (searchType === 'companies' || searchType === 'both') {
      // Company type filter
      if (selectedCompanyType !== 'all') {
        filteredComps = filteredComps.filter(c => {
          return c.company_type === selectedCompanyType ||
                 (c.additional_fields?.company_type === selectedCompanyType) ||
                 (c.additional_fields?.type === selectedCompanyType)
        })
      }

      // Commercial registration status filter
      if (commercialRegStatus !== 'all') {
        const today = new Date()
        filteredComps = filteredComps.filter(c => {
          if (!c.commercial_registration_expiry) return commercialRegStatus === 'inactive'
          const expiryDate = new Date(c.commercial_registration_expiry)
          if (commercialRegStatus === 'active') return expiryDate > today
          if (commercialRegStatus === 'inactive') return expiryDate <= today
          return true
        })
      }

      // Insurance subscription status filter
      if (insuranceStatus !== 'all') {
        const today = new Date()
        filteredComps = filteredComps.filter(c => {
          if (!c.insurance_subscription_expiry) return insuranceStatus === 'inactive'
          const expiryDate = new Date(c.insurance_subscription_expiry)
          if (insuranceStatus === 'active') return expiryDate > today
          if (insuranceStatus === 'inactive') return expiryDate <= today
          return true
        })
      }

      // Company date filters
      if (companyDateFilter !== 'all') {
        const today = new Date()
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

        if (companyDateFilter === 'commercial_expiring') {
          filteredComps = filteredComps.filter(c => {
            if (!c.commercial_registration_expiry) return false
            const expiryDate = new Date(c.commercial_registration_expiry)
            return expiryDate >= today && expiryDate <= thirtyDaysLater
          })
        }

        if (companyDateFilter === 'insurance_expiring') {
          filteredComps = filteredComps.filter(c => {
            if (!c.insurance_subscription_expiry) return false
            const expiryDate = new Date(c.insurance_subscription_expiry)
            return expiryDate >= today && expiryDate <= thirtyDaysLater
          })
        }
      }
    }

    setFilteredEmployees(filteredEmps)
    setFilteredCompanies(filteredComps)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedNationality('all')
    setSelectedCompany('all')
    setSelectedProfession('all')
    setSelectedProject('all')
    setResidenceStatus('all')
    setContractStatus('all')
    setSelectedCompanyType('all')
    setCommercialRegStatus('all')
    setInsuranceStatus('all')
    setCompanyDateFilter('all')
    setCurrentPage(1)
  }

  const saveSearch = async () => {
    if (!user?.id) {
      toast.error('يجب تسجيل الدخول لحفظ البحث')
      return
    }

    const searchName = prompt('أدخل اسماً لهذا البحث:')
    if (!searchName || !searchName.trim()) return

    try {
      const { error } = await supabase.from('saved_searches').insert({
        user_id: user.id,
        name: searchName.trim(),
        search_type: searchType,
        search_query: searchQuery,
        filters: {
          nationality: selectedNationality,
          company: selectedCompany,
          profession: selectedProfession,
          project: selectedProject,
          residenceStatus,
          contractStatus,
          companyType: selectedCompanyType,
          commercialRegStatus,
          insuranceStatus,
          companyDateFilter
        }
      })

      if (error) {
        console.error('Error saving search:', error)
        throw error
      }
      
      toast.success('تم حفظ البحث بنجاح')
      loadSavedSearches()
    } catch (error: any) {
      console.error('Error saving search:', error)
      toast.error(error?.message || 'فشل حفظ البحث')
    }
  }

  const loadSavedSearch = (saved: SavedSearch) => {
    setSearchType(saved.search_type as SearchType)
    setSearchQuery(saved.search_query || '')
    if (saved.filters) {
      setSelectedNationality(saved.filters.nationality || 'all')
      setSelectedCompany(saved.filters.company || 'all')
      setSelectedProfession(saved.filters.profession || 'all')
      setSelectedProject(saved.filters.project || 'all')
      setResidenceStatus(saved.filters.residenceStatus || 'all')
      setContractStatus(saved.filters.contractStatus || 'all')
      setSelectedCompanyType(saved.filters.companyType || 'all')
      setCommercialRegStatus(saved.filters.commercialRegStatus || 'all')
      setInsuranceStatus(saved.filters.insuranceStatus || 'all')
      setCompanyDateFilter(saved.filters.companyDateFilter || 'all')
    }
    setCurrentPage(1)
    toast.success(`تم تحميل البحث: ${saved.name}`)
  }

  const deleteSavedSearch = async (id: string) => {
    try {
      await supabase.from('saved_searches').delete().eq('id', id)
      toast.success('تم حذف البحث المحفوظ')
      loadSavedSearches()
    } catch (error) {
      console.error('Error deleting saved search:', error)
      toast.error('فشل حذف البحث')
    }
  }

  const exportResults = () => {
    if (searchType === 'employees' || searchType === 'both') {
      const employeeData = filteredEmployees.map(emp => {
        const basicData = {
          'الاسم': emp.name,
          'المهنة': emp.profession,
          'الجنسية': emp.nationality,
          'الجوال': emp.phone,
          'انتهاء الإقامة': emp.residence_expiry,
          'انتهاء العقد': emp.contract_expiry,
          'المؤسسة': (emp as any).companies?.name || ''
        }
        
        // Add additional_fields if they exist
        if (emp.additional_fields) {
          Object.entries(emp.additional_fields).forEach(([key, value]) => {
            basicData[`حقل إضافي: ${key}`] = value
          })
        }
        
        return basicData
      })

      const worksheet = XLSX.utils.json_to_sheet(employeeData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'نتائج البحث - موظفين')
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `نتائج_البحث_موظفين_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    if (searchType === 'companies' || searchType === 'both') {
      const companyData = filteredCompanies.map(comp => {
        const basicData = {
          'اسم المؤسسة': comp.name,
          'رقم التأميني': comp.tax_number,
          'رقم موحد': comp.unified_number,
          'نوع المؤسسة': comp.company_type || '',
          'انتهاء السجل التجاري': comp.commercial_registration_expiry,
          'انتهاء التأمينات': comp.insurance_subscription_expiry
        }
        
        // Add additional_fields if they exist
        if (comp.additional_fields) {
          Object.entries(comp.additional_fields).forEach(([key, value]) => {
            basicData[`حقل إضافي: ${key}`] = value
          })
        }
        
        return basicData
      })

      const worksheet = XLSX.utils.json_to_sheet(companyData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'نتائج البحث - مؤسسات')
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `نتائج_البحث_مؤسسات_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    toast.success('تم تصدير النتائج بنجاح')
  }

  const resultsCount = searchType === 'employees' 
    ? filteredEmployees.length 
    : searchType === 'companies'
    ? filteredCompanies.length
    : filteredEmployees.length + filteredCompanies.length

  // Pagination helper functions
  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) goToPage(currentPage - 1)
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) goToPage(currentPage + 1)
  }

  // Get page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i)
    }
    
    return pageNumbers
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">البحث المتقدم والفلترة</h1>
          <p className="text-gray-600">ابحث وفلتر البيانات باستخدام معايير متقدمة</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white border rounded-lg p-4 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  الفلاتر
                </h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showFilters && (
                <div className="space-y-4">
                  {/* Search Type */}
                  <div>
                    <label className="block text-sm font-medium mb-1">نوع البحث</label>
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value as SearchType)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="employees">موظفين</option>
                      <option value="companies">مؤسسات</option>
                      <option value="both">الكل</option>
                    </select>
                  </div>

                  {/* Company Filters */}
                  {(searchType === 'companies' || searchType === 'both') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">نوع المؤسسة</label>
                        <select
                          value={selectedCompanyType}
                          onChange={(e) => setSelectedCompanyType(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          {companyTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">حالة السجل التجاري</label>
                        <select
                          value={commercialRegStatus}
                          onChange={(e) => setCommercialRegStatus(e.target.value as CompanyStatus)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="active">نشط</option>
                          <option value="inactive">منتهي</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">حالة التأمينات</label>
                        <select
                          value={insuranceStatus}
                          onChange={(e) => setInsuranceStatus(e.target.value as CompanyStatus)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="active">نشط</option>
                          <option value="inactive">منتهي</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">فلترة التواريخ</label>
                        <select
                          value={companyDateFilter}
                          onChange={(e) => setCompanyDateFilter(e.target.value as any)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="commercial_expiring">السجل التجاري ينتهي قريباً</option>
                          <option value="insurance_expiring">التأمينات تنتهي قريباً</option>
                        </select>
                      </div>
                    </>
                  )}
                  {(searchType === 'employees' || searchType === 'both') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">الجنسية</label>
                        <select
                          value={selectedNationality}
                          onChange={(e) => setSelectedNationality(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          {nationalities.map(nat => (
                            <option key={nat} value={nat}>{nat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">المؤسسة</label>
                        <select
                          value={selectedCompany}
                          onChange={(e) => setSelectedCompany(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          {companyList.map(comp => (
                            <option key={comp.id} value={comp.id}>{comp.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">المهنة</label>
                        <select
                          value={selectedProfession}
                          onChange={(e) => setSelectedProfession(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          {professions.map(prof => (
                            <option key={prof} value={prof}>{prof}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">المشروع</label>
                        <select
                          value={selectedProject}
                          onChange={(e) => setSelectedProject(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          {projects.map(project => (
                            <option key={project} value={project}>{project}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">حالة الإقامة</label>
                        <select
                          value={residenceStatus}
                          onChange={(e) => setResidenceStatus(e.target.value as ResidenceStatus)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="expired">منتهية</option>
                          <option value="expiring_soon">ستنتهي قريباً (30 يوم)</option>
                          <option value="valid">سارية</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">حالة العقد</label>
                        <select
                          value={contractStatus}
                          onChange={(e) => setContractStatus(e.target.value as ContractStatus)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="expired">منتهي</option>
                          <option value="expiring_soon">سينتهي قريباً (30 يوم)</option>
                          <option value="valid">ساري</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 space-y-2">
                    <button
                      onClick={clearFilters}
                      className="w-full px-4 py-2 border rounded-md hover:bg-gray-50 transition flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      مسح الفلاتر
                    </button>
                    <button
                      onClick={saveSearch}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      حفظ البحث
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Searches */}
              {savedSearches.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    البحوث المحفوظة
                  </h3>
                  <div className="space-y-2">
                    {savedSearches.map(saved => (
                      <div key={saved.id} className="flex items-center gap-2">
                        <button
                          onClick={() => loadSavedSearch(saved)}
                          className="flex-1 text-right px-2 py-1 text-sm hover:bg-gray-50 rounded"
                        >
                          {saved.name}
                        </button>
                        <button
                          onClick={() => deleteSavedSearch(saved.id)}
                          className="p-1 hover:bg-red-50 rounded text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-3">
            {/* Search Bar */}
            <div className="bg-white border rounded-lg p-4 mb-6">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم، المهنة، الجنسية، رقم الجوال، أو أي حقل إضافي..."
                    className="w-full pr-10 pl-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={exportResults}
                  disabled={resultsCount === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  تصدير ({resultsCount})
                </button>
              </div>

              {/* Controls Row */}
              <div className="flex items-center justify-between gap-4">
                {/* Results Count */}
                <div className="text-sm text-gray-600">
                  النتائج المطابقة: <span className="font-bold text-gray-900">{resultsCount}</span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Items per page */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">عرض:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      <option value={6}>6</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                    </select>
                    <span className="text-sm text-gray-600">عنصر</span>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 border rounded-md p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-4 text-gray-600">جاري تحميل البيانات...</p>
              </div>
            )}

            {/* Results Display */}
            {!isLoading && resultsCount > 0 && (
              <>
                {/* Employee Results */}
                {(searchType === 'employees' || searchType === 'both') && paginatedEmployees.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-xl font-bold mb-4">الموظفين ({filteredEmployees.length})</h2>
                    
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {paginatedEmployees.map(emp => (
                          <div key={emp.id} className="bg-white border rounded-lg p-4">
                            <h3 className="font-bold text-lg mb-2">{emp.name}</h3>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-gray-600">المهنة:</span> {emp.profession}</p>
                              <p><span className="text-gray-600">الجنسية:</span> {emp.nationality}</p>
                              <p><span className="text-gray-600">الجوال:</span> {emp.phone}</p>
                              <p><span className="text-gray-600">المؤسسة:</span> {(emp as any).companies?.name || 'غير محدد'}</p>
                              {emp.project_name && (
                                <p><span className="text-gray-600">المشروع:</span> 
                                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full mr-1">
                                    {emp.project_name}
                                  </span>
                                </p>
                              )}
                              {emp.residence_expiry && (
                                <p><span className="text-gray-600">انتهاء الإقامة:</span> {emp.residence_expiry}</p>
                              )}
                              {emp.contract_expiry && (
                                <p><span className="text-gray-600">انتهاء العقد:</span> {emp.contract_expiry}</p>
                              )}
                              {emp.additional_fields && Object.keys(emp.additional_fields).length > 0 && (
                                <div className="mt-2 pt-2 border-t">
                                  <p className="text-xs text-gray-500 mb-1">حقول إضافية:</p>
                                  {Object.entries(emp.additional_fields).map(([key, value]) => (
                                    <p key={key} className="text-xs"><span className="text-gray-500">{key}:</span> {String(value)}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-right">الاسم</th>
                                <th className="px-4 py-2 text-right">المهنة</th>
                                <th className="px-4 py-2 text-right">الجنسية</th>
                                <th className="px-4 py-2 text-right">الجوال</th>
                                <th className="px-4 py-2 text-right">المؤسسة</th>
                                <th className="px-4 py-2 text-right">المشروع</th>
                                <th className="px-4 py-2 text-right">انتهاء الإقامة</th>
                                <th className="px-4 py-2 text-right">انتهاء العقد</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedEmployees.map(emp => (
                                <tr key={emp.id} className="border-t hover:bg-gray-50">
                                  <td className="px-4 py-2 font-medium">{emp.name}</td>
                                  <td className="px-4 py-2">{emp.profession}</td>
                                  <td className="px-4 py-2">{emp.nationality}</td>
                                  <td className="px-4 py-2">{emp.phone}</td>
                                  <td className="px-4 py-2">{(emp as any).companies?.name || 'غير محدد'}</td>
                                  <td className="px-4 py-2">
                                    {emp.project_name ? (
                                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                                        {emp.project_name}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">{emp.residence_expiry || '-'}</td>
                                  <td className="px-4 py-2">{emp.contract_expiry || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Company Results */}
                {(searchType === 'companies' || searchType === 'both') && paginatedCompanies.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-xl font-bold mb-4">المؤسسات ({filteredCompanies.length})</h2>
                    
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {paginatedCompanies.map(comp => (
                          <div key={comp.id} className="bg-white border rounded-lg p-4">
                            <h3 className="font-bold text-lg mb-2">{comp.name}</h3>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-gray-600">رقم التأميني:</span> {comp.tax_number}</p>
                              <p><span className="text-gray-600">رقم موحد:</span> {comp.unified_number}</p>
                              {comp.company_type && (
                                <p><span className="text-gray-600">نوع المؤسسة:</span> {comp.company_type}</p>
                              )}
                              {comp.commercial_registration_expiry && (
                                <p><span className="text-gray-600">انتهاء السجل:</span> {comp.commercial_registration_expiry}</p>
                              )}
                              {comp.insurance_subscription_expiry && (
                                <p><span className="text-gray-600">انتهاء التأمينات:</span> {comp.insurance_subscription_expiry}</p>
                              )}
                              {comp.additional_fields && Object.keys(comp.additional_fields).length > 0 && (
                                <div className="mt-2 pt-2 border-t">
                                  <p className="text-xs text-gray-500 mb-1">حقول إضافية:</p>
                                  {Object.entries(comp.additional_fields).map(([key, value]) => (
                                    <p key={key} className="text-xs"><span className="text-gray-500">{key}:</span> {String(value)}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-right">اسم المؤسسة</th>
                                <th className="px-4 py-2 text-right">رقم التأميني</th>
                                <th className="px-4 py-2 text-right">رقم موحد</th>
                                <th className="px-4 py-2 text-right">نوع المؤسسة</th>
                                <th className="px-4 py-2 text-right">انتهاء السجل</th>
                                <th className="px-4 py-2 text-right">انتهاء التأمينات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedCompanies.map(comp => (
                                <tr key={comp.id} className="border-t hover:bg-gray-50">
                                  <td className="px-4 py-2 font-medium">{comp.name}</td>
                                  <td className="px-4 py-2">{comp.tax_number}</td>
                                  <td className="px-4 py-2">{comp.unified_number}</td>
                                  <td className="px-4 py-2">{comp.company_type || '-'}</td>
                                  <td className="px-4 py-2">{comp.commercial_registration_expiry || '-'}</td>
                                  <td className="px-4 py-2">{comp.insurance_subscription_expiry || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white border rounded-lg p-4">
                    <div className="text-sm text-gray-600">
                      عرض {startIndex + 1}-{Math.min(endIndex, totalResults)} من {totalResults} نتيجة
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {getPageNumbers().map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`px-3 py-2 border rounded-md text-sm ${
                            currentPage === pageNum 
                              ? 'bg-blue-600 text-white border-blue-600' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Empty State */}
            {!isLoading && resultsCount === 0 && (
              <div className="text-center py-12 bg-white border rounded-lg">
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
                <p className="text-gray-600">جرب تغيير معايير البحث أو الفلاتر</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
