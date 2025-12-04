-- Migration: تفعيل RLS وإنشاء Policies لجدول employees
-- Created: 2025-02-15
-- Description: تفعيل Row Level Security وإنشاء Policies للتحقق من الصلاحيات التفصيلية

-- =========================================
-- 1. تفعيل RLS
-- =========================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 2. حذف أي Policies قديمة (إن وجدت)
-- =========================================
DROP POLICY IF EXISTS "Users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Users can create employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update employees" ON public.employees;
DROP POLICY IF EXISTS "Users can delete employees" ON public.employees;
DROP POLICY IF EXISTS "Allow service role full access to employees" ON public.employees;
DROP POLICY IF EXISTS "Allow authenticated users to read employees" ON public.employees;
DROP POLICY IF EXISTS "Allow authenticated users to manage employees" ON public.employees;

-- =========================================
-- 3. إنشاء Policies جديدة
-- =========================================

-- Policy للقراءة (SELECT)
CREATE POLICY "Users can view employees"
  ON public.employees
  FOR SELECT
  USING (check_user_permission('employees', 'view'));

-- Policy للإنشاء (INSERT)
CREATE POLICY "Users can create employees"
  ON public.employees
  FOR INSERT
  WITH CHECK (check_user_permission('employees', 'create'));

-- Policy للتحديث (UPDATE)
CREATE POLICY "Users can update employees"
  ON public.employees
  FOR UPDATE
  USING (check_user_permission('employees', 'edit'))
  WITH CHECK (check_user_permission('employees', 'edit'));

-- Policy للحذف (DELETE)
CREATE POLICY "Users can delete employees"
  ON public.employees
  FOR DELETE
  USING (check_user_permission('employees', 'delete'));

-- =========================================
-- 4. Policy للـ service_role (للـ Edge Functions)
-- =========================================
CREATE POLICY "Allow service role full access to employees"
  ON public.employees
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- 5. إضافة تعليقات
-- =========================================
COMMENT ON POLICY "Users can view employees" ON public.employees IS 'السماح للمستخدمين الذين لديهم صلاحية employees.view بقراءة الموظفين';
COMMENT ON POLICY "Users can create employees" ON public.employees IS 'السماح للمستخدمين الذين لديهم صلاحية employees.create بإنشاء موظفين';
COMMENT ON POLICY "Users can update employees" ON public.employees IS 'السماح للمستخدمين الذين لديهم صلاحية employees.edit بتحديث الموظفين';
COMMENT ON POLICY "Users can delete employees" ON public.employees IS 'السماح للمستخدمين الذين لديهم صلاحية employees.delete بحذف الموظفين';

