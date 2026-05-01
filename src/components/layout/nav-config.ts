import {
  Home,
  Users,
  Building2,
  Briefcase,
  Truck,
  Search,
  AlertCircle,
  BarChart3,
  DollarSign,
  Upload,
  Bell,
  Settings,
  Shield,
  Sliders,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type NavGroupId = 'operational' | 'admin'

export interface NavItem {
  id: string
  labelAr: string
  labelEn: string
  icon: ComponentType<{ className?: string }>
  to: string
  requiredPermission?: string
  group: NavGroupId
  order: number
}

export interface NavGroup {
  id: NavGroupId
  labelAr: string
  labelEn: string
  items: NavItem[]
}

export const NAV_ITEMS: NavItem[] = [
  // Operational Group
  {
    id: 'dashboard',
    labelAr: 'لوحة التحكم',
    labelEn: 'Dashboard',
    icon: Home,
    to: '/dashboard',
    group: 'operational',
    order: 1,
  },
  {
    id: 'employees',
    labelAr: 'الموظفون',
    labelEn: 'Employees',
    icon: Users,
    to: '/employees',
    group: 'operational',
    order: 2,
  },
  {
    id: 'companies',
    labelAr: 'الشركات',
    labelEn: 'Companies',
    icon: Building2,
    to: '/companies',
    group: 'operational',
    order: 3,
  },
  {
    id: 'projects',
    labelAr: 'المشاريع',
    labelEn: 'Projects',
    icon: Briefcase,
    to: '/projects',
    group: 'operational',
    order: 4,
  },
  {
    id: 'transfer-procedures',
    labelAr: 'إجراءات النقل',
    labelEn: 'Transfer Procedures',
    icon: Truck,
    to: '/transfer-procedures',
    group: 'operational',
    order: 5,
  },
  {
    id: 'advanced-search',
    labelAr: 'بحث متقدم',
    labelEn: 'Advanced Search',
    icon: Search,
    to: '/advanced-search',
    group: 'operational',
    order: 6,
  },
  {
    id: 'alerts',
    labelAr: 'التنبيهات',
    labelEn: 'Alerts',
    icon: AlertCircle,
    to: '/alerts',
    group: 'operational',
    order: 7,
  },
  {
    id: 'reports',
    labelAr: 'التقارير',
    labelEn: 'Reports',
    icon: BarChart3,
    to: '/reports',
    group: 'operational',
    order: 8,
  },
  {
    id: 'payroll-deductions',
    labelAr: 'الرواتب والاستقطاعات',
    labelEn: 'Payroll Deductions',
    icon: DollarSign,
    to: '/payroll-deductions',
    group: 'operational',
    order: 9,
  },
  {
    id: 'import-export',
    labelAr: 'استيراد/تصدير',
    labelEn: 'Import/Export',
    icon: Upload,
    to: '/import-export',
    group: 'operational',
    order: 11,
  },
  {
    id: 'notifications',
    labelAr: 'الإشعارات',
    labelEn: 'Notifications',
    icon: Bell,
    to: '/notifications',
    group: 'operational',
    order: 12,
  },

  // Admin Group
  {
    id: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    icon: Settings,
    to: '/settings',
    requiredPermission: 'manage_settings',
    group: 'admin',
    order: 1,
  },
  {
    id: 'general-settings',
    labelAr: 'الإعدادات العامة',
    labelEn: 'General Settings',
    icon: Sliders,
    to: '/general-settings',
    requiredPermission: 'manage_system',
    group: 'admin',
    order: 3,
  },
  {
    id: 'security-management',
    labelAr: 'إدارة الأمان',
    labelEn: 'Security Management',
    icon: Shield,
    to: '/security-management',
    requiredPermission: 'manage_security',
    group: 'admin',
    order: 4,
  },
]

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operational',
    labelAr: 'العمليات',
    labelEn: 'Operational',
    items: NAV_ITEMS.filter((item) => item.group === 'operational').sort(
      (a, b) => a.order - b.order
    ),
  },
  {
    id: 'admin',
    labelAr: 'الإدارة',
    labelEn: 'Administration',
    items: NAV_ITEMS.filter((item) => item.group === 'admin').sort((a, b) => a.order - b.order),
  },
]
