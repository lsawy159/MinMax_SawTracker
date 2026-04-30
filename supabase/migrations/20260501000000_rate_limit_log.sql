-- Migration: T-110 rate_limit_log table for IP-based rate limiting
-- Applied by Edge Functions via service role

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id       bigserial    PRIMARY KEY,
  identifier text       NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_log_lookup
  ON rate_limit_log (identifier, window_start);

-- Auto-cleanup: remove entries older than 10 minutes to keep table small
-- This runs via pg_cron if available; otherwise entries are cleaned lazily.
-- In Supabase, enable pg_cron extension and add:
-- SELECT cron.schedule('rate-limit-cleanup', '*/10 * * * *',
--   $$DELETE FROM rate_limit_log WHERE window_start < now() - interval '10 minutes'$$);

-- RLS: disabled — accessed only via service_role from Edge Functions
ALTER TABLE rate_limit_log DISABLE ROW LEVEL SECURITY;
