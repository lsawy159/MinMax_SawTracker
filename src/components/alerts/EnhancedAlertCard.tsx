import { 
  AlertTriangle, 
  Calendar, 
  Building2, 
  Clock, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  XCircle,
  DollarSign,
  Users,
  FileText,
  TrendingUp
} from 'lucide-react'
import { formatDateWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'

export interface EnhancedAlert {
  id: string
  type: 'commercial_registration_expiry' | 'government_docs_renewal'
  priority: 'urgent' | 'medium' | 'low'
  title: string
  message: string
  company: {
    id: string
    name: string
    commercial_registration_number?: string
  }
  expiry_date?: string
  days_remaining?: number
  action_required: string
  created_at: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  
  // Enhanced fields
  alert_type: 'commercial_registration_expiry' | 'government_docs_renewal'
  document_category: 'legal' | 'financial' | 'operational'
  renewal_complexity: 'simple' | 'moderate' | 'complex'
  estimated_renewal_time: string
  related_documents: string[]
  compliance_risk: 'low' | 'medium' | 'high' | 'critical'
  business_impact: 'minimal' | 'moderate' | 'significant' | 'critical'
  suggested_actions: string[]
  renewal_cost_estimate?: {
    min: number
    max: number
    currency: string
  }
  responsible_department?: string
  last_renewal_date?: string
  renewal_history: Array<{
    date: string
    duration: number
    cost?: number
    notes?: string
  }>
}

interface EnhancedAlertCardProps {
  alert: EnhancedAlert
  onViewCompany: (companyId: string) => void
  onRenewAction: (alertId: string) => void
  onMarkAsRead: (alertId: string) => void
  isRead?: boolean
  showDetails?: boolean
  compact?: boolean
}

export function EnhancedAlertCard({ 
  alert, 
  onViewCompany, 
  onRenewAction, 
  onMarkAsRead,
  isRead = false,
  showDetails = true,
  compact = false
}: EnhancedAlertCardProps) {
  
  const getPriorityConfig = (priority: EnhancedAlert['priority']) => {
    const configs = {
      urgent: {
        borderColor: 'border-r-red-600',
        bgColor: 'bg-red-50',
        textColor: 'text-red-900',
        badgeColor: 'bg-red-100 text-red-800 border-red-200',
        iconColor: 'text-red-500',
        badgeText: 'طارئ',
        progressColor: 'bg-red-500'
      },
      medium: {
        borderColor: 'border-r-yellow-600', 
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-900',
        badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        iconColor: 'text-yellow-500',
        badgeText: 'متوسط',
        progressColor: 'bg-yellow-500'
      },
      low: {
        borderColor: 'border-r-green-600',
        bgColor: 'bg-green-50', 
        textColor: 'text-green-900',
        badgeColor: 'bg-green-100 text-green-800 border-green-200',
        iconColor: 'text-green-500',
        badgeText: 'طفيف',
        progressColor: 'bg-green-500'
      }
    }
    return configs[priority]
  }

  const getComplianceRiskConfig = (risk: EnhancedAlert['compliance_risk']) => {
    const configs = {
      critical: { 
        icon: <XCircle className="h-4 w-4" />,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'طارئ'
      },
      high: { 
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        label: 'عاجل'
      },
      medium: { 
        icon: <AlertCircle className="h-4 w-4" />,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        label: 'متوسط'
      },
      low: { 
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'منخفض'
      }
    }
    return configs[risk]
  }

  const getBusinessImpactConfig = (impact: EnhancedAlert['business_impact']) => {
    const configs = {
      critical: { 
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'طارئ'
      },
      significant: { 
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        label: 'كبير'
      },
      moderate: { 
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        label: 'متوسط'
      },
      minimal: { 
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'صغير'
      }
    }
    return configs[impact]
  }

  const getTypeIcon = (type: EnhancedAlert['alert_type']) => {
    switch (type) {
  case 'commercial_registration_expiry':
        return <Building2 className="h-5 w-5" />
      case 'government_docs_renewal':
        return <FileText className="h-5 w-5" />
      default:
        return <AlertTriangle className="h-5 w-5" />
    }
  }

  const getTypeLabel = (type: EnhancedAlert['alert_type']) => {
    const labels = {
      commercial_registration_expiry: 'السجل التجاري',
      commercial_registration: 'السجل التجاري',
      government_docs_renewal: 'الوثائق الحكومية'
    }
    return labels[type] || type
  }

  const getDocumentCategoryLabel = (category: EnhancedAlert['document_category']) => {
    const labels = {
      legal: 'قانوني',
      financial: 'مالي',
      operational: 'تشغيلي'
    }
    return labels[category] || category
  }

  const getComplexityLabel = (complexity: EnhancedAlert['renewal_complexity']) => {
    const labels = {
      simple: 'بسيط',
      moderate: 'متوسط',
      complex: 'معقد'
    }
    return labels[complexity] || complexity
  }

  const getDaysRemainingText = (days?: number) => {
    if (!days) return ''
    
    if (days < 0) {
      return `منتهي منذ ${Math.abs(days)} يوم`
    } else if (days === 0) {
      return 'ينتهي اليوم'
    } else if (days === 1) {
      return 'ينتهي غداً'
    } else {
      return `باقي ${days} يوم`
    }
  }

  const formatDate = (dateString: string) => {
    return formatDateWithHijri(dateString)
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount)
  }

  const priorityConfig = getPriorityConfig(alert.priority)
  const riskConfig = getComplianceRiskConfig(alert.compliance_risk)
  const impactConfig = getBusinessImpactConfig(alert.business_impact)

  if (compact) {
    return (
      <div className={`
        bg-white rounded-lg shadow-sm border-l-4 ${priorityConfig.borderColor} p-4
        transition-all hover:shadow-md ${isRead ? 'opacity-75' : ''}
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${priorityConfig.bgColor} ${priorityConfig.iconColor}`}>
              {getTypeIcon(alert.alert_type)}
            </div>
            <div>
              <h3 className={`font-semibold ${priorityConfig.textColor} text-sm`}>
                {alert.title}
              </h3>
              <p className="text-gray-600 text-xs">
                {alert.company.name}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`
              inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
              ${priorityConfig.badgeColor}
            `}>
              {priorityConfig.badgeText}
            </span>
            
            {alert.days_remaining !== undefined && (
              <span className={`
                text-xs font-medium
                ${alert.days_remaining < 0 ? 'text-red-600' : 
                  alert.days_remaining <= 7 ? 'text-orange-600' : 'text-gray-600'}
              `}>
                {getDaysRemainingText(alert.days_remaining)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`
      bg-white rounded-lg shadow-sm border-r-4 ${priorityConfig.borderColor} p-6
      transition-all hover:shadow-md ${isRead ? 'opacity-75' : ''}
      ${priorityConfig.bgColor} border border-gray-200
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${priorityConfig.bgColor} ${priorityConfig.iconColor}`}>
            {getTypeIcon(alert.alert_type)}
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold ${priorityConfig.textColor}`}>
                {alert.title}
              </h3>
              <span className={`
                inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
                ${priorityConfig.badgeColor}
              `}>
                {priorityConfig.badgeText}
              </span>
            </div>
            
            <p className="text-gray-600 text-sm">
              {alert.company.name}
              {alert.company.commercial_registration_number && (
                <span className="text-gray-500 mr-2">
                  | رقم السجل: {alert.company.commercial_registration_number}
                </span>
              )}
            </p>
            <p className="text-gray-500 text-xs">
              {getTypeLabel(alert.alert_type)} | {getDocumentCategoryLabel(alert.document_category)}
            </p>
          </div>
        </div>

        {!isRead && (
          <button
            onClick={() => onMarkAsRead(alert.id)}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title="تحديد كمقروء"
          >
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          </button>
        )}
      </div>

      {/* Message */}
      <div className="mb-4">
        <p className="text-gray-700 leading-relaxed">
          {alert.message}
        </p>
      </div>

      {/* Enhanced Details Grid */}
      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Risk & Impact */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              تقييم المخاطر
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${riskConfig.bgColor} ${riskConfig.color}`}>
                  {riskConfig.icon}
                </div>
                <span className="text-sm text-gray-700">
                  مخاطر الامتثال: <span className={`font-medium ${riskConfig.color}`}>{riskConfig.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded ${impactConfig.bgColor} ${impactConfig.color}`}>
                  {impactConfig.icon}
                </div>
                <span className="text-sm text-gray-700">
                  التأثير على الأعمال: <span className={`font-medium ${impactConfig.color}`}>{impactConfig.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Timeline & Complexity */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              الجدولة والتعقيد
            </h4>
            <div className="space-y-2">
              {alert.expiry_date && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <HijriDateDisplay date={alert.expiry_date}>
                    تاريخ الانتهاء: {formatDate(alert.expiry_date)}
                  </HijriDateDisplay>
                </div>
              )}
              
              {alert.days_remaining !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span className={
                    alert.days_remaining < 0 ? 'text-red-600 font-medium' :
                    alert.days_remaining <= 7 ? 'text-orange-600 font-medium' :
                    'text-gray-600'
                  }>
                    {getDaysRemainingText(alert.days_remaining)}
                  </span>
                </div>
              )}
              
              <div className="text-sm text-gray-600">
                <span className="font-medium">مستوى التعقيد:</span> {getComplexityLabel(alert.renewal_complexity)}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">الوقت المقدر:</span> {alert.estimated_renewal_time}
              </div>
            </div>
          </div>

          {/* Cost & Department */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              التكلفة والإدارة
            </h4>
            <div className="space-y-2">
              {alert.renewal_cost_estimate && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">
                    التكلفة المقدرة: {formatCurrency(alert.renewal_cost_estimate.min, alert.renewal_cost_estimate.currency)} - 
                    {formatCurrency(alert.renewal_cost_estimate.max, alert.renewal_cost_estimate.currency)}
                  </span>
                </div>
              )}
              
              {alert.responsible_department && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>القسم المسؤول: {alert.responsible_department}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Required */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <h4 className="text-sm font-medium text-blue-900 mb-1">الإجراء المطلوب:</h4>
        <p className="text-sm text-blue-700">{alert.action_required}</p>
      </div>

      {/* Suggested Actions */}
      {alert.suggested_actions.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            الإجراءات المقترحة:
          </h4>
          <ul className="space-y-1">
            {alert.suggested_actions.map((action, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Documents */}
      {alert.related_documents.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <h4 className="text-sm font-medium text-yellow-900 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            الوثائق المطلوبة:
          </h4>
          <ul className="space-y-1">
            {alert.related_documents.map((document, index) => (
              <li key={index} className="text-sm text-yellow-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                <span>{document}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => onViewCompany(alert.company.id)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <ExternalLink className="h-4 w-4" />
          عرض المؤسسة
        </button>

        <button
          onClick={() => onRenewAction(alert.id)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          بدء التجديد
        </button>

        <button
          onClick={() => onMarkAsRead(alert.id)}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          تم الاطلاع
        </button>

        {alert.renewal_cost_estimate && (
          <button
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            title="عرض تفاصيل التكلفة"
          >
            <DollarSign className="h-4 w-4" />
            تفاصيل التكلفة
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          <HijriDateDisplay date={alert.created_at}>
            تم الإنشاء: {formatDate(alert.created_at)}
          </HijriDateDisplay>
          {alert.responsible_department && (
            <span className="mr-4">القسم: {alert.responsible_department}</span>
          )}
        </p>
      </div>
    </div>
  )
}
