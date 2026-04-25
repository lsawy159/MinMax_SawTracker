import { useState } from 'react'
import { AlertTriangle, Calendar, User, Shield, Clock, Eye, Mail, Loader2, CheckCheck } from 'lucide-react'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'

export interface EmployeeAlert {
  id: string
  type: 'contract_expiry' | 'residence_expiry' | 'health_insurance_expiry' | 'hired_worker_contract_expiry'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  title: string
  message: string
  employee: {
    id: string
    name: string
    profession: string
    nationality: string
    company_id: string
  }
  company: {
    id: string
    name: string
    commercial_registration_number?: string
    unified_number?: number
  }
  expiry_date?: string
  days_remaining?: number
  action_required: string
  created_at: string
}

interface EmployeeAlertCardProps {
  alert: EmployeeAlert
  onViewEmployee: (employeeId: string) => void
  onMarkAsRead: (alertId: string) => void
  onMarkAsUnread?: (alertId: string) => void
  isRead?: boolean
}

const PRIORITY = {
  urgent: {
    accent: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 border-red-200',
    icon: 'bg-red-100 text-red-600',
    label: 'طارئ',
  },
  high: {
    accent: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: 'bg-orange-100 text-orange-600',
    label: 'عاجل',
  },
  medium: {
    accent: 'bg-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: 'bg-yellow-100 text-yellow-600',
    label: 'متوسط',
  },
  low: {
    accent: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-600',
    label: 'طفيف',
  },
} as const

function getTypeIcon(type: EmployeeAlert['type']) {
  switch (type) {
    case 'contract_expiry': return <User className="h-4 w-4" />
    case 'residence_expiry': return <Shield className="h-4 w-4" />
    case 'health_insurance_expiry': return <Shield className="h-4 w-4" />
    case 'hired_worker_contract_expiry': return <User className="h-4 w-4" />
    default: return <AlertTriangle className="h-4 w-4" />
  }
}

function getDaysChip(days: number) {
  if (days < 0) return { text: `منتهي منذ ${Math.abs(days)} يوم`, cls: 'bg-red-50 text-red-700 border-red-200' }
  if (days === 0) return { text: 'ينتهي اليوم', cls: 'bg-red-50 text-red-700 border-red-200' }
  if (days <= 7) return { text: `باقي ${days} يوم`, cls: 'bg-orange-50 text-orange-700 border-orange-200' }
  return { text: `باقي ${days} يوم`, cls: 'bg-slate-100 text-slate-600 border-slate-200' }
}

export function EmployeeAlertCard({
  alert,
  onViewEmployee,
  onMarkAsRead,
  onMarkAsUnread,
  isRead = false,
}: EmployeeAlertCardProps) {
  const [actionLoading, setActionLoading] = useState<'view' | 'read' | 'unread' | null>(null)
  const isBusy = actionLoading !== null
  const p = PRIORITY[alert.priority]

  const runAction = async (action: 'view' | 'read' | 'unread', cb: () => void | Promise<void>) => {
    try { setActionLoading(action); await Promise.resolve(cb()) }
    finally { setActionLoading(null) }
  }

  const daysChip = alert.days_remaining !== undefined ? getDaysChip(alert.days_remaining) : null

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 ${isRead ? 'opacity-55' : ''}`}>

      {/* Priority accent bar */}
      <div className={`h-1 w-full ${p.accent} shrink-0`} />

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">

        {/* Top row: icon + title + read dot */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${p.icon}`}>
              {getTypeIcon(alert.type)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold leading-snug text-slate-900 line-clamp-2">{alert.title}</p>
              <span className={`mt-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${p.badge}`}>
                {p.label}
              </span>
            </div>
          </div>
          {isRead ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              <Eye className="h-3 w-3" />
              مقروء
            </span>
          ) : (
            <button
              onClick={() => void runAction('read', () => onMarkAsRead(alert.id))}
              disabled={isBusy}
              title="تحديد كمقروء"
              className="mt-0.5 shrink-0 text-slate-300 transition hover:text-primary disabled:opacity-40"
            >
              {actionLoading === 'read'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-primary/30" />
              }
            </button>
          )}
        </div>

        {/* Employee info */}
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2">
          <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-slate-800">{alert.employee.name}</p>
            <p className="truncate text-[11px] text-slate-400">
              {alert.employee.profession}
              {alert.employee.nationality ? ` · ${alert.employee.nationality}` : ''}
            </p>
          </div>
        </div>

        {/* Company */}
        <p className="truncate text-[11px] text-slate-500">
          <span className="font-medium text-slate-600">{alert.company.name}</span>
          {alert.company.unified_number ? ` (${alert.company.unified_number})` : ''}
        </p>

        {/* Expiry + Days chips */}
        <div className="flex flex-wrap items-center gap-2">
          {alert.expiry_date && (
            <HijriDateDisplay date={alert.expiry_date}>
              <span className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                <Calendar className="h-3 w-3 shrink-0" />
                {formatDateShortWithHijri(alert.expiry_date)}
              </span>
            </HijriDateDisplay>
          )}
          {daysChip && (
            <span className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${daysChip.cls}`}>
              <Clock className="h-3 w-3 shrink-0" />
              {daysChip.text}
            </span>
          )}
        </div>

        {/* Action required */}
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 border border-amber-100">
          <span className="font-semibold">الإجراء: </span>{alert.action_required}
        </p>

      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5">
        <button
          onClick={() => void runAction('view', () => onViewEmployee(alert.employee.id))}
          disabled={isBusy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-[12px] font-semibold text-slate-900 transition hover:bg-primary/90 disabled:opacity-50"
        >
          {actionLoading === 'view' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
          عرض الموظف
        </button>

        {!isRead && (
          <button
            onClick={() => void runAction('read', () => onMarkAsRead(alert.id))}
            disabled={isBusy}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {actionLoading === 'read' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            اطلعت
          </button>
        )}

        {isRead && onMarkAsUnread && (
          <button
            onClick={() => void runAction('unread', () => onMarkAsUnread(alert.id))}
            disabled={isBusy}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {actionLoading === 'unread' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            غير مقروء
          </button>
        )}
      </div>
    </div>
  )
}
