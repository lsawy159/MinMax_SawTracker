import { InputHTMLAttributes, ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  hint?: ReactNode
  wrapperClassName?: string
}

export const SearchInput = ({ className, wrapperClassName, hint, ...props }: SearchInputProps) => {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        className={cn(
          'focus-ring-brand h-12 w-full rounded-xl border border-input bg-surface pr-11 pl-4 text-sm text-foreground shadow-xs transition-[border-color,box-shadow,background-color] duration-[var(--motion-base)] ease-[var(--ease-out)] placeholder:text-muted-foreground',
          className
        )}
        {...props}
      />
      {hint ? (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  )
}

export default SearchInput
