-- Migration: T-205 — RLS for users table + anti-escalation trigger
-- Depends on: 20260501010000_rls_helper_functions.sql

-- ──────────────────────────────────────────────────────────
-- users table RLS
-- ──────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;
DROP POLICY IF EXISTS users_delete ON users;

-- Any active user can read themselves; admins can read all
CREATE POLICY users_select ON users
  FOR SELECT
  USING (id = auth.uid() OR is_admin(auth.uid()));

-- Only admins can create new users
CREATE POLICY users_insert ON users
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Admins can update any user; users can update their own non-sensitive fields
-- Fine-grained field protection is enforced by the trigger below
CREATE POLICY users_update ON users
  FOR UPDATE
  USING     (id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR is_admin(auth.uid()));

-- Only admins can delete users
CREATE POLICY users_delete ON users
  FOR DELETE
  USING (is_admin(auth.uid()));

-- ──────────────────────────────────────────────────────────
-- Trigger: prevent self role/permissions escalation
-- Non-admin users cannot change their own role or permissions
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only applies when a user edits their own record
  IF NEW.id = auth.uid() AND NOT is_admin(auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'لا يمكن تغيير دورك الخاص' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
      RAISE EXCEPTION 'لا يمكن تعديل صلاحياتك الذاتية' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_self_role_escalation() IS
  'Prevents non-admin users from escalating their own role or permissions.';

-- Drop and recreate trigger for idempotency
DROP TRIGGER IF EXISTS tr_prevent_self_escalation ON users;

CREATE TRIGGER tr_prevent_self_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_role_escalation();
