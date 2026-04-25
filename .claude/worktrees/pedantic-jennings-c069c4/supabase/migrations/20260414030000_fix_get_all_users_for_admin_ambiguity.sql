-- Fix ambiguous column reference in get_all_users_for_admin()
-- The RETURNS TABLE output column names become visible inside PL/pgSQL,
-- so unqualified references like "id" can conflict with table columns.

DROP FUNCTION IF EXISTS public.get_all_users_for_admin();

CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id UUID,
  username VARCHAR(50),
  email TEXT,
  full_name TEXT,
  role TEXT,
  permissions JSONB,
  is_active BOOLEAN,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS admin_user
    WHERE admin_user.id = auth.uid()
      AND admin_user.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.role,
    u.permissions,
    u.is_active,
    u.last_login,
    u.created_at,
    u.created_at AS updated_at
  FROM public.users AS u
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_all_users_for_admin() IS 'Returns all users with username field included';