import { useState } from 'react'
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
  FileText,
  TrendingUp,
  Loader2,
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
  compact = false,
}: EnhancedAlertCardProps) {
  const getPriorityConfig = (priority: EnhancedAlert['priority']) => {
    const configs = {
      urgent: {
        borderColor: 'border-red-400',
        bgColor: 'bg-red-50',
        textColor: 'text-red-900',
        badgeColor: 'bg-red-100 text-red-800 border-red-200',
        iconColor: 'text-danger-500',
        badgeText: 'طارئ',
        progressColor: 'bg-red-500',
      },
      medium: {
        borderColor: 'border-yellow-400',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-900',
        badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        iconColor: 'text-yellow-500',
        badgeText: 'متوسط',
        progressColor: 'bg-yellow-500',
      },
      low: {
        borderColor: 'border-green-400',
        bgColor: 'bg-green-50',
        textColor: 'text-success-900',
        badgeColor: 'bg-green-100 text-success-800 border-green-200',
        iconColor: 'text-success-500',
        badgeText: 'طفيف',
        progressColor: 'bg-green-500',
      },
    }
    return configs[priority]
  }

  const getComplianceRiskConfig = (risk: EnhancedAlert['compliance_risk']) => {
    const configs = {
      critical: {
        icon: <XCircle className="h-4 w-4" />,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'طارئ',
      },
      high: {
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-warning-600',
        bgColor: 'bg-orange-100',
        label: 'عاجل',
      },
      medium: {
        icon: <AlertCircle className="h-4 w-4" />,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        label: 'متوسط',
      },
      low: {
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'text-success-600',
        bgColor: 'bg-green-100',
        label: 'منخفض',
      },
    }
    return configs[risk]
  }

  const getBusinessImpactConfig = (impact: EnhancedAlert['business_impact']) => {
    const configs = {
      critical: {
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'طارئ',
      },
      significant: {
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-warning-600',
        bgColor: 'bg-orange-100',
        label: 'كبير',
      },
      moderate: {
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        label: 'متوسط',
      },
      minimal: {
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-success-600',
        bgColor: 'bg-green-100',
        label: 'صغير',
      },
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
      government_docs_renewal: 'الوثائق الحكومية',
    }
    return labels[type] || type
  }

  const getDocumentCategoryLabel = (category: EnhancedAlert['document_category']) => {
    const labels = {
      legal: 'قانوني',
      financial: 'مالي',
      operational: 'تشغيلي',
    }
    return labels[category] || category
  }

  const getComplexityLabel = (complexity: EnhancedAlert['renewal_complexity']) => {
    const labels = {
      simple: 'بسيط',
      moderate: 'متوسط',
      complex: 'معقد',
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

  const priorityConfig = getPriorityConfig(alert.priority)
  const riskConfig = getComplianceRiskConfig(alert.compliance_risk)
  const impactConfig = getBusinessImpactConfig(alert.business_impact)
  const [actionLoading, setActionLoading] = useState<'view' | 'renew' | 'read' | null>(null)
  const isBusy = actionLoading !== null

  const runAction = async (
    action: 'view' | 'renew' | 'read',
    callback: () => void | Promise<void>
  ) => {
    try {
      setActionLoading(action)
      await Promise.resolve(callback())
    } finally {
      setActionLoading(null)
    }
  }

  if (compact) {
    return (
      <div
        className={`group relative overflow-hidden rounded-2xl border-2 ${priorityConfig.borderColor} bg-white/95 p-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-26px_rgba(14,116,144,0.65)] ${isRead ? 'opacity-75' : ''}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400/70 via-sky-300/60 to-emerald-300/70 opacity-70 transition group-hover:opacity-100" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${priorityConfig.bgColor} ${priorityConfig.iconColor}`}>
              {getTypeIcon(alert.alert_type)}
            </div>
            <div>
              <h3 className={`font-semibold ${priorityConfig.textColor} text-sm`}>{alert.title}</h3>
              <p className="text-neutral-600 text-xs">{alert.company.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`
              inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
              ${priorityConfig.badgeColor}
            `}
            >
              {priorityConfig.badgeText}
            </span>

            {alert.days_remaining !== undefined && (
              <span
                className={`
                text-xs font-medium
                ${
                  alert.days_remaining < 0
                    ? 'text-red-600'
                    : alert.days_remaining <= 7
                      ? 'text-warning-600'
                      : 'text-neutral-600'
                }
              `}
              >
                {getDaysRemainingText(alert.days_remaining)}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border-2 ${priorityConfig.borderColor} bg-white/95 p-3.5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.8)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-26px_rgba(14,116,144,0.65)] ${isRead ? 'opacity-75' : ''}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400/70 via-sky-300/60 to-emerald-300/70 opacity-70 transition group-hover:opacity-100" />

      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${priorityConfig.bgColor} ${priorityConfig.iconColor}`}>
            {getTypeIcon(alert.alert_type)}
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <h3 className={`font-semibold ${priorityConfig.textColor}`}>{alert.title}</h3>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${priorityConfig.badgeColor}`}
              >
                {priorityConfig.badgeText}
              </span>
            </div>

            <p className="text-sm text-neutral-600">
              {alert.company.name}
              {alert.company.commercial_registration_number && (
                <span className="mr-2 text-neutral-500">
                  | رقم السجل: {alert.company.commercial_registration_number}
                </span>
              )}
            </p>
            <p className="text-xs text-neutral-500">
              {getTypeLabel(alert.alert_type)} | {getDocumentCategoryLabel(alert.document_category)}
            </p>
          </div>
        </div>

        {!isRead && (
          <button
            onClick={() => void runAction('read', () => onMarkAsRead(alert.id))}
            disabled={isBusy}
            className="text-neutral-400 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            title="تحديد كمقروء"
          >
            {actionLoading === 'read' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <div className="h-3 w-3 rounded-full bg-primary"></div>
            )}
          </button>
        )}
      </div>

      <div className="mb-3">
        <p className="leading-relaxed text-neutral-700">{alert.message}</p>
      </div>

      {showDetails && (
        <div className="mb-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
            <h4 className="mb-2 flex items-center gap-2 font-medium text-neutral-900">
              <AlertTriangle className="h-4 w-4" />
              تقييم المخاطر
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`rounded p-1 ${riskConfig.bgColor} ${riskConfig.color}`}>
                  {riskConfig.icon}
                </div>
                <span className="text-sm text-neutral-700">
                  مخاطر الامتثال:{' '}
                  <span className={`font-medium ${riskConfig.color}`}>{riskConfig.label}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`rounded p-1 ${impactConfig.bgColor} ${impactConfig.color}`}>
                  {impactConfig.icon}
                </div>
                <span className="text-sm text-neutral-700">
                  التأثير على الأعمال:{' '}
                  <span className={`font-medium ${impactConfig.color}`}>{impactConfig.label}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
            <h4 className="mb-2 flex items-center gap-2 font-medium text-neutral-900">
              <Clock className="h-4 w-4" />
              الجدولة والتعقيد
            </h4>
            <div className="space-y-2">
              {alert.expiry_date && (
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Calendar className="h-4 w-4" />
                  <HijriDateDisplay date={alert.expiry_date}>
                    تاريخ الانتهاء: {formatDate(alert.expiry_date)}
                  </HijriDateDisplay>
                </div>
              )}

              {alert.days_remaining !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span
                    className={
                      alert.days_remaining < 0
                        ? 'font-medium text-red-600'
                        : alert.days_remaining <= 7
                          ? 'font-medium text-warning-600'
                          : 'text-neutral-600'
                    }
                  >
                    {getDaysRemainingText(alert.days_remaining)}
                  </span>
                </div>
              )}

              <div className="text-sm text-neutral-600">
                <span className="font-medium">مستوى التعقيد:</span>{' '}
                {getComplexityLabel(alert.renewal_complexity)}
              </div>
              <div className="text-sm text-neutral-600">
                <span className="font-medium">الوقت المقدر:</span> {alert.estimated_renewal_time}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="app-info-block mb-3 p-2.5">
        <h4 className="mb-1 text-sm font-semibold text-slate-900">الإجراء المطلوب:</h4>
        <p className="text-sm text-slate-700">{alert.action_required}</p>
      </div>

      {alert.suggested_actions.length > 0 && (
        <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-900">
            <CheckCircle className="h-4 w-4" />
            الإجراءات المقترحة:
          </h4>
          <ul className="space-y-1">
            {alert.suggested_actions.map((action, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-neutral-700">
                <span className="mt-1 text-primary">•</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {alert.related_documents.length > 0 && (
        <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-2.5">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-yellow-900">
            <FileText className="h-4 w-4" />
            الوثائق المطلوبة:
          </h4>
          <ul className="space-y-1">
            {alert.related_documents.map((document, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-yellow-800">
                <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
                <span>{document}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={() => void runAction('view', () => onViewCompany(alert.company.id))}
          disabled={isBusy}
          className="app-button-primary"
        >
          {actionLoading === 'view' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          عرض المؤسسة
        </button>

        <button
          onClick={() => void runAction('renew', () => onRenewAction(alert.id))}
          disabled={isBusy}
          className="app-button-success"
        >
          {actionLoading === 'renew' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          بدء التجديد
        </button>

        <button
          onClick={() => void runAction('read', () => onMarkAsRead(alert.id))}
          disabled={isBusy}
          className="app-button-secondary"
        >
          {actionLoading === 'read' && <Loader2 className="h-4 w-4 animate-spin" />}
          تم الاطلاع
        </button>

        {alert.renewal_cost_estimate && (
          <button className="app-button-secondary" title="عرض تفاصيل التكلفة">
            <DollarSign className="h-4 w-4" />
            تفاصيل التكلفة
          </button>
        )}
      </div>

      <div className="mt-3 border-t border-neutral-200 pt-2.5">
        <p className="text-xs text-neutral-500">
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
