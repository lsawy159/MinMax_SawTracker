-- إصلاح خطأ "column reference role is ambiguous" في دالة update_user_as_admin
-- نفذ هذا في Supabase SQL Editor

-- تحديث دالة update_user_as_admin لإصلاح الخطأ
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
  -- التحقق من أن المستخدم الحالي هو مدير
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
    AND users.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- التحقق من وجود المستخدم المراد تحديثه
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE users.id = user_id
  ) THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- الحصول على دور المستخدم الحالي
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

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION public.update_user_as_admin(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_as_admin(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO service_role;

