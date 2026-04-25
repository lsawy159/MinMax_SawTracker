import { ReactNode } from 'react'
import { Plus } from 'lucide-react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  children?: ReactNode
}

export function EmptyState({ icon, title, description, action, children }: EmptyStateProps) {
  return (
    <div className="app-panel card-interactive flex flex-col items-center justify-center border border-dashed border-border p-10 md:p-12">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>

        <div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {action ? (
          <button
            onClick={action.onClick}
            className="touch-feedback inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-[transform,filter] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            {action.label}
          </button>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

// Specific empty states for common scenarios

export function NoDataEmptyState({
  title = 'لا توجد بيانات',
  description = 'لم يتم العثور على أي بيانات لعرضها',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function NoSearchResultsEmptyState({
  searchQuery,
  onClear,
}: {
  searchQuery: string
  onClear: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        لا توجد نتائج لـ "{searchQuery}"
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        جرب استخدام كلمات مختلفة أو تحقق من الإملاء
      </p>
      <button
        onClick={onClear}
        className="touch-feedback inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted"
      >
        مسح البحث
      </button>
    </div>
  )
}
