import { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LayoutDashboard, Users, Building2, UserCog, Settings, LogOut, Database, BarChart3, History, ArrowDownUp, SearchIcon, Shield, Key, Cog } from 'lucide-react'
import NotificationDropdown from '../notifications/NotificationDropdown'
import { GlobalSearch } from '../search/GlobalSearch'

interface PermissionMatrix {
  employees: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  companies: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  settings: { view: boolean; edit: boolean }
}

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

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
    { path: '/dashboard', icon: LayoutDashboard, label: 'لوحة القيادة', permission: null },
    { path: '/employees', icon: Users, label: 'الموظفين', permission: { section: 'employees' as const, action: 'view' as const } },
    { path: '/companies', icon: Building2, label: 'المؤسسات', permission: { section: 'companies' as const, action: 'view' as const } },
    { path: '/advanced-search', icon: SearchIcon, label: 'البحث المتقدم', permission: null },
    { path: '/reports', icon: BarChart3, label: 'التقارير', permission: null },
    { path: '/activity-logs', icon: History, label: 'سجل النشاطات', permission: null },
    { path: '/import-export', icon: ArrowDownUp, label: 'استيراد/تصدير', permission: null },
    { path: '/security-management', icon: Shield, label: 'إدارة الأمان', permission: null, adminOnly: true },
    { path: '/permissions-management', icon: Key, label: 'إدارة الأذونات', permission: null, adminOnly: true },
    { path: '/users', icon: UserCog, label: 'المستخدمين', permission: null, adminOnly: true },
    { path: '/settings', icon: Settings, label: 'حدود الشركات', permission: null, adminOnly: true },
    { path: '/admin-settings', icon: Database, label: 'إعدادات النظام', permission: null, adminOnly: true },
    { path: '/general-settings', icon: Cog, label: 'الإعدادات العامة', permission: null, adminOnly: true },
  ]

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">SawTracker</h1>
            </div>
            <div className="flex items-center gap-4">
              <GlobalSearch />
              <NotificationDropdown />
              <span className="text-sm text-gray-700">{user?.full_name || user?.email}</span>
              <button onClick={handleSignOut} className="flex items-center gap-2 text-gray-700 hover:text-red-600 transition">
                <LogOut className="w-5 h-5" />
                <span className="text-sm">تسجيل خروج</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 bg-white border-l border-gray-200 min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-2">
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
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
          </nav>
        </aside>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
