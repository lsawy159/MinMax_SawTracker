-- Migration: إضافة RLS Policy للمديرين لرؤية جميع الجلسات
-- Created: 2025-02-08
-- Description: السماح للمديرين برؤية وإدارة جميع جلسات المستخدمين

-- =========================================
-- إضافة RLS Policy للمديرين لرؤية جميع الجلسات
-- =========================================

-- السماح للمديرين بقراءة جميع الجلسات
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.user_sessions;
CREATE POLICY "Admins can view all sessions"
  ON public.user_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- السماح للمديرين بتحديث جميع الجلسات (لإنهاء الجلسات)
DROP POLICY IF EXISTS "Admins can update all sessions" ON public.user_sessions;
CREATE POLICY "Admins can update all sessions"
  ON public.user_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- السماح للمديرين بحذف جميع الجلسات
DROP POLICY IF EXISTS "Admins can delete all sessions" ON public.user_sessions;
CREATE POLICY "Admins can delete all sessions"
  ON public.user_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

