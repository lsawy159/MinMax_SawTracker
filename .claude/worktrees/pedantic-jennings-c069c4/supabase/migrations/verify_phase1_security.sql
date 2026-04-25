-- Security Verification Script
-- Phase 1: Security Verification
-- This script verifies that all security improvements have been properly implemented
-- Run in Supabase SQL editor after `db push` completes

-- =========================================
-- 1. Verify RLS is enabled on critical tables
-- =========================================
SELECT
  schemaname,
  tablename,
  (SELECT array_agg(policyname) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as rls_policies,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'security_settings', 'audit_log', 'security_events', 'users', 'companies', 'employees')
ORDER BY tablename;

-- Quick existence check
SELECT to_regclass('public.audit_log') AS audit_log,
       to_regclass('public.security_events') AS security_events,
       to_regclass('public.security_settings') AS security_settings;

-- =========================================
-- 2. Verify audit_log table structure
-- =========================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_log'
ORDER BY ordinal_position;

-- =========================================
-- 3. Verify security_events table structure
-- =========================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'security_events'
ORDER BY ordinal_position;

-- =========================================
-- 4. Verify security_settings table structure
-- =========================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'security_settings'
ORDER BY ordinal_position;

-- =========================================
-- 5. List all indexes on audit and security tables
-- =========================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('audit_log', 'security_events', 'security_settings', 'projects')
ORDER BY tablename, indexname;

-- =========================================
-- 6. Verify functions exist
-- =========================================
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('log_audit_event', 'audit_trigger_function', 'update_projects_updated_at')
ORDER BY routine_name;

-- =========================================
-- 7. Verify triggers are in place
-- =========================================
SELECT
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('audit_log', 'security_events', 'projects', 'security_settings')
ORDER BY event_object_table, trigger_name;

-- =========================================
-- 8. Count records in new tables
-- =========================================
SELECT
  'audit_log' as table_name,
  COUNT(*) as record_count
FROM public.audit_log
UNION ALL
SELECT
  'security_events' as table_name,
  COUNT(*) as record_count
FROM public.security_events
UNION ALL
SELECT
  'security_settings' as table_name,
  COUNT(*) as record_count
FROM public.security_settings
ORDER BY table_name;

-- =========================================
-- 9. Verify RLS policies on projects table
-- =========================================
SELECT
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'projects'
ORDER BY policyname;

-- =========================================
-- 10. Check for any policy conflicts
-- =========================================
SELECT
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'security_settings', 'audit_log', 'security_events')
GROUP BY schemaname, tablename
ORDER BY tablename;
