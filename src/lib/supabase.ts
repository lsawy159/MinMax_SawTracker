import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// إنشاء Supabase client
// في بيئة الاختبارات، نستخدم mock values إذا لم تكن المتغيرات موجودة
let supabase: SupabaseClient

if (!supabaseUrl || !supabaseAnonKey) {
  // في بيئة الاختبارات، نعيد mock client بدلاً من throw error
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    // إنشاء mock client للاختبارات
    supabase = createClient(
      'https://mock.supabase.co',
      'mock-anon-key'
    ) as unknown as SupabaseClient
  } else {
    throw new Error(
      'Supabase URL and Anon Key are required. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.'
    )
  }
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}

export { supabase }

// Types
export interface Company {
  id: string
  name: string
  unified_number: number
  labor_subscription_number: string
  commercial_registration_expiry?: string
  // التأمينات الاجتماعية للمؤسسة
  social_insurance_number?: string // رقم اشتراك التأمينات الاجتماعية
  commercial_registration_status?: string
  additional_fields?: Record<string, unknown>
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

export interface Project {
  id: string
  name: string
  description?: string
  status?: 'active' | 'inactive' | 'completed'
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
  project_id?: string
  project_name?: string // للتوافق مع البيانات القديمة
  project?: Project // Relation إلى جدول المشاريع
  bank_account?: string
  residence_image_url?: string
  // التأمين الصحي للموظف
  health_insurance_expiry?: string // بدلاً من ending_subscription_insurance_date
  salary?: number
  // حقل الملاحظات
  notes?: string
  additional_fields?: Record<string, unknown> // للحقول المخصصة من قاعدة البيانات فقط
  is_deleted?: boolean
  deleted_at?: string | null
  created_at: string
  updated_at: string
}

export interface TransferProcedure {
  id: string
  request_date: string
  name: string
  iqama: number
  status: string
  current_unified_number: number
  project_id: string
  created_by_user_id?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export type ObligationType = 'transfer' | 'renewal' | 'penalty' | 'advance' | 'other'

export type ObligationPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'superseded'

export type ObligationLineStatus = 'unpaid' | 'partial' | 'paid' | 'rescheduled' | 'cancelled'

export interface EmployeeObligationHeader {
  id: string
  employee_id: string
  obligation_type: ObligationType
  title: string
  total_amount: number
  currency_code: string
  start_month: string
  installment_count: number
  status: ObligationPlanStatus
  created_by_user_id?: string | null
  superseded_by_header_id?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeObligationLine {
  id: string
  header_id: string
  employee_id: string
  due_month: string
  amount_due: number
  amount_paid: number
  line_status: ObligationLineStatus
  source_version: number
  manual_override: boolean
  override_reason?: string | null
  rescheduled_from_line_id?: string | null
  rescheduled_to_line_id?: string | null
  payroll_entry_id?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export type PayrollScopeType = 'company' | 'project'

export type PayrollInputMode = 'manual' | 'excel' | 'mixed'

export type PayrollRunStatus = 'draft' | 'processing' | 'finalized' | 'cancelled'

export type PayrollEntryStatus = 'draft' | 'calculated' | 'finalized' | 'paid' | 'cancelled'

export type PayrollComponentType = 'earning' | 'deduction' | 'installment'

export interface PayrollRun {
  id: string
  payroll_month: string
  scope_type: PayrollScopeType
  scope_id: string
  input_mode: PayrollInputMode
  status: PayrollRunStatus
  uploaded_file_path?: string | null
  notes?: string | null
  created_by_user_id?: string | null
  approved_by_user_id?: string | null
  created_at: string
  updated_at: string
  approved_at?: string | null
}

export interface PayrollEntry {
  id: string
  payroll_run_id: string
  employee_id: string
  residence_number_snapshot: number
  employee_name_snapshot: string
  company_name_snapshot?: string | null
  project_name_snapshot?: string | null
  basic_salary_snapshot: number
  daily_rate_snapshot: number
  attendance_days: number
  paid_leave_days: number
  overtime_amount: number
  overtime_notes?: string | null
  deductions_amount: number
  deductions_notes?: string | null
  installment_deducted_amount: number
  gross_amount: number
  net_amount: number
  entry_status: PayrollEntryStatus
  notes?: string | null
  created_at: string
  updated_at: string
  bank_account_snapshot?: string | null
}

export interface PayrollEntryComponent {
  id: string
  payroll_entry_id: string
  component_type: PayrollComponentType
  component_code: string
  amount: number
  notes?: string | null
  source_line_id?: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PayrollSlip {
  id: string
  payroll_entry_id: string
  slip_number: string
  storage_path?: string | null
  template_version: string
  snapshot_data: Record<string, unknown>
  generated_at?: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  role: 'admin' | 'manager' | 'user'
  permissions: Record<string, unknown> | string[] // دعم النسختين: JSON object و string[]
  is_active: boolean
  created_at: string
  last_login?: string
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
  details: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  session_id?: string
  operation?: string
  operation_status?: string
  affected_rows?: number
  old_data?: Record<string, unknown>
  new_data?: Record<string, unknown>
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
