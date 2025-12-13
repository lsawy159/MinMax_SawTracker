import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Menu, 
  X,
} from 'lucide-react'

interface NavItem {
  path: string
  icon: typeof LayoutDashboard
  label: string
  badge?: { count: number; color: string } | null
  adminOnly?: boolean
  hidden?: boolean
  permission?: { section: string; action: string } | null
}

interface MobileBottomNavProps {
  navItems: NavItem[]
}

export function MobileBottomNav({ navItems }: MobileBottomNavProps) {
  const location = useLocation()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  // العناصر الرئيسية (الظاهرة دائماً في Bottom Nav)
  const mainItems = [
    navItems.find(item => item.path === '/dashboard'),
    navItems.find(item => item.path === '/employees'),
    navItems.find(item => item.path === '/companies'),
    navItems.find(item => item.path === '/alerts'),
  ].filter(Boolean) as NavItem[]

  // العناصر الإضافية (في قائمة More)
  const moreItems = navItems.filter(
    item => !mainItems.find(main => main.path === item.path)
  )

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 shadow-lg z-40">
        <div className="flex justify-between items-center px-1">
          {mainItems.map(item => {
            const isActive = location.pathname === item.path
            const Icon = item.icon

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMoreOpen(false)}
                className={`
                  flex-1 flex flex-col items-center justify-center py-3 px-1
                  relative transition-colors duration-200
                  ${
                    isActive
                      ? 'text-primary'
                      : 'text-gray-600 hover:text-gray-900'
                  }
                `}
                title={item.label}
              >
                <div className="relative">
                  <Icon className="w-6 h-6 mb-1" />
                  {item.badge && item.badge.count > 0 && (
                    <span
                      className={`
                        absolute -top-1 -right-1.5
                        min-w-[20px] h-5 px-1 rounded-full
                        text-[10px] font-bold text-white
                        flex items-center justify-center
                        ${item.badge.color === 'red' ? 'bg-red-500' : 'bg-blue-500'}
                      `}
                    >
                      {item.badge.count > 99 ? '99+' : item.badge.count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-center line-clamp-1">
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </Link>
            )
          })}

          {/* More Button */}
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`
              flex-1 flex flex-col items-center justify-center py-3 px-1
              relative transition-colors duration-200
              ${isMoreOpen ? 'text-primary' : 'text-gray-600 hover:text-gray-900'}
            `}
            title="المزيد"
            aria-label="فتح قائمة المزيد"
            aria-expanded={isMoreOpen}
          >
            <Menu className="w-6 h-6 mb-1" />
            <span className="text-[11px] text-center">المزيد</span>
            {isMoreOpen && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      {isMoreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Menu Container */}
          <div className="fixed bottom-16 left-0 right-0 lg:hidden bg-white border-t border-gray-200 shadow-lg z-40 max-h-96 overflow-y-auto rounded-t-lg">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">
                المزيد من الخيارات
              </h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="divide-y divide-gray-100">
              {moreItems.length > 0 ? (
                moreItems.map(item => {
                  const isActive = location.pathname === item.path
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMoreOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3
                        transition-colors duration-200
                        ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{item.label}</span>
                      </div>
                      {item.badge && item.badge.count > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-1">
                          {item.badge.count > 99 ? '99+' : item.badge.count}
                        </span>
                      )}
                    </Link>
                  )
                })
              ) : (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">
                  لا توجد عناصر إضافية
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default MobileBottomNav
