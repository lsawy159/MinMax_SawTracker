import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Moon, Search, Sun, LogOut, Type } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { type FontMode } from '@/hooks/useUiPreferences'
import { GlobalSearchModal } from './GlobalSearchModal'

interface PillHeaderProps {
  isDark: boolean
  toggleTheme: () => void
  alertsCount: number
  userName?: string
  userRole?: string
  onSignOut: () => Promise<void>
  fontMode: FontMode
  onFontChange: (value: FontMode) => void
  quickSearchItems?: unknown[]
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
}: PillHeaderProps) => {
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileWrapperRef = useRef<HTMLDivElement | null>(null)

  const initials = useMemo(() => {
    if (!userName) return 'U'
    return userName
      .split(' ')
      .map((name) => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [userName])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!profileWrapperRef.current?.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (e.key === '/' && !typing) {
        e.preventDefault()
        setGlobalSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <GlobalSearchModal open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
      <div className="pointer-events-none fixed left-1/2 top-3 z-50 w-[min(94vw,720px)] -translate-x-1/2 px-2">
        <div className="pointer-events-auto app-pill-nav relative mx-auto flex h-12 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/70 px-2.5 shadow-[0_14px_45px_-26px_rgba(2,8,23,0.55)] backdrop-blur-xl dark:bg-[#0b1220]/70">
          {/* Search button */}
          <button
            type="button"
            onClick={() => setGlobalSearchOpen(true)}
            className="flex flex-1 min-w-[170px] items-center gap-2 h-9 rounded-full border border-slate-200/60 bg-white/75 px-3 text-sm text-slate-400 outline-none transition hover:border-blue-400/60 hover:bg-white dark:border-white/10 dark:bg-slate-900/70 dark:hover:bg-slate-800/80"
          >
            <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <span className="flex-1 text-right truncate">بحث في النظام...</span>
            <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200/80 bg-slate-100/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:border-white/10 dark:bg-slate-800">
              /
            </kbd>
          </button>

          <div className="flex items-center gap-1">
            {/* Alerts */}
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

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition hover:bg-blue-500/12 hover:text-blue-600 dark:text-slate-100"
              type="button"
              aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Profile */}
            <div className="relative" ref={profileWrapperRef}>
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
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {userName || 'مستخدم'}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-300">
                        {userRole || 'مستخدم'}
                      </p>
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
                    <option value="tajawal">Tajawal</option>
                    <option value="cairo">Cairo</option>
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
    </>
  )
}

export default PillHeader
