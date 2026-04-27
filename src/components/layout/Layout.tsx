import { ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  UserCog,
  Settings,
  Database,
  BarChart3,
  History,
  ArrowDownUp,
  SearchIcon,
  Bell,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Wallet,
  Moon,
  Sun,
  RefreshCcw,
} from 'lucide-react'
import { useAlertsStats } from '@/hooks/useAlertsStats'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { usePermissions } from '@/utils/permissions'
import { useThemeMode, useFontMode, useDensityMode } from '@/hooks/useUiPreferences'
import { MobileBottomNav } from './MobileBottomNav'
import { PillHeader } from './PillHeader'

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { alertsStats } = useAlertsStats()

  // State for sidebar collapse (desktop)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })

  // State for mobile sidebar open/close
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Save collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed])

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  // Close mobile sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isMobileOpen])

  // استخدام usePermissions hook للتحقق من الصلاحيات
  const { hasPermission } = usePermissions()
  const { isDark, toggleTheme } = useThemeMode()
  const { fontMode, setFontMode } = useFontMode()
  const { densityMode, setDensityMode } = useDensityMode()

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  useEffect(() => {
    const handleRipple = (event: MouseEvent) => {
      const ripple = document.createElement('span')
      ripple.className = 'app-click-ripple'
      ripple.style.left = `${event.clientX}px`
      ripple.style.top = `${event.clientY}px`
      document.body.appendChild(ripple)
      window.setTimeout(() => {
        ripple.remove()
      }, 700)
    }

    window.addEventListener('click', handleRipple)
    return () => window.removeEventListener('click', handleRipple)
  }, [])

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.parallax-card'))
    const cleanup: Array<() => void> = []

    cards.forEach((card) => {
      const handleMove = (event: MouseEvent) => {
        const rect = card.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * 100
        const y = ((event.clientY - rect.top) / rect.height) * 100
        card.style.setProperty('--mouse-x', `${x}%`)
        card.style.setProperty('--mouse-y', `${y}%`)
        card.style.setProperty('--tilt-x', `${((y - 50) / 50) * -3}deg`)
        card.style.setProperty('--tilt-y', `${((x - 50) / 50) * 3}deg`)
      }

      const handleLeave = () => {
        card.style.setProperty('--tilt-x', '0deg')
        card.style.setProperty('--tilt-y', '0deg')
      }

      card.addEventListener('mousemove', handleMove)
      card.addEventListener('mouseleave', handleLeave)
      cleanup.push(() => {
        card.removeEventListener('mousemove', handleMove)
        card.removeEventListener('mouseleave', handleLeave)
      })
    })

    return () => {
      cleanup.forEach((dispose) => dispose())
    }
  }, [location.pathname])

  const navItems = useMemo(
    () => [
      {
        path: '/dashboard',
        icon: LayoutDashboard,
        label: 'الرئيسية',
        permission: { section: 'dashboard' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/employees',
        icon: Users,
        label: 'الموظفين',
        permission: { section: 'employees' as const, action: 'view' },
        badge:
          alertsStats.employeeUrgent > 0
            ? { count: alertsStats.employeeUrgent, color: 'red' }
            : null,
        badgeTooltip: 'التنبيهات الطارئة فقط',
      },
      {
        path: '/companies',
        icon: Building2,
        label: 'المؤسسات',
        permission: { section: 'companies' as const, action: 'view' },
        badge:
          alertsStats.companyUrgent > 0 ? { count: alertsStats.companyUrgent, color: 'red' } : null,
        badgeTooltip: 'التنبيهات الطارئة فقط',
      },
      {
        path: '/projects',
        icon: FolderKanban,
        label: 'المشاريع',
        permission: { section: 'projects' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/transfer-procedures',
        icon: RefreshCcw,
        label: 'إجراءات النقل',
        permission: { section: 'transferProcedures' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/alerts',
        icon: Bell,
        label: 'التنبيهات',
        permission: { section: 'alerts' as const, action: 'view' },
        badge:
          alertsStats.total > 0
            ? { count: alertsStats.total, color: alertsStats.urgent > 0 ? 'red' : 'blue' }
            : null,
      },
      {
        path: '/advanced-search',
        icon: SearchIcon,
        label: 'البحث المتقدم',
        permission: { section: 'advancedSearch' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/payroll-deductions',
        icon: Wallet,
        label: 'الرواتب والاستقطاعات',
        permission: { section: 'payroll' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/reports',
        icon: BarChart3,
        label: 'التقارير',
        permission: { section: 'reports' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/activity-logs',
        icon: History,
        label: 'سجل النشاطات',
        permission: { section: 'activityLogs' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/import-export',
        icon: ArrowDownUp,
        label: 'استيراد/تصدير',
        permission: { section: 'importExport' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/users',
        icon: UserCog,
        label: 'المستخدمين',
        permission: { section: 'users' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/settings',
        icon: Settings,
        label: 'حدود الشركات',
        permission: { section: 'settings' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/alert-settings',
        icon: Bell,
        label: 'إعدادات التنبيهات',
        permission: { section: 'centralizedSettings' as const, action: 'view' },
        badge: null,
      },
      {
        path: '/admin-settings',
        icon: Database,
        label: 'إعدادات النظام',
        permission: { section: 'adminSettings' as const, action: 'view' },
        badge: null,
      },
    ],
    [alertsStats]
  )

  const quickSearchItems = useMemo(
    () =>
      navItems
        .filter(
          (item) =>
            !item.permission ||
            hasPermission(item.permission.section, item.permission.action as string)
        )
        .map((item) => ({
          path: item.path,
          label: item.label,
          description: `الانتقال إلى ${item.label}`,
          keywords: [
            item.label,
            item.path,
            item.path.replace('/', ''),
            item.path.includes('employees') ? 'موظف' : '',
            item.path.includes('companies') ? 'مؤسسة' : '',
            item.path.includes('alerts') ? 'تنبيه' : '',
            item.path.includes('transfer') ? 'نقل' : '',
            item.path.includes('payroll') ? 'راتب' : '',
          ].filter(Boolean),
        })),
    [navItems, hasPermission]
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background text-foreground" dir="rtl">
        <PillHeader
          isDark={isDark}
          toggleTheme={toggleTheme}
          alertsCount={alertsStats.total}
          userName={user?.full_name || user?.email || 'مستخدم'}
          userRole={user?.role === 'admin' ? 'مدير' : 'مستخدم'}
          onSignOut={handleSignOut}
          fontMode={fontMode}
          onFontChange={setFontMode}
          densityMode={densityMode}
          onDensityChange={setDensityMode}
          quickSearchItems={quickSearchItems}
        />

        <div className="flex relative">
          {/* Mobile Backdrop */}
          {isMobileOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-[var(--motion-base)] ease-[var(--ease-out)] lg:hidden"
              onClick={() => setIsMobileOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar - Modern Flat Design */}
          <aside
            className={`
              fixed lg:sticky top-0 right-0 lg:self-start
              ${isCollapsed ? 'w-16' : 'w-72'}
              ${isMobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
              h-screen lg:h-auto lg:min-h-screen
              app-sidebar border-l border-border bg-white/95 backdrop-blur-md
              shadow-[0_18px_50px_-24px_rgba(17,24,39,0.28)]
              z-50 lg:z-auto
              transition-all duration-[var(--motion-base)] ease-[var(--ease-in-out)]
              flex flex-col
            `}
          >
            {/* Logo Section at Top */}
            <div className="flex-shrink-0 border-b border-border bg-gradient-to-b from-primary/10 to-white p-4">
              <div className="flex items-center justify-between gap-2">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileOpen(!isMobileOpen)}
                  className="lg:hidden rounded-xl border border-border bg-white p-1.5 text-slate-600 transition-colors hover:bg-primary/10 hover:text-slate-900"
                  aria-label="Toggle menu"
                >
                  {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>

                {/* Logo */}
                {!isCollapsed ? (
                  <Link
                    to="/dashboard"
                    className="flex flex-col items-center transition-opacity hover:opacity-90 flex-1"
                  >
                    <div className="rounded-2xl border border-primary/40 bg-white px-3 py-2 shadow-soft">
                      <img src="/logo.png" alt="SawTracker Logo" className="h-14 w-auto" />
                    </div>
                    <span className="mt-2 text-[10px] font-semibold tracking-wide text-slate-500">
                      See What Others Don't
                    </span>
                  </Link>
                ) : (
                  <Link
                    to="/dashboard"
                    className="flex items-center justify-center transition-opacity hover:opacity-90 flex-1"
                  >
                    <div className="rounded-2xl border border-primary/40 bg-white p-2 shadow-soft">
                      <img src="/logo.png" alt="SawTracker Logo" className="h-10 w-auto" />
                    </div>
                  </Link>
                )}

                {/* Collapse Button (Desktop only) */}
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="hidden lg:flex rounded-xl border border-border bg-white p-1.5 text-slate-500 transition-colors hover:bg-primary/10 hover:text-slate-800"
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${
                      isCollapsed ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems
                .filter((item) => {
                  return (
                    !item.permission ||
                    hasPermission(item.permission.section, item.permission.action as string)
                  )
                })
                .map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  const hasBadge = item.badge && item.badge.count > 0

                  const navItem = (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        group relative flex items-center justify-between
                        ${isCollapsed ? 'px-2.5 justify-center' : 'px-3.5'}
                        py-2.5 rounded-xl border
                        transition-all duration-[var(--motion-fast)] ease-[var(--ease-out)]
                        ${
                          isActive
                            ? 'border-primary/60 bg-primary text-slate-950 font-semibold shadow-soft'
                            : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950'
                        }
                      `}
                    >
                      <div
                        className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'} flex-1 min-w-0`}
                      >
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                            isActive ? 'scale-110' : 'group-hover:scale-105'
                          }`}
                        />
                        {!isCollapsed && <span className="text-[12px] truncate">{item.label}</span>}
                      </div>

                      {hasBadge &&
                        !isCollapsed &&
                        (item.badgeTooltip ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`
                                flex items-center justify-center
                                min-w-[18px] h-[18px] px-1 rounded-full
                                text-[10px] font-bold text-white
                                shadow-sm transition-transform duration-200
                                ${item.badge?.color === 'red' ? 'bg-red-500' : 'bg-slate-900'}
                                ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                              `}
                              >
                                {item.badge!.count > 99 ? '99+' : item.badge!.count}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="bg-neutral-900 text-white">
                              {item.badgeTooltip}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div
                            className={`
                            flex items-center justify-center
                            min-w-[18px] h-[18px] px-1 rounded-full
                            text-[10px] font-bold text-white
                            shadow-sm transition-transform duration-200
                            ${item.badge?.color === 'red' ? 'bg-red-500' : 'bg-slate-900'}
                            ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                          `}
                          >
                            {item.badge!.count > 99 ? '99+' : item.badge!.count}
                          </div>
                        ))}

                      {hasBadge && isCollapsed && (
                        <div
                          className={`
                          absolute -top-0.5 -right-0.5
                          h-2 w-2 rounded-full
                          ${item.badge?.color === 'red' ? 'bg-red-500' : 'bg-slate-900'}
                          ring-2 ring-white
                        `}
                        />
                      )}

                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-r-full" />
                      )}
                    </Link>
                  )

                  // Wrap with Tooltip when collapsed
                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                        <TooltipContent side="right" className="bg-neutral-900 text-white">
                          <div className="flex items-center gap-2">
                            <span>{item.label}</span>
                            {hasBadge && (
                              <span
                                className={`
                                px-1.5 py-0.5 rounded text-xs font-bold
                                ${item.badge?.color === 'red' ? 'bg-red-500' : 'bg-slate-900'}
                              `}
                              >
                                {item.badge!.count > 99 ? '99+' : item.badge!.count}
                              </span>
                            )}
                          </div>
                          {item.badgeTooltip && (
                            <div className="mt-1 text-[10px] text-neutral-300">
                              {item.badgeTooltip}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return navItem
                })}
            </nav>

            {/* User Actions Section at Bottom */}
            <div className="mt-auto border-t border-border bg-white/80 p-2">
              {!isCollapsed ? (
                <div className="space-y-1">
                  <button
                    onClick={toggleTheme}
                    className="w-full group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-700 transition-all duration-200 ease-in-out hover:bg-primary/10 hover:text-slate-950"
                    type="button"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <Moon className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-xs">{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
                  </button>
                  <button
                    onClick={async () => {
                      await handleSignOut()
                    }}
                    className="w-full group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-700 transition-all duration-200 ease-in-out hover:bg-red-50 hover:text-red-600"
                    data-testid="logout-btn-mobile"
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">تسجيل خروج</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={toggleTheme}
                        className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-primary/10 hover:text-slate-950"
                        type="button"
                      >
                        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-neutral-900 text-white">
                      {isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={async () => {
                          await handleSignOut()
                        }}
                        className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-red-50 hover:text-red-600"
                        data-testid="logout-btn"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-neutral-900 text-white">
                      تسجيل خروج
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main
            className={`flex-1 pb-20 pt-16 lg:pb-0 lg:pt-16 transition-all duration-300 ${isCollapsed ? 'lg:ml-0' : ''}`}
          >
            {children}
          </main>
        </div>

        <button
          onClick={toggleTheme}
          type="button"
          className="fixed bottom-24 left-4 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-slate-800 shadow-lg backdrop-blur lg:hidden"
          aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="text-xs font-medium">{isDark ? 'فاتح' : 'داكن'}</span>
        </button>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav navItems={navItems} />
      </div>
    </TooltipProvider>
  )
}
