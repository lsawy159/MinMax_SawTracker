import { useEffect, useState, useCallback } from 'react' // [FIX] تم إضافة useCallback
import { supabase, Company } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import CompanyModal from '@/components/companies/CompanyModal'
import CompanyCard from '@/components/companies/CompanyCard'
import CompanyDetailModal from '@/components/companies/CompanyDetailModal'
import { Building2, Users, AlertCircle, Search, Filter, X, ArrowUpDown, ArrowUp, ArrowDown, Grid3X3, List, ChevronLeft, ChevronRight } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { 
  calculateCommercialRegistrationStatus, 
  calculateSocialInsuranceStatus,  // تحديث: calculateInsuranceSubscriptionStatus → calculateSocialInsuranceStatus
  calculatePowerSubscriptionStatus,
  calculateMoqeemSubscriptionStatus,
  calculateCompanyStatusStats
} from '@/utils/autoCompanyStatus'

type SortField = 'name' | 'created_at' | 'commercial_registration_status' | 'social_insurance_status' | 'employee_count' | 'power_subscription_status' | 'moqeem_subscription_status'  // تحديث: insurance_subscription_status → social_insurance_status
type SortDirection = 'asc' | 'desc'
type CommercialRegStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type SocialInsuranceStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'  // تحديث: InsuranceStatus → SocialInsuranceStatus
type PowerSubscriptionStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type MoqeemSubscriptionStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'

type EmployeeCountFilter = 'all' | '1' | '2' | '3' | '4+'
type AvailableSlotsFilter = 'all' | '0' | '1' | '2' | '3' | '4+'
type DateRange = 'all' | 'last_month' | 'last_3_months' | 'last_year' | 'custom'
type ExemptionsFilter = 'all' | 'تم الاعفاء' | 'لم يتم الاعفاء' | 'أخرى'
type ViewMode = 'grid' | 'table'

