import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface AvatarGroupItem {
  id: string
  name: string
  imageUrl?: string
}

interface AvatarGroupProps {
  items: AvatarGroupItem[]
  max?: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClassMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
  xl: 'h-14 w-14 text-base',
} as const

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/)
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export const AvatarGroup = ({ items, max = 4, size = 'md', className }: AvatarGroupProps) => {
  const visibleItems = items.slice(0, max)
  const remaining = Math.max(items.length - max, 0)

  return (
    <div className={cn('flex items-center', className)}>
      {visibleItems.map((item, index) => (
        <Avatar
          key={item.id}
          className={cn(
            sizeClassMap[size],
            'ring-2 ring-white dark:ring-neutral-900',
            index > 0 && '-mr-2'
          )}
          title={item.name}
        >
          {item.imageUrl ? <AvatarImage src={item.imageUrl} alt={item.name} /> : null}
          <AvatarFallback>{getInitials(item.name)}</AvatarFallback>
        </Avatar>
      ))}

      {remaining > 0 ? (
        <div
          className={cn(
            sizeClassMap[size],
            '-mr-2 inline-flex items-center justify-center rounded-full border border-border bg-muted text-muted-foreground ring-2 ring-white dark:ring-neutral-900'
          )}
        >
          +{remaining}
        </div>
      ) : null}
    </div>
  )
}

export default AvatarGroup
