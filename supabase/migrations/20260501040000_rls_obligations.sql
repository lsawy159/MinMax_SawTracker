-- Migration: T-204 — RLS for obligations tables
-- Depends on: 20260501010000_rls_helper_functions.sql
-- Section: obligations

-- employee_obligation_headers (if exists)
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'employee_obligation_headers' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE employee_obligation_headers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS obligation_headers_select ON employee_obligation_headers';
    EXECUTE 'DROP POLICY IF EXISTS obligation_headers_insert ON employee_obligation_headers';
    EXECUTE 'DROP POLICY IF EXISTS obligation_headers_update ON employee_obligation_headers';
    EXECUTE 'DROP POLICY IF EXISTS obligation_headers_delete ON employee_obligation_headers';
    EXECUTE 'CREATE POLICY obligation_headers_select ON employee_obligation_headers FOR SELECT USING (has_permission(auth.uid(), ''obligations'', ''view''))';
    EXECUTE 'CREATE POLICY obligation_headers_insert ON employee_obligation_headers FOR INSERT WITH CHECK (has_permission(auth.uid(), ''obligations'', ''create''))';
    EXECUTE 'CREATE POLICY obligation_headers_update ON employee_obligation_headers FOR UPDATE USING (has_permission(auth.uid(), ''obligations'', ''edit'')) WITH CHECK (has_permission(auth.uid(), ''obligations'', ''edit''))';
    EXECUTE 'CREATE POLICY obligation_headers_delete ON employee_obligation_headers FOR DELETE USING (has_permission(auth.uid(), ''obligations'', ''delete''))';
    RAISE NOTICE 'RLS enabled on employee_obligation_headers';
  ELSE
    RAISE NOTICE 'employee_obligation_headers not found — skipping';
  END IF;
END;
$do$;

-- employee_obligation_lines (if exists)
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'employee_obligation_lines' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE employee_obligation_lines ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS obligation_lines_select ON employee_obligation_lines';
    EXECUTE 'DROP POLICY IF EXISTS obligation_lines_insert ON employee_obligation_lines';
    EXECUTE 'DROP POLICY IF EXISTS obligation_lines_update ON employee_obligation_lines';
    EXECUTE 'DROP POLICY IF EXISTS obligation_lines_delete ON employee_obligation_lines';
    EXECUTE 'CREATE POLICY obligation_lines_select ON employee_obligation_lines FOR SELECT USING (has_permission(auth.uid(), ''obligations'', ''view''))';
    EXECUTE 'CREATE POLICY obligation_lines_insert ON employee_obligation_lines FOR INSERT WITH CHECK (has_permission(auth.uid(), ''obligations'', ''create''))';
    EXECUTE 'CREATE POLICY obligation_lines_update ON employee_obligation_lines FOR UPDATE USING (has_permission(auth.uid(), ''obligations'', ''edit'')) WITH CHECK (has_permission(auth.uid(), ''obligations'', ''edit''))';
    EXECUTE 'CREATE POLICY obligation_lines_delete ON employee_obligation_lines FOR DELETE USING (has_permission(auth.uid(), ''obligations'', ''delete''))';
    RAISE NOTICE 'RLS enabled on employee_obligation_lines';
  ELSE
    RAISE NOTICE 'employee_obligation_lines not found — skipping';
  END IF;
END;
$do$;
