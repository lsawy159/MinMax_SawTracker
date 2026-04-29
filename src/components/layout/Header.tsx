import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useThemeMode } from '@/hooks/useUiPreferences'
import { Menu, Moon, Sun, Search, Bell, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { isDark, toggleTheme } = useThemeMode()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const handleAdvancedSearch = () => {
    navigate('/advanced-search')
  }

  const userInitials = (user?.full_name || user?.username || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Left: Mobile Menu + Title */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
            aria-label="فتح القائمة الجانبية"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            SawTracker
          </h1>
        </div>

        {/* Center: Search (desktop only) */}
        <div className="hidden lg:flex flex-1 max-w-md mx-8">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAdvancedSearch}
            className="w-full justify-start text-neutral-500 dark:text-neutral-400"
          >
            <Search className="h-4 w-4 mr-2" />
            <span className="text-sm">بحث متقدم...</span>
          </Button>
        </div>

        {/* Right: Actions + Profile */}
        <div className="flex items-center gap-2">
          {/* Search Button (mobile) */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAdvancedSearch}
            className="lg:hidden"
            aria-label="بحث متقدم"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="الإشعارات"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-danger-500 rounded-full" />
          </Button>

          {/* Theme Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Profile Dropdown */}
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary-500 text-white text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
                <p className="font-medium text-neutral-900 dark:text-neutral-50">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
                  {user?.email}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">
                  {user?.role === 'admin'
                    ? 'مدير النظام'
                    : user?.role === 'manager'
                      ? 'مسؤول'
                      : 'مستخدم'}
                </p>
              </div>

              {/* Actions */}
              <DropdownMenuItem
                onClick={() => navigate('/settings')}
                className="cursor-pointer gap-2"
              >
                <Settings className="h-4 w-4" />
                <span>الإعدادات</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer gap-2 text-danger-600 dark:text-danger-400"
              >
                <LogOut className="h-4 w-4" />
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
