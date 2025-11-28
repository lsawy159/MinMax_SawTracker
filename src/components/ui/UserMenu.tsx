import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback } from './Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu'
import { User, Settings, LogOut, Shield } from 'lucide-react'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const displayName = user?.full_name || user?.email || 'مستخدم'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 border-primary bg-white hover:bg-gray-50 hover:shadow-[0_2px_4px_-1px_rgba(0,0,0,0.2),0_4px_5px_0_rgba(0,0,0,0.14)] transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-95">
          <Avatar className="h-9 w-9 ring-2 ring-white transition-transform duration-200 hover:scale-105">
            <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-sm font-semibold">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-end gap-2 hidden sm:block">
            <span className="text-sm font-medium text-blue-900 leading-tight transition-colors duration-200">{displayName}</span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/general-settings')}
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          <span>الملف الشخصي</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/admin-settings')}
          className="cursor-pointer"
          disabled={user?.role !== 'admin'}
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>الإعدادات</span>
        </DropdownMenuItem>
        {user?.role === 'admin' && (
          <DropdownMenuItem
            onClick={() => navigate('/security-management')}
            className="cursor-pointer"
          >
            <Shield className="mr-2 h-4 w-4" />
            <span>الأمان</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>تسجيل خروج</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

