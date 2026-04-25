-- Migration: Permissions System Upgrade - Phase 2 (Flat JSON Array)
-- Date: 2026-04-26
-- Purpose:
-- 1) Normalize users.permissions to flat keys JSON array (e.g. ["employees.view"]).
-- 2) Keep backward compatibility with legacy JSON object payloads.
-- 3) Make permission checks in SQL support both old/new formats.

BEGIN;

-- Helper: Convert legacy/object permissions OR array permissions into a clean flat JSON array.
CREATE OR REPLACE FUNCTION public.permissions_to_flat_array(input_permissions JSONB)
RETURNS JSONB
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized JSONB := '[]'::jsonb;
BEGIN
  IF input_permissions IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF jsonb_typeof(input_permissions) = 'array' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(value) ORDER BY value), '[]'::jsonb)
    INTO normalized
    FROM (
      SELECT DISTINCT value
      FROM jsonb_array_elements_text(input_permissions)
      WHERE value ~ '^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z][a-zA-Z0-9_]*$'
    ) dedup;

    RETURN normalized;
  END IF;

  IF jsonb_typeof(input_permissions) = 'object' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(permission_key) ORDER BY permission_key), '[]'::jsonb)
    INTO normalized
    FROM (
      SELECT DISTINCT format('%s.%s', section.key, action.key) AS permission_key
      FROM jsonb_each(input_permissions) AS section(key, value)
      CROSS JOIN LATERAL jsonb_each(section.value) AS action(key, value)
      WHERE jsonb_typeof(section.value) = 'object'
        AND action.value = 'true'::jsonb
    ) flattened;

    RETURN normalized;
  END IF;

  RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Normalize existing users data to flat JSON array keys.
UPDATE public.users
SET permissions = public.permissions_to_flat_array(permissions)
WHERE permissions IS NULL
   OR jsonb_typeof(permissions) <> 'array';

-- SQL permission helper supports:
-- 1) admin role (active) => full access
-- 2) new array format => checks "section.action" membership
-- 3) legacy object format => fallback lookup for backward compatibility
CREATE OR REPLACE FUNCTION public.user_has_permission(section TEXT, action TEXT)
RETURNS BOOLEAN
SET search_path = public, pg_temp
AS $$
DECLARE
  perms JSONB;
  user_role TEXT;
  user_active BOOLEAN;
  permission_key TEXT;
BEGIN
  SELECT u.permissions, u.role, u.is_active
  INTO perms, user_role, user_active
  FROM public.users u
  WHERE u.id = auth.uid()
  LIMIT 1;

  IF user_role = 'admin' AND COALESCE(user_active, false) = true THEN
    RETURN true;
  END IF;

  IF perms IS NULL THEN
    RETURN false;
  END IF;

  permission_key := format('%s.%s', section, action);

  IF jsonb_typeof(perms) = 'array' THEN
    RETURN perms ? permission_key;
  END IF;

  IF jsonb_typeof(perms) = 'object' THEN
    RETURN COALESCE((perms -> section ->> action)::boolean, false);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep email_queue read policy compatible after moving to flat array permissions.
DROP POLICY IF EXISTS "AdminSettings permission can read email_queue" ON public.email_queue;

CREATE POLICY "AdminSettings permission can read email_queue"
ON public.email_queue FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (
        (u.role = 'admin' AND COALESCE(u.is_active, false) = true)
        OR public.user_has_permission('adminSettings', 'edit')
        OR public.user_has_permission('adminSettings', 'view')
      )
  )
);

COMMIT;
