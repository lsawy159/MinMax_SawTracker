import { createClient } from '@supabase/supabase-js'

// Environment variables validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.\n' +
    'Required variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface Company {
  id: string
  name: string
  tax_number?: BIGINT | null
  unified_number: number
  labor_subscription_number: string
  company_type?: string
  commercial_registration_expiry?: string
  insurance_subscription_expiry?: string
  commercial_registration_status?: string
  insurance_subscription_status?: string
  government_docs_renewal?: string
  additional_fields?: Record<string, any>
  // حقول انتهاء الاشتراكات الجديدة
  ending_subscription_power_date?: string
  ending_subscription_moqeem_date?: string
  ending_subscription_insurance_date?: string
  // عدد الموظفين والعدد الأقصى (للحسابات)
  employee_count?: number
  max_employees?: number
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
  // حقول إضافية من التحسينات الأخيرة
  employee_number?: string
  contract_number?: string
  insurance_number?: string
  salary?: number
  housing_allowance?: number
  transport_allowance?: number
  // حقل انتهاء اشتراك التأمين
  ending_subscription_insurance_date?: string
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
