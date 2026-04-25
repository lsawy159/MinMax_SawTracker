import { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  trend?: number
  icon?: ReactNode
  className?: string
}

export const MetricCard = ({ title, value, subtitle, trend, icon, className }: MetricCardProps) => {
  const isPositive = typeof trend === 'number' ? trend >= 0 : null

  return (
    <Card variant="interactive" className={cn('motion-safe-enter', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="text-2xl font-bold leading-none text-foreground">{value}</p>
        <div className="flex items-center justify-between text-xs">
          {subtitle ? <span className="text-muted-foreground">{subtitle}</span> : <span />}
          {typeof trend === 'number' ? (
            <span className={cn('inline-flex items-center gap-1 font-semibold', isPositive ? 'text-success' : 'text-danger')}>
              {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {`${isPositive ? '+' : ''}${trend}%`}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default MetricCard
