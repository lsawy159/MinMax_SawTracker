import { ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { formatHijriDate } from '@/utils/dateFormatter'

interface HijriDateDisplayProps {
  date: Date | string
  children: ReactNode
  className?: string
}

/**
 * مكون لعرض التاريخ مع tooltip بالتاريخ الهجري يظهر مباشرة فوق التاريخ
 */
export function HijriDateDisplay({ date, children, className = '' }: HijriDateDisplayProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    return <span className={className}>{children}</span>
  }

  const hijri = formatHijriDate(dateObj)
  
  if (!hijri) {
    return <span className={className}>{children}</span>
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className={`cursor-help inline-block ${className}`}>
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
            sideOffset={5}
            side="top"
            dir="rtl"
          >
            {hijri}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

