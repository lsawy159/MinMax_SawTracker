import { useState, useEffect, useCallback } from '../react-init'
import Layout from '../components/layout/Layout'
import { BarChart3, RefreshCw, Download, FileText, AlertTriangle, Calendar, TrendingUp } from 'lucide-react'
import { supabase, Employee as EmployeeType, Company as CompanyType } from '../lib/supabase'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

interface ExpiryStats {
  expired: number
  urgent: number
  medium: number
  valid: number
}

interface SubscriptionItem {
  type: string
  name: string
  expiryDate: string
  daysRemaining: number
  status: 'expired' | 'urgent' | 'medium' | 'valid'
}

const COLORS = {
  expired: '#ef4444', // red
  urgent: '#f97316', // orange
  medium: '#eab308', // yellow
  valid: '#22c55e' // green
}

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<EmployeeType[]>([])
  const [companies, setCompanies] = useState<CompanyType[]>([])
  
  // Overall statistics
  const [totalExpired, setTotalExpired] = useState(0)
  const [totalUrgent, setTotalUrgent] = useState(0)
  const [totalMedium, setTotalMedium] = useState(0)
  const [totalValid, setTotalValid] = useState(0)
  
  // Detailed statistics
  const [residenceStats, setResidenceStats] = useState<ExpiryStats>({ expired: 0, urgent: 0, medium: 0, valid: 0 })
  const [contractStats, setContractStats] = useState<ExpiryStats>({ expired: 0, urgent: 0, medium: 0, valid: 0 })
  const [commercialRegStats, setCommercialRegStats] = useState<ExpiryStats>({ expired: 0, urgent: 0, medium: 0, valid: 0 })
  const [companyInsuranceStats, setCompanyInsuranceStats] = useState<ExpiryStats>({ expired: 0, urgent: 0, medium: 0, valid: 0 })
  const [employeeInsuranceStats, setEmployeeInsuranceStats] = useState<ExpiryStats>({ expired: 0, urgent: 0, medium: 0, valid: 0 })
  
  // Subscription items for table
  const [subscriptionItems, setSubscriptionItems] = useState<SubscriptionItem[]>([])
  const [filteredItems, setFilteredItems] = useState<SubscriptionItem[]>([])
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Helper function to categorize expiry
  const categorizeExpiry = (expiryDate: string | null | undefined): 'expired' | 'urgent' | 'medium' | 'valid' | null => {
    if (!expiryDate) return null
    const days = differenceInDays(new Date(expiryDate), new Date())
    if (days < 0) return 'expired'
    if (days <= 30) return 'urgent'
    if (days <= 90) return 'medium'
    return 'valid'
  }

  // Calculate statistics for a set of dates
  const calculateStats = useCallback((dates: (string | null | undefined)[]): ExpiryStats => {
    const stats: ExpiryStats = { expired: 0, urgent: 0, medium: 0, valid: 0 }
    dates.forEach(date => {
      const category = categorizeExpiry(date)
      if (category) stats[category]++
    })
    return stats
  }, [])

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('name')

      if (employeesError) throw employeesError

      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name')

      if (companiesError) throw companiesError

      if (employeesData) setEmployees(employeesData)
      if (companiesData) setCompanies(companiesData)

      // Calculate statistics
      if (employeesData && companiesData) {
        // Residence statistics
        const residenceDates = employeesData.map(e => e.residence_expiry)
        const residenceStatsData = calculateStats(residenceDates)
        setResidenceStats(residenceStatsData)

        // Contract statistics
        const contractDates = employeesData.map(e => e.contract_expiry)
        const contractStatsData = calculateStats(contractDates)
        setContractStats(contractStatsData)

        // Employee insurance statistics
        const employeeInsuranceDates = employeesData.map(e => e.ending_subscription_insurance_date)
        const employeeInsuranceStatsData = calculateStats(employeeInsuranceDates)
        setEmployeeInsuranceStats(employeeInsuranceStatsData)

        // Commercial registration statistics
        const commercialRegDates = companiesData.map(c => c.commercial_registration_expiry)
        const commercialRegStatsData = calculateStats(commercialRegDates)
        setCommercialRegStats(commercialRegStatsData)

        // Company insurance statistics
        const companyInsuranceDates = companiesData.map(c => c.insurance_subscription_expiry)
        const companyInsuranceStatsData = calculateStats(companyInsuranceDates)
        setCompanyInsuranceStats(companyInsuranceStatsData)

        // Calculate overall statistics
        const allStats = [
          residenceStatsData,
          contractStatsData,
          employeeInsuranceStatsData,
          commercialRegStatsData,
          companyInsuranceStatsData
        ]

        const overall = allStats.reduce((acc, stat) => ({
          expired: acc.expired + stat.expired,
          urgent: acc.urgent + stat.urgent,
          medium: acc.medium + stat.medium,
          valid: acc.valid + stat.valid
        }), { expired: 0, urgent: 0, medium: 0, valid: 0 })

        setTotalExpired(overall.expired)
        setTotalUrgent(overall.urgent)
        setTotalMedium(overall.medium)
        setTotalValid(overall.valid)

        // Build subscription items list
        const items: SubscriptionItem[] = []

        // Employee residences
        employeesData.forEach(emp => {
          if (emp.residence_expiry) {
            const days = differenceInDays(new Date(emp.residence_expiry), new Date())
            const status = categorizeExpiry(emp.residence_expiry)
            if (status) {
              items.push({
                type: 'إقامة',
                name: emp.name,
                expiryDate: emp.residence_expiry,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // Employee contracts
        employeesData.forEach(emp => {
          if (emp.contract_expiry) {
            const days = differenceInDays(new Date(emp.contract_expiry), new Date())
            const status = categorizeExpiry(emp.contract_expiry)
            if (status) {
              items.push({
                type: 'عقد',
                name: emp.name,
                expiryDate: emp.contract_expiry,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // Employee insurance
        employeesData.forEach(emp => {
          if (emp.ending_subscription_insurance_date) {
            const days = differenceInDays(new Date(emp.ending_subscription_insurance_date), new Date())
            const status = categorizeExpiry(emp.ending_subscription_insurance_date)
            if (status) {
              items.push({
                type: 'تأمين موظف',
                name: emp.name,
                expiryDate: emp.ending_subscription_insurance_date,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // Commercial registration
        companiesData.forEach(comp => {
          if (comp.commercial_registration_expiry) {
            const days = differenceInDays(new Date(comp.commercial_registration_expiry), new Date())
            const status = categorizeExpiry(comp.commercial_registration_expiry)
            if (status) {
              items.push({
                type: 'سجل تجاري',
                name: comp.name,
                expiryDate: comp.commercial_registration_expiry,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // Company insurance
        companiesData.forEach(comp => {
          if (comp.insurance_subscription_expiry) {
            const days = differenceInDays(new Date(comp.insurance_subscription_expiry), new Date())
            const status = categorizeExpiry(comp.insurance_subscription_expiry)
            if (status) {
              items.push({
                type: 'تأمين مؤسسة',
                name: comp.name,
                expiryDate: comp.insurance_subscription_expiry,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // Sort by priority (expired first, then urgent, then medium, then valid)
        items.sort((a, b) => {
          const priorityOrder = { expired: 0, urgent: 1, medium: 2, valid: 3 }
          if (priorityOrder[a.status] !== priorityOrder[b.status]) {
            return priorityOrder[a.status] - priorityOrder[b.status]
          }
          return a.daysRemaining - b.daysRemaining
        })

      setSubscriptionItems(items)
      setFilteredItems(items)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [calculateStats])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter items
  useEffect(() => {
    let filtered = [...subscriptionItems]

    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus)
    }

    setFilteredItems(filtered)
  }, [filterType, filterStatus, subscriptionItems])

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredItems.map(item => ({
      'النوع': item.type,
      'الاسم': item.name,
      'تاريخ الانتهاء': item.expiryDate,
      'الأيام المتبقية': item.daysRemaining,
      'الحالة': item.status === 'expired' ? 'منتهي' : item.status === 'urgent' ? 'عاجل' : item.status === 'medium' ? 'متوسط' : 'ساري'
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الاشتراكات')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `تقرير_الاشتراكات_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('تم تصدير البيانات بنجاح')
  }

  // Prepare chart data
  const residenceChartData = [
    { name: 'منتهية', value: residenceStats.expired, color: COLORS.expired },
    { name: 'عاجلة', value: residenceStats.urgent, color: COLORS.urgent },
    { name: 'متوسطة', value: residenceStats.medium, color: COLORS.medium },
    { name: 'سارية', value: residenceStats.valid, color: COLORS.valid }
  ]

  const contractChartData = [
    { name: 'منتهية', value: contractStats.expired, color: COLORS.expired },
    { name: 'عاجلة', value: contractStats.urgent, color: COLORS.urgent },
    { name: 'متوسطة', value: contractStats.medium, color: COLORS.medium },
    { name: 'سارية', value: contractStats.valid, color: COLORS.valid }
  ]

  const commercialRegChartData = [
    { name: 'منتهي', value: commercialRegStats.expired },
    { name: 'عاجل', value: commercialRegStats.urgent },
    { name: 'متوسط', value: commercialRegStats.medium },
    { name: 'ساري', value: commercialRegStats.valid }
  ]

  const companyInsurancePieData = [
    { name: 'منتهي', value: companyInsuranceStats.expired },
    { name: 'عاجل', value: companyInsuranceStats.urgent },
    { name: 'متوسط', value: companyInsuranceStats.medium },
    { name: 'ساري', value: companyInsuranceStats.valid }
  ]

  const stackedChartData = [
    {
      name: 'الإقامات',
      منتهية: residenceStats.expired,
      عاجلة: residenceStats.urgent,
      متوسطة: residenceStats.medium,
      سارية: residenceStats.valid
    },
    {
      name: 'العقود',
      منتهية: contractStats.expired,
      عاجلة: contractStats.urgent,
      متوسطة: contractStats.medium,
      سارية: contractStats.valid
    },
    {
      name: 'السجلات التجارية',
      منتهية: commercialRegStats.expired,
      عاجلة: commercialRegStats.urgent,
      متوسطة: commercialRegStats.medium,
      سارية: commercialRegStats.valid
    },
    {
      name: 'تأمين الموظفين',
      منتهية: employeeInsuranceStats.expired,
      عاجلة: employeeInsuranceStats.urgent,
      متوسطة: employeeInsuranceStats.medium,
      سارية: employeeInsuranceStats.valid
    },
    {
      name: 'تأمين المؤسسات',
      منتهية: companyInsuranceStats.expired,
      عاجلة: companyInsuranceStats.urgent,
      متوسطة: companyInsuranceStats.medium,
      سارية: companyInsuranceStats.valid
    }
  ]

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'urgent':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'valid':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'expired':
        return 'منتهي'
      case 'urgent':
        return 'عاجل'
      case 'medium':
        return 'متوسط'
      case 'valid':
        return 'ساري'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">جاري تحميل البيانات...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">التقارير</h1>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث البيانات
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              تصدير Excel
            </button>
            <button
              onClick={() => toast.info('ميزة تصدير PDF قيد التطوير')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              تصدير PDF
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي المنتهية</p>
                <p className="text-2xl font-bold text-red-600">{totalExpired}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">عاجلة (&lt; 30 يوم)</p>
                <p className="text-2xl font-bold text-orange-600">{totalUrgent}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">متوسطة (30-90 يوم)</p>
                <p className="text-2xl font-bold text-yellow-600">{totalMedium}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي السارية</p>
                <p className="text-2xl font-bold text-green-600">{totalValid}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Residence Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">توزيع انتهاء الإقامات</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={residenceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                {/* @ts-expect-error - recharts types issue */}
                <XAxis dataKey="name" />
                {/* @ts-expect-error - recharts types issue */}
                <YAxis />
                {/* @ts-expect-error - recharts types issue */}
                <Tooltip />
                {/* @ts-expect-error - recharts types issue */}
                <Legend />
                {/* @ts-expect-error - recharts types issue */}
                <Bar dataKey="value" fill="#8884d8">
                  {residenceChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Contract Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">توزيع انتهاء العقود</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={contractChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                {/* @ts-expect-error - recharts types issue */}
                <XAxis dataKey="name" />
                {/* @ts-expect-error - recharts types issue */}
                <YAxis />
                {/* @ts-expect-error - recharts types issue */}
                <Tooltip />
                {/* @ts-expect-error - recharts types issue */}
                <Legend />
                {/* @ts-expect-error - recharts types issue */}
                <Bar dataKey="value" fill="#8884d8">
                  {contractChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Commercial Registration Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">انتهاء السجلات التجارية</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={commercialRegChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                {/* @ts-expect-error - recharts types issue */}
                <XAxis dataKey="name" />
                {/* @ts-expect-error - recharts types issue */}
                <YAxis />
                {/* @ts-expect-error - recharts types issue */}
                <Tooltip />
                {/* @ts-expect-error - recharts types issue */}
                <Legend />
                {/* @ts-expect-error - recharts types issue */}
                <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Company Insurance Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">توزيع اشتراكات التأمين للمؤسسات</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                {/* @ts-expect-error - recharts types issue */}
                <Pie
                  data={companyInsurancePieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {companyInsurancePieData.map((entry, index) => {
                    const colors = [COLORS.expired, COLORS.urgent, COLORS.medium, COLORS.valid]
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  })}
                </Pie>
                {/* @ts-expect-error - recharts types issue */}
                <Tooltip />
                {/* @ts-expect-error - recharts types issue */}
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stacked Chart - Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">نظرة شاملة على جميع الاشتراكات</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stackedChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              {/* @ts-expect-error - recharts types issue */}
              <XAxis dataKey="name" />
              {/* @ts-expect-error - recharts types issue */}
              <YAxis />
              {/* @ts-expect-error - recharts types issue */}
              <Tooltip />
              {/* @ts-expect-error - recharts types issue */}
              <Legend />
              {/* @ts-expect-error - recharts types issue */}
              <Bar dataKey="منتهية" stackId="a" fill={COLORS.expired} />
              {/* @ts-expect-error - recharts types issue */}
              <Bar dataKey="عاجلة" stackId="a" fill={COLORS.urgent} />
              {/* @ts-expect-error - recharts types issue */}
              <Bar dataKey="متوسطة" stackId="a" fill={COLORS.medium} />
              {/* @ts-expect-error - recharts types issue */}
              <Bar dataKey="سارية" stackId="a" fill={COLORS.valid} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">الاشتراكات القريبة من الانتهاء</h2>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">جميع الأنواع</option>
                <option value="إقامة">إقامة</option>
                <option value="عقد">عقد</option>
                <option value="سجل تجاري">سجل تجاري</option>
                <option value="تأمين موظف">تأمين موظف</option>
                <option value="تأمين مؤسسة">تأمين مؤسسة</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">جميع الحالات</option>
                <option value="expired">منتهي</option>
                <option value="urgent">عاجل</option>
                <option value="medium">متوسط</option>
                <option value="valid">ساري</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right">النوع</th>
                  <th className="px-4 py-2 text-right">الاسم/المؤسسة</th>
                  <th className="px-4 py-2 text-right">تاريخ الانتهاء</th>
                  <th className="px-4 py-2 text-right">الأيام المتبقية</th>
                  <th className="px-4 py-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => (
                    <tr key={index} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{item.type}</td>
                      <td className="px-4 py-2 font-medium">{item.name}</td>
                      <td className="px-4 py-2">{item.expiryDate}</td>
                      <td className="px-4 py-2">
                        <span className={item.daysRemaining < 0 ? 'text-red-600 font-bold' : item.daysRemaining <= 30 ? 'text-orange-600' : ''}>
                          {item.daysRemaining < 0 ? `منتهي منذ ${Math.abs(item.daysRemaining)} يوم` : `${item.daysRemaining} يوم`}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadgeColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
