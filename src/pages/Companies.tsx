import { useEffect, useState, useCallback, useRef, useMemo, type CSSProperties } from 'react' // [FIX] تم إضافة useCallback و useMemo
import { supabase, Company } from '@/lib/supabase'
import Layout from '@/components/layout/Layout'
import CompanyModal from '@/components/companies/CompanyModal'
import CompanyCard from '@/components/companies/CompanyCard'
import CompanyDetailModal from '@/components/companies/CompanyDetailModal'
import {
  Building2,
  AlertCircle,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { usePermissions } from '@/utils/permissions'
import { logger } from '@/utils/logger'
import { useLocation } from 'react-router-dom'
import { useIsMobileView } from '@/hooks/useIsMobileView'
import { useCardColumns } from '@/hooks/useUiPreferences'
import { normalizeArabic } from '@/utils/textUtils'
import { PageHeader } from '@/components/ui/PageHeader'
import { FilterBar } from '@/components/ui/FilterBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/button'
import {
  calculateCommercialRegistrationStatus,
  calculatePowerSubscriptionStatus,
  calculateMoqeemSubscriptionStatus,
  calculateCompanyStatusStats,
} from '@/utils/autoCompanyStatus'

type SortField =
  | 'name'
  | 'created_at'
  | 'commercial_registration_status'
  | 'employee_count'
  | 'power_subscription_status'
  | 'moqeem_subscription_status'
type SortDirection = 'asc' | 'desc'
type CommercialRegStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type PowerSubscriptionStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type MoqeemSubscriptionStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'

type EmployeeCountFilter = 'all' | '1' | '2' | '3' | '4+'
type AvailableSlotsFilter = 'all' | '0' | '1' | '2' | '3' | '4+'
type DateRange = 'all' | 'last_month' | 'last_3_months' | 'last_year' | 'custom'
type ExemptionsFilter = 'all' | 'تم الاعفاء' | 'لم يتم الاعفاء' | 'أخرى'
type ViewMode = 'grid' | 'table'

export default function Companies() {
  const { canView, canCreate, canEdit, canDelete } = usePermissions()
  const location = useLocation()
  const isMobileView = useIsMobileView()
  const [companies, setCompanies] = useState<
    (Company & { employee_count: number; available_slots?: number })[]
  >([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCompanyDetailModal, setShowCompanyDetailModal] = useState(false)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false) // New state for bulk delete modal
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedCompanyForDetail, setSelectedCompanyForDetail] = useState<
    (Company & { employee_count: number; available_slots?: number }) | null
  >(null)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]) // New state for selected company IDs

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [commercialRegStatus, setCommercialRegStatus] = useState<CommercialRegStatus>('all')
  const [powerSubscriptionStatus, setPowerSubscriptionStatus] =
    useState<PowerSubscriptionStatus>('all')
  const [moqeemSubscriptionStatus, setMoqeemSubscriptionStatus] =
    useState<MoqeemSubscriptionStatus>('all')
  const [showAlertsOnly, setShowAlertsOnly] = useState(false)

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
  const { gridClass: companyGridClass } = useCardColumns()

  // حالة التنقل بالسهام
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  // [FIX] تم تغليف الدالة بـ useCallback
  const loadSavedFilters = useCallback(() => {
    try {
      const saved = localStorage.getItem('companiesFilters')
      if (saved) {
        const filters = JSON.parse(saved)
        setSearchTerm(filters.searchTerm || '')
        setCommercialRegStatus(filters.commercialRegStatus || 'all')
        setPowerSubscriptionStatus(filters.powerSubscriptionStatus || 'all')
        setMoqeemSubscriptionStatus(filters.moqeemSubscriptionStatus || 'all')
        setShowAlertsOnly(filters.showAlertsOnly || false)

        setEmployeeCountFilter(filters.employeeCountFilter || 'all')
        setAvailableSlotsFilter(filters.availableSlotsFilter || 'all')
        setDateRangeFilter(filters.dateRangeFilter || 'all')
        setExemptionsFilter(filters.exemptionsFilter || 'all')
        setSortField(filters.sortField || 'name')
        setSortDirection(filters.sortDirection || 'asc')
      }
    } catch (error) {
      logger.error('Error loading saved filters:', error)
    }
  }, []) // <-- [FIX] مصفوفة اعتماديات فارغة لأنها لا تعتمد على state

  // [FIX] تم تغليف الدالة بـ useCallback
  const saveFiltersToStorage = useCallback(() => {
    try {
      const filters = {
        searchTerm,
        commercialRegStatus,
        powerSubscriptionStatus,
        moqeemSubscriptionStatus,
        showAlertsOnly,

        employeeCountFilter,
        availableSlotsFilter,
        dateRangeFilter,
        exemptionsFilter,
        sortField,
        sortDirection,
      }
      localStorage.setItem('companiesFilters', JSON.stringify(filters))
    } catch (error) {
      logger.error('Error saving filters:', error)
    }
  }, [
    // <-- [FIX] إضافة جميع الاعتماديات التي تستخدمها الدالة
    searchTerm,
    commercialRegStatus,
    powerSubscriptionStatus,
    moqeemSubscriptionStatus,
    showAlertsOnly,
    employeeCountFilter,
    availableSlotsFilter,
    dateRangeFilter,
    exemptionsFilter,
    sortField,
    sortDirection,
  ])

  // [FIX] تم تغليف الدالة بـ useCallback
  const loadCompanies = useCallback(async () => {
    logger.debug('Starting loadCompanies...')

    try {
      logger.debug('Fetching companies from database...')
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(
          'id,name,unified_number,labor_subscription_number,commercial_registration_expiry,social_insurance_number,commercial_registration_status,additional_fields,ending_subscription_power_date,ending_subscription_moqeem_date,employee_count,max_employees,notes,exemptions,company_type,created_at,updated_at'
        )
        .order('name')

      logger.debug('📋 [DEBUG] Companies data fetched:', {
        data: companiesData,
        error: companiesError,
        dataLength: companiesData?.length || 0,
      })

      if (companiesError) {
        logger.error('Companies fetch error:', companiesError)
        throw companiesError
      }

      // معالجة البيانات null/undefined
      if (!companiesData) {
        logger.warn('No companies data received, setting empty array')
        setCompanies([])
        return
      }

      logger.debug(`Processing ${companiesData.length} companies...`)

      // [OPTIMIZATION] جلب عدد الموظفين لكل الشركات باستعلام واحد بدلاً من 133 استعلام
      logger.debug('Fetching employee counts for all companies in a single query...')
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('company_id')

      if (employeesError) {
        logger.error('Error fetching employees:', employeesError)
        throw employeesError
      }

      // حساب عدد الموظفين لكل شركة
      const employeeCounts: Record<string, number> = {}
      employeesData?.forEach((emp) => {
        if (emp.company_id) {
          employeeCounts[emp.company_id] = (employeeCounts[emp.company_id] || 0) + 1
        }
      })

      logger.debug(`Employee counts calculated for ${Object.keys(employeeCounts).length} companies`)

      // دمج البيانات
      const companiesWithCount = (companiesData || []).map((company) => {
        try {
          const employeeCount = employeeCounts[company.id] || 0
          const maxEmployees = company.max_employees || 4 // افتراضي 4 موظفين كحد أقصى
          const availableSlots = Math.max(0, maxEmployees - employeeCount)

          return { ...company, employee_count: employeeCount, available_slots: availableSlots }
        } catch (companyError) {
          logger.error(`Error processing company ${company.id}:`, companyError)
          return {
            ...company,
            employee_count: 0,
            available_slots: company.max_employees || 4,
          }
        }
      })

      logger.debug('Setting companies data:', companiesWithCount.length, 'companies')
      setCompanies(companiesWithCount)

      logger.debug(`Successfully loaded ${companiesWithCount.length} companies`)
    } catch (error) {
      logger.error('Critical error in loadCompanies:', error)
      console.error('❌ [DEBUG] Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      })

      // في حالة الخطأ، قم بمسح البيانات وتعيين قائمة فارغة
      setCompanies([])
    } finally {
      logger.debug('loadCompanies completed, setting loading to false')
      setLoading(false)
    }
  }, []) // <-- [FIX] مصفوفة فارغة لأنها لا تعتمد على state (setters مستقرة)

  // Helper function for calculating days remaining
  const getDaysRemaining = useCallback((date: string) => {
    return differenceInDays(new Date(date), new Date())
  }, [])

  const hasCompanyAlert = useCallback((company: Company): boolean => {
    const crStatus = calculateCommercialRegistrationStatus(company.commercial_registration_expiry)
    const powerStatus = calculatePowerSubscriptionStatus(company.ending_subscription_power_date)
    const moqeemStatus = calculateMoqeemSubscriptionStatus(company.ending_subscription_moqeem_date)

    return [crStatus, powerStatus, moqeemStatus].some((status) =>
      ['منتهي', 'طارئ', 'عاجل', 'متوسط'].includes(status.status)
    )
  }, [])

  const companyAlertsCount = useMemo(() => {
    return companies.filter((company) => hasCompanyAlert(company)).length
  }, [companies, hasCompanyAlert])

  // [FIX] تم تحويلها إلى useMemo بدلاً من useState + useEffect
  const filteredCompanies = useMemo(() => {
    let filtered = [...companies]

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (company) =>
          company.name.toLowerCase().includes(searchLower) ||
          company.unified_number?.toString().includes(searchLower) ||
          company.social_insurance_number?.toString().includes(searchLower)
      )
    }

    // Apply commercial registration status filter
    if (commercialRegStatus !== 'all') {
      filtered = filtered.filter((company) => {
        const statusInfo = calculateCommercialRegistrationStatus(
          company.commercial_registration_expiry
        )

        if (commercialRegStatus === 'expired') return statusInfo.status === 'منتهي'
        if (commercialRegStatus === 'expiring_soon')
          return (
            statusInfo.status === 'طارئ' ||
            statusInfo.status === 'عاجل' ||
            statusInfo.status === 'متوسط'
          )
        if (commercialRegStatus === 'valid') return statusInfo.status === 'ساري'
        return true
      })
    }

    // Apply power subscription status filter
    if (powerSubscriptionStatus !== 'all') {
      const today = new Date()
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      filtered = filtered.filter((company) => {
        if (!company.ending_subscription_power_date) return false
        const expiryDate = new Date(company.ending_subscription_power_date)

        if (powerSubscriptionStatus === 'expired') return expiryDate < today
        if (powerSubscriptionStatus === 'expiring_soon')
          return expiryDate >= today && expiryDate <= thirtyDaysLater
        if (powerSubscriptionStatus === 'valid') return expiryDate > thirtyDaysLater
        return true
      })
    }

    // Apply moqeem subscription status filter
    if (moqeemSubscriptionStatus !== 'all') {
      const today = new Date()
      const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      filtered = filtered.filter((company) => {
        if (!company.ending_subscription_moqeem_date) return false
        const expiryDate = new Date(company.ending_subscription_moqeem_date)

        if (moqeemSubscriptionStatus === 'expired') return expiryDate < today
        if (moqeemSubscriptionStatus === 'expiring_soon')
          return expiryDate >= today && expiryDate <= thirtyDaysLater
        if (moqeemSubscriptionStatus === 'valid') return expiryDate > thirtyDaysLater
        return true
      })
    }

    // Apply alerts filter
    if (showAlertsOnly) {
      filtered = filtered.filter((company) => hasCompanyAlert(company))
    }

    // Apply employee count filter
    if (employeeCountFilter !== 'all') {
      filtered = filtered.filter((company) => {
        const count = company.employee_count
        if (employeeCountFilter === '4+') return count >= 4
        return count === parseInt(employeeCountFilter)
      })
    }

    // Apply available slots filter
    if (availableSlotsFilter !== 'all') {
      filtered = filtered.filter((company) => {
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
        filtered = filtered.filter((company) => {
          if (!company.created_at) return false
          const createdDate = new Date(company.created_at)
          return createdDate >= startDate! && createdDate <= endDate!
        })
      }
    }

    // Apply exemptions filter
    if (exemptionsFilter !== 'all') {
      filtered = filtered.filter((company) => {
        const targetPhrase = normalizeArabic('تم الاعفاء')
        const normalizedValue = normalizeArabic(company.exemptions)
        const isExempt = normalizedValue.includes(targetPhrase)

        if (exemptionsFilter === 'تم الاعفاء') {
          return isExempt
        }

        return !isExempt
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

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
          aValue = a.commercial_registration_expiry
            ? calculateCommercialRegistrationStatus(a.commercial_registration_expiry).daysRemaining
            : -999999
          bValue = b.commercial_registration_expiry
            ? calculateCommercialRegistrationStatus(b.commercial_registration_expiry).daysRemaining
            : -999999
          break
        case 'employee_count':
          aValue = a.employee_count || 0
          bValue = b.employee_count || 0
          break
        case 'power_subscription_status':
          aValue = a.ending_subscription_power_date
            ? getDaysRemaining(a.ending_subscription_power_date)
            : -999999
          bValue = b.ending_subscription_power_date
            ? getDaysRemaining(b.ending_subscription_power_date)
            : -999999
          break
        case 'moqeem_subscription_status':
          aValue = a.ending_subscription_moqeem_date
            ? getDaysRemaining(a.ending_subscription_moqeem_date)
            : -999999
          bValue = b.ending_subscription_moqeem_date
            ? getDaysRemaining(b.ending_subscription_moqeem_date)
            : -999999
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

    return filtered
  }, [
    // <-- [FIX] إضافة جميع الاعتماديات التي تستخدمها الدالة
    companies,
    searchTerm,
    commercialRegStatus,
    powerSubscriptionStatus,
    moqeemSubscriptionStatus,
    showAlertsOnly,
    employeeCountFilter,
    availableSlotsFilter,
    dateRangeFilter,
    customStartDate,
    customEndDate,
    exemptionsFilter,
    sortField,
    sortDirection,
    getDaysRemaining,
    hasCompanyAlert,
  ])

  useEffect(() => {
    loadCompanies()
    // Load saved filters from localStorage
    loadSavedFilters()
  }, [loadCompanies, loadSavedFilters]) // <-- [FIX] تم التحديث

  // Handle URL parameters for alerts filter
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const filter = params.get('filter')

    if (filter === 'alerts') {
      // فلترة المؤسسات التي لديها تنبيهات (سجل تجاري/قوى/مقيم)
      setShowAlertsOnly(true)
    }
  }, [location.search])

  useEffect(() => {
    // Save filters to localStorage whenever filters change
    saveFiltersToStorage()
  }, [
    saveFiltersToStorage,
    searchTerm,
    commercialRegStatus,
    powerSubscriptionStatus,
    moqeemSubscriptionStatus,
    showAlertsOnly,
    employeeCountFilter,
    availableSlotsFilter,
    dateRangeFilter,
    customStartDate,
    customEndDate,
    exemptionsFilter,
    sortField,
    sortDirection,
  ])

  // دالة الحصول على لون حالة الأماكن الشاغرة
  const getAvailableSlotsColor = (availableSlots: number) => {
    if (availableSlots === 0) return 'text-red-600 bg-red-50 border-red-200'
    if (availableSlots === 1) return 'text-warning-600 bg-orange-50 border-orange-200'
    if (availableSlots <= 3) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-success-600 bg-green-50 border-green-200'
  }

  // دالة الحصول على لون النص للأماكن الشاغرة
  const getAvailableSlotsTextColor = (availableSlots: number) => {
    if (availableSlots === 0) return 'text-red-600'
    if (availableSlots === 1) return 'text-warning-600'
    if (availableSlots <= 3) return 'text-yellow-600'
    return 'text-success-600'
  }

  // دالة الحصول على وصف حالة الأماكن الشاغرة
  const getAvailableSlotsText = (availableSlots: number) => {
    if (availableSlots === 0) return 'مكتملة'
    if (availableSlots === 1) return 'مكان واحد متبقي'
    if (availableSlots <= 3) return 'أماكن قليلة متاحة'
    return 'أماكن متاحة'
  }

  const clearFilters = () => {
    setSearchTerm('')
    setCommercialRegStatus('all')
    setPowerSubscriptionStatus('all')
    setMoqeemSubscriptionStatus('all')
    setShowAlertsOnly(false)

    setEmployeeCountFilter('all')
    setAvailableSlotsFilter('all')
    setDateRangeFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setExemptionsFilter('all')
  }

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        // Toggle direction if same field
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        // Set new field with ascending order
        setSortField(field)
        setSortDirection('asc')
      }
    },
    [sortField, sortDirection]
  )

  // Handle individual company selection
  const handleSelectCompany = (companyId: string, isSelected: boolean) => {
    setSelectedCompanyIds((prev) =>
      isSelected ? [...prev, companyId] : prev.filter((id) => id !== companyId)
    )
  }

  // Handle select all companies
  const handleSelectAllCompanies = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedCompanyIds(paginatedCompanies.map((company) => company.id))
    } else {
      setSelectedCompanyIds([])
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedCompanyIds.length === 0) return

    setLoading(true)
    try {
      const { error } = await supabase.from('companies').delete().in('id', selectedCompanyIds)

      if (error) {
        throw error
      }

      toast.success(`${selectedCompanyIds.length} شركات تم حذفها بنجاح`)
      setSelectedCompanyIds([]) // Clear selection after deletion
      setShowBulkDeleteModal(false)
      loadCompanies() // Reload companies after deletion
    } catch (error) {
      logger.error('Error deleting companies in bulk:', error)
      toast.error('فشل حذف الشركات. يرجى المحاولة مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    )
  }

  const handleAddCompany = useCallback(() => {
    setSelectedCompany(null)
    setShowAddModal(true)
  }, [])

  const handleEditCompany = useCallback((company: Company) => {
    setSelectedCompany(company)
    setShowEditModal(true)
  }, [])

  const handleDeleteCompany = useCallback((company: Company) => {
    setSelectedCompany(company)
    setShowDeleteModal(true)
  }, [])

  const handleCompanyCardClick = useCallback(
    (company: Company & { employee_count: number; available_slots?: number }) => {
      setSelectedCompanyForDetail(company)
      setShowCompanyDetailModal(true)
    },
    []
  )

  const handleCloseCompanyDetailModal = useCallback(() => {
    setShowCompanyDetailModal(false)
    setSelectedCompanyForDetail(null)
    // إعادة تعيين الصف المحدد عند إغلاق المودال
    setSelectedRowIndex(null)
  }, [])

  const handleDeleteConfirm = async () => {
    if (!selectedCompany) return

    try {
      // [FIX] المرحلة الأولى: فصل جميع الموظفين (بدون حذفهم)
      logger.debug(`فصل الموظفين من المؤسسة ${selectedCompany.name}...`)
      const { data: employees, error: fetchError } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', selectedCompany.id)

      if (fetchError) throw fetchError

      if (employees && employees.length > 0) {
        // تحديث جميع الموظفين: فصلهم من المؤسسة
        const { error: updateError } = await supabase
          .from('employees')
          .update({ company_id: null })
          .eq('company_id', selectedCompany.id)

        if (updateError) throw updateError
        logger.debug(`تم فصل ${employees.length} موظف بنجاح`)
      }

      // [FIX] المرحلة الثانية: حذف المؤسسة فقط
      logger.debug(`حذف المؤسسة ${selectedCompany.name}...`)
      const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id)

      if (deleteError) throw deleteError

      // [FIX] المرحلة الثالثة: تسجيل النشاط في activity_log (عام)
      await supabase.from('activity_log').insert({
        action: 'حذف مؤسسة',
        entity_type: 'company',
        entity_id: selectedCompany.id,
        details: {
          company_name: selectedCompany.name,
          unified_number: selectedCompany.unified_number,
          employees_detached: employees?.length || 0,
        },
      })

      // إرسال event لتحديث إحصائيات التنبيهات
      window.dispatchEvent(new CustomEvent('companyUpdated'))

      // إظهار رسالة نجاح مفصلة
      const employeeCount = employees?.length || 0
      if (employeeCount > 0) {
        toast.success(
          `تم حذف المؤسسة وفصل ${employeeCount} موظف بنجاح. سيبقى الموظفون في النظام بدون تعيين`
        )
      } else {
        toast.success('تم حذف المؤسسة بنجاح')
      }

      // Refresh companies list
      await loadCompanies()
      setShowDeleteModal(false)
      setSelectedCompany(null)
    } catch (error) {
      logger.error('Error deleting company:', error)
      toast.error('حدث خطأ أثناء حذف المؤسسة. يرجى المحاولة مرة أخرى')
    }
  }

  const handleModalClose = useCallback(() => {
    setShowAddModal(false)
    setShowEditModal(false)
    setShowDeleteModal(false)
    setSelectedCompany(null)
  }, [])

  const handleModalSuccess = useCallback(async () => {
    try {
      handleModalClose()
      await loadCompanies()
    } catch (error) {
      logger.error('Error in handleModalSuccess:', error)
      // لا نعيد تحميل القائمة في حالة الخطأ - نترك المودال مفتوحاً
      toast.error('حدث خطأ أثناء تحديث القائمة')
    }
  }, [handleModalClose, loadCompanies])

  const activeFiltersCount = [
    searchTerm !== '',
    commercialRegStatus !== 'all',
    powerSubscriptionStatus !== 'all',
    moqeemSubscriptionStatus !== 'all',
    showAlertsOnly,

    employeeCountFilter !== 'all',
    availableSlotsFilter !== 'all',
    dateRangeFilter !== 'all',
    exemptionsFilter !== 'all',
  ].filter(Boolean).length

  const [showSortDropdown, setShowSortDropdown] = useState(false)

  // Pagination calculations
  const totalResults = filteredCompanies.length
  const totalPages = Math.ceil(totalResults / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCompanies = filteredCompanies.slice(startIndex, endIndex)

  // معالجة التنقل بالسهام في الجدول
  useEffect(() => {
    // لا تعمل إذا كان هناك modal مفتوح أو في وضع grid
    if (
      showAddModal ||
      showEditModal ||
      showDeleteModal ||
      showCompanyDetailModal ||
      showFiltersModal ||
      viewMode === 'grid'
    ) {
      return
    }

    function handleKeyDown(e: KeyboardEvent) {
      // التحقق من أن المستخدم لا يكتب في حقل إدخال
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return
      }

      const companiesList = paginatedCompanies
      if (companiesList.length === 0) return

      let newIndex: number | null = selectedRowIndex

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (selectedRowIndex === null) {
            newIndex = 0
          } else {
            newIndex = Math.min(selectedRowIndex + 1, companiesList.length - 1)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (selectedRowIndex === null) {
            newIndex = companiesList.length - 1
          } else {
            newIndex = Math.max(selectedRowIndex - 1, 0)
          }
          break
        case 'Home':
          e.preventDefault()
          newIndex = 0
          break
        case 'End':
          e.preventDefault()
          newIndex = companiesList.length - 1
          break
        case 'Enter':
          e.preventDefault()
          if (selectedRowIndex !== null && companiesList[selectedRowIndex]) {
            handleCompanyCardClick(companiesList[selectedRowIndex])
          }
          return
        default:
          return
      }

      if (newIndex !== null && newIndex !== selectedRowIndex) {
        setSelectedRowIndex(newIndex)
        // Scroll to view
        setTimeout(() => {
          const rowElement = rowRefs.current[newIndex]
          if (rowElement) {
            rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        }, 0)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedRowIndex,
    paginatedCompanies,
    showAddModal,
    showEditModal,
    showDeleteModal,
    showCompanyDetailModal,
    showFiltersModal,
    viewMode,
    handleCompanyCardClick,
  ])

  // إعادة تعيين الصف المحدد عند تغيير الفلاتر أو الصفحة
  useEffect(() => {
    setSelectedRowIndex(null)
  }, [
    searchTerm,
    commercialRegStatus,
    powerSubscriptionStatus,
    moqeemSubscriptionStatus,
    showAlertsOnly,
    employeeCountFilter,
    availableSlotsFilter,
    dateRangeFilter,
    exemptionsFilter,
    sortField,
    sortDirection,
    currentPage,
  ])

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

  // التحقق من صلاحية العرض
  const hasViewPermission = canView('companies')

  if (!hasViewPermission) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-danger-500" />
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">غير مصرح</h2>
            <p className="text-neutral-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="app-page app-tech-grid">
        <PageHeader
          title="المؤسسات"
          description={`عرض ${filteredCompanies.length} من ${companies.length} مؤسسة${
            activeFiltersCount > 0 ? ` (${activeFiltersCount} فلتر نشط)` : ''
          }`}
          breadcrumbs={[{ label: 'الرئيسية', href: '/dashboard' }, { label: 'المؤسسات' }]}
          className="mb-6"
          actions={
            canCreate('companies') ? (
              <Button onClick={handleAddCompany} variant="success">
                <Building2 className="w-4 h-4" />
                إضافة مؤسسة
              </Button>
            ) : undefined
          }
        />

        {/* Company Status Statistics Section - إحصائيات موحدة تشمل جميع الحالات */}
        <div className="app-panel mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-info-600" />
              إحصائيات المؤسسات (موحدة - تشمل جميع الحالات)
            </h3>
          </div>
          {(() => {
            const stats = calculateCompanyStatusStats(
              companies.map((c) => ({
                id: c.id,
                name: c.name,
                commercial_registration_expiry: c.commercial_registration_expiry,
                ending_subscription_power_date: c.ending_subscription_power_date,
                ending_subscription_moqeem_date: c.ending_subscription_moqeem_date,
              }))
            )
            return (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <div className="app-panel p-4 text-center">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.totalCompanies}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">إجمالي المؤسسات</div>
                </div>

                <div className="app-panel border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                    {stats.totalValid}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    ساري ({stats.totalValidPercentage}%)
                  </div>
                </div>

                <div className="app-panel border-amber-500/20 bg-amber-500/5 p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-300">
                    {stats.totalMedium}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    متوسط ({stats.totalMediumPercentage}%)
                  </div>
                </div>

                <div className="app-panel border-rose-500/20 bg-rose-500/5 p-4 text-center">
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-300">
                    {stats.totalCritical + stats.totalExpired}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    طارئ/منتهي ({stats.totalCriticalPercentage + stats.totalExpiredPercentage}%)
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        <FilterBar className="mb-6">
          <SearchInput
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بالاسم أو رقم اشتراك التأمينات أو الرقم الموحد..."
            wrapperClassName="min-w-[260px] flex-1"
          />

          <Button onClick={() => setShowFiltersModal(true)} className="relative">
            <Filter className="w-4 h-4" />
            <span>الفلاتر</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          <Button
            onClick={() => setShowAlertsOnly((prev) => !prev)}
            variant="secondary"
            className={`relative border-red-200 text-red-700 ${showAlertsOnly ? 'bg-red-50' : ''}`}
            title="عرض المؤسسات ذات التنبيهات فقط"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="hidden sm:inline">تنبيهات</span>
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {companyAlertsCount}
            </span>
          </Button>

          <div className="relative">
            <Button onClick={() => setShowSortDropdown(!showSortDropdown)} variant="secondary">
              {getSortIcon(sortField)}
              <span className="hidden sm:inline">الترتيب</span>
              <ArrowUpDown className="w-4 h-4" />
            </Button>

            {/* Sort Dropdown Menu */}
            {showSortDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 z-20 py-2">
                  <div className="px-3 py-2 text-xs font-semibold text-neutral-500 border-b border-neutral-200">
                    الترتيب حسب:
                  </div>
                  {[
                    { field: 'name' as SortField, label: 'الاسم' },
                    { field: 'created_at' as SortField, label: 'تاريخ التسجيل' },
                    {
                      field: 'commercial_registration_status' as SortField,
                      label: 'حالة التسجيل التجاري',
                    },
                    { field: 'employee_count' as SortField, label: 'عدد الموظفين' },
                    { field: 'power_subscription_status' as SortField, label: 'حالة اشتراك قوى' },
                    { field: 'moqeem_subscription_status' as SortField, label: 'حالة اشتراك مقيم' },
                  ].map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => {
                        handleSort(field)
                        setShowSortDropdown(false)
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2 text-right text-sm transition hover:bg-neutral-50 ${
                        sortField === field ? 'bg-primary/10 text-slate-900' : 'text-neutral-700'
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="app-toggle-shell">
              {!isMobileView && (
                <button
                  onClick={() => setViewMode('grid')}
                  className={`app-toggle-button ${viewMode === 'grid' ? 'app-toggle-button-active' : ''}`}
                  title="عرض شبكي"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              )}
              {!isMobileView && (
                <button
                  onClick={() => setViewMode('table')}
                  className={`app-toggle-button ${viewMode === 'table' ? 'app-toggle-button-active' : ''}`}
                  title="عرض جدول"
                >
                  <List className="w-4 h-4" />
                </button>
              )}
              {isMobileView && (
                <button
                  onClick={() => setViewMode('grid')}
                  className="app-toggle-button app-toggle-button-active"
                  title="عرض شبكي"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-white/70 px-3 py-1.5 dark:bg-slate-900/70">
              <span className="text-sm text-neutral-600">عرض:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={150}>150</option>
              </select>
            </div>
          </div>
        </FilterBar>

        {/* Filters Modal */}
        {showFiltersModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity duration-[var(--motion-base)] ease-[var(--ease-out)]"
              onClick={() => setShowFiltersModal(false)}
            />

            {/* Modal Content */}
            <div className="fixed inset-0 flex items-end justify-center p-0 md:items-center md:p-4">
              <div className="w-full max-h-[92vh] max-w-4xl overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl motion-safe-enter md:rounded-2xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">الفلاتر والبحث</h2>
                    {activeFiltersCount > 0 && (
                      <p className="text-sm text-neutral-600 mt-1">{activeFiltersCount} فلتر نشط</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="touch-feedback rounded-lg p-2 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted"
                  >
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Commercial Registration Status */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        حالة التسجيل التجاري
                      </label>
                      <select
                        value={commercialRegStatus}
                        onChange={(e) =>
                          setCommercialRegStatus(e.target.value as CommercialRegStatus)
                        }
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="all">الكل</option>
                        <option value="expired">منتهي</option>
                        <option value="expiring_soon">عاجل</option>
                        <option value="valid">ساري</option>
                      </select>
                    </div>

                    {/* Power Subscription Status */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        حالة اشتراك قوى
                      </label>
                      <select
                        value={powerSubscriptionStatus}
                        onChange={(e) =>
                          setPowerSubscriptionStatus(e.target.value as PowerSubscriptionStatus)
                        }
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="all">الكل</option>
                        <option value="expired">منتهي</option>
                        <option value="expiring_soon">عاجل</option>
                        <option value="valid">ساري</option>
                      </select>
                    </div>

                    {/* Moqeem Subscription Status */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        حالة اشتراك مقيم
                      </label>
                      <select
                        value={moqeemSubscriptionStatus}
                        onChange={(e) =>
                          setMoqeemSubscriptionStatus(e.target.value as MoqeemSubscriptionStatus)
                        }
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                      >
                        <option value="all">الكل</option>
                        <option value="expired">منتهي</option>
                        <option value="expiring_soon">عاجل</option>
                        <option value="valid">ساري</option>
                      </select>
                    </div>

                    {/* Employee Count Filter */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        عدد الموظفين
                      </label>
                      <select
                        value={employeeCountFilter}
                        onChange={(e) =>
                          setEmployeeCountFilter(e.target.value as EmployeeCountFilter)
                        }
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
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
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        الأماكن الشاغرة
                      </label>
                      <select
                        value={availableSlotsFilter}
                        onChange={(e) =>
                          setAvailableSlotsFilter(e.target.value as AvailableSlotsFilter)
                        }
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
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
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        فلتر تاريخ انشاء المؤسسة
                      </label>
                      <select
                        value={dateRangeFilter}
                        onChange={(e) => setDateRangeFilter(e.target.value as DateRange)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
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
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        الاعفاءات
                      </label>
                      <select
                        value={exemptionsFilter}
                        onChange={(e) => setExemptionsFilter(e.target.value as ExemptionsFilter)}
                        className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
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
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            من تاريخ
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            إلى تاريخ
                          </label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="focus-ring-brand w-full rounded-md border border-input bg-surface px-3 py-2 text-sm transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)]"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between border-t border-border bg-muted/30 p-6">
                  <button
                    onClick={clearFilters}
                    disabled={activeFiltersCount === 0}
                    className="touch-feedback flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    مسح جميع الفلاتر
                  </button>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="touch-feedback rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-[transform,filter] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:brightness-95"
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredCompanies.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              <div className={companyGridClass}>
                {paginatedCompanies.map((company, index) => (
                  <div
                    key={company.id}
                    onClick={() => handleCompanyCardClick(company)}
                    className="stagger-item group cursor-pointer transition-transform duration-300 hover:-translate-y-0.5"
                    style={{ '--i': Math.min(index, 11) } as CSSProperties}
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
              <div className="app-panel overflow-hidden">
                {/* Bulk Action Toolbar */}
                {selectedCompanyIds.length > 0 && (
                  <div className="flex items-center justify-between border-b border-primary/30 bg-primary/10 px-6 py-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-neutral-700">
                        تم تحديد {selectedCompanyIds.length} مؤسسة
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setSelectedCompanyIds([])}
                        variant="secondary"
                        size="sm"
                      >
                        إلغاء التحديد
                      </Button>
                      {canDelete('companies') && (
                        <Button
                          onClick={() => setShowBulkDeleteModal(true)}
                          variant="destructive"
                          size="sm"
                        >
                          حذف المحدد
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
                  <table className="w-full text-sm" ref={tableRef}>
                    <thead className="sticky top-0 z-[1] bg-neutral-50 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700 w-12">
                          <input
                            type="checkbox"
                            checked={
                              selectedCompanyIds.length > 0 &&
                              selectedCompanyIds.length === paginatedCompanies.length
                            }
                            onChange={(e) => handleSelectAllCompanies(e.target.checked)}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          اسم المؤسسة
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          رقم موحد
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          رقم اشتراك التأمينات الاجتماعية
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          رقم اشتراك قوى
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          انتهاء السجل التجاري
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          حالة اشتراك قوى
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          حالة اشتراك مقيم
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          عدد الموظفين
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          الأماكن الشاغرة
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                          الإجراءات
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCompanies.map((company, index) => {
                        const commercialStatus = calculateCommercialRegistrationStatus(
                          company.commercial_registration_expiry
                        )
                        const powerStatus = calculatePowerSubscriptionStatus(
                          company.ending_subscription_power_date
                        )
                        const moqeemStatus = calculateMoqeemSubscriptionStatus(
                          company.ending_subscription_moqeem_date
                        )
                        const isSelected = selectedRowIndex === index
                        const isCompanySelected = selectedCompanyIds.includes(company.id)
                        return (
                          <tr
                            key={company.id}
                            ref={(el) => {
                              rowRefs.current[index] = el
                            }}
                            className={`cursor-pointer border-t transition hover:bg-neutral-50 ${isSelected ? 'bg-primary/10 border-l-4 border-primary' : ''}`}
                            onClick={() => handleCompanyCardClick(company)}
                          >
                            <td
                              className="px-4 py-3 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isCompanySelected}
                                onChange={(e) => handleSelectCompany(company.id, e.target.checked)}
                                className="w-4 h-4 rounded cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-neutral-900">
                              {company.name}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {company.unified_number || '-'}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {company.social_insurance_number || '-'}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {company.labor_subscription_number || '-'}
                            </td>
                            <td className="px-4 py-3">
                              {company.commercial_registration_expiry ? (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    commercialStatus.status === 'منتهي'
                                      ? 'bg-red-100 text-red-700'
                                      : commercialStatus.status === 'طارئ'
                                        ? 'bg-red-100 text-red-700'
                                        : commercialStatus.status === 'عاجل'
                                          ? 'bg-orange-100 text-warning-700'
                                          : commercialStatus.status === 'متوسط'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-green-100 text-success-700'
                                  }`}
                                >
                                  {company.commercial_registration_expiry}
                                </span>
                              ) : (
                                <span className="text-neutral-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {company.ending_subscription_power_date ? (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    powerStatus.status === 'منتهي'
                                      ? 'bg-red-100 text-red-700'
                                      : powerStatus.status === 'طارئ'
                                        ? 'bg-red-100 text-red-700'
                                        : powerStatus.status === 'عاجل'
                                          ? 'bg-orange-100 text-warning-700'
                                          : powerStatus.status === 'متوسط'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : powerStatus.status === 'ساري'
                                              ? 'bg-green-100 text-success-700'
                                              : 'bg-neutral-100 text-neutral-700'
                                  }`}
                                >
                                  {company.ending_subscription_power_date}
                                </span>
                              ) : (
                                <span className="text-neutral-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {company.ending_subscription_moqeem_date ? (
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    moqeemStatus.status === 'منتهي'
                                      ? 'bg-red-100 text-red-700'
                                      : moqeemStatus.status === 'طارئ'
                                        ? 'bg-red-100 text-red-700'
                                        : moqeemStatus.status === 'عاجل'
                                          ? 'bg-orange-100 text-warning-700'
                                          : moqeemStatus.status === 'متوسط'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : moqeemStatus.status === 'ساري'
                                              ? 'bg-green-100 text-success-700'
                                              : 'bg-neutral-100 text-neutral-700'
                                  }`}
                                >
                                  {company.ending_subscription_moqeem_date}
                                </span>
                              ) : (
                                <span className="text-neutral-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {company.employee_count || 0}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${getAvailableSlotsColor(company.available_slots || 0)}`}
                              >
                                {company.available_slots || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {canEdit('companies') && (
                                  <Button
                                    onClick={() => handleEditCompany(company)}
                                    variant="secondary"
                                    size="sm"
                                  >
                                    تعديل
                                  </Button>
                                )}
                                {canDelete('companies') && (
                                  <Button
                                    onClick={() => handleDeleteCompany(company)}
                                    variant="destructive"
                                    size="sm"
                                  >
                                    حذف
                                  </Button>
                                )}
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
              <div className="app-panel mt-6 flex items-center justify-between p-4">
                <div className="text-sm text-neutral-600">
                  عرض {startIndex + 1}-{Math.min(endIndex, totalResults)} من {totalResults} مؤسسة
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    variant="secondary"
                    size="icon"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  {getPageNumbers().map((pageNum) => (
                    <Button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      variant={currentPage === pageNum ? 'default' : 'secondary'}
                      size="sm"
                      className="min-w-9"
                    >
                      {pageNum}
                    </Button>
                  ))}

                  <Button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    variant="secondary"
                    size="icon"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="app-panel py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
            <p className="text-neutral-600">لا توجد مؤسسات تطابق معايير البحث</p>
            {activeFiltersCount > 0 && (
              <Button onClick={clearFilters} variant="secondary" size="sm" className="mt-4">
                مسح الفلاتر وعرض الكل
              </Button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-100 p-3 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">تأكيد الحذف</h3>
                    <p className="text-sm text-neutral-600">هذا الإجراء لا يمكن التراجع عنه</p>
                  </div>
                </div>
                <p className="text-neutral-700 mb-6">
                  هل أنت متأكد من حذف مؤسسة "<strong>{selectedCompany?.name}</strong>"؟
                  <br />
                  <span className="text-sm text-info-600 mt-2 block">
                    ✓ سيبقى الموظفون في النظام بدون تعيينهم على أي مؤسسة
                  </span>
                  <span className="text-sm text-info-600 block">
                    ✓ يمكن إعادة تعيينهم لاحقاً إن أردت
                  </span>
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleDeleteConfirm} variant="destructive" className="flex-1">
                    نعم، احذف
                  </Button>
                  <Button onClick={handleModalClose} variant="secondary" className="flex-1">
                    إلغاء
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-100 p-3 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900">تأكيد حذف المحدد</h3>
                    <p className="text-sm text-neutral-600">هذا الإجراء لا يمكن التراجع عنه</p>
                  </div>
                </div>
                <p className="text-neutral-700 mb-6">
                  هل أنت متأكد من حذف <strong>{selectedCompanyIds.length} مؤسسة</strong>؟
                  <br />
                  <span className="text-sm text-info-600 mt-2 block">
                    ✓ سيبقى الموظفون في النظام بدون تعيينهم على أي مؤسسة
                  </span>
                  <span className="text-sm text-info-600 block">
                    ✓ يمكن إعادة تعيينهم لاحقاً إن أردت
                  </span>
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleBulkDelete}
                    disabled={loading}
                    variant="destructive"
                    className="flex-1"
                  >
                    {loading ? 'جاري الحذف...' : 'نعم، احذف الكل'}
                  </Button>
                  <Button
                    onClick={() => setShowBulkDeleteModal(false)}
                    disabled={loading}
                    variant="secondary"
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
