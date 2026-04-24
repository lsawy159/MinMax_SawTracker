import Layout from '@/components/layout/Layout'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { StatCard } from '@/components/ui/StatCard'
import { DataCard } from '@/components/ui/DataCard'
import { MetricCard } from '@/components/ui/MetricCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { FilterBar } from '@/components/ui/FilterBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { AvatarGroup } from '@/components/ui/AvatarGroup'
import { Users, Building2, AlertTriangle } from 'lucide-react'

interface ColorToken {
  name: string
  hex: string
  className: string
  textClassName?: string
}

interface ShadowToken {
  name: string
  value: string
}

const brandTokens: ColorToken[] = [
  { name: 'Primary', hex: '#FECE14', className: 'bg-brand-gold', textClassName: 'text-neutral-950' },
  { name: 'Primary Hover', hex: '#EAB308', className: 'bg-brand-hover', textClassName: 'text-neutral-950' },
  { name: 'Primary Subtle', hex: '#FEF9C3', className: 'bg-brand-subtle', textClassName: 'text-neutral-900' },
]

const neutralTokens: ColorToken[] = [
  { name: 'Neutral 950', hex: '#0A0A0A', className: 'bg-neutral-950' },
  { name: 'Neutral 900', hex: '#171717', className: 'bg-neutral-900' },
  { name: 'Neutral 700', hex: '#404040', className: 'bg-neutral-700' },
  { name: 'Neutral 500', hex: '#737373', className: 'bg-neutral-500' },
  { name: 'Neutral 300', hex: '#D4D4D4', className: 'bg-neutral-300', textClassName: 'text-neutral-900' },
  { name: 'Neutral 200', hex: '#E5E5E5', className: 'bg-neutral-200', textClassName: 'text-neutral-900' },
  { name: 'Neutral 100', hex: '#F5F5F5', className: 'bg-neutral-100', textClassName: 'text-neutral-900' },
  { name: 'Neutral 50', hex: '#FAFAFA', className: 'bg-neutral-50', textClassName: 'text-neutral-900' },
]

const semanticTokens: ColorToken[] = [
  { name: 'Success', hex: '#10B981', className: 'bg-success', textClassName: 'text-white' },
  { name: 'Warning', hex: '#F59E0B', className: 'bg-warning', textClassName: 'text-white' },
  { name: 'Danger', hex: '#EF4444', className: 'bg-danger', textClassName: 'text-white' },
  { name: 'Info', hex: '#3B82F6', className: 'bg-info', textClassName: 'text-white' },
]

