-- Fix: RLS Policies for system_settings table
-- This migration allows users with centralizedSettings.edit permission to modify settings
-- Run this in Supabase SQL Editor

-- First, ensure the system_settings table exists with proper structure
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the table
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies
DROP POLICY IF EXISTS "Allow admins to view system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow admins to insert system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow admins to update system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow authenticated users to view system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow users with edit permission to update system_settings" ON public.system_settings;

-- Policy 1: Allow all authenticated users to VIEW system_settings (read-only)
CREATE POLICY "Allow authenticated users to view system_settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow ADMINS to INSERT/UPDATE system_settings
CREATE POLICY "Allow admins to insert system_settings"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Allow admins to update system_settings"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 3: Allow REGULAR USERS to INSERT/UPDATE if they have the appropriate permission
-- This uses a helper function to check if user has edit permission
CREATE OR REPLACE FUNCTION public.user_has_permission(permission_section TEXT, permission_action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
BEGIN
  -- Get user's permissions from the users table
  SELECT permissions INTO user_permissions
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  -- Check if user has the specific permission (e.g., centralizedSettings.edit)
  RETURN COALESCE(
    user_permissions -> permission_section ->> permission_action = 'true'
    OR user_permissions -> permission_section ->> permission_action = 'true'::text,
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Additional policies for regular users with permissions
CREATE POLICY "Allow users with edit permission to update system_settings"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_permission('centralizedSettings', 'edit')
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Allow users with edit permission to modify system_settings"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (
  public.user_has_permission('centralizedSettings', 'edit')
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  public.user_has_permission('centralizedSettings', 'edit')
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Verify the setup
SELECT 'RLS Configuration for system_settings:' as status;
SELECT tablename, policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename = 'system_settings'
ORDER BY policyname;
