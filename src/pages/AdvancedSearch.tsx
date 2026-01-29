import { useState, useEffect, useCallback } from 'react' // [FIX] تم إضافة useCallback
import Layout from '@/components/layout/Layout'
import { Search, Filter, X, Save, Download, Star, Grid3X3, List, ChevronLeft, ChevronRight, Users, Building2, User, Calendar, Hash } from 'lucide-react'
import { supabase, Company as CompanyType, Employee as EmployeeType } from '@/lib/supabase'
import { toast } from 'sonner'
import Fuse from 'fuse.js'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { useAuth } from '@/contexts/AuthContext'
import EmployeeCard from '@/components/employees/EmployeeCard'
import CompanyModal from '@/components/companies/CompanyModal'
import CompanyDetailModal from '@/components/companies/CompanyDetailModal'
import { usePermissions } from '@/utils/permissions'
import { SearchIcon } from 'lucide-react'
import { useIsMobileView } from '@/hooks/useIsMobileView'
import { 
  calculateCommercialRegistrationStatus
} from '@/utils/autoCompanyStatus'
import { normalizeArabic } from '@/utils/textUtils'

interface SavedSearchFilters {
  // Employee filters
  nationality?: string
  company?: string
  profession?: string
  project?: string
  residenceStatus?: string
  contractStatus?: string
  hasHealthInsuranceExpiry?: string | boolean
  healthInsuranceExpiryStatus?: string
  hasPassport?: string | boolean
  hasBankAccount?: string | boolean
  birthDateRange?: string
  joiningDateRange?: string
  passportNumberSearch?: string
  residenceNumberSearch?: string
  // Company filters
  commercialRegStatus?: string
  companyDateFilter?: string
  powerSubscriptionStatus?: string
  moqeemSubscriptionStatus?: string
  employeeCountFilter?: string
  availableSlotsFilter?: string
  exemptionsFilter?: string
  unifiedNumberSearch?: string
  taxNumberSearch?: string
  laborSubscriptionNumberSearch?: string
  maxEmployeesRange?: string
  companyCreatedDateRange?: string
  companyCreatedStartDate?: string
  companyCreatedEndDate?: string
  notesSearch?: string
  notesFilter?: 'all' | 'has_notes' | 'no_notes'
}

interface SavedSearch {
  id: string
  name: string
  search_query: string
  search_type: string
  filters: SavedSearchFilters
}

type TabType = 'employees' | 'companies'
type ResidenceStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type ContractStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
// Reserved for future use: CompanyStatus type
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CompanyStatus = 'all' | 'active' | 'inactive'
type CommercialRegStatus = 'all' | 'expired' | 'expiring_soon' | 'valid'
type ViewMode = 'grid' | 'table'

// Helper function to get company name from employee
const getCompanyName = (emp: EmployeeType & { companies?: CompanyType | CompanyType[] }): string => {
  if (!emp.companies) return ''
  if (Array.isArray(emp.companies)) {
    return emp.companies[0]?.name || ''
  }
  return emp.companies.name || ''
}

