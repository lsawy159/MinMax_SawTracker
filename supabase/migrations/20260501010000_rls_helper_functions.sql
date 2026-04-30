-- Migration: T-201 — RLS Helper Functions
-- has_permission(uid, section, action) and is_admin(uid)
-- These are SECURITY DEFINER so RLS policies can call them efficiently.

-- ──────────────────────────────────────────────────────────
-- is_admin
-- Returns TRUE if the user exists, is active, and has role='admin'
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM users
    WHERE id = p_uid
      AND role = 'admin'
      AND is_active = TRUE
  );
$$;

COMMENT ON FUNCTION is_admin(UUID) IS
  'Returns TRUE if the user is an active admin. SECURITY DEFINER — safe for RLS policies.';

-- ──────────────────────────────────────────────────────────
-- has_permission
-- Returns TRUE if the user is an admin OR has permissions[section][action] = true
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_permission(
  p_uid     UUID,
  p_section TEXT,
  p_action  TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admins bypass all permission checks
    EXISTS(
      SELECT 1 FROM users
      WHERE id = p_uid
        AND role = 'admin'
        AND is_active = TRUE
    )
    OR
    -- Regular users need explicit permission
    EXISTS(
      SELECT 1 FROM users
      WHERE id = p_uid
        AND is_active = TRUE
        AND COALESCE(
              (permissions -> p_section ->> p_action)::BOOLEAN,
              FALSE
            ) = TRUE
    );
$$;

COMMENT ON FUNCTION has_permission(UUID, TEXT, TEXT) IS
  'Returns TRUE if user is admin OR has permissions[section][action]=true. SECURITY DEFINER — safe for RLS policies.';

-- ──────────────────────────────────────────────────────────
-- Unit tests (run once, then safe to leave)
-- ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  -- Test: is_admin with NULL (should return FALSE, not error)
  SELECT is_admin(NULL::UUID) INTO v_ok;
  IF v_ok IS TRUE THEN
    RAISE EXCEPTION 'is_admin(NULL) should return FALSE';
  END IF;

  -- Test: has_permission with NULL uid (should return FALSE, not error)
  SELECT has_permission(NULL::UUID, 'companies', 'view') INTO v_ok;
  IF v_ok IS TRUE THEN
    RAISE EXCEPTION 'has_permission(NULL, ...) should return FALSE';
  END IF;

  -- Test: has_permission with empty section (should return FALSE)
  SELECT has_permission(NULL::UUID, '', '') INTO v_ok;
  IF v_ok IS TRUE THEN
    RAISE EXCEPTION 'has_permission(NULL, empty, empty) should return FALSE';
  END IF;

  RAISE NOTICE 'T-201: All helper function tests passed';
END;
$$;
