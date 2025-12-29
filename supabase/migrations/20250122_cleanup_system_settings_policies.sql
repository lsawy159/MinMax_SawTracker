-- System Settings RLS Cleanup (final minimal set)
-- Drops all existing policies on public.system_settings and recreates a minimal, clear set.
-- Includes a robust user_has_permission() helper.
-- Run in Supabase SQL Editor.

BEGIN;

-- Ensure the table exists
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on this table (cleanup)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_settings', pol.policyname);
  END LOOP;
END$$;

-- Ensure helper function exists (creates or replaces)
CREATE OR REPLACE FUNCTION public.user_has_permission(section TEXT, action TEXT)
RETURNS BOOLEAN
SET search_path = public, pg_temp
AS $$
DECLARE
  perms JSONB;
BEGIN
  SELECT permissions INTO perms
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(
    (perms -> section ->> action)::boolean,
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Minimal policy set

-- 1) Read for authenticated users
CREATE POLICY "read_system_settings_authenticated"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

-- 2) Admin: manage ALL (SELECT/INSERT/UPDATE/DELETE)
CREATE POLICY "admin_manage_system_settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

-- 3) Edit by permission (requires INSERT + UPDATE for upsert)
-- Note: Upsert requires both INSERT and UPDATE; thus two physical policies here
CREATE POLICY "edit_system_settings_insert"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (public.user_has_permission('centralizedSettings', 'edit'));

CREATE POLICY "edit_system_settings_update"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (public.user_has_permission('centralizedSettings', 'edit'))
WITH CHECK (public.user_has_permission('centralizedSettings', 'edit'));

-- Verify
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'system_settings'
ORDER BY policyname;

COMMIT;