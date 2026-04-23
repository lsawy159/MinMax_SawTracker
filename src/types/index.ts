/**
 * Centralized type exports for the entire application
 * This file serves as a single source of truth for all application types
 */

// Auth & User Types
export type { User } from '@/lib/supabase'
export type { PermissionMatrix } from '@/utils/permissions'

// App Role Type — مدعومة في Database و App
export type AppRole = 'admin' | 'manager' | 'user'

// Helper type for role validation
export const VALID_ROLES: AppRole[] = ['admin', 'manager', 'user'] as const

// Export commonly used types from utils
export type PermissionKey =
  | 'dashboard.view'
  | 'employees.view' | 'employees.create' | 'employees.edit' | 'employees.delete'
  | 'companies.view' | 'companies.create' | 'companies.edit' | 'companies.delete'
  | 'projects.view' | 'projects.create' | 'projects.edit' | 'projects.delete'
  | 'transferProcedures.view' | 'transferProcedures.create' | 'transferProcedures.edit' | 'transferProcedures.delete' | 'transferProcedures.import' | 'transferProcedures.export'
  | 'alerts.view'
  | 'advancedSearch.view'
  | 'userGuide.view'
  | 'reports.view' | 'reports.export'
  | 'payroll.view' | 'payroll.export'
  | 'activityLogs.view'
  | 'importExport.view' | 'importExport.import' | 'importExport.export'
  | 'users.view' | 'users.create' | 'users.edit' | 'users.delete'
  | 'settings.view' | 'settings.edit'
  | 'adminSettings.view' | 'adminSettings.edit'
  | 'centralizedSettings.view' | 'centralizedSettings.edit'

// Component-specific types (add more as needed)
export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'warning' | 'expired'
  label: string
  className?: string
}

export interface UnauthorizedPageProps {
  title?: string
  message?: string
  showBackButton?: boolean
}