export default function AdvancedSearch() {
  const { user } = useAuth()
  const { canView } = usePermissions()
  const isMobileView = useIsMobileView()
  const [activeTab, setActiveTab] = useState<TabType>('employees')
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('')
  const [companySearchQuery, setCompanySearchQuery] = useState('')
  const [employees, setEmployees] = useState<EmployeeType[]>([])
  const [companies, setCompanies] = useState<CompanyType[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeType[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showFiltersModal, setShowFiltersModal] = useState(false)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  
  // View and Pagination State
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Filter states for employees
  const [selectedNationality, setSelectedNationality] = useState<string>('all')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all')
  const [selectedProfession, setSelectedProfession] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [residenceStatus, setResidenceStatus] = useState<ResidenceStatus>('all')
  const [contractStatus, setContractStatus] = useState<ContractStatus>('all')
  
  // فلاتر جديدة للموظفين
  const [hasHealthInsuranceExpiry, setHasHealthInsuranceExpiry] = useState<string>('all')  // تحديث: hasInsuranceExpiry → hasHealthInsuranceExpiry
  const [healthInsuranceExpiryStatus, setHealthInsuranceExpiryStatus] = useState<string>('all')  // تحديث: insuranceExpiryStatus → healthInsuranceExpiryStatus
  const [hasPassport, setHasPassport] = useState<string>('all')

  const [hasBankAccount, setHasBankAccount] = useState<string>('all')
  const [birthDateRange, setBirthDateRange] = useState<string>('all')
  const [joiningDateRange, setJoiningDateRange] = useState<string>('all')
  
  // فلاتر البحث النصي للموظفين
  const [passportNumberSearch, setPassportNumberSearch] = useState<string>('')
  const [residenceNumberSearch, setResidenceNumberSearch] = useState<string>('')

  // Filter states for companies
  const [commercialRegStatus, setCommercialRegStatus] = useState<CommercialRegStatus>('all')
  const [companyDateFilter, setCompanyDateFilter] = useState<'all' | 'commercial_expiring'>('all')
  
  // فلاتر جديدة للشركات
  const [powerSubscriptionStatus, setPowerSubscriptionStatus] = useState<string>('all')
  const [moqeemSubscriptionStatus, setMoqeemSubscriptionStatus] = useState<string>('all')

  const [employeeCountFilter, setEmployeeCountFilter] = useState<string>('all')
  const [availableSlotsFilter, setAvailableSlotsFilter] = useState<string>('all')
  const [exemptionsFilter, setExemptionsFilter] = useState<string>('all')
  
  // فلاتر إضافية للمؤسسات
  const [unifiedNumberSearch, setUnifiedNumberSearch] = useState<string>('')
  const [taxNumberSearch, setTaxNumberSearch] = useState<string>('')
  const [laborSubscriptionNumberSearch, setLaborSubscriptionNumberSearch] = useState<string>('')
  const [maxEmployeesRange, setMaxEmployeesRange] = useState<string>('all')
  const [companyCreatedDateRange, setCompanyCreatedDateRange] = useState<string>('all')
  const [companyCreatedStartDate, setCompanyCreatedStartDate] = useState<string>('')
  const [companyCreatedEndDate, setCompanyCreatedEndDate] = useState<string>('')
  
  // Notes search filter
  const [notesSearch, setNotesSearch] = useState<string>('')
  const [notesFilter, setNotesFilter] = useState<'all' | 'has_notes' | 'no_notes'>('all')

  // Filter lists
  const [nationalities, setNationalities] = useState<string[]>([])
  const [companyList, setCompanyList] = useState<{ id: string; name: string }[]>([])
  const [professions, setProfessions] = useState<string[]>([])
  const [projects, setProjects] = useState<string[]>([])

  // Modal states for cards
  const [selectedEmployee, setSelectedEmployee] = useState<(EmployeeType & { company: CompanyType }) | null>(null)
  const [isEmployeeCardOpen, setIsEmployeeCardOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyType | null>(null)
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [showCompanyDetailModal, setShowCompanyDetailModal] = useState(false)
  const [selectedCompanyForDetail, setSelectedCompanyForDetail] = useState<CompanyType | null>(null)

  // Pagination calculations
  const totalEmployees = filteredEmployees.length
  const totalCompanies = filteredCompanies.length
  const totalResults = activeTab === 'employees' ? totalEmployees : totalCompanies
  const totalPages = Math.ceil(totalResults / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage

  // Get paginated results
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex)
  const paginatedCompanies = filteredCompanies.slice(startIndex, endIndex)
  
  // Get current search query based on active tab
  const currentSearchQuery = activeTab === 'employees' ? employeeSearchQuery : companySearchQuery

  // [FIX] تم تغليف الدالة بـ useCallback
  const loadData = useCallback(async () => {
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
        
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setIsLoading(false)
    }
  }, []) // <-- [FIX] مصفوفة اعتماديات فارغة (setters مستقرة)

  // [FIX] تم تغليف الدالة بـ useCallback
  const loadSavedSearches = useCallback(async () => {
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
  }, [user]) // <-- [FIX] تعتمد على user

  // [FIX] تم تغليف الدالة بـ useCallback
  const applyFilters = useCallback(() => {
    let filteredEmps = [...employees]
    let filteredComps = [...companies]

    // Apply employee search query using Fuse.js for fuzzy search
    if (employeeSearchQuery.trim()) {
      // Create searchable data
      const searchableEmployees = filteredEmps.map(emp => ({
        ...emp,
        searchableText: [
          emp.name,
          emp.profession,
          emp.nationality,
          emp.phone
        ].filter(Boolean).join(' ')
      }))

      const fuseEmployees = new Fuse(searchableEmployees, {
        keys: ['name', 'profession', 'nationality', 'phone', 'searchableText'],
        threshold: 0.3,
        includeScore: true
      })
      const employeeResults = fuseEmployees.search(employeeSearchQuery)
      filteredEmps = employeeResults.map(result => result.item)
    }

    // Apply company search query
    if (companySearchQuery.trim()) {
      const searchQuery = companySearchQuery.trim()
      
      // Check if the search query is a number (unified number or insurance number)
      const isNumericSearch = /^\d+$/.test(searchQuery)
      
      if (isNumericSearch) {
        // For numeric searches, use exact matching
        // First, try exact match on unified_number
        let exactMatches = filteredComps.filter(comp => 
          comp.unified_number?.toString() === searchQuery
        )
        
        // If no exact match on unified_number, try social_insurance_number
        if (exactMatches.length === 0) {
          exactMatches = filteredComps.filter(comp => 
            comp.social_insurance_number?.toString() === searchQuery
          )
        }
        
        filteredComps = exactMatches
      } else {
        // For text searches (company names), use Fuse.js for fuzzy search
        // Only search in name field, not in numbers
        const searchableCompanies = filteredComps.map(comp => ({
          ...comp,
          searchableText: comp.name || ''
        }))

        const fuseCompanies = new Fuse(searchableCompanies, {
          keys: ['name', 'searchableText'],
          threshold: 0.3,
          includeScore: true
        })
        const companyResults = fuseCompanies.search(searchQuery)
        filteredComps = companyResults.map(result => result.item)
      }
    }

    // Apply employee filters
    {
      if (selectedNationality !== 'all') {
        filteredEmps = filteredEmps.filter(e => e.nationality === selectedNationality)
      }

      if (selectedCompanyFilter !== 'all') {
        filteredEmps = filteredEmps.filter(e => e.company_id === selectedCompanyFilter)
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

      // فلاتر جديدة للموظفين - التأمين الصحي
      if (hasHealthInsuranceExpiry !== 'all') {  // تحديث: hasInsuranceExpiry → hasHealthInsuranceExpiry
        filteredEmps = filteredEmps.filter(e => {
          const hasExpiry = e.health_insurance_expiry  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
          return hasHealthInsuranceExpiry === 'yes' ? !!hasExpiry : !hasExpiry
        })
      }

      // حالة انتهاء التأمين الصحي (محسّن)
      if (healthInsuranceExpiryStatus !== 'all') {  // تحديث: insuranceExpiryStatus → healthInsuranceExpiryStatus
        const today = new Date()
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        filteredEmps = filteredEmps.filter(e => {
          if (!e.health_insurance_expiry) return healthInsuranceExpiryStatus === 'no_expiry'  // تحديث: ending_subscription_insurance_date → health_insurance_expiry
          const expiryDate = new Date(e.health_insurance_expiry)
          
          if (healthInsuranceExpiryStatus === 'expired') return expiryDate < today
          if (healthInsuranceExpiryStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
          if (healthInsuranceExpiryStatus === 'valid') return expiryDate > thirtyDaysLater
          if (healthInsuranceExpiryStatus === 'no_expiry') return false
          return true
        })
      }

      // حالة رقم الجواز
      if (hasPassport !== 'all') {
        filteredEmps = filteredEmps.filter(e => {
          const hasPassportNum = e.passport_number
          return hasPassport === 'yes' ? !!hasPassportNum : !hasPassportNum
        })
      }


      // فلاتر البحث النصي
      if (passportNumberSearch.trim()) {
        filteredEmps = filteredEmps.filter(e => 
          e.passport_number?.toLowerCase().includes(passportNumberSearch.toLowerCase().trim())
        )
      }

      if (residenceNumberSearch.trim()) {
        filteredEmps = filteredEmps.filter(e => 
          e.residence_number?.toString().includes(residenceNumberSearch.trim())
        )
      }



      if (hasBankAccount !== 'all') {
        filteredEmps = filteredEmps.filter(e => {
          const hasAccount = e.bank_account
          return hasBankAccount === 'yes' ? !!hasAccount : !hasAccount
        })
      }

      if (birthDateRange !== 'all') {
        const today = new Date()
        filteredEmps = filteredEmps.filter(e => {
          if (!e.birth_date) return false
          const birthDate = new Date(e.birth_date)
          const age = today.getFullYear() - birthDate.getFullYear()
          
          if (birthDateRange === 'under_25') return age < 25
          if (birthDateRange === '25_35') return age >= 25 && age <= 35
          if (birthDateRange === '35_45') return age >= 35 && age <= 45
          if (birthDateRange === 'over_45') return age > 45
          return true
        })
      }

      if (joiningDateRange !== 'all') {
        const today = new Date()
        filteredEmps = filteredEmps.filter(e => {
          if (!e.joining_date) return false
          const joiningDate = new Date(e.joining_date)
          const monthsDiff = (today.getFullYear() - joiningDate.getFullYear()) * 12 + (today.getMonth() - joiningDate.getMonth())
          
          if (joiningDateRange === 'less_than_6_months') return monthsDiff < 6
          if (joiningDateRange === '6_months_1_year') return monthsDiff >= 6 && monthsDiff < 12
          if (joiningDateRange === '1_2_years') return monthsDiff >= 12 && monthsDiff < 24
          if (joiningDateRange === 'over_2_years') return monthsDiff >= 24
          return true
        })
      }
    }

    // Apply company filters
    {

      // Commercial registration status filter
      if (commercialRegStatus !== 'all') {
        filteredComps = filteredComps.filter(c => {
          const status = calculateCommercialRegistrationStatus(c.commercial_registration_expiry)
          if (commercialRegStatus === 'expired') return status.status === 'منتهي'
          if (commercialRegStatus === 'expiring_soon') return status.status === 'عاجل' || status.status === 'طارئ'
          if (commercialRegStatus === 'valid') return status.status === 'ساري' || status.status === 'متوسط'
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
      }

      // فلاتر جديدة للشركات
      if (powerSubscriptionStatus !== 'all') {
        const today = new Date()
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

        filteredComps = filteredComps.filter(c => {
          if (!c.ending_subscription_power_date) return powerSubscriptionStatus === 'no_expiry'
          const expiryDate = new Date(c.ending_subscription_power_date)
          
          if (powerSubscriptionStatus === 'expired') return expiryDate < today
          if (powerSubscriptionStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
          if (powerSubscriptionStatus === 'valid') return expiryDate > thirtyDaysLater
          if (powerSubscriptionStatus === 'no_expiry') return false
          return true
        })
      }

      if (moqeemSubscriptionStatus !== 'all') {
        const today = new Date()
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

        filteredComps = filteredComps.filter(c => {
          if (!c.ending_subscription_moqeem_date) return moqeemSubscriptionStatus === 'no_expiry'
          const expiryDate = new Date(c.ending_subscription_moqeem_date)
          
          if (moqeemSubscriptionStatus === 'expired') return expiryDate < today
          if (moqeemSubscriptionStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
          if (moqeemSubscriptionStatus === 'valid') return expiryDate > thirtyDaysLater
          if (moqeemSubscriptionStatus === 'no_expiry') return false
          return true
        })
      }



      if (employeeCountFilter !== 'all') {
        filteredComps = filteredComps.filter(c => {
          const count = c.employee_count || 0
          if (employeeCountFilter === '1') return count === 1
          if (employeeCountFilter === '2') return count === 2
          if (employeeCountFilter === '3') return count === 3
          if (employeeCountFilter === '4+') return count >= 4
          return true
        })
      }

      if (availableSlotsFilter !== 'all') {
        filteredComps = filteredComps.filter(c => {
          const slots = (c as CompanyType & { available_slots?: number }).available_slots || 0
          if (availableSlotsFilter === '1') return slots === 1
          if (availableSlotsFilter === '2') return slots === 2
          if (availableSlotsFilter === '3') return slots === 3
          if (availableSlotsFilter === '4+') return slots >= 4
          return true
        })
      }

      if (exemptionsFilter !== 'all') {
        filteredComps = filteredComps.filter(c => {
          const targetPhrase = normalizeArabic('تم الاعفاء')
          const normalizedValue = normalizeArabic(c.exemptions)
          const isExempt = normalizedValue.includes(targetPhrase)

          if (exemptionsFilter === 'تم الاعفاء') {
            return isExempt
          }

          // كل ما عدا "تم الاعفاء" يعتبر "غير معفى"
          return !isExempt
        })
      }

      // فلاتر البحث النصي للمؤسسات
      if (unifiedNumberSearch.trim()) {
        filteredComps = filteredComps.filter(c => 
          c.unified_number?.toString().includes(unifiedNumberSearch.trim())
        )
      }

      if (taxNumberSearch.trim()) {
        filteredComps = filteredComps.filter(c => 
          c.social_insurance_number?.toString().includes(taxNumberSearch.trim())
        )
      }

      if (laborSubscriptionNumberSearch.trim()) {
        filteredComps = filteredComps.filter(c => 
          c.labor_subscription_number?.toLowerCase().includes(laborSubscriptionNumberSearch.toLowerCase().trim())
        )
      }

      // فلتر الحد الأقصى للموظفين
      if (maxEmployeesRange !== 'all') {
        filteredComps = filteredComps.filter(c => {
          const maxEmp = c.max_employees || 0
          if (maxEmployeesRange === '1_2') return maxEmp >= 1 && maxEmp <= 2
          if (maxEmployeesRange === '3_4') return maxEmp >= 3 && maxEmp <= 4
          if (maxEmployeesRange === '5_10') return maxEmp >= 5 && maxEmp <= 10
          if (maxEmployeesRange === 'over_10') return maxEmp > 10
          return true
        })
      }

      // فلتر تاريخ إنشاء المؤسسة
      if (companyCreatedDateRange !== 'all') {
        const today = new Date()
        let startDate: Date | null = null
        let endDate: Date | null = null

        if (companyCreatedDateRange === 'last_month') {
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
          endDate = today
        } else if (companyCreatedDateRange === 'last_3_months') {
          startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
          endDate = today
        } else if (companyCreatedDateRange === 'last_year') {
          startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
          endDate = today
        } else if (companyCreatedDateRange === 'custom' && companyCreatedStartDate && companyCreatedEndDate) {
          startDate = new Date(companyCreatedStartDate)
          endDate = new Date(companyCreatedEndDate)
        }

        if (startDate && endDate) {
          filteredComps = filteredComps.filter(c => {
            if (!c.created_at) return false
            const createdDate = new Date(c.created_at)
            return createdDate >= startDate! && createdDate <= endDate!
          })
        }
      }
      
      // Notes filter
      if (notesSearch.trim()) {
        const searchLower = notesSearch.toLowerCase().trim()
        filteredComps = filteredComps.filter(c => 
          c.notes?.toLowerCase().includes(searchLower)
        )
      }
      
      if (notesFilter !== 'all') {
        filteredComps = filteredComps.filter(c => {
          if (notesFilter === 'has_notes') return c.notes && c.notes.trim().length > 0
          if (notesFilter === 'no_notes') return !c.notes || c.notes.trim().length === 0
          return true
        })
      }
    }

    setFilteredEmployees(filteredEmps)
    setFilteredCompanies(filteredComps)
  }, [ // [FIX] مصفوفة الاعتماديات لـ useCallback
    employees, 
    companies, 
    employeeSearchQuery,
    companySearchQuery, 
    selectedNationality, 
    selectedCompanyFilter, 
    selectedProfession, 
    selectedProject, 
    residenceStatus, 
    contractStatus, 
    hasHealthInsuranceExpiry,  // تحديث: hasInsuranceExpiry → hasHealthInsuranceExpiry
    healthInsuranceExpiryStatus,  // تحديث: insuranceExpiryStatus → healthInsuranceExpiryStatus
    hasPassport,
    hasBankAccount, 
    birthDateRange, 
    joiningDateRange,
    passportNumberSearch,
    residenceNumberSearch,
    commercialRegStatus,
    companyDateFilter, 
    powerSubscriptionStatus, 
    moqeemSubscriptionStatus, 
    employeeCountFilter, 
    availableSlotsFilter,
    exemptionsFilter,
    unifiedNumberSearch,
    taxNumberSearch,
    laborSubscriptionNumberSearch,
    maxEmployeesRange,
    companyCreatedDateRange,
    companyCreatedStartDate,
    companyCreatedEndDate,
    notesSearch,
    notesFilter
  ])

  useEffect(() => {
    loadData()
    loadSavedSearches()
  }, [loadData, loadSavedSearches]) // [FIX] تم التحديث

  useEffect(() => {
    applyFilters()
    setCurrentPage(1) // Reset to first page when filters change
  }, [applyFilters]) // [FIX] تم التحديث

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when tab changes
  }, [activeTab])

  // التحقق من صلاحية العرض - بعد جميع الـ hooks
  if (!canView('advancedSearch')) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <SearchIcon className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h2>
            <p className="text-gray-600">عذراً، ليس لديك صلاحية لعرض هذه الصفحة.</p>
          </div>
        </div>
      </Layout>
    )
  }

  // Calculate active filters count based on active tab
  const calculateActiveFiltersCount = () => {
    let count = 0
    
    if (activeTab === 'employees') {
      // Employee search query
      if (employeeSearchQuery.trim()) count++
      
      // Employee filters
      if (selectedNationality !== 'all') count++
      if (selectedCompanyFilter !== 'all') count++
      if (selectedProfession !== 'all') count++
      if (selectedProject !== 'all') count++
      if (residenceStatus !== 'all') count++
      if (contractStatus !== 'all') count++
      if (hasHealthInsuranceExpiry !== 'all') count++
      if (healthInsuranceExpiryStatus !== 'all') count++
      if (hasPassport !== 'all') count++
      if (hasBankAccount !== 'all') count++
      if (birthDateRange !== 'all') count++
      if (joiningDateRange !== 'all') count++
      if (passportNumberSearch.trim()) count++
      if (residenceNumberSearch.trim()) count++
    } else {
      // Company search query
      if (companySearchQuery.trim()) count++
      
      // Company filters
      if (commercialRegStatus !== 'all') count++
      if (companyDateFilter !== 'all') count++
      if (exemptionsFilter !== 'all') count++
      if (powerSubscriptionStatus !== 'all') count++
      if (moqeemSubscriptionStatus !== 'all') count++
      if (employeeCountFilter !== 'all') count++
      if (availableSlotsFilter !== 'all') count++
      if (unifiedNumberSearch.trim()) count++
      if (taxNumberSearch.trim()) count++
      if (laborSubscriptionNumberSearch.trim()) count++
      if (maxEmployeesRange !== 'all') count++
      if (companyCreatedDateRange !== 'all') count++
    }
    
    return count
  }

  const activeFiltersCount = calculateActiveFiltersCount()

  const clearFilters = () => {
    if (activeTab === 'employees') {
      setEmployeeSearchQuery('')
      setSelectedNationality('all')
      setSelectedCompanyFilter('all')
      setSelectedProfession('all')
      setSelectedProject('all')
      setResidenceStatus('all')
      setContractStatus('all')
      setHasHealthInsuranceExpiry('all')
      setHealthInsuranceExpiryStatus('all')
      setHasPassport('all')
      setHasBankAccount('all')
      setBirthDateRange('all')
      setJoiningDateRange('all')
      setPassportNumberSearch('')
      setResidenceNumberSearch('')
    } else {
      setCompanySearchQuery('')
      setCommercialRegStatus('all')
      setCompanyDateFilter('all')
      setExemptionsFilter('all')
      setPowerSubscriptionStatus('all')
      setMoqeemSubscriptionStatus('all')
      setEmployeeCountFilter('all')
      setAvailableSlotsFilter('all')
      setUnifiedNumberSearch('')
      setTaxNumberSearch('')
      setLaborSubscriptionNumberSearch('')
      setNotesSearch('')
      setNotesFilter('all')
      setMaxEmployeesRange('all')
      setCompanyCreatedDateRange('all')
      setCompanyCreatedStartDate('')
      setCompanyCreatedEndDate('')
    }
    
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
      const currentSearchQuery = activeTab === 'employees' ? employeeSearchQuery : companySearchQuery
      const filters: SavedSearchFilters = {}
      
      if (activeTab === 'employees') {
        filters.nationality = selectedNationality
        filters.company = selectedCompanyFilter
        filters.profession = selectedProfession
        filters.project = selectedProject
        filters.residenceStatus = residenceStatus
        filters.contractStatus = contractStatus
        filters.hasHealthInsuranceExpiry = hasHealthInsuranceExpiry
        filters.healthInsuranceExpiryStatus = healthInsuranceExpiryStatus
        filters.hasPassport = hasPassport
        filters.hasBankAccount = hasBankAccount
        filters.birthDateRange = birthDateRange
        filters.joiningDateRange = joiningDateRange
        filters.passportNumberSearch = passportNumberSearch
        filters.residenceNumberSearch = residenceNumberSearch
      } else {
        filters.commercialRegStatus = commercialRegStatus
        filters.companyDateFilter = companyDateFilter
        filters.powerSubscriptionStatus = powerSubscriptionStatus
        filters.moqeemSubscriptionStatus = moqeemSubscriptionStatus
        filters.employeeCountFilter = employeeCountFilter
        filters.availableSlotsFilter = availableSlotsFilter
        filters.exemptionsFilter = exemptionsFilter
        filters.unifiedNumberSearch = unifiedNumberSearch
        filters.taxNumberSearch = taxNumberSearch
        filters.laborSubscriptionNumberSearch = laborSubscriptionNumberSearch
        filters.notesSearch = notesSearch
        filters.notesFilter = notesFilter
        filters.maxEmployeesRange = maxEmployeesRange
        filters.companyCreatedDateRange = companyCreatedDateRange
        filters.companyCreatedStartDate = companyCreatedStartDate
        filters.companyCreatedEndDate = companyCreatedEndDate
      }

      const { error } = await supabase.from('saved_searches').insert({
        user_id: user.id,
        name: searchName.trim(),
        search_type: activeTab,
        search_query: currentSearchQuery,
        filters
      })

      if (error) {
        console.error('Error saving search:', error)
        throw error
      }
      
      toast.success('تم حفظ البحث بنجاح')
      loadSavedSearches() // [FIX] نستخدم الدالة المغلفة
    } catch (error) {
      console.error('Error saving search:', error)
      const errorMessage = error instanceof Error ? error.message : 'فشل حفظ البحث'
      toast.error(errorMessage)
    }
  }

  const loadSavedSearch = (saved: SavedSearch) => {
    const savedType = saved.search_type === 'both' ? 'employees' : (saved.search_type as TabType)
    setActiveTab(savedType)
    
    if (savedType === 'employees') {
      setEmployeeSearchQuery(saved.search_query || '')
    } else {
      setCompanySearchQuery(saved.search_query || '')
    }
    
    if (saved.filters) {
      if (savedType === 'employees') {
        setSelectedNationality(saved.filters.nationality || 'all')
        setSelectedCompanyFilter(saved.filters.company || 'all')
        setSelectedProfession(saved.filters.profession || 'all')
        setSelectedProject(saved.filters.project || 'all')
        setResidenceStatus((saved.filters.residenceStatus as ResidenceStatus) || 'all')
        setContractStatus((saved.filters.contractStatus as ContractStatus) || 'all')
        setHasHealthInsuranceExpiry(String(saved.filters.hasHealthInsuranceExpiry ?? 'all'))
        setHealthInsuranceExpiryStatus(saved.filters.healthInsuranceExpiryStatus || 'all')
        setHasPassport(String(saved.filters.hasPassport ?? 'all'))
        setHasBankAccount(String(saved.filters.hasBankAccount ?? 'all'))
        setBirthDateRange(saved.filters.birthDateRange || 'all')
        setJoiningDateRange(saved.filters.joiningDateRange || 'all')
        setPassportNumberSearch(saved.filters.passportNumberSearch || '')
        setResidenceNumberSearch(saved.filters.residenceNumberSearch || '')
      } else {
        setCommercialRegStatus((saved.filters.commercialRegStatus as CommercialRegStatus) || 'all')
        setCompanyDateFilter((saved.filters.companyDateFilter as 'all' | 'commercial_expiring') || 'all')
        setPowerSubscriptionStatus(saved.filters.powerSubscriptionStatus || 'all')
        setMoqeemSubscriptionStatus(saved.filters.moqeemSubscriptionStatus || 'all')
        setEmployeeCountFilter(saved.filters.employeeCountFilter || 'all')
        setAvailableSlotsFilter(saved.filters.availableSlotsFilter || 'all')
        setExemptionsFilter(saved.filters.exemptionsFilter || 'all')
        setUnifiedNumberSearch(saved.filters.unifiedNumberSearch || '')
        setTaxNumberSearch(saved.filters.taxNumberSearch || '')
        setLaborSubscriptionNumberSearch(saved.filters.laborSubscriptionNumberSearch || '')
        setNotesSearch(saved.filters.notesSearch || '')
        setNotesFilter((saved.filters.notesFilter as 'all' | 'has_notes' | 'no_notes') || 'all')
        setMaxEmployeesRange(saved.filters.maxEmployeesRange || 'all')
        setCompanyCreatedDateRange(saved.filters.companyCreatedDateRange || 'all')
        setCompanyCreatedStartDate(saved.filters.companyCreatedStartDate || '')
        setCompanyCreatedEndDate(saved.filters.companyCreatedEndDate || '')
      }
    }
    setCurrentPage(1)
    toast.success(`تم تحميل البحث: ${saved.name}`)
  }

  const deleteSavedSearch = async (id: string) => {
    try {
      await supabase.from('saved_searches').delete().eq('id', id)
      toast.success('تم حذف البحث المحفوظ')
      loadSavedSearches() // [FIX] نستخدم الدالة المغلفة
    } catch (error) {
      console.error('Error deleting saved search:', error)
      toast.error('فشل حذف البحث')
    }
  }

  const exportResults = () => {
    if (activeTab === 'employees') {
      const employeeData = filteredEmployees.map(emp => {
        const basicData = {
          'الاسم': emp.name,
          'المهنة': emp.profession,
          'الجنسية': emp.nationality,
          'الجوال': emp.phone,
          'انتهاء الإقامة': emp.residence_expiry,
          'انتهاء العقد': emp.contract_expiry,
          'المؤسسة': getCompanyName(emp)
        }
        
        return basicData
      })

      const worksheet = XLSX.utils.json_to_sheet(employeeData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'نتائج البحث - موظفين')
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `نتائج_البحث_موظفين_${new Date().toISOString().split('T')[0]}.xlsx`)
    } else {
      const companyData = filteredCompanies.map(comp => {
        const basicData = {
          'اسم المؤسسة': comp.name,
          'رقم اشتراك التأمينات الاجتماعية': comp.social_insurance_number || '',
          'رقم موحد': comp.unified_number,
          'انتهاء السجل التجاري': comp.commercial_registration_expiry
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

  const resultsCount = activeTab === 'employees' ? filteredEmployees.length : filteredCompanies.length

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
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i)
    }
    
    return pageNumbers
  }

  // Handle employee click - fetch full employee data with company
  const handleEmployeeClick = async (employee: EmployeeType) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, companies(*)')
        .eq('id', employee.id)
        .single()

      if (error) throw error

      if (data) {
        // Convert companies array to company object (EmployeeCard expects company, not companies)
        const employeeWithCompany = {
          ...data,
          company: Array.isArray(data.companies) && data.companies.length > 0 
            ? data.companies[0] 
            : (data.companies || null)
        }
        
        // Remove companies array as we now have company object
        if ('companies' in employeeWithCompany) {
          delete (employeeWithCompany as EmployeeType & { companies?: CompanyType | CompanyType[] }).companies
        }
        
        if (employeeWithCompany.company) {
          setSelectedEmployee(employeeWithCompany as EmployeeType & { company: CompanyType })
          setIsEmployeeCardOpen(true)
        } else {
          toast.error('فشل تحميل بيانات المؤسسة المرتبطة بالموظف')
        }
      } else {
        toast.error('فشل تحميل بيانات الموظف')
      }
    } catch (error) {
      console.error('Error loading employee:', error)
      toast.error('حدث خطأ أثناء تحميل بيانات الموظف')
    }
  }

  // Handle company click
  const handleCompanyClick = (company: CompanyType) => {
    setSelectedCompanyForDetail(company)
    setShowCompanyDetailModal(true)
  }

  // Handle close employee card
  const handleCloseEmployeeCard = () => {
    setIsEmployeeCardOpen(false)
    setSelectedEmployee(null)
  }

  // Handle close company modal
  const handleCloseCompanyModal = () => {
    setIsCompanyModalOpen(false)
    setSelectedCompany(null)
  }

  // Handle close company detail modal
  const handleCloseCompanyDetailModal = () => {
    setShowCompanyDetailModal(false)
    setSelectedCompanyForDetail(null)
  }

  // Handle edit company from detail modal
  const handleEditCompanyFromDetail = (company: CompanyType) => {
    setShowCompanyDetailModal(false)
    setSelectedCompany(company)
    setIsCompanyModalOpen(true)
  }

  // Handle delete company from detail modal
  // Reserved for future use: company parameter for delete functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteCompanyFromDetail = (company: CompanyType) => {
    // يمكن إضافة confirmation dialog هنا لاحقاً
    setShowCompanyDetailModal(false)
    // يمكن تنفيذ حذف مباشر أو فتح modal تأكيد
  }

  // Handle employee update - reload data
  const handleEmployeeUpdate = async () => {
    await loadData()
  }

  // Handle company update - reload data
  const handleCompanyUpdate = async () => {
    await loadData()
    handleCloseCompanyModal()
  }


  return (
    <Layout>
      <div className="w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">البحث المتقدم</h1>
            <p className="text-sm text-gray-600">
              النتائج المطابقة: <span className="font-bold text-blue-600">{resultsCount}</span>
              {activeFiltersCount > 0 && (
                <span className="mr-2 text-gray-500">
                  ({activeFiltersCount} فلتر نشط)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
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
            <button
              onClick={saveSearch}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>حفظ البحث</span>
            </button>
            <button
              onClick={exportResults}
              disabled={resultsCount === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>تصدير ({resultsCount})</span>
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => {
                setActiveTab('employees')
                setCurrentPage(1)
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'employees'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>الموظفين</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('companies')
                setCurrentPage(1)
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'companies'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span>المؤسسات</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={currentSearchQuery}
                onChange={(e) => {
                  if (activeTab === 'employees') {
                    setEmployeeSearchQuery(e.target.value)
                  } else {
                    setCompanySearchQuery(e.target.value)
                  }
                }}
                placeholder={activeTab === 'employees' 
                  ? "ابحث بالاسم، المهنة، الجنسية، رقم الجوال، أو أي حقل إضافي..."
                  : "ابحث باسم المؤسسة، الرقم الموحد، الرقم التأميني، أو أي حقل إضافي..."}
                className="w-full pr-11 pl-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* View Mode and Items Per Page */}
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              {!isMobileView && (
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
              )}
              {isMobileView && (
                <div className="flex items-center gap-1 border border-gray-300 rounded-md p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
                    title="عرض شبكي"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                </div>
              )}

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

          {/* Active Filters Chips */}
          {activeFiltersCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {activeTab === 'employees' ? (
                  <>
                    {employeeSearchQuery && (
                      <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full flex items-center gap-2">
                        البحث: {employeeSearchQuery}
                        <button
                          onClick={() => setEmployeeSearchQuery('')}
                          className="hover:bg-blue-100 rounded-full p-0.5 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {selectedNationality !== 'all' && (
                  <span className="px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-full flex items-center gap-2">
                    الجنسية: {selectedNationality}
                    <button
                      onClick={() => setSelectedNationality('all')}
                      className="hover:bg-purple-100 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedCompanyFilter !== 'all' && companyList && (
                  <span className="px-3 py-1.5 bg-green-50 text-green-700 text-sm rounded-full flex items-center gap-2">
                    المؤسسة: {companyList.find(c => c.id === selectedCompanyFilter)?.name || selectedCompanyFilter}
                    <button
                      onClick={() => setSelectedCompanyFilter('all')}
                      className="hover:bg-green-100 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedProfession !== 'all' && (
                  <span className="px-3 py-1.5 bg-orange-50 text-orange-700 text-sm rounded-full flex items-center gap-2">
                    المهنة: {selectedProfession}
                    <button
                      onClick={() => setSelectedProfession('all')}
                      className="hover:bg-orange-100 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {residenceStatus !== 'all' && (
                  <span className="px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-full flex items-center gap-2">
                    حالة الإقامة: {residenceStatus === 'expired' ? 'منتهي' : residenceStatus === 'expiring_soon' ? 'عاجل' : 'ساري'}
                    <button
                      onClick={() => setResidenceStatus('all')}
                      className="hover:bg-red-100 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {contractStatus !== 'all' && (
                  <span className="px-3 py-1.5 bg-yellow-50 text-yellow-700 text-sm rounded-full flex items-center gap-2">
                    حالة العقد: {contractStatus === 'expired' ? 'منتهي' : contractStatus === 'expiring_soon' ? 'عاجل' : 'ساري'}
                    <button
                      onClick={() => setContractStatus('all')}
                      className="hover:bg-yellow-100 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {residenceNumberSearch && (
                  <span className="px-3 py-1.5 bg-cyan-50 text-cyan-700 text-sm rounded-full flex items-center gap-2">
                    رقم الإقامة: {residenceNumberSearch}
                    <button
                      onClick={() => setResidenceNumberSearch('')}
                      className="hover:bg-cyan-100 rounded-full p-0.5 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                    {passportNumberSearch && (
                      <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-full flex items-center gap-2">
                        رقم الجواز: {passportNumberSearch}
                        <button
                          onClick={() => setPassportNumberSearch('')}
                          className="hover:bg-indigo-100 rounded-full p-0.5 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {companySearchQuery && (
                      <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full flex items-center gap-2">
                        البحث: {companySearchQuery}
                        <button
                          onClick={() => setCompanySearchQuery('')}
                          className="hover:bg-blue-100 rounded-full p-0.5 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {commercialRegStatus !== 'all' && (
                      <span className="px-3 py-1.5 bg-pink-50 text-pink-700 text-sm rounded-full flex items-center gap-2">
                        حالة السجل التجاري: {commercialRegStatus === 'expired' ? 'منتهي' : commercialRegStatus === 'expiring_soon' ? 'عاجل' : commercialRegStatus === 'valid' ? 'ساري' : commercialRegStatus}
                        <button
                          onClick={() => setCommercialRegStatus('all')}
                          className="hover:bg-pink-100 rounded-full p-0.5 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {unifiedNumberSearch && (
                      <span className="px-3 py-1.5 bg-teal-50 text-teal-700 text-sm rounded-full flex items-center gap-2">
                        الرقم الموحد: {unifiedNumberSearch}
                        <button
                          onClick={() => setUnifiedNumberSearch('')}
                          className="hover:bg-teal-100 rounded-full p-0.5 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {taxNumberSearch && (
                      <span className="px-3 py-1.5 bg-cyan-50 text-cyan-700 text-sm rounded-full flex items-center gap-2">
                        الرقم التأميني: {taxNumberSearch}
                        <button
                          onClick={() => setTaxNumberSearch('')}
                          className="hover:bg-cyan-100 rounded-full p-0.5 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {laborSubscriptionNumberSearch && (
                      <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-full flex items-center gap-2">
                        رقم اشتراك العمل: {laborSubscriptionNumberSearch}
                        <button
                          onClick={() => setLaborSubscriptionNumberSearch('')}
                          className="hover:bg-indigo-100 rounded-full p-0.5 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filters Modal */}
        {showFiltersModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop with blur */}
            <div
              className="fixed inset-0 bg-gradient-to-br from-gray-900/60 via-gray-800/50 to-gray-900/60 backdrop-blur-md transition-opacity"
              onClick={() => setShowFiltersModal(false)}
            />
            
            {/* Modal Content with Glass Morphism */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-300">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 bg-gradient-to-r from-white/40 to-white/20 backdrop-blur-sm">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">الفلاتر والبحث المتقدم</h2>
                    {activeFiltersCount > 0 && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {activeFiltersCount} فلتر نشط
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="p-1.5 hover:bg-white/30 rounded-lg transition-all duration-200 hover:scale-110"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Modal Body with Grouped Grid Layout */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Employee Filters - Grouped Layout */}
                  {activeTab === 'employees' && (
                    <div className="space-y-3 mb-4">
                      {/* Group 1: المعلومات الأساسية */}
                      <div className="bg-gradient-to-br from-blue-50/60 to-blue-100/40 backdrop-blur-md rounded-xl p-3.5 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-blue-500/20 rounded-lg backdrop-blur-sm">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-800">المعلومات الأساسية</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">الجنسية</label>
                            <select
                              value={selectedNationality}
                              onChange={(e) => setSelectedNationality(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              {nationalities && nationalities.map(nat => (
                                <option key={nat} value={nat}>{nat}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">المؤسسة</label>
                            <select
                              value={selectedCompanyFilter}
                              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              {companyList && companyList.length > 0 ? (
                                companyList.map(comp => (
                                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                                ))
                              ) : (
                                <option value="all" disabled>لا توجد مؤسسات</option>
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">المهنة</label>
                            <select
                              value={selectedProfession}
                              onChange={(e) => setSelectedProfession(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              {professions && professions.map(prof => (
                                <option key={prof} value={prof}>{prof}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">المشروع</label>
                            <select
                              value={selectedProject}
                              onChange={(e) => setSelectedProject(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              {projects && projects.map(project => (
                                <option key={project} value={project}>{project}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Group 2: حالة التوثيق */}
                      <div className="bg-gradient-to-br from-green-50/60 to-emerald-100/40 backdrop-blur-md rounded-xl p-3.5 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-green-500/20 rounded-lg backdrop-blur-sm">
                            <Calendar className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-800">حالة التوثيق</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">حالة الإقامة</label>
                            <select
                              value={residenceStatus}
                              onChange={(e) => setResidenceStatus(e.target.value as ResidenceStatus)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              <option value="expired">منتهية</option>
                              <option value="expiring_soon">عاجل</option>
                              <option value="valid">سارية</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">حالة العقد</label>
                            <select
                              value={contractStatus}
                              onChange={(e) => setContractStatus(e.target.value as ContractStatus)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              <option value="expired">منتهي</option>
                              <option value="expiring_soon">عاجل</option>
                              <option value="valid">ساري</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">حالة انتهاء التأمين الصحي</label>
                            <select
                              value={healthInsuranceExpiryStatus}
                              onChange={(e) => setHealthInsuranceExpiryStatus(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              <option value="expired">منتهي</option>
                              <option value="expiring_soon">عاجل</option>
                              <option value="valid">ساري</option>
                              <option value="no_expiry">غير محدد</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Group 3: البحث النصي */}
                      <div className="bg-gradient-to-br from-purple-50/60 to-pink-100/40 backdrop-blur-md rounded-xl p-3.5 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-purple-500/20 rounded-lg backdrop-blur-sm">
                            <Hash className="w-3.5 h-3.5 text-purple-600" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-800">البحث النصي</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">بحث رقم الجواز</label>
                            <input
                              type="text"
                              value={passportNumberSearch}
                              onChange={(e) => setPassportNumberSearch(e.target.value)}
                              placeholder="ابحث برقم الجواز..."
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all shadow-sm hover:shadow-md"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">بحث رقم الإقامة</label>
                            <input
                              type="text"
                              value={residenceNumberSearch}
                              onChange={(e) => setResidenceNumberSearch(e.target.value)}
                              placeholder="ابحث برقم الإقامة..."
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all shadow-sm hover:shadow-md"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Company Filters - Grouped Layout */}
                  {activeTab === 'companies' && (
                    <div className="space-y-3">
                      {/* Group 1: الحالة الأساسية */}
                      <div className="bg-gradient-to-br from-indigo-50/60 to-blue-100/40 backdrop-blur-md rounded-xl p-3.5 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-indigo-500/20 rounded-lg backdrop-blur-sm">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-800">الحالة الأساسية</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">حالة السجل التجاري</label>
                            <select
                              value={commercialRegStatus}
                              onChange={(e) => setCommercialRegStatus(e.target.value as CommercialRegStatus)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              <option value="expired">منتهي</option>
                              <option value="expiring_soon">عاجل</option>
                              <option value="valid">ساري</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">الاعفاءات</label>
                            <select
                              value={exemptionsFilter}
                              onChange={(e) => setExemptionsFilter(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              <option value="تم الاعفاء">تم الاعفاء</option>
                              <option value="لم يتم الاعفاء">لم يتم الاعفاء</option>
                              <option value="أخرى">أخرى</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Group 2: حالة التوثيق */}
                      <div className="bg-gradient-to-br from-green-50/60 to-emerald-100/40 backdrop-blur-md rounded-xl p-3.5 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-green-500/20 rounded-lg backdrop-blur-sm">
                            <Calendar className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-800">حالة التوثيق</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">حالة اشتراك قوى</label>
                            <select
                              value={powerSubscriptionStatus}
                              onChange={(e) => setPowerSubscriptionStatus(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              <option value="expired">منتهي</option>
                              <option value="expiring_soon">عاجل</option>
                              <option value="valid">ساري</option>
                              <option value="no_expiry">غير محدد</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">حالة اشتراك مقيم</label>
                            <select
                              value={moqeemSubscriptionStatus}
                              onChange={(e) => setMoqeemSubscriptionStatus(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              <option value="expired">منتهي</option>
                              <option value="expiring_soon">عاجل</option>
                              <option value="valid">ساري</option>
                              <option value="no_expiry">غير محدد</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Group 3: البحث النصي */}
                      <div className="bg-gradient-to-br from-purple-50/60 to-pink-100/40 backdrop-blur-md rounded-xl p-3.5 border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-purple-500/20 rounded-lg backdrop-blur-sm">
                            <Hash className="w-3.5 h-3.5 text-purple-600" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-800">البحث النصي</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">بحث الرقم الموحد</label>
                            <input
                              type="text"
                              value={unifiedNumberSearch}
                              onChange={(e) => setUnifiedNumberSearch(e.target.value)}
                              placeholder="ابحث بالرقم الموحد..."
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all shadow-sm hover:shadow-md"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">بحث الرقم التأميني</label>
                            <input
                              type="text"
                              value={taxNumberSearch}
                              onChange={(e) => setTaxNumberSearch(e.target.value)}
                              placeholder="ابحث بالرقم التأميني..."
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all shadow-sm hover:shadow-md"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">بحث رقم اشتراك العمل</label>
                            <input
                              type="text"
                              value={laborSubscriptionNumberSearch}
                              onChange={(e) => setLaborSubscriptionNumberSearch(e.target.value)}
                              placeholder="ابحث برقم اشتراك العمل..."
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all shadow-sm hover:shadow-md"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">بحث في الملاحظات</label>
                            <input
                              type="text"
                              value={notesSearch}
                              onChange={(e) => setNotesSearch(e.target.value)}
                              placeholder="ابحث في الملاحظات..."
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all shadow-sm hover:shadow-md"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">فلتر الملاحظات</label>
                            <select
                              value={notesFilter}
                              onChange={(e) => setNotesFilter(e.target.value as 'all' | 'has_notes' | 'no_notes')}
                              className="w-full px-2.5 py-1.5 text-sm bg-white/70 backdrop-blur-sm border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all shadow-sm hover:shadow-md"
                            >
                              <option value="all">الكل</option>
                              <option value="has_notes">يوجد ملاحظات</option>
                              <option value="no_notes">لا توجد ملاحظات</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Saved Searches */}
                  {savedSearches.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <h3 className="text-xs font-bold mb-2.5 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-yellow-500" />
                        البحوث المحفوظة
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {savedSearches.map(saved => (
                          <div key={saved.id} className="flex items-center gap-1.5 bg-white/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/30 shadow-sm hover:shadow-md transition-all duration-200">
                            <button
                              onClick={() => {
                                loadSavedSearch(saved)
                                setShowFiltersModal(false)
                              }}
                              className="text-xs hover:text-blue-600 transition-colors font-medium"
                            >
                              {saved.name}
                            </button>
                            <button
                              onClick={() => deleteSavedSearch(saved.id)}
                              className="p-0.5 hover:bg-red-100/50 rounded text-red-600 transition-all duration-200"
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

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/20 bg-gradient-to-r from-white/40 to-white/20 backdrop-blur-sm">
                <button
                  onClick={clearFilters}
                  disabled={activeFiltersCount === 0}
                  className="px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/40 rounded-lg hover:bg-white/80 transition-all duration-200 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-sm hover:shadow-md disabled:hover:shadow-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  مسح جميع الفلاتر
                </button>
                <button
                  onClick={() => setShowFiltersModal(false)}
                  className="px-5 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg text-xs font-semibold"
                >
                  تطبيق الفلاتر
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Results Area */}
        <div className="w-full mt-6">
          {/* Loading State */}
            {isLoading && (
              <div className="text-center py-8">
                <div className="animate-spin w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-3 text-sm text-gray-600">جاري تحميل البيانات...</p>
              </div>
            )}

            {/* Results Display */}
            {!isLoading && resultsCount > 0 && (
              <>
                {/* Employee Results */}
                {activeTab === 'employees' && paginatedEmployees.length > 0 && (
                  <div className="mb-4">
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                        {paginatedEmployees.map(emp => (
                          <div 
                            key={emp.id} 
                            onClick={() => handleEmployeeClick(emp)}
                            className="bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                          >
                            <h3 className="font-bold text-base mb-1.5">{emp.name}</h3>
                            <div className="space-y-0.5 text-xs">
                              <p><span className="text-gray-600">المهنة:</span> {emp.profession}</p>
                              <p><span className="text-gray-600">الجنسية:</span> {emp.nationality}</p>
                              <p><span className="text-gray-600">الجوال:</span> {emp.phone}</p>
                              <p><span className="text-gray-600">المؤسسة:</span> {getCompanyName(emp) || 'غير محدد'}</p>
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
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-1.5 text-right">الاسم</th>
                                <th className="px-3 py-1.5 text-right">المهنة</th>
                                <th className="px-3 py-1.5 text-right">الجنسية</th>
                                <th className="px-3 py-1.5 text-right">الجوال</th>
                                <th className="px-3 py-1.5 text-right">المؤسسة</th>
                                <th className="px-3 py-1.5 text-right">المشروع</th>
                                <th className="px-3 py-1.5 text-right">انتهاء الإقامة</th>
                                <th className="px-3 py-1.5 text-right">انتهاء العقد</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedEmployees.map(emp => (
                                <tr 
                                  key={emp.id} 
                                  onClick={() => handleEmployeeClick(emp)}
                                  className="border-t hover:bg-gray-50 cursor-pointer"
                                >
                                  <td className="px-3 py-1.5 font-medium">{emp.name}</td>
                                  <td className="px-3 py-1.5">{emp.profession}</td>
                                  <td className="px-3 py-1.5">{emp.nationality}</td>
                                  <td className="px-3 py-1.5">{emp.phone}</td>
                                  <td className="px-3 py-1.5">{getCompanyName(emp) || 'غير محدد'}</td>
                                  <td className="px-3 py-1.5">
                                    {emp.project_name ? (
                                      <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                                        {emp.project_name}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5">{emp.residence_expiry || '-'}</td>
                                  <td className="px-3 py-1.5">{emp.contract_expiry || '-'}</td>
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
                {activeTab === 'companies' && paginatedCompanies.length > 0 && (
                  <div className="mb-4">
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                        {paginatedCompanies.map(comp => (
                          <div 
                            key={comp.id} 
                            onClick={() => handleCompanyClick(comp)}
                            className="bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                          >
                            <h3 className="font-bold text-base mb-1.5">{comp.name}</h3>
                            <div className="space-y-0.5 text-xs">
                              <p><span className="text-gray-600">رقم اشتراك التأمينات:</span> {comp.social_insurance_number}</p>
                              <p><span className="text-gray-600">رقم موحد:</span> {comp.unified_number}</p>
                              {comp.commercial_registration_expiry && (
                                <p><span className="text-gray-600">انتهاء السجل:</span> {comp.commercial_registration_expiry}</p>
                              )}
                              {comp.ending_subscription_power_date && (
                                <p><span className="text-gray-600">انتهاء اشتراك قوى:</span> {comp.ending_subscription_power_date}</p>
                              )}
                              {comp.ending_subscription_moqeem_date && (
                                <p><span className="text-gray-600">انتهاء اشتراك مقيم:</span> {comp.ending_subscription_moqeem_date}</p>
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
                                <th className="px-3 py-1.5 text-right">اسم المؤسسة</th>
                                <th className="px-3 py-1.5 text-right">رقم اشتراك التأمينات</th>
                                <th className="px-3 py-1.5 text-right">رقم موحد</th>
                                <th className="px-3 py-1.5 text-right">انتهاء السجل</th>
                                <th className="px-3 py-1.5 text-right">انتهاء اشتراك قوى</th>
                                <th className="px-3 py-1.5 text-right">انتهاء اشتراك مقيم</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedCompanies.map(comp => (
                                <tr 
                                  key={comp.id} 
                                  onClick={() => handleCompanyClick(comp)}
                                  className="border-t hover:bg-gray-50 cursor-pointer"
                                >
                                  <td className="px-3 py-1.5 font-medium">{comp.name}</td>
                                  <td className="px-3 py-1.5">{comp.social_insurance_number || '-'}</td>
                                  <td className="px-3 py-1.5">{comp.unified_number}</td>
                                  <td className="px-3 py-1.5">{comp.commercial_registration_expiry || '-'}</td>
                                  <td className="px-3 py-1.5">{comp.ending_subscription_power_date || '-'}</td>
                                  <td className="px-3 py-1.5">{comp.ending_subscription_moqeem_date || '-'}</td>
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
                  <div className="flex items-center justify-between bg-white border rounded-lg p-3">
                    <div className="text-xs text-gray-600">
                      عرض {startIndex + 1}-{Math.min(endIndex, totalResults)} من {totalResults} نتيجة
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="p-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {getPageNumbers().map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`px-2 py-1 border rounded-md text-xs ${
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
                        className="p-1.5 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Empty State */}
            {!isLoading && resultsCount === 0 && (
              <div className="text-center py-8 bg-white border rounded-lg">
                <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <h3 className="text-base font-semibold mb-1">لا توجد نتائج</h3>
                <p className="text-sm text-gray-600">جرب تغيير معايير البحث أو الفلاتر</p>
              </div>
            )}
        </div>
      </div>

      {/* Employee Card Modal */}
      {isEmployeeCardOpen && selectedEmployee && (
        <EmployeeCard
          employee={selectedEmployee}
          onClose={handleCloseEmployeeCard}
          onUpdate={handleEmployeeUpdate}
        />
      )}

      {/* Company Detail Modal */}
      {showCompanyDetailModal && selectedCompanyForDetail && (
        <CompanyDetailModal
          company={{
            ...selectedCompanyForDetail,
            employee_count: filteredEmployees.filter(e => e.company_id === selectedCompanyForDetail.id).length,
            available_slots: Math.max(0, (selectedCompanyForDetail.max_employees || 4) - filteredEmployees.filter(e => e.company_id === selectedCompanyForDetail.id).length),
            max_employees: selectedCompanyForDetail.max_employees || 4
          }}
          onClose={handleCloseCompanyDetailModal}
          onEdit={handleEditCompanyFromDetail}
          onDelete={handleDeleteCompanyFromDetail}
        />
      )}

      {/* Company Modal */}
      {isCompanyModalOpen && (
        <CompanyModal
          isOpen={isCompanyModalOpen}
          company={selectedCompany}
          onClose={handleCloseCompanyModal}
          onSuccess={handleCompanyUpdate}
        />
      )}
    </Layout>
  )
}