export default function Companies() {
  const [companies, setCompanies] = useState<(Company & { employee_count: number; available_slots?: number })[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<(Company & { employee_count: number; available_slots?: number })[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCompanyDetailModal, setShowCompanyDetailModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedCompanyForDetail, setSelectedCompanyForDetail] = useState<(Company & { employee_count: number; available_slots?: number }) | null>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [commercialRegStatus, setCommercialRegStatus] = useState<CommercialRegStatus>('all')
  const [socialInsuranceStatus, setSocialInsuranceStatus] = useState<SocialInsuranceStatus>('all')  // تحديث: insuranceStatus → socialInsuranceStatus
  const [powerSubscriptionStatus, setPowerSubscriptionStatus] = useState<PowerSubscriptionStatus>('all')
  const [moqeemSubscriptionStatus, setMoqeemSubscriptionStatus] = useState<MoqeemSubscriptionStatus>('all')

  const [employeeCountFilter, setEmployeeCountFilter] = useState<EmployeeCountFilter>('all')
  const [availableSlotsFilter, setAvailableSlotsFilter] = useState<AvailableSlotsFilter>('all')
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [exemptionsFilter, setExemptionsFilter] = useState<ExemptionsFilter>('all')
  const [showFiltersModal, setShowFiltersModal] = useState(false)

  // Sort states
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // View and Pagination states
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)


  // [FIX] تم تغليف الدالة بـ useCallback
  const loadSavedFilters = useCallback(() => {
    try {
      const saved = localStorage.getItem('companiesFilters')
      if (saved) {
        const filters = JSON.parse(saved)
        setSearchTerm(filters.searchTerm || '')
        setCommercialRegStatus(filters.commercialRegStatus || 'all')
        setSocialInsuranceStatus(filters.socialInsuranceStatus || filters.insuranceStatus || 'all')  // تحديث: دعم التوافق مع الأسماء القديمة
        setPowerSubscriptionStatus(filters.powerSubscriptionStatus || 'all')
        setMoqeemSubscriptionStatus(filters.moqeemSubscriptionStatus || 'all')

        setEmployeeCountFilter(filters.employeeCountFilter || 'all')
        setAvailableSlotsFilter(filters.availableSlotsFilter || 'all')
        setDateRangeFilter(filters.dateRangeFilter || 'all')
        setExemptionsFilter(filters.exemptionsFilter || 'all')
        setSortField(filters.sortField || 'name')
        setSortDirection(filters.sortDirection || 'asc')
      }
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }, []) // <-- [FIX] مصفوفة اعتماديات فارغة لأنها لا تعتمد على state

  // [FIX] تم تغليف الدالة بـ useCallback
  const saveFiltersToStorage = useCallback(() => {
    try {
      const filters = {
        searchTerm,
        commercialRegStatus,
        socialInsuranceStatus,  // تحديث: insuranceStatus → socialInsuranceStatus
        powerSubscriptionStatus,
        moqeemSubscriptionStatus,

        employeeCountFilter,
        availableSlotsFilter,
        dateRangeFilter,
        exemptionsFilter,
        sortField,
        sortDirection
      }
      localStorage.setItem('companiesFilters', JSON.stringify(filters))
    } catch (error) {
      console.error('Error saving filters:', error)
    }
  }, [ // <-- [FIX] إضافة جميع الاعتماديات التي تستخدمها الدالة
    searchTerm,
    commercialRegStatus,
    socialInsuranceStatus,  // تحديث: insuranceStatus → socialInsuranceStatus
    powerSubscriptionStatus,
    moqeemSubscriptionStatus,
    employeeCountFilter,
    availableSlotsFilter,
    dateRangeFilter,
    exemptionsFilter,
    sortField,
    sortDirection
  ])

  // [FIX] تم تغليف الدالة بـ useCallback
  const loadCompanies = useCallback(async () => {
    console.log('🔍 [DEBUG] Starting loadCompanies...')
    
    try {
      console.log('📊 [DEBUG] Fetching companies from database...')
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      console.log('📋 [DEBUG] Companies data fetched:', {
        data: companiesData,
        error: companiesError,
        dataLength: companiesData?.length || 0
      })

      if (companiesError) {
        console.error('❌ [DEBUG] Companies fetch error:', companiesError)
        throw companiesError
      }

      // معالجة البيانات null/undefined
      if (!companiesData) {
        console.warn('⚠️ [DEBUG] No companies data received, setting empty array')
        setCompanies([])
        return
      }

      console.log(`🏢 [DEBUG] Processing ${companiesData.length} companies...`)
      
      // [OPTIMIZATION] جلب عدد الموظفين لكل الشركات باستعلام واحد بدلاً من 133 استعلام
      console.log('👥 [DEBUG] Fetching employee counts for all companies in a single query...')
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('company_id')

      if (employeesError) {
        console.error('❌ [DEBUG] Error fetching employees:', employeesError)
        throw employeesError
      }

      // حساب عدد الموظفين لكل شركة
      const employeeCounts: Record<string, number> = {}
      employeesData?.forEach(emp => {
        if (emp.company_id) {
          employeeCounts[emp.company_id] = (employeeCounts[emp.company_id] || 0) + 1
        }
      })

      console.log(`✅ [DEBUG] Employee counts calculated for ${Object.keys(employeeCounts).length} companies`)

      // دمج البيانات
      const companiesWithCount = (companiesData || []).map((company) => {
        try {
          const employeeCount = employeeCounts[company.id] || 0
          const maxEmployees = company.max_employees || 4 // افتراضي 4 موظفين كحد أقصى
          const availableSlots = Math.max(0, maxEmployees - employeeCount)

          return { ...company, employee_count: employeeCount, available_slots: availableSlots }
        } catch (companyError) {
          console.error(`❌ [DEBUG] Error processing company ${company.id}:`, companyError)
          return { 
            ...company, 
            employee_count: 0, 
            available_slots: company.max_employees || 4 
          }
        }
      })

      console.log('💾 [DEBUG] Setting companies data:', companiesWithCount.length, 'companies')
      setCompanies(companiesWithCount)

      console.log(`✅ [DEBUG] Successfully loaded ${companiesWithCount.length} companies`)
      
    } catch (error) {
      console.error('❌ [DEBUG] Critical error in loadCompanies:', error)
      console.error('❌ [DEBUG] Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      })
      
      // في حالة الخطأ، قم بمسح البيانات وتعيين قائمة فارغة
      setCompanies([])
    } finally {
      console.log('🏁 [DEBUG] loadCompanies completed, setting loading to false')
      setLoading(false)
    }
  }, []) // <-- [FIX] مصفوفة فارغة لأنها لا تعتمد على state (setters مستقرة)

  // [FIX] تم تغليف الدالة بـ useCallback
  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...companies]

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(company =>
        company.name.toLowerCase().includes(searchLower) ||
        company.unified_number?.toString().includes(searchLower) ||
        company.social_insurance_number?.toString().includes(searchLower)
      )
    }


    // Apply commercial registration status filter
    if (commercialRegStatus !== 'all') {
      filtered = filtered.filter(company => {
        const statusInfo = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)

        if (commercialRegStatus === 'expired') return statusInfo.status === 'منتهي'
        if (commercialRegStatus === 'expiring_soon') return statusInfo.status === 'حرج' || statusInfo.status === 'متوسط'
        if (commercialRegStatus === 'valid') return statusInfo.status === 'ساري'
        return true
      })
    }

    // Apply social insurance status filter (التأمينات الاجتماعية للمؤسسات)
    if (socialInsuranceStatus !== 'all') {  // تحديث: insuranceStatus → socialInsuranceStatus
      filtered = filtered.filter(company => {
        const statusInfo = calculateSocialInsuranceStatus(company.social_insurance_expiry)  // تحديث: calculateInsuranceSubscriptionStatus → calculateSocialInsuranceStatus, insurance_subscription_expiry → social_insurance_expiry

        if (socialInsuranceStatus === 'expired') return statusInfo.status === 'منتهي'
        if (socialInsuranceStatus === 'expiring_soon') return statusInfo.status === 'حرج' || statusInfo.status === 'عاجل' || statusInfo.status === 'متوسط'
        if (socialInsuranceStatus === 'valid') return statusInfo.status === 'ساري'
        return true
      })
    }

    // Apply power subscription status filter
    if (powerSubscriptionStatus !== 'all') {
      const today = new Date()
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      filtered = filtered.filter(company => {
        if (!company.ending_subscription_power_date) return false
        const expiryDate = new Date(company.ending_subscription_power_date)

        if (powerSubscriptionStatus === 'expired') return expiryDate < today
        if (powerSubscriptionStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
        if (powerSubscriptionStatus === 'valid') return expiryDate > thirtyDaysLater
        return true
      })
    }

    // Apply moqeem subscription status filter
    if (moqeemSubscriptionStatus !== 'all') {
      const today = new Date()
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      filtered = filtered.filter(company => {
        if (!company.ending_subscription_moqeem_date) return false
        const expiryDate = new Date(company.ending_subscription_moqeem_date)

        if (moqeemSubscriptionStatus === 'expired') return expiryDate < today
        if (moqeemSubscriptionStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
        if (moqeemSubscriptionStatus === 'valid') return expiryDate > thirtyDaysLater
        return true
      })
    }



    // Apply employee count filter
    if (employeeCountFilter !== 'all') {
      filtered = filtered.filter(company => {
        const count = company.employee_count
        if (employeeCountFilter === '4+') return count >= 4
        return count === parseInt(employeeCountFilter)
      })
    }

    // Apply available slots filter
    if (availableSlotsFilter !== 'all') {
      filtered = filtered.filter(company => {
        const slots = company.available_slots || 0
        if (availableSlotsFilter === '0') return slots === 0
        if (availableSlotsFilter === '4+') return slots >= 4
        return slots === parseInt(availableSlotsFilter)
      })
    }

    // Apply date range filter
    if (dateRangeFilter !== 'all') {
      const today = new Date()
      let startDate: Date | null = null
      let endDate: Date | null = null

      if (dateRangeFilter === 'last_month') {
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
        endDate = today
      } else if (dateRangeFilter === 'last_3_months') {
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
        endDate = today
      } else if (dateRangeFilter === 'last_year') {
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        endDate = today
      } else if (dateRangeFilter === 'custom' && customStartDate && customEndDate) {
        startDate = new Date(customStartDate)
        endDate = new Date(customEndDate)
      }

      if (startDate && endDate) {
        filtered = filtered.filter(company => {
          if (!company.created_at) return false
          const createdDate = new Date(company.created_at)
          return createdDate >= startDate! && createdDate <= endDate!
        })
      }
    }

    // Apply exemptions filter
    if (exemptionsFilter !== 'all') {
      filtered = filtered.filter(company => {
        if (!company.exemptions) return false
        return company.exemptions === exemptionsFilter
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'created_at':
          aValue = a.created_at ? new Date(a.created_at).getTime() : 0
          bValue = b.created_at ? new Date(b.created_at).getTime() : 0
          break
        case 'commercial_registration_status':
          aValue = a.commercial_registration_expiry ? calculateCommercialRegistrationStatus(a.commercial_registration_expiry).daysRemaining : -999999
          bValue = b.commercial_registration_expiry ? calculateCommercialRegistrationStatus(b.commercial_registration_expiry).daysRemaining : -999999
          break
        case 'social_insurance_status':  // تحديث: insurance_subscription_status → social_insurance_status
          aValue = a.social_insurance_expiry ? calculateSocialInsuranceStatus(a.social_insurance_expiry).daysRemaining : -999999  // تحديث: insurance_subscription_expiry → social_insurance_expiry
          bValue = b.social_insurance_expiry ? calculateSocialInsuranceStatus(b.social_insurance_expiry).daysRemaining : -999999
          break
        case 'employee_count':
          aValue = a.employee_count || 0
          bValue = b.employee_count || 0
          break
        case 'power_subscription_status':
          aValue = a.ending_subscription_power_date ? getDaysRemaining(a.ending_subscription_power_date) : -999999
          bValue = b.ending_subscription_power_date ? getDaysRemaining(b.ending_subscription_power_date) : -999999
          break
        case 'moqeem_subscription_status':
          aValue = a.ending_subscription_moqeem_date ? getDaysRemaining(a.ending_subscription_moqeem_date) : -999999
          bValue = b.ending_subscription_moqeem_date ? getDaysRemaining(b.ending_subscription_moqeem_date) : -999999
          break

        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

    setFilteredCompanies(filtered)
  }, [ // <-- [FIX] إضافة جميع الاعتماديات التي تستخدمها الدالة
    companies,
    searchTerm,
    commercialRegStatus,
    socialInsuranceStatus,  // تحديث: insuranceStatus → socialInsuranceStatus
    powerSubscriptionStatus,
    moqeemSubscriptionStatus,
    employeeCountFilter,
    availableSlotsFilter,
    dateRangeFilter,
    customStartDate,
    customEndDate,
    exemptionsFilter,
    sortField,
    sortDirection
  ])


  useEffect(() => {
    loadCompanies()
    // Load saved filters from localStorage
    loadSavedFilters()
  }, [loadCompanies, loadSavedFilters]) // <-- [FIX] تم التحديث
  
  useEffect(() => {
    applyFiltersAndSort()
    // Save filters to localStorage
    saveFiltersToStorage()
  }, [applyFiltersAndSort, saveFiltersToStorage]) // <-- [FIX] تم التحديث

  const getDaysRemaining = (date: string) => {
    return differenceInDays(new Date(date), new Date())
  }

  // دالة حساب الأماكن الشاغرة
  const calculateAvailableSlots = (maxEmployees: number, currentEmployees: number): number => {
    return Math.max(0, maxEmployees - currentEmployees)
  }

  // دالة الحصول على لون حالة الأماكن الشاغرة
  const getAvailableSlotsColor = (availableSlots: number) => {
    if (availableSlots === 0) return 'text-red-600 bg-red-50 border-red-200'
    if (availableSlots === 1) return 'text-orange-600 bg-orange-50 border-orange-200'
    if (availableSlots <= 3) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  // دالة الحصول على لون النص للأماكن الشاغرة
  const getAvailableSlotsTextColor = (availableSlots: number) => {
    if (availableSlots === 0) return 'text-red-600'
    if (availableSlots === 1) return 'text-orange-600'
    if (availableSlots <= 3) return 'text-yellow-600'
    return 'text-green-600'
  }

  // دالة الحصول على وصف حالة الأماكن الشاغرة
  const getAvailableSlotsText = (availableSlots: number, maxEmployees: number) => {
    if (availableSlots === 0) return 'مكتملة'
    if (availableSlots === 1) return 'مكان واحد متبقي'
    if (availableSlots <= 3) return 'أماكن قليلة متاحة'
    return 'أماكن متاحة'
  }



  const clearFilters = () => {
    setSearchTerm('')
    setCommercialRegStatus('all')
    setSocialInsuranceStatus('all')
    setPowerSubscriptionStatus('all')
    setMoqeemSubscriptionStatus('all')

    setEmployeeCountFilter('all')
    setAvailableSlotsFilter('all')
    setDateRangeFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setExemptionsFilter('all')
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field with ascending order
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
  }

  const handleAddCompany = () => {
    setSelectedCompany(null)
    setShowAddModal(true)
  }

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company)
    setShowEditModal(true)
  }

  const handleDeleteCompany = (company: Company) => {
    setSelectedCompany(company)
    setShowDeleteModal(true)
  }

  const handleCompanyCardClick = (company: Company & { employee_count: number; available_slots?: number }) => {
    setSelectedCompanyForDetail(company)
    setShowCompanyDetailModal(true)
  }

  const handleCloseCompanyDetailModal = () => {
    setShowCompanyDetailModal(false)
    setSelectedCompanyForDetail(null)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedCompany) return

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id)

      if (error) throw error

      // Log activity
      await supabase.from('activity_log').insert({
        action: 'حذف مؤسسة',
        entity_type: 'company',
        entity_id: selectedCompany.id,
        details: { company_name: selectedCompany.name }
      })

      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('companyUpdated'))

      // Refresh companies list
      loadCompanies()
      setShowDeleteModal(false)
      setSelectedCompany(null)
    } catch (error) {
      console.error('Error deleting company:', error)
    }
  }

  const handleModalClose = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    setShowDeleteModal(false)
    setSelectedCompany(null)
  }

  const handleModalSuccess = async () => {
    try {
      handleModalClose()
      await loadCompanies()
    } catch (error) {
      console.error('Error in handleModalSuccess:', error)
      // لا نعيد تحميل القائمة في حالة الخطأ - نترك المودال مفتوحاً
      toast.error('حدث خطأ أثناء تحديث القائمة')
    }
  }

  const activeFiltersCount = [
    searchTerm !== '',
    commercialRegStatus !== 'all',
    socialInsuranceStatus !== 'all',  // تحديث: insuranceStatus → socialInsuranceStatus
    powerSubscriptionStatus !== 'all',
    moqeemSubscriptionStatus !== 'all',

    employeeCountFilter !== 'all',
    availableSlotsFilter !== 'all',
    dateRangeFilter !== 'all',
    exemptionsFilter !== 'all'
  ].filter(Boolean).length

  const [showSortDropdown, setShowSortDropdown] = useState(false)

  // Pagination calculations
  const totalResults = filteredCompanies.length
  const totalPages = Math.ceil(totalResults / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCompanies = filteredCompanies.slice(startIndex, endIndex)

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(page)
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 5
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i)
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pageNumbers.push(i)
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pageNumbers.push(i)
        }
      }
    }
    
    return pageNumbers
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filteredCompanies.length, itemsPerPage])

  return (
    <Layout>
      <div className="p-6">
        {/* Header with Actions */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">المؤسسات</h1>
            <p className="text-sm text-gray-600">
              عرض {filteredCompanies.length} من {companies.length} مؤسسة
              {activeFiltersCount > 0 && (
                <span className="mr-2 text-blue-600 font-medium">
                  ({activeFiltersCount} فلتر نشط)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleAddCompany}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            إضافة مؤسسة
          </button>
        </div>

        {/* Company Status Statistics Section - إحصائيات موحدة تشمل جميع الحالات */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              إحصائيات المؤسسات (موحدة - تشمل جميع الحالات)
            </h3>
          </div>
          {(() => {
            const stats = calculateCompanyStatusStats(companies.map(c => ({
              id: c.id,
              name: c.name,
              commercial_registration_expiry: c.commercial_registration_expiry,
              social_insurance_expiry: c.social_insurance_expiry,  // تحديث: insurance_subscription_expiry → social_insurance_expiry
              ending_subscription_power_date: c.ending_subscription_power_date,
              ending_subscription_moqeem_date: c.ending_subscription_moqeem_date
            })))
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* إجمالي المؤسسات */}
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</div>
                  <div className="text-sm text-gray-600">إجمالي المؤسسات</div>
                </div>
                
                {/* ساري - جميع الحالات سارية */}
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-700">{stats.totalValid}</div>
                  <div className="text-sm text-green-600">ساري ({stats.totalValidPercentage}%)</div>
                </div>
                
                {/* متوسطة الأهمية - حالة واحدة على الأقل متوسطة */}
                <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-700">{stats.totalMedium}</div>
                  <div className="text-sm text-yellow-600">متوسط ({stats.totalMediumPercentage}%)</div>
                </div>
                
                {/* حرج/منتهي - حالة واحدة على الأقل حرجة أو منتهية */}
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-700">{stats.totalCritical + stats.totalExpired}</div>
                  <div className="text-sm text-red-600">حرج/منتهي ({stats.totalCriticalPercentage + stats.totalExpiredPercentage}%)</div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Compact Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم أو رقم اشتراك التأمينات أو الرقم الموحد..."
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter Button with Badge */}
            <button
              onClick={() => setShowFiltersModal(true)}
              className="relative px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              <span>الفلاتر</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition flex items-center gap-2 border border-gray-300"
              >
                {getSortIcon(sortField)}
                <span className="hidden sm:inline">الترتيب</span>
                <ArrowUpDown className="w-4 h-4" />
              </button>

              {/* Sort Dropdown Menu */}
              {showSortDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortDropdown(false)}
                  />
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-2">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
                      الترتيب حسب:
                    </div>
                    {[
                      { field: 'name' as SortField, label: 'الاسم' },
                      { field: 'created_at' as SortField, label: 'تاريخ التسجيل' },
                      { field: 'commercial_registration_status' as SortField, label: 'حالة التسجيل التجاري' },
                      { field: 'social_insurance_status' as SortField, label: 'حالة التأمينات الاجتماعية' },  // تحديث: insurance_subscription_status → social_insurance_status
                      { field: 'employee_count' as SortField, label: 'عدد الموظفين' },
                      { field: 'power_subscription_status' as SortField, label: 'حالة اشتراك قوى' },
                      { field: 'moqeem_subscription_status' as SortField, label: 'حالة اشتراك مقيم' }
                    ].map(({ field, label }) => (
                      <button
                        key={field}
                        onClick={() => {
                          handleSort(field)
                          setShowSortDropdown(false)
                        }}
                        className={`w-full text-right px-4 py-2 text-sm hover:bg-gray-50 transition flex items-center justify-between ${
                          sortField === field ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <span>{label}</span>
                        {sortField === field && getSortIcon(field)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View Mode and Items Per Page */}
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 border border-gray-300 rounded-md p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="عرض شبكي"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
                  title="عرض جدول"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Items per page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">عرض:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={150}>150</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Modal */}
        {showFiltersModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowFiltersModal(false)}
            />
            
            {/* Modal Content */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">الفلاتر والبحث</h2>
                    {activeFiltersCount > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {activeFiltersCount} فلتر نشط
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Commercial Registration Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">حالة التسجيل التجاري</label>
                      <select
                        value={commercialRegStatus}
                        onChange={(e) => setCommercialRegStatus(e.target.value as CommercialRegStatus)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">الكل</option>
                        <option value="expired">منتهي</option>
                        <option value="expiring_soon">عاجل</option>
                        <option value="valid">ساري</option>
                      </select>
                    </div>

                    {/* Insurance Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">حالة اشتراك التأمينات</label>
                      <select
                        value={socialInsuranceStatus}
                        onChange={(e) => setSocialInsuranceStatus(e.target.value as SocialInsuranceStatus)}  // تحديث: insuranceStatus → socialInsuranceStatus
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">الكل</option>
                        <option value="expired">منتهي</option>
                        <option value="expiring_soon">عاجل</option>
                        <option value="valid">ساري</option>
                      </select>
                    </div>

                    {/* Power Subscription Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">حالة اشتراك قوى</label>
                      <select
                        value={powerSubscriptionStatus}
                        onChange={(e) => setPowerSubscriptionStatus(e.target.value as PowerSubscriptionStatus)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">الكل</option>
                        <option value="expired">منتهي</option>
                        <option value="expiring_soon">عاجل</option>
                        <option value="valid">ساري</option>
                      </select>
                    </div>

                    {/* Moqeem Subscription Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">حالة اشتراك مقيم</label>
                      <select
                        value={moqeemSubscriptionStatus}
                        onChange={(e) => setMoqeemSubscriptionStatus(e.target.value as MoqeemSubscriptionStatus)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">الكل</option>
                        <option value="expired">منتهي</option>
                        <option value="expiring_soon">عاجل</option>
                        <option value="valid">ساري</option>
                      </select>
                    </div>

                    {/* Employee Count Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">عدد الموظفين</label>
                      <select
                        value={employeeCountFilter}
                        onChange={(e) => setEmployeeCountFilter(e.target.value as EmployeeCountFilter)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">الكل</option>
                        <option value="1">موظف واحد</option>
                        <option value="2">موظفان</option>
                        <option value="3">ثلاثة موظفين</option>
                        <option value="4+">أربعة موظفين فأكثر</option>
                      </select>
                    </div>

                    {/* Available Slots Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">الأماكن الشاغرة</label>
                      <select
                        value={availableSlotsFilter}
                        onChange={(e) => setAvailableSlotsFilter(e.target.value as AvailableSlotsFilter)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">الكل</option>
                        <option value="0">المؤسسات المكتملة</option>
                        <option value="1">مكان واحد شاغر</option>
                        <option value="2">مكانين شاغرين</option>
                        <option value="3">ثلاثة أماكن شاغرة</option>
                        <option value="4+">أربعة أماكن فأكثر</option>
                      </select>
                    </div>

                    {/* Date Range */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">فلتر تاريخ انشاء المؤسسة</label>
                      <select
                        value={dateRangeFilter}
                        onChange={(e) => setDateRangeFilter(e.target.value as DateRange)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">الكل</option>
                        <option value="last_month">آخر شهر</option>
                        <option value="last_3_months">آخر 3 أشهر</option>
                        <option value="last_year">آخر سنة</option>
                        <option value="custom">مخصص</option>
                      </select>
                    </div>

                    {/* Exemptions Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">الاعفاءات</label>
                      <select
                        value={exemptionsFilter}
                        onChange={(e) => setExemptionsFilter(e.target.value as ExemptionsFilter)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">الكل</option>
                        <option value="تم الاعفاء">تم الاعفاء</option>
                        <option value="لم يتم الاعفاء">لم يتم الاعفاء</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>

                    {/* Custom Date Range */}
                    {dateRangeFilter === 'custom' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">من تاريخ</label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">إلى تاريخ</label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={clearFilters}
                    disabled={activeFiltersCount === 0}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <X className="w-4 h-4" />
                    مسح جميع الفلاتر
                  </button>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    تطبيق الفلاتر
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Companies Display */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCompanies.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedCompanies.map((company) => (
                  <div
                    key={company.id}
                    onClick={() => handleCompanyCardClick(company)}
                    className="cursor-pointer"
                  >
                    <CompanyCard
                      company={company}
                      onEdit={(comp) => {
                        handleEditCompany(comp)
                      }}
                      onDelete={(comp) => {
                        handleDeleteCompany(comp)
                      }}
                      getAvailableSlotsColor={getAvailableSlotsColor}
                      getAvailableSlotsTextColor={getAvailableSlotsTextColor}
                      getAvailableSlotsText={getAvailableSlotsText}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">اسم المؤسسة</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">رقم موحد</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">رقم اشتراك التأمينات الاجتماعية</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">رقم اشتراك قوى</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">انتهاء السجل التجاري</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">انتهاء اشتراك التأمينات</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">حالة اشتراك قوى</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">حالة اشتراك مقيم</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">عدد الموظفين</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">الأماكن الشاغرة</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCompanies.map((company) => {
                        const commercialStatus = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
                        const socialInsuranceStatus = calculateSocialInsuranceStatus(company.social_insurance_expiry)  // تحديث: calculateInsuranceSubscriptionStatus → calculateSocialInsuranceStatus, insurance_subscription_expiry → social_insurance_expiry
                        const powerStatus = calculatePowerSubscriptionStatus(company.ending_subscription_power_date)
                        const moqeemStatus = calculateMoqeemSubscriptionStatus(company.ending_subscription_moqeem_date)
                        return (
                          <tr 
                            key={company.id} 
                            className="border-t hover:bg-gray-50 transition cursor-pointer"
                            onClick={() => handleCompanyCardClick(company)}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">{company.name}</td>
                            <td className="px-4 py-3 text-gray-700">{company.unified_number || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{company.social_insurance_number || '-'}</td>
                            <td className="px-4 py-3 text-gray-700">{company.labor_subscription_number || '-'}</td>
                            <td className="px-4 py-3">
                              {company.commercial_registration_expiry ? (
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  commercialStatus.status === 'منتهي' ? 'bg-red-100 text-red-700' :
                                  commercialStatus.status === 'حرج' ? 'bg-red-100 text-red-700' :
                                  commercialStatus.status === 'عاجل' ? 'bg-orange-100 text-orange-700' :
                                  commercialStatus.status === 'متوسط' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {company.commercial_registration_expiry}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {company.social_insurance_expiry ? (  // تحديث: insurance_subscription_expiry → social_insurance_expiry
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  socialInsuranceStatus.status === 'منتهي' ? 'bg-red-100 text-red-700' :
                                  socialInsuranceStatus.status === 'حرج' ? 'bg-red-100 text-red-700' :
                                  socialInsuranceStatus.status === 'عاجل' ? 'bg-orange-100 text-orange-700' :
                                  socialInsuranceStatus.status === 'متوسط' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {company.social_insurance_expiry}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {company.ending_subscription_power_date ? (
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  powerStatus.status === 'منتهي' ? 'bg-red-100 text-red-700' :
                                  powerStatus.status === 'حرج' ? 'bg-red-100 text-red-700' :
                                  powerStatus.status === 'عاجل' ? 'bg-orange-100 text-orange-700' :
                                  powerStatus.status === 'متوسط' ? 'bg-yellow-100 text-yellow-700' :
                                  powerStatus.status === 'ساري' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {company.ending_subscription_power_date}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {company.ending_subscription_moqeem_date ? (
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  moqeemStatus.status === 'منتهي' ? 'bg-red-100 text-red-700' :
                                  moqeemStatus.status === 'حرج' ? 'bg-red-100 text-red-700' :
                                  moqeemStatus.status === 'عاجل' ? 'bg-orange-100 text-orange-700' :
                                  moqeemStatus.status === 'متوسط' ? 'bg-yellow-100 text-yellow-700' :
                                  moqeemStatus.status === 'ساري' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {company.ending_subscription_moqeem_date}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{company.employee_count || 0}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${getAvailableSlotsColor(company.available_slots || 0)}`}>
                                {company.available_slots || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleEditCompany(company)}
                                  className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition text-sm"
                                >
                                  تعديل
                                </button>
                                <button
                                  onClick={() => handleDeleteCompany(company)}
                                  className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition text-sm"
                                >
                                  حذف
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white border rounded-lg p-4 mt-6">
                <div className="text-sm text-gray-600">
                  عرض {startIndex + 1}-{Math.min(endIndex, totalResults)} من {totalResults} مؤسسة
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {getPageNumbers().map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-1 border rounded-md text-sm transition ${
                        currentPage === pageNum 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="p-2 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">لا توجد مؤسسات تطابق معايير البحث</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
              >
                مسح الفلاتر وعرض الكل
              </button>
            )}
          </div>
        )}

        {/* Add/Edit Company Modal */}
        {(showAddModal || showEditModal) && (
          <CompanyModal
            isOpen={showAddModal || showEditModal}
            company={selectedCompany}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
          />
        )}

        {/* Company Detail Modal */}
        {showCompanyDetailModal && selectedCompanyForDetail && (
          <CompanyDetailModal
            company={selectedCompanyForDetail}
            onClose={handleCloseCompanyDetailModal}
            onEdit={handleEditCompany}
            onDelete={handleDeleteCompany}
            getAvailableSlotsColor={getAvailableSlotsColor}
            getAvailableSlotsTextColor={getAvailableSlotsTextColor}
            getAvailableSlotsText={getAvailableSlotsText}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-100 p-3 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">تأكيد الحذف</h3>
                    <p className="text-sm text-gray-600">هذا الإجراء لا يمكن التراجع عنه</p>
                  </div>
                </div>
                <p className="text-gray-700 mb-6">
                  هل أنت متأكد من حذف مؤسسة "<strong>{selectedCompany?.name}</strong>"؟
                  <br />
                  <span className="text-sm text-red-600 mt-2 block">
                    سيتم حذف جميع الموظفين المرتبطة بهذه المؤسسة أيضاً
                  </span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
                  >
                    نعم، احذف
                  </button>
                  <button
                    onClick={handleModalClose}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}