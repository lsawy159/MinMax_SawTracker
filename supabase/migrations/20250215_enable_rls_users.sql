-- Migration: تفعيل RLS وإنشاء Policies لجدول users
-- Created: 2025-02-15
-- Description: تفعيل Row Level Security وإنشاء Policies للتحقق من الصلاحيات التفصيلية
-- ملاحظة: Policies خاصة - يمكن للمستخدم رؤية وتحديث نفسه حتى بدون صلاحيات

-- =========================================
-- 1. تفعيل RLS
-- =========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 2. حذف أي Policies قديمة (إن وجدت)
-- =========================================
DROP POLICY IF EXISTS "Users can view users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can create users" ON public.users;
DROP POLICY IF EXISTS "Users can update users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete users" ON public.users;
DROP POLICY IF EXISTS "Allow service role full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow users to read all" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert own" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own" ON public.users;
DROP POLICY IF EXISTS "Allow service role full access" ON public.users;

-- =========================================
-- 3. إنشاء Policies جديدة
-- =========================================

-- Policy للقراءة (SELECT)
-- يمكن للمستخدم رؤية نفسه أو إذا كان لديه صلاحية users.view
CREATE POLICY "Users can view users"
  ON public.users
  FOR SELECT
  USING (
    auth.uid() = users.id 
    OR check_user_permission('users', 'view')
  );

-- Policy للإنشاء (INSERT)
-- فقط من لديه صلاحية users.create
CREATE POLICY "Users can create users"
  ON public.users
  FOR INSERT
  WITH CHECK (check_user_permission('users', 'create'));

-- Policy للتحديث (UPDATE)
-- يمكن للمستخدم تحديث نفسه أو إذا كان لديه صلاحية users.edit
CREATE POLICY "Users can update users"
  ON public.users
  FOR UPDATE
  USING (
    auth.uid() = users.id 
    OR check_user_permission('users', 'edit')
  )
  WITH CHECK (
    auth.uid() = users.id 
    OR check_user_permission('users', 'edit')
  );

-- Policy للحذف (DELETE)
-- فقط من لديه صلاحية users.delete
CREATE POLICY "Users can delete users"
  ON public.users
  FOR DELETE
  USING (check_user_permission('users', 'delete'));

-- =========================================
-- 4. Policy للـ service_role (للـ Edge Functions)
-- =========================================
CREATE POLICY "Allow service role full access to users"
  ON public.users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- 5. إضافة تعليقات
-- =========================================
COMMENT ON POLICY "Users can view users" ON public.users IS 'السماح للمستخدمين برؤية أنفسهم أو للمستخدمين الذين لديهم صلاحية users.view';
COMMENT ON POLICY "Users can create users" ON public.users IS 'السماح للمستخدمين الذين لديهم صلاحية users.create بإنشاء مستخدمين';
COMMENT ON POLICY "Users can update users" ON public.users IS 'السماح للمستخدمين بتحديث أنفسهم أو للمستخدمين الذين لديهم صلاحية users.edit';
COMMENT ON POLICY "Users can delete users" ON public.users IS 'السماح للمستخدمين الذين لديهم صلاحية users.delete بحذف مستخدمين';

