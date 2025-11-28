import { ReactNode, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LayoutDashboard, Users, Building2, UserCog, Settings, Database, BarChart3, History, ArrowDownUp, SearchIcon, Shield, Key, Cog, Bell, Menu, X, ChevronRight, User, LogOut } from 'lucide-react'
import { useAlertsStats } from '@/hooks/useAlertsStats'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

interface PermissionMatrix {
  employees: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  companies: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  settings: { view: boolean; edit: boolean }
}

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

  // التحقق من الصلاحيات مع معالجة محسنة للمديرين
  const hasPermission = (section: keyof PermissionMatrix, action: keyof PermissionMatrix[keyof PermissionMatrix]) => {
    if (!user) {
      return false
    }
    
    // المديرون لهم جميع الصلاحيات
    if (user.role === 'admin') {
      return true
    }
    
    // للمستخدمين العاديين، تحقق من الصلاحيات المحددة مع فحص آمن
    const permissions = user.permissions as PermissionMatrix | undefined
    
    // تحقق من وجود permissions و section بشكل آمن
    if (!permissions || !permissions[section] || typeof permissions[section] !== 'object') {
      return false
    }
    
    // تحقق من وجود الإجراء المحدد بشكل آمن
    const sectionPermissions = permissions[section]
    if (!sectionPermissions || typeof sectionPermissions !== 'object') {
      return false
    }
    
    // تحقق من وجود الصلاحية المحددة
    const hasAccess = sectionPermissions[action as keyof typeof sectionPermissions]
    return Boolean(hasAccess)
  }

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'الرئيسية', permission: null, badge: null },
    { path: '/employees', icon: Users, label: 'الموظفين', permission: { section: 'employees' as const, action: 'view' as const }, badge: alertsStats.employeeUrgent > 0 ? { count: alertsStats.employeeUrgent, color: 'red' } : null },
    { path: '/companies', icon: Building2, label: 'المؤسسات', permission: { section: 'companies' as const, action: 'view' as const }, badge: alertsStats.companyUrgent > 0 ? { count: alertsStats.companyUrgent, color: 'red' } : null },
    { path: '/alerts', icon: Bell, label: 'التنبيهات', permission: null, badge: alertsStats.total > 0 ? { count: alertsStats.total, color: alertsStats.urgent > 0 ? 'red' : 'blue' } : null },
    { path: '/advanced-search', icon: SearchIcon, label: 'البحث المتقدم', permission: null, badge: null },
    { path: '/reports', icon: BarChart3, label: 'التقارير', permission: null, badge: null },
    { path: '/activity-logs', icon: History, label: 'سجل النشاطات', permission: null, badge: null },
    { path: '/import-export', icon: ArrowDownUp, label: 'استيراد/تصدير', permission: null, badge: null },
    { path: '/security-management', icon: Shield, label: 'إدارة الأمان', permission: null, adminOnly: true, badge: null },
    { path: '/permissions-management', icon: Key, label: 'إدارة الأذونات', permission: null, adminOnly: true, badge: null },
    { path: '/users', icon: UserCog, label: 'المستخدمين', permission: null, adminOnly: true, badge: null },
    { path: '/settings', icon: Settings, label: 'حدود الشركات', permission: null, adminOnly: true, badge: null },
    { path: '/admin-settings', icon: Database, label: 'إعدادات النظام', permission: null, adminOnly: true, badge: null },
    { path: '/general-settings', icon: Cog, label: 'الإعدادات العامة', permission: null, adminOnly: true, badge: null },
  ]

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <div className="flex relative">
          {/* Mobile Backdrop */}
          {isMobileOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
              onClick={() => setIsMobileOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar - Modern Flat Design */}
          <aside
            className={`
              fixed lg:sticky top-0 right-0 lg:self-start
              ${isCollapsed ? 'w-16' : 'w-64'}
              ${isMobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
              bg-white border-r border-gray-100
              h-screen lg:h-auto lg:min-h-screen
              shadow-lg lg:shadow-sm
              z-50 lg:z-auto
              transition-all duration-300 ease-in-out
              flex flex-col
            `}
          >
            {/* Logo Section at Top */}
            <div className="flex-shrink-0 border-b border-gray-100 p-4">
              <div className="flex items-center justify-between gap-2">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileOpen(!isMobileOpen)}
                  className="lg:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  aria-label="Toggle menu"
                >
                  {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
                
                {/* Logo */}
                {!isCollapsed ? (
                  <Link to="/dashboard" className="flex flex-col items-center hover:opacity-80 transition-opacity flex-1">
                    <img 
                      src="/logo.png" 
                      alt="SawTracker Logo" 
                      className="h-10 w-auto"
                    />
                    <span className="text-xs text-gray-500 mt-0.5 font-medium">
                      See What Others Don't
                    </span>
                  </Link>
                ) : (
                  <Link to="/dashboard" className="flex items-center justify-center hover:opacity-80 transition-opacity flex-1">
                    <img 
                      src="/logo.png" 
                      alt="SawTracker Logo" 
                      className="h-8 w-auto"
                    />
                  </Link>
                )}
                
                {/* Collapse Button (Desktop only) */}
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="hidden lg:flex p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
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
            <nav className="flex-1 p-2 space-y-0.5">
              {navItems
                .filter(item => {
                  // إذا كان العنصر للمديرين فقط، تحقق من أن المستخدم مدير
                  if (item.adminOnly && user?.role !== 'admin') {
                    return false
                  }
                  // التحقق من الصلاحيات العادية
                  return !item.permission || 
                    hasPermission(item.permission.section, item.permission.action)
                })
                .map(item => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  const hasBadge = item.badge && item.badge.count > 0
                  
                  const navItem = (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        group relative flex items-center justify-between
                        ${isCollapsed ? 'px-2.5 justify-center' : 'px-3'}
                        py-2 rounded-lg
                        transition-all duration-200 ease-in-out
                        ${
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'} flex-1 min-w-0`}>
                        <Icon className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                          isActive ? 'scale-110' : 'group-hover:scale-105'
                        }`} />
                        {!isCollapsed && (
                          <span className="text-xs truncate">{item.label}</span>
                        )}
                      </div>
                      
                      {hasBadge && !isCollapsed && (
                        <div className={`
                          flex items-center justify-center
                          min-w-[18px] h-[18px] px-1 rounded-full
                          text-[10px] font-bold text-white
                          shadow-sm transition-transform duration-200
                          ${
                            item.badge?.color === 'red' 
                              ? 'bg-red-500' 
                              : 'bg-blue-500'
                          }
                          ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                        `}>
                          {item.badge!.count > 99 ? '99+' : item.badge!.count}
                        </div>
                      )}
                      
                      {hasBadge && isCollapsed && (
                        <div className={`
                          absolute -top-0.5 -right-0.5
                          w-2 h-2 rounded-full
                          ${item.badge?.color === 'red' ? 'bg-red-500' : 'bg-blue-500'}
                          ring-2 ring-white
                        `} />
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
                        <TooltipTrigger asChild>
                          {navItem}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-gray-900 text-white">
                          <div className="flex items-center gap-2">
                            <span>{item.label}</span>
                            {hasBadge && (
                              <span className={`
                                px-1.5 py-0.5 rounded text-xs font-bold
                                ${item.badge?.color === 'red' ? 'bg-red-500' : 'bg-blue-500'}
                              `}>
                                {item.badge!.count > 99 ? '99+' : item.badge!.count}
                              </span>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return navItem
                })}
            </nav>

            {/* User Section at Bottom */}
            <div className="mt-auto border-t border-gray-100 p-2">
              {!isCollapsed ? (
                <div className="space-y-1">
                  <div className="px-3 py-2 flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs font-semibold">
                        {user?.full_name
                          ?.split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {user?.full_name || user?.email || 'مستخدم'}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {user?.role === 'admin' ? 'مدير' : 'مستخدم'}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/general-settings"
                    className={`
                      group relative flex items-center gap-2.5
                      px-3 py-2 rounded-lg
                      transition-all duration-200 ease-in-out
                      ${
                        location.pathname === '/general-settings'
                          ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">الملف الشخصي</span>
                  </Link>
                  <button
                    onClick={async () => {
                      await signOut()
                      window.location.href = '/login'
                    }}
                    className="w-full group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200 ease-in-out"
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs">تسجيل خروج</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="px-2 py-1">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-xs font-semibold">
                            {user?.full_name
                              ?.split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-gray-900 text-white">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{user?.full_name || user?.email || 'مستخدم'}</span>
                        <span className="text-xs text-gray-300">{user?.role === 'admin' ? 'مدير' : 'مستخدم'}</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to="/general-settings"
                        className={`p-2 rounded-lg transition-colors ${
                          location.pathname === '/general-settings'
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <User className="w-4 h-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-gray-900 text-white">
                      الملف الشخصي
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={async () => {
                          await signOut()
                          window.location.href = '/login'
                        }}
                        className="p-2 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-gray-900 text-white">
                      تسجيل خروج
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'lg:ml-0' : ''}`}>
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
