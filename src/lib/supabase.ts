import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface Company {
  id: string
  name: string
  tax_number: number
  unified_number: number
  labor_subscription_number: string
  company_type?: string
  commercial_registration_expiry?: string
  insurance_subscription_expiry?: string
  commercial_registration_status?: string
  insurance_subscription_status?: string
  government_docs_renewal?: string
  additional_fields?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  company_id: string
  name: string
  profession: string
  nationality: string
  birth_date: string
  phone: string
  passport_number?: string
  residence_number: number
  joining_date: string
  contract_expiry?: string
  residence_expiry: string
  project_name?: string
  bank_account?: string
  residence_image_url?: string
  employee_tax_number: number
  additional_fields?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  permissions: Record<string, any>
  is_active: boolean
  created_at: string
  last_login?: string
}

export interface CustomField {
  id: number
  entity_type: 'employee' | 'company'
  field_name: string
  field_label: string
  field_type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea'
  field_options: Record<string, any>
  is_required: boolean
  is_active: boolean
  display_order: number
  created_at: string
  created_by?: string
  updated_at: string
}

export interface Notification {
  id: number
  type: string
  title: string
  message?: string
  entity_type?: string
  entity_id?: number
  priority: 'urgent' | 'high' | 'medium' | 'low'
  days_remaining?: number
  is_read: boolean
  is_archived: boolean
  created_at: string
  read_at?: string
  target_date?: string
}

export interface ActivityLog {
  id: number
  user_id?: string
  action: string
  entity_type?: string
  entity_id?: number
  details: Record<string, any>
  ip_address?: string
  created_at: string
}

export interface NotificationStats {
  total_notifications: number
  unread_count: number
  urgent_count: number
  high_count: number
  medium_count: number
  low_count: number
}
