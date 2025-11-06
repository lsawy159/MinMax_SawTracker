import { useEffect, useState } from 'react'
import { supabase, Company } from '../lib/supabase'
import Layout from '../components/layout/Layout'
import CompanyModal from '../components/companies/CompanyModal'
import CompanyCard from '../components/companies/CompanyCard'
import { Building2, Users, AlertCircle, Search, Filter, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { 
  calculateCommercialRegistrationStatus, 
  calculateInsuranceSubscriptionStatus,
  calculateCompanyStatusStats
} from '../utils/autoCompanyStatus'

type SortField = 'name' | 'company_type' | 'created_at' | 'commercial_registration_status' | 'insurance_subscription_status' | 'employee_count' | 'power_subscription_status' | 'moqeem_subscription_status'
type SortDirection = 'asc' | 'desc'
type CommercialRegStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type InsuranceStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type PowerSubscriptionStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type MoqeemSubscriptionStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'

type EmployeeCountFilter = 'all' | '1' | '2' | '3' | '4+'
type AvailableSlotsFilter = 'all' | '1' | '2' | '3' | '4+'
type DateRange = 'all' | 'last_month' | 'last_3_months' | 'last_year' | 'custom'

export default function Companies() {
  const [companies, setCompanies] = useState<(Company & { employee_count: number; available_slots?: number })[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<(Company & { employee_count: number; available_slots?: number })[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [companyTypeFilter, setCompanyTypeFilter] = useState<string>('all')
  const [commercialRegStatus, setCommercialRegStatus] = useState<CommercialRegStatus>('all')
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus>('all')
  const [powerSubscriptionStatus, setPowerSubscriptionStatus] = useState<PowerSubscriptionStatus>('all')
  const [moqeemSubscriptionStatus, setMoqeemSubscriptionStatus] = useState<MoqeemSubscriptionStatus>('all')

  const [employeeCountFilter, setEmployeeCountFilter] = useState<EmployeeCountFilter>('all')
  const [availableSlotsFilter, setAvailableSlotsFilter] = useState<AvailableSlotsFilter>('all')
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  // Sort states
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Company types list
  const [companyTypes, setCompanyTypes] = useState<string[]>([])

  useEffect(() => {
    loadCompanies()
    // Load saved filters from localStorage
    loadSavedFilters()
  }, [])

  useEffect(() => {
    applyFiltersAndSort()
    // Save filters to localStorage
    saveFiltersToStorage()
  }, [
    companies,
    searchTerm,
    companyTypeFilter,
    commercialRegStatus,
    insuranceStatus,
    powerSubscriptionStatus,
    moqeemSubscriptionStatus,
    employeeCountFilter,
    availableSlotsFilter,
    dateRangeFilter,
    customStartDate,
    customEndDate,
    sortField,
    sortDirection
  ])

  const loadSavedFilters = () => {
    try {
      const saved = localStorage.getItem('companiesFilters')
      if (saved) {
        const filters = JSON.parse(saved)
        setSearchTerm(filters.searchTerm || '')
        setCompanyTypeFilter(filters.companyTypeFilter || 'all')
        setCommercialRegStatus(filters.commercialRegStatus || 'all')
        setInsuranceStatus(filters.insuranceStatus || 'all')
        setPowerSubscriptionStatus(filters.powerSubscriptionStatus || 'all')
        setMoqeemSubscriptionStatus(filters.moqeemSubscriptionStatus || 'all')

        setEmployeeCountFilter(filters.employeeCountFilter || 'all')
        setAvailableSlotsFilter(filters.availableSlotsFilter || 'all')
        setDateRangeFilter(filters.dateRangeFilter || 'all')
        setSortField(filters.sortField || 'name')
        setSortDirection(filters.sortDirection || 'asc')
      }
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }

  const saveFiltersToStorage = () => {
    try {
      const filters = {
        searchTerm,
        companyTypeFilter,
        commercialRegStatus,
        insuranceStatus,
        powerSubscriptionStatus,
        moqeemSubscriptionStatus,

        employeeCountFilter,
        availableSlotsFilter,
        dateRangeFilter,
        sortField,
        sortDirection
      }
      localStorage.setItem('companiesFilters', JSON.stringify(filters))
    } catch (error) {
      console.error('Error saving filters:', error)
    }
  }

  const loadCompanies = async () => {
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
        setCompanyTypes([])
        return
      }

      console.log(`🏢 [DEBUG] Processing ${companiesData.length} companies...`)
      
      const companiesWithCount = await Promise.all(
        (companiesData || []).map(async (company) => {
          try {
            console.log(`👥 [DEBUG] Counting employees for company: ${company.name} (ID: ${company.id})`)
            
            const { count, error: countError } = await supabase
              .from('employees')
              .select('*', { count: 'exact', head: true })
              .eq('company_id', company.id)

            if (countError) {
              console.error(`❌ [DEBUG] Error counting employees for company ${company.id}:`, countError)
            }

            const employeeCount = count || 0
            const maxEmployees = company.max_employees || 4 // افتراضي 4 موظفين كحد أقصى
            const availableSlots = Math.max(0, maxEmployees - employeeCount)

            console.log(`✅ [DEBUG] Company ${company.name}: ${employeeCount} employees, ${availableSlots} available slots`)

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
      )

      console.log('💾 [DEBUG] Setting companies data:', companiesWithCount.length, 'companies')
      setCompanies(companiesWithCount)

      // Extract unique company types
      console.log('🏷️ [DEBUG] Extracting company types...')
      const typesSet = new Set<string>()
      companiesWithCount.forEach(company => {
        if (company?.company_type) {
          typesSet.add(company.company_type)
        }
        if (company?.additional_fields?.company_type) {
          typesSet.add(company.additional_fields.company_type)
        }
        if (company?.additional_fields?.type) {
          typesSet.add(company.additional_fields.type)
        }
      })
      
      const sortedTypes = Array.from(typesSet).sort()
      console.log('🏷️ [DEBUG] Company types extracted:', sortedTypes)
      setCompanyTypes(sortedTypes)

      console.log(`✅ [DEBUG] Successfully loaded ${companiesWithCount.length} companies with ${sortedTypes.length} types`)
      
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
      setCompanyTypes([])
    } finally {
      console.log('🏁 [DEBUG] loadCompanies completed, setting loading to false')
      setLoading(false)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = [...companies]

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(company =>
        company.name.toLowerCase().includes(searchLower) ||
        company.tax_number?.toString().includes(searchLower) ||
        company.unified_number?.toString().includes(searchLower)
      )
    }

    // Apply company type filter
    if (companyTypeFilter !== 'all') {
      filtered = filtered.filter(company =>
        company.company_type === companyTypeFilter ||
        company.additional_fields?.company_type === companyTypeFilter ||
        company.additional_fields?.type === companyTypeFilter
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

    // Apply insurance status filter
    if (insuranceStatus !== 'all') {
      filtered = filtered.filter(company => {
        const statusInfo = calculateInsuranceSubscriptionStatus(company.insurance_subscription_expiry)

        if (insuranceStatus === 'expired') return statusInfo.status === 'منتهي'
        if (insuranceStatus === 'expiring_soon') return statusInfo.status === 'حرج' || statusInfo.status === 'متوسط'
        if (insuranceStatus === 'valid') return statusInfo.status === 'ساري'
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

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'company_type':
          aValue = a.company_type || a.additional_fields?.company_type || ''
          bValue = b.company_type || b.additional_fields?.company_type || ''
          break
        case 'created_at':
          aValue = a.created_at ? new Date(a.created_at).getTime() : 0
          bValue = b.created_at ? new Date(b.created_at).getTime() : 0
          break
        case 'commercial_registration_status':
          aValue = a.commercial_registration_expiry ? calculateCommercialRegistrationStatus(a.commercial_registration_expiry).daysRemaining : -999999
          bValue = b.commercial_registration_expiry ? calculateCommercialRegistrationStatus(b.commercial_registration_expiry).daysRemaining : -999999
          break
        case 'insurance_subscription_status':
          aValue = a.insurance_subscription_expiry ? calculateInsuranceSubscriptionStatus(a.insurance_subscription_expiry).daysRemaining : -999999
          bValue = b.insurance_subscription_expiry ? calculateInsuranceSubscriptionStatus(b.insurance_subscription_expiry).daysRemaining : -999999
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
  }

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
    setCompanyTypeFilter('all')
    setCommercialRegStatus('all')
    setInsuranceStatus('all')
    setPowerSubscriptionStatus('all')
    setMoqeemSubscriptionStatus('all')

    setEmployeeCountFilter('all')
    setAvailableSlotsFilter('all')
    setDateRangeFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
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

  const handleDeleteConfirm = async () => {
    if (!selectedCompany) return

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id)

      if (error) throw error

      // Log activity
      await supabase.from('activity_logs').insert({
        action: 'حذف مؤسسة',
        entity_type: 'company',
        entity_id: selectedCompany.id,
        details: { company_name: selectedCompany.name }
      })

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

  const handleModalSuccess = () => {
    handleModalClose()
    loadCompanies()
  }

  const activeFiltersCount = [
    searchTerm !== '',
    companyTypeFilter !== 'all',
    commercialRegStatus !== 'all',
    insuranceStatus !== 'all',
    powerSubscriptionStatus !== 'all',
    moqeemSubscriptionStatus !== 'all',

    employeeCountFilter !== 'all',
    availableSlotsFilter !== 'all',
    dateRangeFilter !== 'all'
  ].filter(Boolean).length

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">إدارة المؤسسات</h1>
            <p className="text-sm text-gray-600 mt-1">
              عرض {filteredCompanies.length} من {companies.length} مؤسسة
              {activeFiltersCount > 0 && (
                <span className="mr-2 text-blue-600 font-medium">
                  ({activeFiltersCount} فلتر نشط)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAddCompany}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
            >
              <Building2 className="w-4 h-4" />
              إضافة مؤسسة
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}
            </button>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البحث</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث بالاسم أو رقم اشتراك التأمينات أو الرقم الموحد..."
                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Company Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المؤسسة</label>
                <select
                  value={companyTypeFilter}
                  onChange={(e) => setCompanyTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">الكل</option>
                  {companyTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Commercial Registration Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حالة التسجيل التجاري</label>
                <select
                  value={commercialRegStatus}
                  onChange={(e) => setCommercialRegStatus(e.target.value as CommercialRegStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">الكل</option>
                  <option value="expired">منتهي الصلاحية</option>
                  <option value="expiring_soon">أقل من 60 يوم</option>
                  <option value="valid">أكثر من 60 يوم</option>
                </select>
              </div>

              {/* Insurance Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حالة اشتراك التأمينات</label>
                <select
                  value={insuranceStatus}
                  onChange={(e) => setInsuranceStatus(e.target.value as InsuranceStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">الكل</option>
                  <option value="expired">منتهي الصلاحية</option>
                  <option value="expiring_soon">أقل من 60 يوم</option>
                  <option value="valid">أكثر من 60 يوم</option>
                </select>
              </div>

              {/* Power Subscription Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حالة اشتراك قوى</label>
                <select
                  value={powerSubscriptionStatus}
                  onChange={(e) => setPowerSubscriptionStatus(e.target.value as PowerSubscriptionStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">الكل</option>
                  <option value="expired">منتهي</option>
                  <option value="expiring_soon">قريب الانتهاء (30 يوم)</option>
                  <option value="valid">ساري</option>
                </select>
              </div>

              {/* Moqeem Subscription Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حالة اشتراك مقيم</label>
                <select
                  value={moqeemSubscriptionStatus}
                  onChange={(e) => setMoqeemSubscriptionStatus(e.target.value as MoqeemSubscriptionStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">الكل</option>
                  <option value="expired">منتهي</option>
                  <option value="expiring_soon">قريب الانتهاء (30 يوم)</option>
                  <option value="valid">ساري</option>
                </select>
              </div>



              {/* Employee Count Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">عدد الموظفين</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">الأماكن الشاغرة</label>
                <select
                  value={availableSlotsFilter}
                  onChange={(e) => setAvailableSlotsFilter(e.target.value as AvailableSlotsFilter)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">الكل</option>
                  <option value="1">مكان واحد شاغر</option>
                  <option value="2">مكانين شاغرين</option>
                  <option value="3">ثلاثة أماكن شاغرة</option>
                  <option value="4+">أربعة أماكن فأكثر</option>
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">فلتر التاريخ</label>
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

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  disabled={activeFiltersCount === 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                  مسح جميع الفلاتر
                </button>
              </div>

              {/* Custom Date Range */}
              {dateRangeFilter === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
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

            {/* Sort Buttons */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">الترتيب حسب:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSort('name')}
                  className={`px-3 py-1.5 rounded-md border transition flex items-center gap-1 text-sm ${
                    sortField === 'name' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getSortIcon('name')}
                  الاسم
                </button>
                <button
                  onClick={() => handleSort('company_type')}
                  className={`px-3 py-1.5 rounded-md border transition flex items-center gap-1 text-sm ${
                    sortField === 'company_type' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getSortIcon('company_type')}
                  نوع المؤسسة
                </button>
                <button
                  onClick={() => handleSort('created_at')}
                  className={`px-3 py-1.5 rounded-md border transition flex items-center gap-1 text-sm ${
                    sortField === 'created_at' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getSortIcon('created_at')}
                  تاريخ التسجيل
                </button>
                <button
                  onClick={() => handleSort('commercial_registration_status')}
                  className={`px-3 py-1.5 rounded-md border transition flex items-center gap-1 text-sm ${
                    sortField === 'commercial_registration_status' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getSortIcon('commercial_registration_status')}
                  حالة التسجيل التجاري
                </button>
                <button
                  onClick={() => handleSort('insurance_subscription_status')}
                  className={`px-3 py-1.5 rounded-md border transition flex items-center gap-1 text-sm ${
                    sortField === 'insurance_subscription_status' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getSortIcon('insurance_subscription_status')}
                  حالة اشتراك التأمينات
                </button>
                <button
                  onClick={() => handleSort('employee_count')}
                  className={`px-3 py-1.5 rounded-md border transition flex items-center gap-1 text-sm ${
                    sortField === 'employee_count' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getSortIcon('employee_count')}
                  عدد الموظفين
                </button>
                <button
                  onClick={() => handleSort('power_subscription_status')}
                  className={`px-3 py-1.5 rounded-md border transition flex items-center gap-1 text-sm ${
                    sortField === 'power_subscription_status' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getSortIcon('power_subscription_status')}
                  حالة اشتراك قوى
                </button>
                <button
                  onClick={() => handleSort('moqeem_subscription_status')}
                  className={`px-3 py-1.5 rounded-md border transition flex items-center gap-1 text-sm ${
                    sortField === 'moqeem_subscription_status' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {getSortIcon('moqeem_subscription_status')}
                  حالة اشتراك مقيم
                </button>

              </div>
            </div>
          </div>
        )}

        {/* Commercial Registration Statistics Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              إحصائيات السجل التجاري
            </h3>
          </div>
          {(() => {
            const stats = calculateCompanyStatusStats(companies.map(c => ({
              id: c.id,
              name: c.name,
              commercial_registration_expiry: c.commercial_registration_expiry,
              insurance_subscription_expiry: c.insurance_subscription_expiry
            })))
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* إجمالي المؤسسات */}
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</div>
                  <div className="text-sm text-gray-600">إجمالي المؤسسات</div>
                </div>
                
                {/* ساري */}
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-700">{stats.commercialRegStats.valid}</div>
                  <div className="text-sm text-green-600">ساري ({stats.commercialRegStats.percentageValid}%)</div>
                </div>
                
                {/* متوسطة الأهمية */}
                <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-700">{stats.commercialRegStats.medium}</div>
                  <div className="text-sm text-yellow-600">متوسطة الأهمية ({stats.commercialRegStats.percentageMedium}%)</div>
                </div>
                
                {/* حرج/منتهي */}
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-700">{stats.commercialRegStats.critical + stats.commercialRegStats.expired}</div>
                  <div className="text-sm text-red-600">حرج/منتهي ({stats.commercialRegStats.percentageCritical + stats.commercialRegStats.percentageExpired}%)</div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Companies Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCompanies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                onEdit={handleEditCompany}
                onDelete={handleDeleteCompany}
                getAvailableSlotsColor={getAvailableSlotsColor}
                getAvailableSlotsTextColor={getAvailableSlotsTextColor}
                getAvailableSlotsText={getAvailableSlotsText}
              />
            ))}
          </div>
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
