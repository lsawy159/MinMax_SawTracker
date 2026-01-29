import React, { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import { EnhancedAlertsSection } from '@/components/dashboard/EnhancedAlertsSection'
import { EnhancedAlertCard } from '@/components/alerts/EnhancedAlertCard'
import { logger } from '@/utils/logger'
import { 
  generateEnhancedCompanyAlerts,
  getEnhancedAlertsStats,
  getCriticalAlerts,
  generateAlertSummaryReport,
  type EnhancedAlert
} from '@/utils/enhancedCompanyAlerts'
import { Building2, Shield, FileText, Plus, Settings } from 'lucide-react'

// Test data for enhanced alerts
const testCompanies = [
  {
    id: '1',
    name: 'مؤسسة البناء المتقدمة',
    commercial_registration_number: 'CR1234567890',
    commercial_registration_expiry: '2025-11-20', // About 2 weeks - urgent
    insurance_subscription_expiry: '2025-12-01', // About 3 weeks - medium
    government_docs_renewal: '2025-10-15', // Already expired - critical
    created_at: '2024-01-01',
    updated_at: '2025-01-01'
  },
  {
    id: '2', 
    name: 'شركة التجارة والاستثمار',
    commercial_registration_number: 'CR9876543210',
    commercial_registration_expiry: '2025-12-31', // About 2 months - medium
    insurance_subscription_expiry: '2025-11-10', // About 1 week - urgent
    government_docs_renewal: '2026-01-15', // Future - no alert
    created_at: '2024-01-01',
    updated_at: '2025-01-01'
  },
  {
    id: '3',
    name: 'مؤسسة التقنية المتطورة',
    commercial_registration_number: 'CR5555666677',
    commercial_registration_expiry: '2026-06-15', // More than 6 months - no alert
    insurance_subscription_expiry: '2026-03-01', // More than 3 months - no alert
    government_docs_renewal: '2025-11-25', // About 3 weeks - medium
    created_at: '2024-01-01',
    updated_at: '2025-01-01'
  },
  {
    id: '4',
    name: 'شركة الخدمات اللوجستية',
    commercial_registration_number: 'CR1111222233',
    commercial_registration_expiry: '2025-10-05', // Already expired - critical
    insurance_subscription_expiry: '2025-09-28', // Already expired - critical
    government_docs_renewal: '2025-10-01', // Already expired - critical
    created_at: '2024-01-01',
    updated_at: '2025-01-01'
  },
  {
    id: '5',
    name: 'مؤسسة الاستشارات الإدارية',
    commercial_registration_number: 'CR4444555566',
    commercial_registration_expiry: '2025-12-10', // About 1 month - medium
    insurance_subscription_start: '2024-12-01', // Calculate expiry from start date
    government_docs_renewal: '2026-02-20', // Future - no alert
    created_at: '2024-01-01',
    updated_at: '2025-01-01'
  }
]

export default function EnhancedAlertsTestPage() {
  const [alerts, setAlerts] = useState<EnhancedAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<EnhancedAlert | null>(null)
  const [testMode, setTestMode] = useState<'enhanced' | 'basic'>('enhanced')

  useEffect(() => {
    // Generate enhanced alerts from test data
    const generatedAlerts = generateEnhancedCompanyAlerts(testCompanies)
    setAlerts(generatedAlerts)
    setLoading(false)
  }, [])

  // Handler functions
  const handleViewCompany = (companyId: string) => {
    logger.debug('View company:', companyId)
    // Navigate to company details
  }

  const handleRenewAction = (alertId: string) => {
    logger.debug('Renew action for alert:', alertId)
    // Start renewal process
  }

  const handleMarkAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert } : alert
    ))
  }

  // Filter alerts by type for demonstration
  const commercialRegAlerts = alerts.filter(alert => alert.alert_type === 'commercial_registration_expiry')
  const govDocsAlerts = alerts.filter(alert => alert.alert_type === 'government_docs_renewal')
  const criticalAlerts = getCriticalAlerts(alerts)
  const stats = getEnhancedAlertsStats(alerts)
  const summaryReport = generateAlertSummaryReport(alerts)

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">اختبار نظام التنبيهات المحسن</h1>
            <p className="text-sm text-gray-600 mt-1">
              اختبار شامل لنظام التنبيهات المحسن للمؤسسات
            </p>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setTestMode('enhanced')}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                testMode === 'enhanced' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
              }`}
            >
              النظام المحسن
            </button>
            <button
              onClick={() => setTestMode('basic')}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                testMode === 'basic' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
              }`}
            >
              النظام الأساسي
            </button>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">إجمالي التنبيهات</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-10 w-10 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">تنبيهات طارئة</p>
                <p className="text-3xl font-bold">{criticalAlerts.length}</p>
              </div>
              <Shield className="h-10 w-10 text-red-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">تنبيهات متوسطة</p>
                <p className="text-3xl font-bold">{stats.medium}</p>
              </div>
              <FileText className="h-10 w-10 text-yellow-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">التكلفة المقدرة</p>
                <p className="text-lg font-bold">
                  {summaryReport.estimatedRenewalCosts.currency} {summaryReport.estimatedRenewalCosts.min.toLocaleString()} - {summaryReport.estimatedRenewalCosts.max.toLocaleString()}
                </p>
              </div>
              <Settings className="h-10 w-10 text-green-200" />
            </div>
          </div>
        </div>

        {/* Alert Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">السجل التجاري</h3>
            </div>
            <div className="text-2xl font-bold text-blue-600 mb-2">{commercialRegAlerts.length}</div>
            <p className="text-sm text-gray-600">تنبيهات متعلقة بالسجل التجاري</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">الوثائق الحكومية</h3>
            </div>
            <div className="text-2xl font-bold text-purple-600 mb-2">{govDocsAlerts.length}</div>
            <p className="text-sm text-gray-600">تنبيهات متعلقة بالوثائق الحكومية</p>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">تحكم الاختبار</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <button 
                onClick={() => setAlerts(generateEnhancedCompanyAlerts(testCompanies))}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                إعادة توليد التنبيهات
              </button>
            </div>
            <div>
              <button 
                onClick={() => setAlerts([])}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                مسح جميع التنبيهات
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {testMode === 'enhanced' ? (
          <EnhancedAlertsSection
            alerts={alerts}
            onViewCompany={handleViewCompany}
            onRenewAction={handleRenewAction}
            onMarkAsRead={handleMarkAsRead}
            showAllAlerts={true}
          />
        ) : (
          // Basic mode - show simple alert list
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">النظام الأساسي - قائمة التنبيهات</h3>
            {alerts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد تنبيهات</h3>
                <p className="text-gray-600">جميع المؤسسات محدثة ولا تحتاج إلى إجراءات فورية</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {alerts.map((alert) => (
                  <EnhancedAlertCard
                    key={alert.id}
                    alert={alert}
                    onViewCompany={handleViewCompany}
                    onRenewAction={handleRenewAction}
                    onMarkAsRead={handleMarkAsRead}
                    compact={false}
                    showDetails={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detailed Alert View */}
        {selectedAlert && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">تفاصيل التنبيه</h3>
                  <button
                    onClick={() => setSelectedAlert(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <EnhancedAlertCard
                  alert={selectedAlert}
                  onViewCompany={handleViewCompany}
                  onRenewAction={handleRenewAction}
                  onMarkAsRead={handleMarkAsRead}
                  showDetails={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* Test Data Summary */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">بيانات الاختبار المستخدمة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">المؤسسات المختبرة</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {testCompanies.map((company) => (
                  <li key={company.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <span>{company.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">سيناريوهات الاختبار</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                  <span>تنبيهات منتهية الصلاحية</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                  <span>تنبيهات عاجلة (أقل من 30 يوم)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>تنبيهات متوسطة (30-60 يوم)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  <span>تنبيهات منخفضة (60+ يوم)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
