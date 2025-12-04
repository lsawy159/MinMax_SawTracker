-- Migration: تفعيل RLS وإنشاء Policies لجدول projects
-- Created: 2025-02-15
-- Description: تفعيل Row Level Security وإنشاء Policies للتحقق من الصلاحيات التفصيلية

-- =========================================
-- 1. تفعيل RLS
-- =========================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 2. حذف أي Policies قديمة (إن وجدت)
-- =========================================
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Allow service role full access to projects" ON public.projects;
DROP POLICY IF EXISTS "Allow authenticated users to read projects" ON public.projects;
DROP POLICY IF EXISTS "Allow authenticated users to manage projects" ON public.projects;

-- =========================================
-- 3. إنشاء Policies جديدة
-- =========================================

-- Policy للقراءة (SELECT)
CREATE POLICY "Users can view projects"
  ON public.projects
  FOR SELECT
  USING (check_user_permission('projects', 'view'));

-- Policy للإنشاء (INSERT)
CREATE POLICY "Users can create projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (check_user_permission('projects', 'create'));

-- Policy للتحديث (UPDATE)
CREATE POLICY "Users can update projects"
  ON public.projects
  FOR UPDATE
  USING (check_user_permission('projects', 'edit'))
  WITH CHECK (check_user_permission('projects', 'edit'));

-- Policy للحذف (DELETE)
CREATE POLICY "Users can delete projects"
  ON public.projects
  FOR DELETE
  USING (check_user_permission('projects', 'delete'));

-- =========================================
-- 4. Policy للـ service_role (للـ Edge Functions)
-- =========================================
CREATE POLICY "Allow service role full access to projects"
  ON public.projects
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- 5. إضافة تعليقات
-- =========================================
COMMENT ON POLICY "Users can view projects" ON public.projects IS 'السماح للمستخدمين الذين لديهم صلاحية projects.view بقراءة المشاريع';
COMMENT ON POLICY "Users can create projects" ON public.projects IS 'السماح للمستخدمين الذين لديهم صلاحية projects.create بإنشاء مشاريع';
COMMENT ON POLICY "Users can update projects" ON public.projects IS 'السماح للمستخدمين الذين لديهم صلاحية projects.edit بتحديث المشاريع';
COMMENT ON POLICY "Users can delete projects" ON public.projects IS 'السماح للمستخدمين الذين لديهم صلاحية projects.delete بحذف المشاريع';

