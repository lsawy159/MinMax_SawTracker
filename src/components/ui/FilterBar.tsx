import { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export const FilterBar = ({ children, actions, className }: FilterBarProps) => {
  return (
    <section className={cn('app-filter-surface motion-safe-enter', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="font-medium">الفلاتر</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

export default FilterBar
