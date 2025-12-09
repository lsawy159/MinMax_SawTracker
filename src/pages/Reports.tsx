import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/layout/Layout'
import { BarChart3, RefreshCw, Download, AlertTriangle, Calendar, TrendingUp, Building2, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { DEFAULT_STATUS_THRESHOLDS, getStatusThresholds } from '@/utils/autoCompanyStatus'
import { usePermissions } from '@/utils/permissions'

interface SubscriptionItem {
  type: string
  name: string
  expiryDate: string
  daysRemaining: number
  status: 'expired' | 'urgent' | 'medium' | 'valid'
}

type TabType = 'companies' | 'employees'

export default function Reports() {
  const { canExport } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('companies')
  // Statistics for active tab
  const [totalExpired, setTotalExpired] = useState(0)
  const [totalUrgent, setTotalUrgent] = useState(0)
  const [totalMedium, setTotalMedium] = useState(0)
  const [totalValid, setTotalValid] = useState(0)
  
  // Subscription items for table
  const [subscriptionItems, setSubscriptionItems] = useState<SubscriptionItem[]>([])
  const [filteredItems, setFilteredItems] = useState<SubscriptionItem[]>([])
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [statusThresholds, setStatusThresholds] = useState<typeof DEFAULT_STATUS_THRESHOLDS>(DEFAULT_STATUS_THRESHOLDS)
  

  // Load status thresholds on mount
  useEffect(() => {
    const loadThresholds = async () => {
      const thresholds = await getStatusThresholds()
      setStatusThresholds(thresholds)
    }
    loadThresholds()
  }, [])

  // Helper function to categorize expiry
  const categorizeExpiry = useCallback((expiryDate: string | null | undefined): 'expired' | 'urgent' | 'medium' | 'valid' | null => {
    if (!expiryDate) return null
    const days = differenceInDays(new Date(expiryDate), new Date())
    if (days < 0) return 'expired'
    
    const criticalDays = statusThresholds.commercial_reg_critical_days || 7
    const urgentDays = statusThresholds.commercial_reg_urgent_days || 30
    const mediumDays = statusThresholds.commercial_reg_medium_days || 45
    
    if (days <= criticalDays) return 'urgent' // حرج
    if (days <= urgentDays) return 'urgent' // عاجل
    if (days <= mediumDays) return 'medium' // متوسط
    return 'valid'
  }, [statusThresholds])


  // Calculate statistics for active tab
  const updateTabStatistics = useCallback((items: SubscriptionItem[], tab: TabType) => {
    // Filter items by tab
    const tabItems = items.filter(item => {
      if (tab === 'companies') {
        return ['سجل تجاري', 'تأمينات اجتماعية', 'اشتراك مقيم', 'اشتراك قوى'].includes(item.type)
      } else {
        return ['إقامة', 'عقد', 'عقد أجير', 'تأمين صحي'].includes(item.type)
      }
    })

    // Calculate statistics
    const stats = {
      expired: tabItems.filter(item => item.status === 'expired').length,
      urgent: tabItems.filter(item => item.status === 'urgent').length,
      medium: tabItems.filter(item => item.status === 'medium').length,
      valid: tabItems.filter(item => item.status === 'valid').length
    }

    setTotalExpired(stats.expired)
    setTotalUrgent(stats.urgent)
    setTotalMedium(stats.medium)
    setTotalValid(stats.valid)
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

      // Employees and companies data are used directly, not stored in state

      // Calculate statistics and build subscription items
      if (employeesData && companiesData) {
        // Build subscription items list
        const items: SubscriptionItem[] = []

        // ========== EMPLOYEE ITEMS ==========
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

        // Hired worker contracts (عقد أجير)
        employeesData.forEach(emp => {
          if (emp.hired_worker_contract_expiry) {
            const days = differenceInDays(new Date(emp.hired_worker_contract_expiry), new Date())
            const status = categorizeExpiry(emp.hired_worker_contract_expiry)
            if (status) {
              items.push({
                type: 'عقد أجير',
                name: emp.name,
                expiryDate: emp.hired_worker_contract_expiry,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // Employee health insurance (التأمين الصحي)
        employeesData.forEach(emp => {
          if (emp.health_insurance_expiry) {
            const days = differenceInDays(new Date(emp.health_insurance_expiry), new Date())
            const status = categorizeExpiry(emp.health_insurance_expiry)
            if (status) {
              items.push({
                type: 'تأمين صحي',
                name: emp.name,
                expiryDate: emp.health_insurance_expiry,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // ========== COMPANY ITEMS ==========
        // Commercial registration (السجل التجاري)
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

        // Social insurance (التأمينات الاجتماعية)
        companiesData.forEach(comp => {
          if (comp.social_insurance_expiry) {
            const days = differenceInDays(new Date(comp.social_insurance_expiry), new Date())
            const status = categorizeExpiry(comp.social_insurance_expiry)
            if (status) {
              items.push({
                type: 'تأمينات اجتماعية',
                name: comp.name,
                expiryDate: comp.social_insurance_expiry,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // Resident subscription (اشتراك مقيم)
        companiesData.forEach(comp => {
          if (comp.ending_subscription_moqeem_date) {
            const days = differenceInDays(new Date(comp.ending_subscription_moqeem_date), new Date())
            const status = categorizeExpiry(comp.ending_subscription_moqeem_date)
            if (status) {
              items.push({
                type: 'اشتراك مقيم',
                name: comp.name,
                expiryDate: comp.ending_subscription_moqeem_date,
                daysRemaining: days,
                status
              })
            }
          }
        })

        // Power subscription (اشتراك قوى)
        companiesData.forEach(comp => {
          if (comp.ending_subscription_power_date) {
            const days = differenceInDays(new Date(comp.ending_subscription_power_date), new Date())
            const status = categorizeExpiry(comp.ending_subscription_power_date)
            if (status) {
              items.push({
                type: 'اشتراك قوى',
                name: comp.name,
                expiryDate: comp.ending_subscription_power_date,
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
        
        // Calculate statistics for current tab
        updateTabStatistics(items, activeTab)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [activeTab, categorizeExpiry, updateTabStatistics])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Update statistics when tab changes
  useEffect(() => {
    if (subscriptionItems.length > 0) {
      updateTabStatistics(subscriptionItems, activeTab)
    }
  }, [activeTab, subscriptionItems, updateTabStatistics])

  // Reset filter type when tab changes
  useEffect(() => {
    setFilterType('all')
  }, [activeTab])

  // Filter items by tab and filters
  useEffect(() => {
    // First filter by tab
    let filtered = subscriptionItems.filter(item => {
      if (activeTab === 'companies') {
        return ['سجل تجاري', 'تأمينات اجتماعية', 'اشتراك مقيم', 'اشتراك قوى'].includes(item.type)
      } else {
        return ['إقامة', 'عقد', 'عقد أجير', 'تأمين صحي'].includes(item.type)
      }
    })

    // Then filter by type if not 'all'
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType)
    }

    // Then filter by status if not 'all'
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus)
    }

    setFilteredItems(filtered)
  }, [filterType, filterStatus, subscriptionItems, activeTab])

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredItems.map(item => ({
      'النوع': item.type,
      'الاسم': item.name,
      'تاريخ الانتهاء': item.expiryDate,
      'الأيام المتبقية': item.daysRemaining,
      'الحالة': item.status === 'expired' ? 'منتهي' : item.status === 'urgent' ? (item.daysRemaining <= (statusThresholds.commercial_reg_critical_days || 7) ? 'حرج' : 'عاجل') : item.status === 'medium' ? 'متوسط' : 'ساري'
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'companies' ? 'المؤسسات' : 'الموظفين')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const tabName = activeTab === 'companies' ? 'المؤسسات' : 'الموظفين'
    saveAs(blob, `تقرير_${tabName}_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('تم تصدير البيانات بنجاح')
  }

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
            {canExport('reports') && (
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                تصدير Excel
              </button>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('companies')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'companies'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              <span>المؤسسات</span>
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                activeTab === 'employees'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>الموظفين</span>
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div>
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
                <p className="text-sm text-gray-600 mb-1">عاجل</p>
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
                <p className="text-sm text-gray-600 mb-1">متوسط</p>
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
                <p className="text-sm text-gray-600 mb-1">ساري</p>
                <p className="text-2xl font-bold text-green-600">{totalValid}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
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
                {activeTab === 'companies' ? (
                  <>
                    <option value="سجل تجاري">سجل تجاري</option>
                    <option value="تأمينات اجتماعية">تأمينات اجتماعية</option>
                    <option value="اشتراك مقيم">اشتراك مقيم</option>
                    <option value="اشتراك قوى">اشتراك قوى</option>
                  </>
                ) : (
                  <>
                    <option value="إقامة">إقامة</option>
                    <option value="عقد">عقد</option>
                    <option value="عقد أجير">عقد أجير</option>
                    <option value="تأمين صحي">تأمين صحي</option>
                  </>
                )}
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
      </div>
    </Layout>
  )
}
