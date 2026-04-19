import { Activity, Plus, Edit, Trash2, Calendar, Clock, User as UserIcon, Building2 } from 'lucide-react'

interface StatsCardsProps {
  total: number
  createCount: number
  updateCount: number
  deleteCount: number
  todayCount: number
  weekCount: number
  employeeCount: number
  companyCount: number
}

export function StatsCards({
  total,
  createCount,
  updateCount,
  deleteCount,
  todayCount,
  weekCount,
  employeeCount,
  companyCount,
}: StatsCardsProps) {
  const items = [
    { label: 'السجلات', value: total, icon: Activity, tone: 'border-slate-200 bg-white text-slate-900', iconTone: 'bg-slate-100 text-slate-800' },
    { label: 'إنشاء', value: createCount, icon: Plus, tone: 'border-green-200 bg-green-50 text-green-700', iconTone: 'bg-green-100 text-green-700' },
    { label: 'تحديث', value: updateCount, icon: Edit, tone: 'border-amber-200 bg-amber-50 text-amber-700', iconTone: 'bg-amber-100 text-amber-700' },
    { label: 'حذف', value: deleteCount, icon: Trash2, tone: 'border-red-200 bg-red-50 text-red-700', iconTone: 'bg-red-100 text-red-700' },
    { label: 'اليوم', value: todayCount, icon: Calendar, tone: 'border-primary/40 bg-primary/10 text-slate-900', iconTone: 'bg-primary/20 text-slate-900' },
    { label: 'الأسبوع', value: weekCount, icon: Clock, tone: 'border-slate-200 bg-slate-50 text-slate-800', iconTone: 'bg-slate-200 text-slate-800' },
    { label: 'الموظفين', value: employeeCount, icon: UserIcon, tone: 'border-primary/40 bg-primary/10 text-slate-900', iconTone: 'bg-primary/20 text-slate-900' },
    { label: 'المؤسسات', value: companyCount, icon: Building2, tone: 'border-slate-200 bg-white text-slate-900', iconTone: 'bg-primary/15 text-slate-900' },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-2 overflow-hidden sm:grid-cols-4 lg:grid-cols-8">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.label} className={`rounded-xl border p-2 sm:p-3 transition-shadow hover:shadow-md ${item.tone}`}>
            <div className="mb-1 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-base font-bold sm:text-lg lg:text-xl">{item.value}</div>
                <div className="mt-0.5 line-clamp-1 text-xs opacity-80">{item.label}</div>
              </div>
              <div className={`flex-shrink-0 rounded-lg p-1.5 sm:p-2 ${item.iconTone}`}>
                <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
