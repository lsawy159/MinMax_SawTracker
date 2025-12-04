-- Migration: تفعيل RLS وإنشاء Policies لجدول companies
-- Created: 2025-02-15
-- Description: تفعيل Row Level Security وإنشاء Policies للتحقق من الصلاحيات التفصيلية

-- =========================================
-- 1. تفعيل RLS
-- =========================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 2. حذف أي Policies قديمة (إن وجدت)
-- =========================================
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Users can delete companies" ON public.companies;
DROP POLICY IF EXISTS "Allow service role full access to companies" ON public.companies;
DROP POLICY IF EXISTS "Allow authenticated users to read companies" ON public.companies;
DROP POLICY IF EXISTS "Allow authenticated users to manage companies" ON public.companies;

-- =========================================
-- 3. إنشاء Policies جديدة
-- =========================================

-- Policy للقراءة (SELECT)
CREATE POLICY "Users can view companies"
  ON public.companies
  FOR SELECT
  USING (check_user_permission('companies', 'view'));

-- Policy للإنشاء (INSERT)
CREATE POLICY "Users can create companies"
  ON public.companies
  FOR INSERT
  WITH CHECK (check_user_permission('companies', 'create'));

-- Policy للتحديث (UPDATE)
CREATE POLICY "Users can update companies"
  ON public.companies
  FOR UPDATE
  USING (check_user_permission('companies', 'edit'))
  WITH CHECK (check_user_permission('companies', 'edit'));

-- Policy للحذف (DELETE)
CREATE POLICY "Users can delete companies"
  ON public.companies
  FOR DELETE
  USING (check_user_permission('companies', 'delete'));

-- =========================================
-- 4. Policy للـ service_role (للـ Edge Functions)
-- =========================================
CREATE POLICY "Allow service role full access to companies"
  ON public.companies
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- 5. إضافة تعليقات
-- =========================================
COMMENT ON POLICY "Users can view companies" ON public.companies IS 'السماح للمستخدمين الذين لديهم صلاحية companies.view بقراءة المؤسسات';
COMMENT ON POLICY "Users can create companies" ON public.companies IS 'السماح للمستخدمين الذين لديهم صلاحية companies.create بإنشاء مؤسسات';
COMMENT ON POLICY "Users can update companies" ON public.companies IS 'السماح للمستخدمين الذين لديهم صلاحية companies.edit بتحديث المؤسسات';
COMMENT ON POLICY "Users can delete companies" ON public.companies IS 'السماح للمستخدمين الذين لديهم صلاحية companies.delete بحذف المؤسسات';

