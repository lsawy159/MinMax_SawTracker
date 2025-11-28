-- Migration: إضافة RLS Policy للـ DELETE على activity_log
-- Created: 2025-01-21
-- Description: السماح للمستخدمين المصادق عليهم بحذف سجلات activity_log

-- إضافة RLS Policy للسماح بالحذف
-- السماح للمستخدمين المصادق عليهم بحذف سجلات النشاط
DROP POLICY IF EXISTS "Allow authenticated users to delete activity logs" ON public.activity_log;
CREATE POLICY "Allow authenticated users to delete activity logs"
  ON public.activity_log
  FOR DELETE
  USING (auth.role() = 'authenticated');

