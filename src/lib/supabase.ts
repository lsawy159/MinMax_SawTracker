import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// التأكد من أن المتغيرات موجودة قبل إنشاء العميل
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export interface Company {
  id: string
  name: string
  unified_number: number
  labor_subscription_number: string
  commercial_registration_expiry?: string
  // التأمينات الاجتماعية للمؤسسة
  social_insurance_expiry?: string  // بدلاً من insurance_subscription_expiry
  social_insurance_number?: string  // رقم اشتراك التأمينات الاجتماعية
  social_insurance_status?: string  // بدلاً من insurance_subscription_status
  commercial_registration_status?: string
  additional_fields?: Record<string, any>
  // حقول انتهاء الاشتراكات الجديدة
  ending_subscription_power_date?: string
  ending_subscription_moqeem_date?: string
  // عدد الموظفين والعدد الأقصى (للحسابات)
  employee_count?: number
  max_employees?: number
  // حقل الملاحظات
  notes?: string
  // حقل الاعفاءات
  exemptions?: string | null
  // نوع المؤسسة
  company_type?: string | null
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
  hired_worker_contract_expiry?: string
  residence_expiry: string
  project_name?: string
  bank_account?: string
  residence_image_url?: string
  // التأمين الصحي للموظف
  health_insurance_expiry?: string  // بدلاً من ending_subscription_insurance_date
  salary?: number
  // حقل الملاحظات
  notes?: string
  additional_fields?: Record<string, any>  // للحقول المخصصة من قاعدة البيانات فقط
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
  entity_id?: string | number // يمكن أن يكون UUID (string) أو number
  details: Record<string, any>
  ip_address?: string
  user_agent?: string
  session_id?: string
  operation?: string
  operation_status?: string
  affected_rows?: number
  old_data?: Record<string, any>
  new_data?: Record<string, any>
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
