import { AlertTriangle } from 'lucide-react'
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay'
import { formatDateShortWithHijri } from '@/utils/dateFormatter'

interface ExpiryStatusRowProps {
  label: string
  date: string | null | undefined
  daysRemaining: number | null
}

export function ExpiryStatusRow({ label, date, daysRemaining }: ExpiryStatusRowProps) {
  const getStatusColor = (days: number | null) => {
    if (days === null) return 'text-green-600 bg-green-50 border-green-200'
    if (days < 0) return 'text-red-600 bg-red-50 border-red-200'
    if (days <= 7) return 'text-red-600 bg-red-50 border-red-200'
    if (days <= 15) return 'text-orange-600 bg-orange-50 border-orange-200'
    if (days <= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(daysRemaining)}`}>
      <AlertTriangle className="w-5 h-5" />
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-sm">
          {date ? (
            <>
              <HijriDateDisplay date={date}>
                {formatDateShortWithHijri(date)}
              </HijriDateDisplay>
              {daysRemaining !== null && (daysRemaining < 0 ? ' (منتهية)' : ` (بعد ${daysRemaining} يوم)`)}
            </>
          ) : (
            'غير محدد'
          )}
        </div>
      </div>
    </div>
  )
}
