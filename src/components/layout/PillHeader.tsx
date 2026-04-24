import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, Moon, Search, Sun, LogOut, Type, Rows3 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { type DensityMode, type FontMode } from '@/hooks/useUiPreferences'

interface QuickSearchItem {
  path: string
  label: string
  description?: string
  keywords?: string[]
}

interface PillHeaderProps {
  isDark: boolean
  toggleTheme: () => void
  alertsCount: number
  userName?: string
  userRole?: string
  onSignOut: () => Promise<void>
  fontMode: FontMode
  onFontChange: (value: FontMode) => void
  densityMode: DensityMode
  onDensityChange: (value: DensityMode) => void
  quickSearchItems: QuickSearchItem[]
}

export const PillHeader = ({
  isDark,
  toggleTheme,
  alertsCount,
  userName,
  userRole,
  onSignOut,
  fontMode,
  onFontChange,
  densityMode,
  onDensityChange,
  quickSearchItems,
}: PillHeaderProps) => {
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeResultIndex, setActiveResultIndex] = useState(0)
  const searchWrapperRef = useRef<HTMLDivElement | null>(null)
  const profileWrapperRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  const initials = useMemo(() => {
    if (!userName) return 'U'
    return userName
      .split(' ')
      .map((name) => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [userName])

  const normalizedQuery = searchTerm.trim().toLowerCase()
  const quickResults = useMemo(() => {
    const items = quickSearchItems
    if (!normalizedQuery) {
      return items.slice(0, 6)
    }

    return items
      .filter((item) => {
        const haystack = [item.label, item.description, item.path, ...(item.keywords || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .slice(0, 8)
  }, [quickSearchItems, normalizedQuery])

  useEffect(() => {
    setActiveResultIndex(0)
  }, [normalizedQuery, searchOpen])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const targetNode = event.target as Node
      if (!searchWrapperRef.current?.contains(targetNode)) {
        setSearchOpen(false)
      }
      if (!profileWrapperRef.current?.contains(targetNode)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const navigateTo = (path: string) => {
    navigate(path)
    setSearchOpen(false)
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (quickResults.length > 0) {
        setActiveResultIndex((prev) => (prev + 1) % quickResults.length)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (quickResults.length > 0) {
        setActiveResultIndex((prev) => (prev - 1 + quickResults.length) % quickResults.length)
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const selectedResult = quickResults[activeResultIndex]
      if (selectedResult) {
        navigateTo(selectedResult.path)
        return
      }
      navigateTo('/advanced-search')
      return
    }

    if (event.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-50 w-[min(94vw,720px)] -translate-x-1/2 px-2">
      <div className="pointer-events-auto app-pill-nav relative mx-auto flex h-12 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/70 px-2.5 shadow-[0_14px_45px_-26px_rgba(2,8,23,0.55)] backdrop-blur-xl dark:bg-[#0b1220]/70">
        <div ref={searchWrapperRef} className="relative min-w-[170px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="بحث سريع في النظام..."
            className="h-9 w-full rounded-full border border-slate-200/60 bg-white/75 px-10 text-sm text-slate-700 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100"
          />

          {searchOpen ? (
            <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white/96 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/96">
              <div className="max-h-80 overflow-y-auto p-2">
                {quickResults.length > 0 ? (
                  quickResults.map((result, index) => (
                    <button
                      key={result.path}
                      type="button"
                      onClick={() => navigateTo(result.path)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right transition ${
                        index === activeResultIndex
                          ? 'bg-primary/10 text-slate-900 dark:text-slate-50'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0 text-right">
                        <p className="truncate text-sm font-medium">{result.label}</p>
                        {result.description ? (
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{result.description}</p>
                        ) : null}
                      </div>
                      <span className="mr-3 text-[11px] text-slate-400">{result.path}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-300">لا توجد نتائج مطابقة</p>
                )}
              </div>

              <div className="border-t border-slate-200 p-2 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => navigateTo('/advanced-search')}
                  className="flex w-full items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/15"
                >
                  <span>فتح البحث المتقدم</span>
                  <span className="text-xs text-primary/80">نتائج أوسع</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <Link
            to="/alerts"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-blue-500/12 hover:text-blue-600 dark:text-slate-100"
            aria-label="التنبيهات"
          >
            <Bell className="h-4 w-4" />
            {alertsCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                {alertsCount > 99 ? '99+' : alertsCount}
              </span>
            ) : null}
          </Link>

          <button
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-blue-500/12 hover:text-blue-600 dark:text-slate-100"
            type="button"
            aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setProfileOpen((open) => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-slate-200/80 transition hover:ring-blue-500/40 dark:ring-white/10"
              type="button"
              aria-label="قائمة المستخدم"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-500/15 text-xs font-bold text-blue-700 dark:text-blue-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>

            {profileOpen ? (
              <div className="absolute left-0 top-11 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/96">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-200/70 pb-3 dark:border-white/10">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-blue-500/15 text-xs font-bold text-blue-700 dark:text-blue-300">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userName || 'مستخدم'}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-300">{userRole || 'مستخدم'}</p>
                  </div>
                </div>

                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Type className="h-3.5 w-3.5" />
                  الخط المستخدم
                </label>
                <select
                  value={fontMode}
                  onChange={(event) => onFontChange(event.target.value as FontMode)}
                  className="mb-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="ibm-plex">IBM Plex Sans Arabic</option>
                  <option value="cairo">Cairo</option>
                  <option value="noto">Noto Sans Arabic</option>
                  <option value="tajawal">Tajawal</option>
                </select>

                <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Rows3 className="h-3.5 w-3.5" />
                  كثافة الواجهة
                </label>
                <select
                  value={densityMode}
                  onChange={(event) => onDensityChange(event.target.value as DensityMode)}
                  className="mb-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="compact">مضغوط</option>
                  <option value="balanced">متوازن</option>
                  <option value="comfortable">مريح</option>
                </select>

                <button
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                  onClick={onSignOut}
                  type="button"
                >
                  <LogOut className="h-4 w-4" />
                  تسجيل خروج
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PillHeader
