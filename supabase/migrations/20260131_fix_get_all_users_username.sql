-- Fix get_all_users_for_admin to include username
-- Date: 2026-01-31

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_all_users_for_admin();

-- Recreate with username field
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
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Return all users (admin can see all users)
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
    u.updated_at
  FROM public.users u
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_all_users_for_admin() IS 'Returns all users with username field included';
