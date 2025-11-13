import { useState, useEffect, useCallback } from 'react' // [FIX] تم إضافة useCallback
import Layout from '@/components/layout/Layout'
import { Search, Filter, X, Save, Download, Star, ChevronDown, ChevronUp, Grid3X3, List, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase, Company as CompanyType, Employee as EmployeeType } from '@/lib/supabase'
import { toast } from 'sonner'
import Fuse from 'fuse.js'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { useAuth } from '@/contexts/AuthContext'
import EmployeeCard from '@/components/employee/EmployeeCard'
import CompanyModal from '@/components/companies/CompanyModal'

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
  const [employees, setEmployees] = useState<EmployeeType[]>([])
  const [companies, setCompanies] = useState<CompanyType[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeType[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  
  // View and Pagination State
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  // Filter states for employees
  const [selectedNationality, setSelectedNationality] = useState<string>('all')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all')
  const [selectedProfession, setSelectedProfession] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [residenceStatus, setResidenceStatus] = useState<ResidenceStatus>('all')
  const [contractStatus, setContractStatus] = useState<ContractStatus>('all')
  
  // فلاتر جديدة للموظفين
  const [hasInsuranceExpiry, setHasInsuranceExpiry] = useState<string>('all')
  const [insuranceExpiryStatus, setInsuranceExpiryStatus] = useState<string>('all')
  const [hasPassport, setHasPassport] = useState<string>('all')

  const [hasBankAccount, setHasBankAccount] = useState<string>('all')
  const [birthDateRange, setBirthDateRange] = useState<string>('all')
  const [joiningDateRange, setJoiningDateRange] = useState<string>('all')
  
  // فلاتر البحث النصي للموظفين
  const [passportNumberSearch, setPassportNumberSearch] = useState<string>('')
  const [residenceNumberSearch, setResidenceNumberSearch] = useState<string>('')
  const [phoneSearch, setPhoneSearch] = useState<string>('')
  const [employeeNumberSearch, setEmployeeNumberSearch] = useState<string>('')
  const [contractNumberSearch, setContractNumberSearch] = useState<string>('')
  const [insuranceNumberSearch, setInsuranceNumberSearch] = useState<string>('')

  // Filter states for companies
  const [commercialRegStatus, setCommercialRegStatus] = useState<CompanyStatus>('all')
  const [insuranceStatus, setInsuranceStatus] = useState<CompanyStatus>('all')
  const [companyDateFilter, setCompanyDateFilter] = useState<'all' | 'commercial_expiring' | 'insurance_expiring'>('all')
  
  // فلاتر جديدة للشركات
  const [powerSubscriptionStatus, setPowerSubscriptionStatus] = useState<string>('all')
  const [moqeemSubscriptionStatus, setMoqeemSubscriptionStatus] = useState<string>('all')

  const [employeeCountFilter, setEmployeeCountFilter] = useState<string>('all')
  const [availableSlotsFilter, setAvailableSlotsFilter] = useState<string>('all')
  const [exemptionsFilter, setExemptionsFilter] = useState<string>('all')
  
  // فلاتر إضافية للمؤسسات
  const [companyInsuranceExpiryStatus, setCompanyInsuranceExpiryStatus] = useState<string>('all')
  const [unifiedNumberSearch, setUnifiedNumberSearch] = useState<string>('')
  const [taxNumberSearch, setTaxNumberSearch] = useState<string>('')
  const [laborSubscriptionNumberSearch, setLaborSubscriptionNumberSearch] = useState<string>('')
  const [maxEmployeesRange, setMaxEmployeesRange] = useState<string>('all')
  const [companyCreatedDateRange, setCompanyCreatedDateRange] = useState<string>('all')
  const [companyCreatedStartDate, setCompanyCreatedStartDate] = useState<string>('')
  const [companyCreatedEndDate, setCompanyCreatedEndDate] = useState<string>('')

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
            // Add additional_fields values to search
            ...(comp.additional_fields ? Object.values(comp.additional_fields).filter(v => v && typeof v === 'string') : [])
          ].filter(Boolean).join(' ')
        }))

        const fuseCompanies = new Fuse(searchableCompanies, {
          keys: ['name', 'tax_number', 'unified_number', 'searchableText'],
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

      // فلاتر جديدة للموظفين
      if (hasInsuranceExpiry !== 'all') {
        filteredEmps = filteredEmps.filter(e => {
          const hasExpiry = e.ending_subscription_insurance_date
          return hasInsuranceExpiry === 'yes' ? !!hasExpiry : !hasExpiry
        })
      }

      // حالة انتهاء اشتراك التأمين (محسّن)
      if (insuranceExpiryStatus !== 'all') {
        const today = new Date()
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        filteredEmps = filteredEmps.filter(e => {
          if (!e.ending_subscription_insurance_date) return insuranceExpiryStatus === 'no_expiry'
          const expiryDate = new Date(e.ending_subscription_insurance_date)
          
          if (insuranceExpiryStatus === 'expired') return expiryDate < today
          if (insuranceExpiryStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
          if (insuranceExpiryStatus === 'valid') return expiryDate > thirtyDaysLater
          if (insuranceExpiryStatus === 'no_expiry') return false
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

      if (phoneSearch.trim()) {
        filteredEmps = filteredEmps.filter(e => 
          e.phone?.includes(phoneSearch.trim())
        )
      }

      if (employeeNumberSearch.trim()) {
        filteredEmps = filteredEmps.filter(e => 
          e.employee_number?.toLowerCase().includes(employeeNumberSearch.toLowerCase().trim())
        )
      }

      if (contractNumberSearch.trim()) {
        filteredEmps = filteredEmps.filter(e => 
          e.contract_number?.toLowerCase().includes(contractNumberSearch.toLowerCase().trim())
        )
      }

      if (insuranceNumberSearch.trim()) {
        filteredEmps = filteredEmps.filter(e => 
          e.insurance_number?.toLowerCase().includes(insuranceNumberSearch.toLowerCase().trim())
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
    if (searchType === 'companies' || searchType === 'both') {

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
          if (!c.exemptions) return false
          return c.exemptions === exemptionsFilter
        })
      }

      // حالة انتهاء اشتراك التأمين للمؤسسة
      if (companyInsuranceExpiryStatus !== 'all') {
        const today = new Date()
        const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        filteredComps = filteredComps.filter(c => {
          if (!c.ending_subscription_insurance_date) return companyInsuranceExpiryStatus === 'no_expiry'
          const expiryDate = new Date(c.ending_subscription_insurance_date)
          
          if (companyInsuranceExpiryStatus === 'expired') return expiryDate < today
          if (companyInsuranceExpiryStatus === 'expiring_soon') return expiryDate >= today && expiryDate <= thirtyDaysLater
          if (companyInsuranceExpiryStatus === 'valid') return expiryDate > thirtyDaysLater
          if (companyInsuranceExpiryStatus === 'no_expiry') return false
          return true
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
          c.tax_number?.toString().includes(taxNumberSearch.trim())
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
    }

    setFilteredEmployees(filteredEmps)
    setFilteredCompanies(filteredComps)
  }, [ // [FIX] مصفوفة الاعتماديات لـ useCallback
    employees, 
    companies, 
    searchQuery, 
    searchType, 
    selectedNationality, 
    selectedCompanyFilter, 
    selectedProfession, 
    selectedProject, 
    residenceStatus, 
    contractStatus, 
    hasInsuranceExpiry,
    insuranceExpiryStatus,
    hasPassport,
    hasBankAccount, 
    birthDateRange, 
    joiningDateRange,
    passportNumberSearch,
    residenceNumberSearch,
    phoneSearch,
    employeeNumberSearch,
    contractNumberSearch,
    insuranceNumberSearch,
    commercialRegStatus, 
    insuranceStatus, 
    companyDateFilter, 
    powerSubscriptionStatus, 
    moqeemSubscriptionStatus, 
    employeeCountFilter, 
    availableSlotsFilter,
    exemptionsFilter,
    companyInsuranceExpiryStatus,
    unifiedNumberSearch,
    taxNumberSearch,
    laborSubscriptionNumberSearch,
    maxEmployeesRange,
    companyCreatedDateRange,
    companyCreatedStartDate,
    companyCreatedEndDate
  ])

  useEffect(() => {
    loadData()
    loadSavedSearches()
  }, [loadData, loadSavedSearches]) // [FIX] تم التحديث

  useEffect(() => {
    applyFilters()
    setCurrentPage(1) // Reset to first page when filters change
  }, [applyFilters]) // [FIX] تم التحديث

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedNationality('all')
    setSelectedCompanyFilter('all')
    setSelectedProfession('all')
    setSelectedProject('all')
    setResidenceStatus('all')
    setContractStatus('all')
    
    // فلاتر جديدة للموظفين
    setHasInsuranceExpiry('all')
    setInsuranceExpiryStatus('all')
    setHasPassport('all')
    setHasBankAccount('all')
    setBirthDateRange('all')
    setJoiningDateRange('all')
    setPassportNumberSearch('')
    setResidenceNumberSearch('')
    setPhoneSearch('')
    setEmployeeNumberSearch('')
    setContractNumberSearch('')
    setInsuranceNumberSearch('')
    
    setCommercialRegStatus('all')
    setInsuranceStatus('all')
    setCompanyDateFilter('all')
    setExemptionsFilter('all')
    
    // فلاتر جديدة للشركات
    setPowerSubscriptionStatus('all')
    setMoqeemSubscriptionStatus('all')
    setEmployeeCountFilter('all')
    setAvailableSlotsFilter('all')
    setCompanyInsuranceExpiryStatus('all')
    setUnifiedNumberSearch('')
    setTaxNumberSearch('')
    setLaborSubscriptionNumberSearch('')
    setMaxEmployeesRange('all')
    setCompanyCreatedDateRange('all')
    setCompanyCreatedStartDate('')
    setCompanyCreatedEndDate('')
    
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
          company: selectedCompanyFilter,
          profession: selectedProfession,
          project: selectedProject,
          residenceStatus,
          contractStatus,
          hasInsuranceExpiry,
          insuranceExpiryStatus,
          hasPassport,
          hasBankAccount,
          birthDateRange,
          joiningDateRange,
          passportNumberSearch,
          residenceNumberSearch,
          phoneSearch,
          employeeNumberSearch,
          contractNumberSearch,
          insuranceNumberSearch,
          commercialRegStatus,
          insuranceStatus,
          companyDateFilter,
          powerSubscriptionStatus,
          moqeemSubscriptionStatus,
          employeeCountFilter,
          availableSlotsFilter,
          exemptionsFilter,
          companyInsuranceExpiryStatus,
          unifiedNumberSearch,
          taxNumberSearch,
          laborSubscriptionNumberSearch,
          maxEmployeesRange,
          companyCreatedDateRange,
          companyCreatedStartDate,
          companyCreatedEndDate
        }
      })

      if (error) {
        console.error('Error saving search:', error)
        throw error
      }
      
      toast.success('تم حفظ البحث بنجاح')
      loadSavedSearches() // [FIX] نستخدم الدالة المغلفة
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
      setSelectedCompanyFilter(saved.filters.company || 'all')
      setSelectedProfession(saved.filters.profession || 'all')
      setSelectedProject(saved.filters.project || 'all')
      setResidenceStatus(saved.filters.residenceStatus || 'all')
      setContractStatus(saved.filters.contractStatus || 'all')
      setHasInsuranceExpiry(saved.filters.hasInsuranceExpiry || 'all')
      setInsuranceExpiryStatus(saved.filters.insuranceExpiryStatus || 'all')
      setHasPassport(saved.filters.hasPassport || 'all')
      setHasBankAccount(saved.filters.hasBankAccount || 'all')
      setBirthDateRange(saved.filters.birthDateRange || 'all')
      setJoiningDateRange(saved.filters.joiningDateRange || 'all')
      setPassportNumberSearch(saved.filters.passportNumberSearch || '')
      setResidenceNumberSearch(saved.filters.residenceNumberSearch || '')
      setPhoneSearch(saved.filters.phoneSearch || '')
      setEmployeeNumberSearch(saved.filters.employeeNumberSearch || '')
      setContractNumberSearch(saved.filters.contractNumberSearch || '')
      setInsuranceNumberSearch(saved.filters.insuranceNumberSearch || '')
      setCommercialRegStatus(saved.filters.commercialRegStatus || 'all')
      setInsuranceStatus(saved.filters.insuranceStatus || 'all')
      setCompanyDateFilter(saved.filters.companyDateFilter || 'all')
      setPowerSubscriptionStatus(saved.filters.powerSubscriptionStatus || 'all')
      setMoqeemSubscriptionStatus(saved.filters.moqeemSubscriptionStatus || 'all')
      setEmployeeCountFilter(saved.filters.employeeCountFilter || 'all')
      setAvailableSlotsFilter(saved.filters.availableSlotsFilter || 'all')
      setExemptionsFilter(saved.filters.exemptionsFilter || 'all')
      setCompanyInsuranceExpiryStatus(saved.filters.companyInsuranceExpiryStatus || 'all')
      setUnifiedNumberSearch(saved.filters.unifiedNumberSearch || '')
      setTaxNumberSearch(saved.filters.taxNumberSearch || '')
      setLaborSubscriptionNumberSearch(saved.filters.laborSubscriptionNumberSearch || '')
      setMaxEmployeesRange(saved.filters.maxEmployeesRange || 'all')
      setCompanyCreatedDateRange(saved.filters.companyCreatedDateRange || 'all')
      setCompanyCreatedStartDate(saved.filters.companyCreatedStartDate || '')
      setCompanyCreatedEndDate(saved.filters.companyCreatedEndDate || '')
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
          'رقم اشتراك التأمينات': comp.tax_number,
          'رقم موحد': comp.unified_number,
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
        delete (employeeWithCompany as any).companies
        
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
    setSelectedCompany(company)
    setIsCompanyModalOpen(true)
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
                        <label className="block text-sm font-medium mb-1">حالة اشتراك التأمينات</label>
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

                      <div>
                        <label className="block text-sm font-medium mb-1">الاعفاءات</label>
                        <select
                          value={exemptionsFilter}
                          onChange={(e) => setExemptionsFilter(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="تم الاعفاء">تم الاعفاء</option>
                          <option value="لم يتم الاعفاء">لم يتم الاعفاء</option>
                          <option value="أخرى">أخرى</option>
                        </select>
                      </div>

                      {/* فلاتر الحالات للمؤسسات */}
                      <div>
                        <label className="block text-sm font-medium mb-1">حالة انتهاء اشتراك التأمين</label>
                        <select
                          value={companyInsuranceExpiryStatus}
                          onChange={(e) => setCompanyInsuranceExpiryStatus(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="expired">منتهي</option>
                          <option value="expiring_soon">قريب الانتهاء (30 يوم)</option>
                          <option value="valid">ساري</option>
                          <option value="no_expiry">غير محدد</option>
                        </select>
                      </div>

                      {/* فلاتر البحث النصي للمؤسسات */}
                      <div>
                        <label className="block text-sm font-medium mb-1">بحث الرقم الموحد</label>
                        <input
                          type="text"
                          value={unifiedNumberSearch}
                          onChange={(e) => setUnifiedNumberSearch(e.target.value)}
                          placeholder="ابحث بالرقم الموحد..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">بحث الرقم التأميني</label>
                        <input
                          type="text"
                          value={taxNumberSearch}
                          onChange={(e) => setTaxNumberSearch(e.target.value)}
                          placeholder="ابحث بالرقم التأميني..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">بحث رقم اشتراك قوى</label>
                        <input
                          type="text"
                          value={laborSubscriptionNumberSearch}
                          onChange={(e) => setLaborSubscriptionNumberSearch(e.target.value)}
                          placeholder="ابحث برقم اشتراك قوى..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>

                      {/* فلاتر النطاقات للمؤسسات */}
                      <div>
                        <label className="block text-sm font-medium mb-1">الحد الأقصى للموظفين</label>
                        <select
                          value={maxEmployeesRange}
                          onChange={(e) => setMaxEmployeesRange(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="1_2">1 - 2</option>
                          <option value="3_4">3 - 4</option>
                          <option value="5_10">5 - 10</option>
                          <option value="over_10">أكثر من 10</option>
                        </select>
                      </div>

                      {/* فلتر تاريخ إنشاء المؤسسة */}
                      <div>
                        <label className="block text-sm font-medium mb-1">تاريخ إنشاء المؤسسة</label>
                        <select
                          value={companyCreatedDateRange}
                          onChange={(e) => setCompanyCreatedDateRange(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="last_month">آخر شهر</option>
                          <option value="last_3_months">آخر 3 أشهر</option>
                          <option value="last_year">آخر سنة</option>
                          <option value="custom">مخصص</option>
                        </select>
                      </div>

                      {/* Custom Date Range */}
                      {companyCreatedDateRange === 'custom' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1">من تاريخ</label>
                            <input
                              type="date"
                              value={companyCreatedStartDate}
                              onChange={(e) => setCompanyCreatedStartDate(e.target.value)}
                              className="w-full px-3 py-2 border rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">إلى تاريخ</label>
                            <input
                              type="date"
                              value={companyCreatedEndDate}
                              onChange={(e) => setCompanyCreatedEndDate(e.target.value)}
                              className="w-full px-3 py-2 border rounded-md"
                            />
                          </div>
                        </>
                      )}
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
                          value={selectedCompanyFilter}
                          onChange={(e) => setSelectedCompanyFilter(e.target.value)}
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

                      {/* فلاتر الحالات للموظفين */}
                      <div>
                        <label className="block text-sm font-medium mb-1">حالة انتهاء اشتراك التأمين</label>
                        <select
                          value={insuranceExpiryStatus}
                          onChange={(e) => setInsuranceExpiryStatus(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="expired">منتهي</option>
                          <option value="expiring_soon">قريب الانتهاء (30 يوم)</option>
                          <option value="valid">ساري</option>
                          <option value="no_expiry">غير محدد</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">رقم الجواز</label>
                        <select
                          value={hasPassport}
                          onChange={(e) => setHasPassport(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="all">الكل</option>
                          <option value="yes">موجود</option>
                          <option value="no">غير موجود</option>
                        </select>
                      </div>

                      {/* فلاتر البحث النصي للموظفين */}
                      <div>
                        <label className="block text-sm font-medium mb-1">بحث رقم الجواز</label>
                        <input
                          type="text"
                          value={passportNumberSearch}
                          onChange={(e) => setPassportNumberSearch(e.target.value)}
                          placeholder="ابحث برقم الجواز..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">بحث رقم الإقامة</label>
                        <input
                          type="text"
                          value={residenceNumberSearch}
                          onChange={(e) => setResidenceNumberSearch(e.target.value)}
                          placeholder="ابحث برقم الإقامة..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">بحث رقم الهاتف</label>
                        <input
                          type="text"
                          value={phoneSearch}
                          onChange={(e) => setPhoneSearch(e.target.value)}
                          placeholder="ابحث برقم الهاتف..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">بحث رقم الموظف</label>
                        <input
                          type="text"
                          value={employeeNumberSearch}
                          onChange={(e) => setEmployeeNumberSearch(e.target.value)}
                          placeholder="ابحث برقم الموظف..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">بحث رقم العقد</label>
                        <input
                          type="text"
                          value={contractNumberSearch}
                          onChange={(e) => setContractNumberSearch(e.target.value)}
                          placeholder="ابحث برقم العقد..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">بحث رقم التأمين</label>
                        <input
                          type="text"
                          value={insuranceNumberSearch}
                          onChange={(e) => setInsuranceNumberSearch(e.target.value)}
                          placeholder="ابحث برقم التأمين..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
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
                          <div 
                            key={emp.id} 
                            onClick={() => handleEmployeeClick(emp)}
                            className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                          >
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
                                <tr 
                                  key={emp.id} 
                                  onClick={() => handleEmployeeClick(emp)}
                                  className="border-t hover:bg-gray-50 cursor-pointer"
                                >
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
                          <div 
                            key={comp.id} 
                            onClick={() => handleCompanyClick(comp)}
                            className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                          >
                            <h3 className="font-bold text-lg mb-2">{comp.name}</h3>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-gray-600">رقم اشتراك التأمينات:</span> {comp.tax_number}</p>
                              <p><span className="text-gray-600">رقم موحد:</span> {comp.unified_number}</p>
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
                                <th className="px-4 py-2 text-right">رقم اشتراك التأمينات</th>
                                <th className="px-4 py-2 text-right">رقم موحد</th>
                                <th className="px-4 py-2 text-right">انتهاء السجل</th>
                                <th className="px-4 py-2 text-right">انتهاء التأمينات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedCompanies.map(comp => (
                                <tr 
                                  key={comp.id} 
                                  onClick={() => handleCompanyClick(comp)}
                                  className="border-t hover:bg-gray-50 cursor-pointer"
                                >
                                  <td className="px-4 py-2 font-medium">{comp.name}</td>
                                  <td className="px-4 py-2">{comp.tax_number}</td>
                                  <td className="px-4 py-2">{comp.unified_number}</td>
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

      {/* Employee Card Modal */}
      {isEmployeeCardOpen && selectedEmployee && (
        <EmployeeCard
          employee={selectedEmployee}
          onClose={handleCloseEmployeeCard}
          onUpdate={handleEmployeeUpdate}
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