-- Migration: تحديث دالة delete_user_as_admin
-- Created: 2025-02-01
-- Description: تحديث دالة delete_user_as_admin لإضافة معالجة أفضل للأخطاء ومنع حذف آخر مدير

-- تحديث دالة حذف مستخدم (للمديرين فقط)
-- =========================================
CREATE OR REPLACE FUNCTION public.delete_user_as_admin(
  user_id UUID
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  permissions JSONB,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_user RECORD;
  admin_count INTEGER;
  target_user_role TEXT;
  target_user_active BOOLEAN;
BEGIN
  -- التحقق من صحة المعاملات
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required.' USING ERRCODE = '23502';
  END IF;

  -- التحقق من أن المستخدم الحالي هو مدير
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.' USING ERRCODE = '42501';
  END IF;

  -- منع حذف المستخدم الحالي
  IF user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account.' USING ERRCODE = '23505';
  END IF;

  -- التحقق من وجود المستخدم المراد حذفه والحصول على معلوماته
  SELECT users.role, users.is_active INTO target_user_role, target_user_active
  FROM public.users
  WHERE users.id = user_id;

  IF target_user_role IS NULL THEN
    RAISE EXCEPTION 'User not found.' USING ERRCODE = 'P0001';
  END IF;

  -- منع حذف آخر مدير نشط في النظام
  IF target_user_role = 'admin' AND target_user_active = true THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.users
    WHERE users.role = 'admin'
      AND users.is_active = true
      AND users.id != user_id;

    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot delete the last active admin. At least one active admin must exist in the system.' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- حفظ بيانات المستخدم قبل الحذف
  SELECT * INTO deleted_user
  FROM public.users
  WHERE users.id = user_id;

  -- التحقق من أن البيانات تم حفظها بنجاح
  IF deleted_user IS NULL THEN
    RAISE EXCEPTION 'Failed to retrieve user data before deletion.' USING ERRCODE = 'P0002';
  END IF;

  -- حذف المستخدم
  DELETE FROM public.users
  WHERE users.id = user_id;

  -- التحقق من نجاح الحذف
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to delete user. User may have been deleted already.' USING ERRCODE = 'P0003';
  END IF;

  -- إرجاع بيانات المستخدم المحذوف
  RETURN QUERY
  SELECT 
    deleted_user.id,
    deleted_user.email,
    deleted_user.full_name,
    deleted_user.role,
    deleted_user.permissions,
    deleted_user.is_active,
    deleted_user.created_at,
    deleted_user.last_login;
END;
$$;

-- تحديث التعليق على الدالة
COMMENT ON FUNCTION public.delete_user_as_admin(UUID) IS 'دالة لحذف مستخدم (للمديرين فقط) - محدثة بمعالجة أفضل للأخطاء';

