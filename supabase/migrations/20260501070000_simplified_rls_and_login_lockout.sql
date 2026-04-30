-- Migration: Simplified RLS + login_rate_limits lockout
-- Policy model: authenticated users have full access, anon users denied.

-- ========================================================
-- 1) Login lockout table (replaces CAPTCHA requirement)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.login_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  email TEXT,
  ip_address TEXT,
  attempts INT NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_rate_limits_identifier ON public.login_rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_login_rate_limits_locked_until ON public.login_rate_limits(locked_until);
CREATE INDEX IF NOT EXISTS idx_login_rate_limits_last_attempt ON public.login_rate_limits(last_attempt_at DESC);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.update_login_rate_limits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_login_rate_limits_updated_at ON public.login_rate_limits;
CREATE TRIGGER tr_login_rate_limits_updated_at
BEFORE UPDATE ON public.login_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.update_login_rate_limits_updated_at();

-- Check if login is allowed (security definer so anon can call safely)
CREATE OR REPLACE FUNCTION public.check_login_allowed(
  p_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.login_rate_limits%ROWTYPE;
BEGIN
  SELECT *
  INTO v_record
  FROM public.login_rate_limits
  WHERE identifier = p_identifier;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'locked_until', NULL
    );
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'locked_until', v_record.locked_until,
      'attempts', v_record.attempts
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'locked_until', NULL,
    'attempts', v_record.attempts
  );
END;
$$;

-- Record a failed login; lock account after max attempts
CREATE OR REPLACE FUNCTION public.record_login_failure(
  p_identifier TEXT,
  p_email TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_max_attempts INT DEFAULT 5,
  p_lock_minutes INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.login_rate_limits%ROWTYPE;
  v_new_attempts INT;
  v_locked_until TIMESTAMPTZ;
BEGIN
  SELECT *
  INTO v_record
  FROM public.login_rate_limits
  WHERE identifier = p_identifier
  FOR UPDATE;

  IF NOT FOUND THEN
    v_new_attempts := 1;
    IF v_new_attempts >= p_max_attempts THEN
      v_locked_until := NOW() + make_interval(mins => p_lock_minutes);
    ELSE
      v_locked_until := NULL;
    END IF;

    INSERT INTO public.login_rate_limits (
      identifier,
      email,
      ip_address,
      attempts,
      first_attempt_at,
      last_attempt_at,
      locked_until
    ) VALUES (
      p_identifier,
      p_email,
      p_ip_address,
      v_new_attempts,
      NOW(),
      NOW(),
      v_locked_until
    );
  ELSE
    v_new_attempts := COALESCE(v_record.attempts, 0) + 1;
    IF v_new_attempts >= p_max_attempts THEN
      v_locked_until := NOW() + make_interval(mins => p_lock_minutes);
    ELSE
      v_locked_until := v_record.locked_until;
    END IF;

    UPDATE public.login_rate_limits
    SET
      attempts = v_new_attempts,
      email = COALESCE(p_email, email),
      ip_address = COALESCE(p_ip_address, ip_address),
      last_attempt_at = NOW(),
      locked_until = v_locked_until
    WHERE identifier = p_identifier;
  END IF;

  RETURN jsonb_build_object(
    'locked', (v_locked_until IS NOT NULL AND v_locked_until > NOW()),
    'locked_until', v_locked_until,
    'attempts', v_new_attempts
  );
END;
$$;

-- Clear failures after successful login
CREATE OR REPLACE FUNCTION public.clear_login_failures(
  p_identifier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_rate_limits
  WHERE identifier = p_identifier;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_allowed(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_failure(TEXT, TEXT, TEXT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_login_failures(TEXT) TO anon, authenticated;

COMMENT ON TABLE public.login_rate_limits IS
  'Tracks failed login attempts and lockout windows. Replaces CAPTCHA flow.';

-- ========================================================
-- 2) Remove legacy granular RLS helpers
-- ========================================================
DROP TRIGGER IF EXISTS tr_prevent_self_escalation ON public.users;
DROP FUNCTION IF EXISTS public.prevent_self_role_escalation() CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;

-- ========================================================
-- 3) Unified simplified RLS policy on all public tables
--    authenticated => full read/write
--    anon => denied (no anon policies)
-- ========================================================
DO $$
DECLARE
  tbl RECORD;
  pol RECORD;
BEGIN
  FOR tbl IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', tbl.schemaname, tbl.tablename);

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = tbl.schemaname
        AND tablename = tbl.tablename
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, tbl.schemaname, tbl.tablename);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY authenticated_all_access ON %I.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl.schemaname,
      tbl.tablename
    );
  END LOOP;
END;
$$;
