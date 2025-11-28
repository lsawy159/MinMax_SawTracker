-- Migration: إضافة دوال إدارة كلمات المرور
-- Created: 2025-02-04
-- Description: إضافة دوال لتغيير كلمات المرور للمستخدمين من قبل المدير

-- 1. دالة لتغيير كلمة مرور المستخدم (للمدير فقط)
-- =========================================
CREATE OR REPLACE FUNCTION public.update_user_password_as_admin(
  user_id UUID,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id UUID;
BEGIN
  -- التحقق من أن المستخدم الحالي هو مدير
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- التحقق من وجود المستخدم المراد تغيير كلمة مروره
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE users.id = user_id
  ) THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- التحقق من صحة كلمة المرور
  IF new_password IS NULL OR LENGTH(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  -- ملاحظة: لا يمكن تغيير كلمة المرور مباشرة من PostgreSQL
  -- يجب استخدام Supabase Admin API من Edge Function
  -- هذه الدالة ستعيد رسالة توضيحية
  RETURN jsonb_build_object(
    'success', false,
    'message', 'Password update must be done through admin API. Use the update_user_password edge function instead.'
  );
END;
$$;

-- 2. دالة Edge Function لتغيير كلمة المرور (سيتم إنشاؤها في ملف منفصل)
-- ملاحظة: هذه الدالة تحتاج إلى service_role للوصول إلى auth.admin.updateUserById
-- سيتم إنشاء Edge Function في supabase/functions/update-user-password/index.ts

-- 3. إضافة تعليقات
-- =========================================
COMMENT ON FUNCTION public.update_user_password_as_admin(UUID, TEXT) IS 'دالة لتغيير كلمة مرور المستخدم (للمدير فقط) - يجب استخدام Edge Function للتطبيق الفعلي';

-- 4. منح الصلاحيات
-- =========================================
GRANT EXECUTE ON FUNCTION public.update_user_password_as_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_password_as_admin(UUID, TEXT) TO service_role;

