import { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  className?: string
}

export const PageHeader = ({ title, description, breadcrumbs, actions, className }: PageHeaderProps) => {
  return (
    <header className={cn('app-panel app-page-header motion-safe-enter space-y-3 p-4 md:p-5', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((item, index) => (
            <div key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 ? <ChevronLeft className="h-3.5 w-3.5" /> : null}
              {item.href ? (
                <a href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </a>
              ) : (
                <span className={index === breadcrumbs.length - 1 ? 'font-semibold text-foreground' : ''}>{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">{title}</h1>
          {description ? <p className="text-sm leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

export default PageHeader
