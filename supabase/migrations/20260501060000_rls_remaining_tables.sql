-- Migration: T-206 — RLS for remaining tables
-- Depends on: 20260501010000_rls_helper_functions.sql
-- Tables: notifications, audit_log, activity_log, system_settings,
--         security_events, backups, email_queue, daily_excel_logs

-- ──────────────────────────────────────────────────────────
-- notifications — section: notifications
-- Users see only their own notifications; admins see all
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS notifications_select ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS notifications_insert ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS notifications_update ON notifications';
    EXECUTE 'DROP POLICY IF EXISTS notifications_delete ON notifications';
    -- Users see their own; admins see all
    EXECUTE 'CREATE POLICY notifications_select ON notifications FOR SELECT USING (user_id = auth.uid() OR is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = auth.uid() OR is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY notifications_delete ON notifications FOR DELETE USING (user_id = auth.uid() OR is_admin(auth.uid()))';
    RAISE NOTICE 'RLS enabled on notifications';
  ELSE
    RAISE NOTICE 'notifications not found — skipping';
  END IF;
END;
$do$;

-- ──────────────────────────────────────────────────────────
-- audit_log — section: audit (read-only for non-admins with permission)
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_log' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS audit_log_select ON audit_log';
    EXECUTE 'DROP POLICY IF EXISTS audit_log_insert ON audit_log';
    EXECUTE 'CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (has_permission(auth.uid(), ''audit'', ''view''))';
    -- Only service role / triggers insert audit logs (deny direct inserts from app users)
    EXECUTE 'CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (is_admin(auth.uid()))';
    RAISE NOTICE 'RLS enabled on audit_log';
  ELSE
    RAISE NOTICE 'audit_log not found — skipping';
  END IF;
END;
$do$;

-- ──────────────────────────────────────────────────────────
-- activity_log — section: audit
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'activity_log' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS activity_log_select ON activity_log';
    EXECUTE 'DROP POLICY IF EXISTS activity_log_insert ON activity_log';
    EXECUTE 'CREATE POLICY activity_log_select ON activity_log FOR SELECT USING (has_permission(auth.uid(), ''audit'', ''view''))';
    EXECUTE 'CREATE POLICY activity_log_insert ON activity_log FOR INSERT WITH CHECK (is_admin(auth.uid()))';
    RAISE NOTICE 'RLS enabled on activity_log';
  ELSE
    RAISE NOTICE 'activity_log not found — skipping';
  END IF;
END;
$do$;

-- ──────────────────────────────────────────────────────────
-- system_settings — section: settings (admin read/write; others read-only)
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_settings' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS system_settings_select ON system_settings';
    EXECUTE 'DROP POLICY IF EXISTS system_settings_insert ON system_settings';
    EXECUTE 'DROP POLICY IF EXISTS system_settings_update ON system_settings';
    EXECUTE 'DROP POLICY IF EXISTS system_settings_delete ON system_settings';
    EXECUTE 'CREATE POLICY system_settings_select ON system_settings FOR SELECT USING (has_permission(auth.uid(), ''settings'', ''view'') OR is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY system_settings_insert ON system_settings FOR INSERT WITH CHECK (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY system_settings_update ON system_settings FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY system_settings_delete ON system_settings FOR DELETE USING (is_admin(auth.uid()))';
    RAISE NOTICE 'RLS enabled on system_settings';
  ELSE
    RAISE NOTICE 'system_settings not found — skipping';
  END IF;
END;
$do$;

-- ──────────────────────────────────────────────────────────
-- security_events — admin only
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'security_events' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE security_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS security_events_select ON security_events';
    EXECUTE 'DROP POLICY IF EXISTS security_events_insert ON security_events';
    EXECUTE 'DROP POLICY IF EXISTS security_events_update ON security_events';
    EXECUTE 'CREATE POLICY security_events_select ON security_events FOR SELECT USING (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY security_events_insert ON security_events FOR INSERT WITH CHECK (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY security_events_update ON security_events FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()))';
    RAISE NOTICE 'RLS enabled on security_events';
  ELSE
    RAISE NOTICE 'security_events not found — skipping';
  END IF;
END;
$do$;

-- ──────────────────────────────────────────────────────────
-- backups — section: data (admin only)
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'backups' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE backups ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS backups_select ON backups';
    EXECUTE 'DROP POLICY IF EXISTS backups_insert ON backups';
    EXECUTE 'DROP POLICY IF EXISTS backups_update ON backups';
    EXECUTE 'CREATE POLICY backups_select ON backups FOR SELECT USING (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY backups_insert ON backups FOR INSERT WITH CHECK (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY backups_update ON backups FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()))';
    RAISE NOTICE 'RLS enabled on backups';
  ELSE
    RAISE NOTICE 'backups not found — skipping';
  END IF;
END;
$do$;

-- ──────────────────────────────────────────────────────────
-- email_queue — admin only (Edge Functions use service role)
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_queue' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS email_queue_select ON email_queue';
    EXECUTE 'DROP POLICY IF EXISTS email_queue_insert ON email_queue';
    EXECUTE 'DROP POLICY IF EXISTS email_queue_update ON email_queue';
    EXECUTE 'CREATE POLICY email_queue_select ON email_queue FOR SELECT USING (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY email_queue_insert ON email_queue FOR INSERT WITH CHECK (is_admin(auth.uid()))';
    EXECUTE 'CREATE POLICY email_queue_update ON email_queue FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()))';
    RAISE NOTICE 'RLS enabled on email_queue';
  ELSE
    RAISE NOTICE 'email_queue not found — skipping';
  END IF;
END;
$do$;

-- ──────────────────────────────────────────────────────────
-- daily_excel_logs — admin + users with audit view
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_excel_logs' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE daily_excel_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS daily_excel_logs_select ON daily_excel_logs';
    EXECUTE 'DROP POLICY IF EXISTS daily_excel_logs_insert ON daily_excel_logs';
    EXECUTE 'CREATE POLICY daily_excel_logs_select ON daily_excel_logs FOR SELECT USING (has_permission(auth.uid(), ''audit'', ''view''))';
    EXECUTE 'CREATE POLICY daily_excel_logs_insert ON daily_excel_logs FOR INSERT WITH CHECK (is_admin(auth.uid()))';
    RAISE NOTICE 'RLS enabled on daily_excel_logs';
  ELSE
    RAISE NOTICE 'daily_excel_logs not found — skipping';
  END IF;
END;
$do$;
