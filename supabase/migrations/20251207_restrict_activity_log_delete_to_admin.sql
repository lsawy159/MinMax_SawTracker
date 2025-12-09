-- Migration: تقييد حذف activity_log للمدير فقط
-- Created: 2025-12-07
-- Description: تحديث RLS Policy لحذف activity_log ليكون فقط للمستخدمين الذين لديهم role = 'admin' في جدول users

-- حذف السياسة القديمة التي تسمح لجميع المستخدمين المصادق عليهم بالحذف
DROP POLICY IF EXISTS "Allow authenticated users to delete activity logs" ON public.activity_log;

-- إنشاء سياسة جديدة تسمح فقط للمديرين بالحذف
-- التحقق من أن المستخدم المصادق عليه لديه role = 'admin' في جدول users
CREATE POLICY "Allow only admins to delete activity logs"
  ON public.activity_log
  FOR DELETE
  USING (
    auth.role() = 'authenticated' 
    AND EXISTS (
      SELECT 1 
      FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
      AND users.is_active = true
    )
  );

-- إضافة تعليق للسياسة
COMMENT ON POLICY "Allow only admins to delete activity logs" ON public.activity_log IS 
'السماح فقط للمستخدمين الذين لديهم role = admin في جدول users بحذف سجلات activity_log';
