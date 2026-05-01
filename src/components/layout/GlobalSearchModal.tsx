import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Users, Building2, FolderKanban, Truck, Wallet, X, Loader2, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type SearchTab = 'employees' | 'companies' | 'projects' | 'transfers' | 'payroll'

interface SearchResult {
  id: string
  primary: string
  secondary?: string
  tertiary?: string
  extra?: string
}

const TABS: {
  id: SearchTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  placeholder: string
}[] = [
  { id: 'employees', label: 'موظفين', icon: Users, placeholder: 'الاسم أو رقم الإقامة...' },
  { id: 'companies', label: 'مؤسسات', icon: Building2, placeholder: 'الاسم أو الرقم الموحد أو رقم القوى أو التأمينات...' },
  { id: 'projects', label: 'مشاريع', icon: FolderKanban, placeholder: 'اسم المشروع...' },
  { id: 'transfers', label: 'إجراءات النقل', icon: Truck, placeholder: 'الاسم أو رقم الإقامة...' },
  { id: 'payroll', label: 'الرواتب', icon: Wallet, placeholder: 'الاسم أو رقم الإقامة...' },
]

async function runSearch(tab: SearchTab, query: string): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q) return []

  switch (tab) {
    case 'employees': {
      const isNum = /^\d+$/.test(q)
      let dbq = supabase
        .from('employees')
        .select('id, name, residence_number, nationality, company:companies(name)')
        .eq('is_deleted', false)
        .limit(10)
      dbq = isNum ? dbq.ilike('residence_number', `%${q}%`) : dbq.ilike('name', `%${q}%`)
      const { data } = await dbq
      return (data || []).map((e) => ({
        id: e.id,
        primary: e.name,
        secondary: e.residence_number ? `رقم الإقامة: ${e.residence_number}` : undefined,
        tertiary: e.nationality || undefined,
        extra: (e.company as { name?: string } | null)?.name || undefined,
      }))
    }

    case 'companies': {
      const isNum = /^\d+$/.test(q)
      let dbq = supabase
        .from('companies')
        .select('id, name, unified_number, labor_subscription_number, social_insurance_number')
        .limit(10)
      if (isNum) {
        dbq = dbq.or(
          `unified_number.eq.${q},labor_subscription_number.ilike.%${q}%,social_insurance_number.ilike.%${q}%`
        )
      } else {
        dbq = dbq.ilike('name', `%${q}%`)
      }
      const { data } = await dbq
      return (data || []).map((c) => ({
        id: c.id,
        primary: c.name,
        secondary: c.unified_number ? `الرقم الموحد: ${c.unified_number}` : undefined,
        tertiary: c.labor_subscription_number ? `رقم القوى: ${c.labor_subscription_number}` : undefined,
        extra: c.social_insurance_number ? `التأمينات: ${c.social_insurance_number}` : undefined,
      }))
    }

    case 'projects': {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status, company:companies(name)')
        .ilike('name', `%${q}%`)
        .limit(10)
      return (data || []).map((p) => ({
        id: p.id,
        primary: p.name,
        secondary: (p.company as { name?: string } | null)?.name || undefined,
        tertiary: p.status || undefined,
      }))
    }

    case 'transfers': {
      const isNum = /^\d+$/.test(q)
      let dbq = supabase.from('transfer_procedures').select('id, name, iqama, status').limit(10)
      dbq = isNum ? dbq.ilike('iqama::text', `%${q}%`) : dbq.ilike('name', `%${q}%`)
      const { data } = await dbq
      return (data || []).map((t) => ({
        id: t.id,
        primary: t.name,
        secondary: t.iqama ? `رقم الإقامة: ${t.iqama}` : undefined,
        tertiary: t.status || undefined,
      }))
    }

    case 'payroll': {
      const isNum = /^\d+$/.test(q)
      let dbq = supabase
        .from('payroll_run_entries')
        .select('id, employee_name_snapshot, residence_number_snapshot, entry_status, payroll_run:payroll_runs(payroll_month)')
        .limit(10)
      dbq = isNum
        ? dbq.ilike('residence_number_snapshot::text', `%${q}%`)
        : dbq.ilike('employee_name_snapshot', `%${q}%`)
      const { data } = await dbq
      return (data || []).map((e) => ({
        id: e.id,
        primary: e.employee_name_snapshot || '—',
        secondary: e.residence_number_snapshot ? `رقم الإقامة: ${e.residence_number_snapshot}` : undefined,
        tertiary: (e.payroll_run as { payroll_month?: string } | null)?.payroll_month || undefined,
        extra: e.entry_status || undefined,
      }))
    }
  }
}

interface GlobalSearchModalProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [activeTab, setActiveTab] = useState<SearchTab>('employees')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      setSelectedResult(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setQuery('')
    setResults([])
    setActiveIndex(0)
    setSelectedResult(null)
  }, [activeTab])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      setSelectedResult(null)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const res = await runSearch(activeTab, query)
      setResults(res)
      setActiveIndex(0)
      setSelectedResult(null)
      setLoading(false)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeTab])

  const handleSelect = useCallback((result: SearchResult) => {
    setSelectedResult((prev) => (prev?.id === result.id ? null : result))
    setActiveIndex(results.indexOf(result))
  }, [results])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && results[activeIndex]) { handleSelect(results[activeIndex]); return }
  }

  if (!open) return null

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[72px] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/98 shadow-2xl dark:border-white/10 dark:bg-slate-900/98 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={TABS.find(t => t.id === activeTab)?.placeholder}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none dark:text-slate-100"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 flex-shrink-0" />}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto">
          {!query.trim() ? (
            <p className="px-4 py-6 text-sm text-center text-slate-400 dark:text-slate-500">
              ابدأ الكتابة للبحث...
            </p>
          ) : loading ? (
            <p className="px-4 py-6 text-sm text-center text-slate-400">جارٍ البحث...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-slate-400">لا توجد نتائج</p>
          ) : (
            <div className="p-2 space-y-0.5">
              {results.map((result, idx) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-right transition ${
                    selectedResult?.id === result.id
                      ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-400/40'
                      : idx === activeIndex
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {result.primary}
                    </span>
                    {result.secondary && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {result.secondary}
                      </span>
                    )}
                    {result.tertiary && (
                      <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">
                        {result.tertiary}
                      </span>
                    )}
                  </div>
                  {result.extra && (
                    <span className="flex-shrink-0 text-[10px] text-slate-400 mt-0.5">{result.extra}</span>
                  )}
                  {selectedResult?.id === result.id && (
                    <ChevronLeft className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected result detail panel */}
        {selectedResult && (
          <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/60 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{selectedResult.primary}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {[selectedResult.secondary, selectedResult.tertiary, selectedResult.extra]
                    .filter(Boolean)
                    .map((v, i) => (
                      <span key={i} className="inline-flex items-center rounded-full border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-700 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">
                        {v}
                      </span>
                    ))}
                </div>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-400">
          <span>↑↓ تنقل · Enter تحديد · Esc إغلاق</span>
          <span>{results.length > 0 ? `${results.length} نتيجة` : ''}</span>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
