import { useEffect, useState } from 'react'
import { supabase, Company } from '../lib/supabase'
import Layout from '../components/layout/Layout'
import { Building2, Users, AlertCircle, Search, Filter, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { differenceInDays } from 'date-fns'

type SortField = 'name' | 'company_type' | 'created_at' | 'commercial_registration_status' | 'insurance_subscription_status'
type SortDirection = 'asc' | 'desc'
type CommercialRegStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type InsuranceStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type DateRange = 'all' | 'last_month' | 'last_3_months' | 'last_year' | 'custom'

export default function Companies() {
  const [companies, setCompanies] = useState<(Company & { employee_count: number })[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<(Company & { employee_count: number })[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [companyTypeFilter, setCompanyTypeFilter] = useState<string>('all')
  const [commercialRegStatus, setCommercialRegStatus] = useState<CommercialRegStatus>('all')
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus>('all')
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
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      if (companiesError) throw companiesError

      const companiesWithCount = await Promise.all(
        (companiesData || []).map(async (company) => {
          const { count } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)

          return { ...company, employee_count: count || 0 }
        })
      )

      setCompanies(companiesWithCount)

      // Extract unique company types
      const typesSet = new Set<string>()
      companiesWithCount.forEach(company => {
        if (company.company_type) {
          typesSet.add(company.company_type)
        }
        if (company.additional_fields?.company_type) {
          typesSet.add(company.additional_fields.company_type)
        }
        if (company.additional_fields?.type) {
          typesSet.add(company.additional_fields.type)
        }
      })
      setCompanyTypes(Array.from(typesSet).sort())
    } catch (error) {
      console.error('Error loading companies:', error)
    } finally {
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
      const today = new Date()
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      filtered = filtered.filter(company => {
        if (!company.commercial_registration_expiry) return false
        const expiryDate = new Date(company.commercial_registration_expiry)

        if (commercialRegStatus === 'expired') return expiryDate < today
        if (commercialRegStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
        if (commercialRegStatus === 'valid') return expiryDate > thirtyDaysLater
        return true
      })
    }

    // Apply insurance status filter
    if (insuranceStatus !== 'all') {
      const today = new Date()
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      filtered = filtered.filter(company => {
        if (!company.insurance_subscription_expiry) return false
        const expiryDate = new Date(company.insurance_subscription_expiry)

        if (insuranceStatus === 'expired') return expiryDate < today
        if (insuranceStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
        if (insuranceStatus === 'valid') return expiryDate > thirtyDaysLater
        return true
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
          aValue = a.commercial_registration_expiry ? getDaysRemaining(a.commercial_registration_expiry) : -999999
          bValue = b.commercial_registration_expiry ? getDaysRemaining(b.commercial_registration_expiry) : -999999
          break
        case 'insurance_subscription_status':
          aValue = a.insurance_subscription_expiry ? getDaysRemaining(a.insurance_subscription_expiry) : -999999
          bValue = b.insurance_subscription_expiry ? getDaysRemaining(b.insurance_subscription_expiry) : -999999
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

  const getStatusColor = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-50'
    if (days <= 30) return 'text-orange-600 bg-orange-50'
    return 'text-green-600 bg-green-50'
  }

  const clearFilters = () => {
    setSearchTerm('')
    setCompanyTypeFilter('all')
    setCommercialRegStatus('all')
    setInsuranceStatus('all')
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

  const activeFiltersCount = [
    searchTerm !== '',
    companyTypeFilter !== 'all',
    commercialRegStatus !== 'all',
    insuranceStatus !== 'all',
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}
          </button>
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
                    placeholder="ابحث بالاسم أو الرقم التأميني أو الموحد..."
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
                  <option value="expired">منتهي</option>
                  <option value="expiring_soon">قريب الانتهاء (30 يوم)</option>
                  <option value="valid">ساري</option>
                </select>
              </div>

              {/* Insurance Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حالة التأمين</label>
                <select
                  value={insuranceStatus}
                  onChange={(e) => setInsuranceStatus(e.target.value as InsuranceStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">الكل</option>
                  <option value="expired">منتهي</option>
                  <option value="expiring_soon">قريب الانتهاء (30 يوم)</option>
                  <option value="valid">ساري</option>
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
                  حالة التأمين
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Companies Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredCompanies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => {
              const commercialRegDays = company.commercial_registration_expiry 
                ? getDaysRemaining(company.commercial_registration_expiry)
                : null
              const insuranceDays = company.insurance_subscription_expiry
                ? getDaysRemaining(company.insurance_subscription_expiry)
                : null

              return (
                <div key={company.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-700">{company.employee_count} موظف</span>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{company.name}</h3>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">الرقم الموحد:</span>
                      <span className="font-mono text-gray-900">{company.unified_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">الرقم التأميني:</span>
                      <span className="font-mono text-gray-900">{company.tax_number}</span>
                    </div>
                    {company.labor_subscription_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">رقم اشتراك قوى:</span>
                        <span className="font-mono text-gray-900">{company.labor_subscription_number}</span>
                      </div>
                    )}
                    {(company.company_type || company.additional_fields?.company_type) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">نوع المؤسسة:</span>
                        <span className="text-gray-900">{company.company_type || company.additional_fields?.company_type}</span>
                      </div>
                    )}
                  </div>

                  {/* Status Badges */}
                  <div className="space-y-2 pt-4 border-t border-gray-200">
                    {commercialRegDays !== null && (
                      <div className={`px-3 py-2 rounded-md text-sm font-medium ${getStatusColor(commercialRegDays)}`}>
                        السجل التجاري: {commercialRegDays < 0 ? `منتهي منذ ${Math.abs(commercialRegDays)} يوم` : `باقي ${commercialRegDays} يوم`}
                      </div>
                    )}
                    {insuranceDays !== null && (
                      <div className={`px-3 py-2 rounded-md text-sm font-medium ${getStatusColor(insuranceDays)}`}>
                        التأمينات: {insuranceDays < 0 ? `منتهي منذ ${Math.abs(insuranceDays)} يوم` : `باقي ${insuranceDays} يوم`}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
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
      </div>
    </Layout>
  )
}
