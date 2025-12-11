import React, { useState } from 'react'
import { 
  Bell, 
  AlertTriangle, 
  TrendingUp,
  DollarSign,
  Users,
  Filter,
  Search,
  BarChart3,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Settings,
  Target,
  Shield as ShieldIcon
} from 'lucide-react'
import { EnhancedAlert } from '@/components/alerts/EnhancedAlertCard'
import { EnhancedAlertCard } from '@/components/alerts/EnhancedAlertCard'
import { 
  getEnhancedAlertsStats, 
  getCriticalAlerts, 
  generateAlertSummaryReport
} from '@/utils/enhancedCompanyAlerts'

interface EnhancedAlertsSectionProps {
  alerts: EnhancedAlert[]
  onViewCompany: (companyId: string) => void
  onRenewAction: (alertId: string) => void
  onMarkAsRead: (alertId: string) => void
  showAllAlerts?: boolean
}

export function EnhancedAlertsSection({
  alerts,
  onViewCompany,
  onRenewAction,
  onMarkAsRead,
  showAllAlerts = false
}: EnhancedAlertsSectionProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'summary' | 'analytics'>('cards')
  const [filterMode, setFilterMode] = useState<'all' | 'critical' | 'urgent'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Get filtered alerts based on current filter mode and search
  const getFilteredAlerts = () => {
    let filtered = alerts

    // Apply filter mode
    if (filterMode === 'critical') {
      filtered = getCriticalAlerts(filtered)
    } else if (filterMode === 'urgent') {
      filtered = filtered.filter(alert => alert.priority === 'urgent')
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(alert =>
        alert.company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered
  }

  const filteredAlerts = getFilteredAlerts()
  const stats = getEnhancedAlertsStats(alerts)
  const criticalAlerts = getCriticalAlerts(alerts)
  const summaryReport = generateAlertSummaryReport(alerts)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">تنبيهات المؤسسات المحسنة</h2>
            <p className="text-gray-600 mt-1">
              {alerts.length > 0 ? `${alerts.length} تنبيه نشط - ${criticalAlerts.length} حرج` : 'لا توجد تنبيهات حالياً'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="البحث في التنبيهات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Filter className="h-4 w-4" />
            الفلاتر
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
              }`}
            >
              البطاقات
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
              }`}
            >
              الملخص
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'analytics' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
              }`}
            >
              التحليلات
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب الأولوية</label>
              <select
                value={filterMode}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'all' || value === 'critical' || value === 'urgent') {
                    setFilterMode(value)
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">جميع التنبيهات</option>
                <option value="urgent">عاجل فقط</option>
                <option value="critical">حرج فقط</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب النوع</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="all">جميع الأنواع</option>
                <option value="commercial_registration_expiry">السجل التجاري</option>
                <option value="insurance_subscription">التأمين</option>
                <option value="government_docs_renewal">الوثائق الحكومية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب القسم</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="all">جميع الأقسام</option>
                <option value="legal">الشؤون القانونية</option>
                <option value="finance">الشؤون المالية</option>
                <option value="administrative">الشؤون الإدارية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">إجراءات</label>
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                  تطبيق الفلاتر
                </button>
                <button className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                  مسح
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">تنبيهات حرجة</p>
              <p className="text-2xl font-bold">{criticalAlerts.length}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">تنبيهات عاجلة</p>
              <p className="text-2xl font-bold">{stats.urgent}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">إجمالي التنبيهات</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Bell className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">التكلفة المقدرة</p>
              <p className="text-xl font-bold">
                {summaryReport.estimatedRenewalCosts.currency} {summaryReport.estimatedRenewalCosts.min.toLocaleString()} - 
                {summaryReport.estimatedRenewalCosts.max.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-200" />
          </div>
        </div>
      </div>

      {/* Content Based on View Mode */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد تنبيهات</h3>
              <p className="text-gray-600">
                {alerts.length === 0 
                  ? 'جميع مؤسساتك محدثة ولا تحتاج إلى إجراءات فورية'
                  : 'لا توجد تنبيهات تطابق معايير البحث الحالية'
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {(showAllAlerts ? filteredAlerts : filteredAlerts.slice(0, 3)).map((alert) => (
                <EnhancedAlertCard
                  key={alert.id}
                  alert={alert}
                  onViewCompany={onViewCompany}
                  onRenewAction={onRenewAction}
                  onMarkAsRead={onMarkAsRead}
                  showDetails={true}
                />
              ))}
            </div>
          )}

          {!showAllAlerts && filteredAlerts.length > 3 && (
            <div className="text-center">
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                onClick={() => {/* Show all alerts */}}
              >
                عرض جميع التنبيهات ({filteredAlerts.length})
              </button>
            </div>
          )}
        </div>
      )}

      {viewMode === 'summary' && (
        <div className="space-y-6">
          {/* Summary Report */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              تقرير الملخص
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Timeline Summary */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  التوزيع الزمني
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">متأخرة</span>
                    <span className="font-medium text-red-600">{summaryReport.timeline.overdue}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">عاجلة</span>
                    <span className="font-medium text-orange-600">{summaryReport.timeline.urgent}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">قادمة</span>
                    <span className="font-medium text-blue-600">{summaryReport.timeline.upcoming}</span>
                  </div>
                </div>
              </div>

              {/* Department Distribution */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  التوزيع حسب القسم
                </h4>
                <div className="space-y-2">
                  {Object.entries(summaryReport.departments).map(([dept, count]) => (
                    <div key={dept} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{dept}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Estimation */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  تقدير التكلفة
                </h4>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    الحد الأدنى: <span className="font-medium text-green-600">
                      {summaryReport.estimatedRenewalCosts.currency} {summaryReport.estimatedRenewalCosts.min.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    الحد الأقصى: <span className="font-medium text-red-600">
                      {summaryReport.estimatedRenewalCosts.currency} {summaryReport.estimatedRenewalCosts.max.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'analytics' && (
        <div className="space-y-6">
          {/* Analytics Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Distribution */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldIcon className="h-5 w-5" />
                توزيع المخاطر
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-gray-600">حرج</span>
                  </div>
                  <span className="font-medium text-red-600">{stats.byRisk.critical}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-600">عاجل</span>
                  </div>
                  <span className="font-medium text-orange-600">{stats.byRisk.high}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-600">متوسط</span>
                  </div>
                  <span className="font-medium text-yellow-600">{stats.byRisk.medium}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600">منخفض</span>
                  </div>
                  <span className="font-medium text-green-600">{stats.byRisk.low}</span>
                </div>
              </div>
            </div>

            {/* Business Impact */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                التأثير على الأعمال
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">حرج</span>
                  <span className="font-medium text-red-600">{stats.byBusinessImpact.critical}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">كبير</span>
                  <span className="font-medium text-orange-600">{stats.byBusinessImpact.significant}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">متوسط</span>
                  <span className="font-medium text-yellow-600">{stats.byBusinessImpact.moderate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">صغير</span>
                  <span className="font-medium text-green-600">{stats.byBusinessImpact.minimal}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5" />
              إجراءات سريعة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">تجديد جميع التنبيهات الحرجة</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <Download className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">تصدير تقرير مفصل</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <Settings className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">إعدادات التنبيهات</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