const shadowTokens: ShadowToken[] = [
  { name: 'shadow-xs', value: '0 1px 2px rgba(0, 0, 0, 0.04)' },
  { name: 'shadow-sm', value: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)' },
  { name: 'shadow-md', value: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  { name: 'shadow-lg', value: '0 12px 32px rgba(0, 0, 0, 0.10)' },
  { name: 'shadow-xl', value: '0 24px 48px rgba(0, 0, 0, 0.14)' },
]

const renderColorGrid = (title: string, tokens: ColorToken[]) => (
  <section className="space-y-4">
    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{title}</h2>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tokens.map((token) => (
        <article key={token.name} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className={`h-20 ${token.className}`} />
          <div className="space-y-1 p-3">
            <p className="text-sm font-semibold text-foreground">{token.name}</p>
            <p className="text-xs text-muted-foreground">{token.hex}</p>
            <p className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${token.textClassName ?? 'text-white'}`}>
              {token.className}
            </p>
          </div>
        </article>
      ))}
    </div>
  </section>
)

const DesignSystem = () => {
  const [statusValue, setStatusValue] = useState('active')

  return (
    <Layout>
      <div className="app-page space-y-8 pb-16">
        <PageHeader
          title="Design System"
          description="This page is the internal visual reference for core design tokens and UI primitives in the revamp rollout."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Design System' }]}
          actions={<Button size="sm">Primary Action</Button>}
        />

        {renderColorGrid('Brand Colors', brandTokens)}
        {renderColorGrid('Neutral Scale', neutralTokens)}
        {renderColorGrid('Semantic Colors', semanticTokens)}

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Typography Scale</h2>
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[32px] font-bold leading-[40px]">Display 32/40</p>
            <p className="text-[24px] font-bold leading-[32px]">Heading-1 24/32</p>
            <p className="text-[20px] font-semibold leading-[28px]">Heading-2 20/28</p>
            <p className="text-[18px] font-semibold leading-[26px]">Heading-3 18/26</p>
            <p className="text-base leading-6">Body-lg 16/24</p>
            <p className="text-sm leading-5">Body 14/20</p>
            <p className="text-[13px] leading-[18px] text-muted-foreground">Body-sm 13/18</p>
            <p className="text-xs font-medium leading-4 text-muted-foreground">Caption 12/16</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Elevation</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shadowTokens.map((token) => (
              <article
                key={token.name}
                className="rounded-xl border border-border bg-card p-4"
                style={{ boxShadow: token.value }}
              >
                <p className="text-sm font-semibold text-foreground">{token.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{token.value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Radius and Spacing</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold">Radius</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-12 w-12 rounded-sm border border-border bg-primary/20" />
                <div className="h-12 w-12 rounded-md border border-border bg-primary/20" />
                <div className="h-12 w-12 rounded-lg border border-border bg-primary/20" />
                <div className="h-12 w-12 rounded-xl border border-border bg-primary/20" />
                <div className="h-12 w-12 rounded-full border border-border bg-primary/20" />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold">Spacing</p>
              <div className="flex items-end gap-2">
                <div className="w-6 bg-primary/20 p-1 text-center text-[10px] font-semibold">4</div>
                <div className="w-8 bg-primary/20 p-2 text-center text-[10px] font-semibold">8</div>
                <div className="w-10 bg-primary/20 p-3 text-center text-[10px] font-semibold">12</div>
                <div className="w-12 bg-primary/20 p-4 text-center text-[10px] font-semibold">16</div>
                <div className="w-14 bg-primary/20 p-6 text-center text-[10px] font-semibold">24</div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Primitives Preview</h2>
          <Card>
            <CardHeader>
              <CardTitle>Core UI Elements</CardTitle>
              <CardDescription>
                Button, Input, Badge, Card, and Select using the new foundation tokens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="success">Success</Button>
                <Button variant="warning">Warning</Button>
                <Button variant="destructive">Danger</Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input placeholder="اكتب اسم الموظف" />
                <Select value={statusValue} onValueChange={setStatusValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="warning">يتطلب متابعة</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge>Default</Badge>
                <Badge variant="neutral">Neutral</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">Primary Action</Button>
              <Button variant="outline" size="sm">Secondary Action</Button>
            </CardFooter>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Composed Components</h2>

          <FilterBar
            actions={
              <>
                <Button size="sm" variant="outline">Reset</Button>
                <Button size="sm">Apply</Button>
              </>
            }
          >
            <SearchInput placeholder="ابحث عن موظف أو مؤسسة" wrapperClassName="min-w-[220px] flex-1" />
            <Select value={statusValue} onValueChange={setStatusValue}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="warning">يتطلب متابعة</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="عدد الموظفين" value={124} trendValue={8} trendLabel="مقارنة بالشهر الماضي" icon={<Users className="h-5 w-5" />} accent="info" />
            <StatCard title="عدد المؤسسات" value={34} trendValue={3} trendLabel="نمو مستمر" icon={<Building2 className="h-5 w-5" />} accent="success" />
            <StatCard title="تنبيهات عاجلة" value={18} trendValue={-6} trendLabel="انخفاض جيد" icon={<AlertTriangle className="h-5 w-5" />} accent="warning" />
            <MetricCard title="معدل الإشغال" value="84%" subtitle="آخر 30 يوم" trend={5} icon={<Building2 className="h-4 w-4" />} />
          </div>

          <DataCard
            title="الفريق المسؤول"
            description="نموذج لبطاقة بيانات مع محتوى ديناميكي وإجراء جانبي."
            action={<Button size="sm" variant="outline">Manage</Button>}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <AvatarGroup
                size="lg"
                items={[
                  { id: '1', name: 'Ahmad Ali' },
                  { id: '2', name: 'Sara Salem' },
                  { id: '3', name: 'Yousef Adel' },
                  { id: '4', name: 'Lama Omar' },
                  { id: '5', name: 'Nora Hani' },
                ]}
              />
              <p className="text-sm text-muted-foreground">آخر تحديث: قبل 10 دقائق</p>
            </div>
          </DataCard>
        </section>
      </div>
    </Layout>
  )
}

export default DesignSystem
