import React from 'react'
import { AlertTriangle, Calendar, Building2, Shield, Clock, ExternalLink, RefreshCw } from 'lucide-react'

export interface Alert {
  id: string
  type: 'commercial_registration' | 'insurance_subscription'
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
}

interface AlertCardProps {
  alert: Alert
  onViewCompany: (companyId: string) => void
  onShowCompanyCard: (companyId: string) => void
  onMarkAsRead: (alertId: string) => void
  isRead?: boolean
}

export function AlertCard({ 
  alert, 
  onViewCompany, 
  onShowCompanyCard,
  onMarkAsRead,
  isRead = false 
}: AlertCardProps) {
  const getPriorityConfig = (priority: Alert['priority']) => {
    const configs = {
      urgent: {
        borderColor: 'border-r-red-600',
        bgColor: 'bg-red-50',
        textColor: 'text-red-900',
        badgeColor: 'bg-red-100 text-red-800 border-red-200',
        iconColor: 'text-red-500',
        badgeText: 'عاجل'
      },
      medium: {
        borderColor: 'border-r-yellow-600', 
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-900',
        badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        iconColor: 'text-yellow-500',
        badgeText: 'متوسط'
      },
      low: {
        borderColor: 'border-r-green-600',
        bgColor: 'bg-green-50', 
        textColor: 'text-green-900',
        badgeColor: 'bg-green-100 text-green-800 border-green-200',
        iconColor: 'text-green-500',
        badgeText: 'طفيف'
      }
    }
    return configs[priority]
  }

  const getTypeIcon = (type: Alert['type']) => {
    switch (type) {
      case 'commercial_registration':
        return <Building2 className="h-5 w-5" />
      case 'insurance_subscription':
        return <Shield className="h-5 w-5" />
      default:
        return <AlertTriangle className="h-5 w-5" />
    }
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
    return new Date(dateString).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const priorityConfig = getPriorityConfig(alert.priority)

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
            {getTypeIcon(alert.type)}
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
            
            <div className="space-y-1">
              <p className="text-gray-600 text-sm font-medium">
                {alert.company.name}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {alert.company.commercial_registration_number && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    رقم السجل: {alert.company.commercial_registration_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  تاريخ الإنشاء: {formatDate(alert.created_at)}
                </span>
              </div>
            </div>
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

      {/* Details */}
      <div className="space-y-2 mb-4">
        {alert.expiry_date && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>تاريخ انتهاء الصلاحية: {formatDate(alert.expiry_date)}</span>
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
      </div>

      {/* Action Required */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <h4 className="text-sm font-medium text-blue-900 mb-1">الإجراء المطلوب:</h4>
        <p className="text-sm text-blue-700">{alert.action_required}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onShowCompanyCard(alert.company.id)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <ExternalLink className="h-4 w-4" />
          عرض المؤسسة
        </button>

        <button
          onClick={() => onMarkAsRead(alert.id)}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          تم الاطلاع
        </button>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          تم الإنشاء: {formatDate(alert.created_at)}
        </p>
      </div>
    </div>
  )
}