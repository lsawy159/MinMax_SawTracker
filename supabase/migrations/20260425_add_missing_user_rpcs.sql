-- Migration: Add Missing User Management RPCs
-- تاريخ: 2026-04-25
-- الغرض: تتبع RPCs الموجودة في الإنتاج لكنها غير موثقة في migrations

-- ملاحظة: هذا RPC موجود بالفعل في الإنتاج
-- نحن نوثقه هنا للنسخ الجديدة من البيئات

-- 1. RPC: update_user_as_admin
-- الغرض: تحديث بيانات المستخدم (الاسم، الدور، الصلاحيات) من قِبل الأدمن فقط
CREATE OR REPLACE FUNCTION public.update_user_as_admin(
  user_id UUID,
  new_email TEXT DEFAULT NULL,
  new_full_name TEXT DEFAULT NULL,
  new_role TEXT DEFAULT NULL,
  new_permissions JSONB DEFAULT NULL,
  new_is_active BOOLEAN DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  full_name TEXT,
  role TEXT,
  permissions JSONB,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_role TEXT;
  v_effective_permissions JSONB;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if current user is admin
  SELECT role INTO v_current_role FROM public.users WHERE id = v_current_user_id;

  IF v_current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user roles and permissions';
  END IF;

  -- Prevent creating additional admins
  IF new_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot promote user to admin. Only one admin is allowed.';
  END IF;

  -- Validate role if provided
  IF new_role IS NOT NULL AND new_role NOT IN ('admin', 'manager', 'user') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  -- Normalize incoming permissions to a flat JSON array format for consistency
  IF new_permissions IS NULL THEN
    v_effective_permissions := NULL;
  ELSIF jsonb_typeof(new_permissions) = 'array' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(value) ORDER BY value), '[]'::jsonb)
    INTO v_effective_permissions
    FROM (
      SELECT DISTINCT value
      FROM jsonb_array_elements_text(new_permissions)
      WHERE value ~ '^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z][a-zA-Z0-9_]*$'
    ) dedup;
  ELSIF jsonb_typeof(new_permissions) = 'object' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(permission_key) ORDER BY permission_key), '[]'::jsonb)
    INTO v_effective_permissions
    FROM (
      SELECT DISTINCT format('%s.%s', section.key, action.key) AS permission_key
      FROM jsonb_each(new_permissions) AS section(key, value)
      CROSS JOIN LATERAL jsonb_each(section.value) AS action(key, value)
      WHERE jsonb_typeof(section.value) = 'object'
        AND action.value = 'true'::jsonb
    ) flattened;
  ELSE
    v_effective_permissions := '[]'::jsonb;
  END IF;

  -- Update user
  RETURN QUERY
  UPDATE public.users
  SET
    email = COALESCE(new_email, email),
    full_name = COALESCE(new_full_name, full_name),
    role = COALESCE(new_role, role),
    permissions = COALESCE(v_effective_permissions, permissions),
    is_active = COALESCE(new_is_active, is_active),
    updated_at = NOW()
  WHERE id = user_id
  RETURNING
    public.users.id,
    public.users.email,
    public.users.username,
    public.users.full_name,
    public.users.role,
    public.users.permissions,
    public.users.is_active,
    public.users.created_at,
    public.users.updated_at;
END;
$$;

-- 2. RPC: delete_user_as_admin
-- الغرض: حذف مستخدم من قِبل الأدمن فقط
-- ملاحظة: يحذف من جداول auth و public معاً
CREATE OR REPLACE FUNCTION public.delete_user_as_admin(
  user_id UUID
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_role TEXT;
  v_user_role TEXT;
  v_active_admin_count INTEGER;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if current user is admin
  SELECT role INTO v_current_role FROM public.users WHERE id = v_current_user_id;

  IF v_current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Get role of user to delete
  SELECT role INTO v_user_role FROM public.users WHERE id = user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Prevent deleting the last admin
  IF v_user_role = 'admin' THEN
    SELECT COUNT(*) INTO v_active_admin_count
    FROM public.users
    WHERE role = 'admin' AND is_active = true;

    IF v_active_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last active admin';
    END IF;
  END IF;

  -- Delete from public.users
  DELETE FROM public.users WHERE id = user_id;

  -- Delete from auth.users (cascades from public.users foreign key)
  -- Note: This is handled by the foreign key constraint with ON DELETE CASCADE

  RETURN QUERY SELECT true, 'User deleted successfully'::TEXT;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_as_admin(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_as_admin(UUID) TO authenticated;
