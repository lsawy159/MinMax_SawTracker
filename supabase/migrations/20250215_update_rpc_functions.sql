-- Migration: تحديث دوال RPC للتحقق من الصلاحيات التفصيلية
-- Created: 2025-02-15
-- Description: تحديث دوال get_all_users_for_admin, update_user_as_admin, delete_user_as_admin للتحقق من الصلاحيات بدلاً من role فقط

-- =========================================
-- 1. تحديث دالة get_all_users_for_admin
-- =========================================
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
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
BEGIN
  -- التحقق من صلاحية عرض المستخدمين
  IF NOT check_user_permission('users', 'view') THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to view users.';
  END IF;

  -- إرجاع جميع المستخدمين
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.permissions,
    u.is_active,
    u.created_at,
    u.last_login
  FROM public.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- =========================================
-- 2. تحديث دالة update_user_as_admin
-- =========================================
CREATE OR REPLACE FUNCTION public.update_user_as_admin(
  user_id UUID,
  new_email TEXT DEFAULT NULL,
  new_full_name TEXT DEFAULT NULL,
  new_role TEXT DEFAULT NULL,
  new_permissions JSONB DEFAULT NULL,
  new_is_active BOOLEAN DEFAULT NULL
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
  updated_user RECORD;
  admin_count INTEGER;
  current_user_role TEXT;
BEGIN
  -- التحقق من صلاحية تعديل المستخدمين
  IF NOT check_user_permission('users', 'edit') THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to edit users.';
  END IF;

  -- التحقق من وجود المستخدم المراد تحديثه
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE users.id = user_id
  ) THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- الحصول على دور المستخدم المراد تحديثه
  SELECT users.role INTO current_user_role
  FROM public.users
  WHERE users.id = user_id;

  -- منع تغيير دور المستخدم إلى admin إذا كان هناك مدير آخر
  IF new_role = 'admin' AND current_user_role != 'admin' THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.users
    WHERE users.role = 'admin' 
      AND users.is_active = true
      AND users.id != user_id;

    IF admin_count > 0 THEN
      RAISE EXCEPTION 'Cannot change user role to admin. Only one admin is allowed in the system.';
    END IF;
  END IF;

  -- منع تغيير دور المدير الوحيد إلى user
  IF current_user_role = 'admin' AND new_role IS NOT NULL AND new_role != 'admin' THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.users
    WHERE users.role = 'admin' 
      AND users.is_active = true
      AND users.id != user_id;

    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot change the only admin role to user. At least one admin must exist in the system.';
    END IF;
  END IF;

  -- تحديث المستخدم
  UPDATE public.users
  SET
    email = COALESCE(new_email, users.email),
    full_name = COALESCE(new_full_name, users.full_name),
    role = COALESCE(new_role, users.role),
    permissions = COALESCE(new_permissions, users.permissions),
    is_active = COALESCE(new_is_active, users.is_active)
  WHERE users.id = user_id
  RETURNING * INTO updated_user;

  -- إرجاع المستخدم المحدث
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.permissions,
    u.is_active,
    u.created_at,
    u.last_login
  FROM public.users u
  WHERE u.id = user_id;
END;
$$;

-- =========================================
-- 3. تحديث دالة delete_user_as_admin
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

  -- التحقق من صلاحية حذف المستخدمين
  IF NOT check_user_permission('users', 'delete') THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to delete users.' USING ERRCODE = '42501';
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

-- =========================================
-- 4. تحديث التعليقات
-- =========================================
COMMENT ON FUNCTION public.get_all_users_for_admin() IS 'دالة للحصول على جميع المستخدمين (يتطلب صلاحية users.view)';
COMMENT ON FUNCTION public.update_user_as_admin(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN) IS 'دالة لتحديث مستخدم (يتطلب صلاحية users.edit)';
COMMENT ON FUNCTION public.delete_user_as_admin(UUID) IS 'دالة لحذف مستخدم (يتطلب صلاحية users.delete)';

