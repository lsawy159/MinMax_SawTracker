import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: number | string
  icon?: ReactNode
  trendLabel?: string
  trendValue?: number
  accent?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
  onClick?: () => void
}

const accentClassMap = {
  neutral: 'bg-muted text-foreground',
  success: 'bg-success-subtle text-success-foreground',
  warning: 'bg-warning-subtle text-warning-foreground',
  danger: 'bg-danger-subtle text-danger-foreground',
  info: 'bg-info-subtle text-info-foreground',
} as const

const useCountUp = (targetValue: number, enabled: boolean) => {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setValue(targetValue)
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) {
      setValue(targetValue)
      return
    }

    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const duration = mobileQuery.matches ? 400 : 800
    const start = performance.now()

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(targetValue * eased))
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(step)
      }
    }

    rafRef.current = window.requestAnimationFrame(step)

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [enabled, targetValue])

  return value
}

export const StatCard = ({
  title,
  value,
  icon,
  trendLabel,
  trendValue,
  accent = 'neutral',
  className,
  onClick,
}: StatCardProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const numericValue = typeof value === 'number' ? value : Number.NaN
  const isNumeric = Number.isFinite(numericValue)
  const animatedValue = useCountUp(numericValue, isVisible && isNumeric)

  useEffect(() => {
    if (!rootRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [])

  const trend = useMemo(() => {
    if (typeof trendValue !== 'number') return null
    const positive = trendValue >= 0
    return {
      positive,
      icon: positive ? TrendingUp : TrendingDown,
      text: `${positive ? '+' : ''}${trendValue}%`,
    }
  }, [trendValue])

  const shownValue = isNumeric ? animatedValue.toLocaleString('en-US') : value

  return (
    <Card
      ref={rootRef}
      variant="interactive"
      className={cn(
        'motion-safe-enter parallax-card overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.16),transparent_52%)]',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{shownValue}</p>
            {trend || trendLabel ? (
              <div className="flex items-center gap-2 text-xs">
                {trend ? (
                  <span className={cn('inline-flex items-center gap-1 font-semibold', trend.positive ? 'text-success' : 'text-danger')}>
                    <trend.icon className="h-3.5 w-3.5" />
                    {trend.text}
                  </span>
                ) : null}
                {trendLabel ? <span className="text-muted-foreground">{trendLabel}</span> : null}
              </div>
            ) : null}
          </div>

          {icon ? (
            <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl', accentClassMap[accent])}>
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default StatCard
