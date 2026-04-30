-- Migration: T-203 — RLS for payroll tables (5 tables)
-- Depends on: 20260501010000_rls_helper_functions.sql
-- Section: payroll

-- ──────────────────────────────────────────────────────────
-- Helper macro: enable RLS + 4 policies on a table
-- Called per-table using DO blocks for idempotency
-- ──────────────────────────────────────────────────────────

-- payroll_runs
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_runs_select ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_insert ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_update ON payroll_runs;
DROP POLICY IF EXISTS payroll_runs_delete ON payroll_runs;
CREATE POLICY payroll_runs_select ON payroll_runs
  FOR SELECT USING (has_permission(auth.uid(), 'payroll', 'view'));
CREATE POLICY payroll_runs_insert ON payroll_runs
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'payroll', 'create'));
CREATE POLICY payroll_runs_update ON payroll_runs
  FOR UPDATE
  USING     (has_permission(auth.uid(), 'payroll', 'edit'))
  WITH CHECK(has_permission(auth.uid(), 'payroll', 'edit'));
CREATE POLICY payroll_runs_delete ON payroll_runs
  FOR DELETE USING (has_permission(auth.uid(), 'payroll', 'delete'));

-- payroll_entries
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_entries_select ON payroll_entries;
DROP POLICY IF EXISTS payroll_entries_insert ON payroll_entries;
DROP POLICY IF EXISTS payroll_entries_update ON payroll_entries;
DROP POLICY IF EXISTS payroll_entries_delete ON payroll_entries;
CREATE POLICY payroll_entries_select ON payroll_entries
  FOR SELECT USING (has_permission(auth.uid(), 'payroll', 'view'));
CREATE POLICY payroll_entries_insert ON payroll_entries
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'payroll', 'create'));
CREATE POLICY payroll_entries_update ON payroll_entries
  FOR UPDATE
  USING     (has_permission(auth.uid(), 'payroll', 'edit'))
  WITH CHECK(has_permission(auth.uid(), 'payroll', 'edit'));
CREATE POLICY payroll_entries_delete ON payroll_entries
  FOR DELETE USING (has_permission(auth.uid(), 'payroll', 'delete'));

-- payroll_entry_components (if exists)
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payroll_entry_components' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE payroll_entry_components ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS payroll_entry_components_select ON payroll_entry_components';
    EXECUTE 'DROP POLICY IF EXISTS payroll_entry_components_insert ON payroll_entry_components';
    EXECUTE 'DROP POLICY IF EXISTS payroll_entry_components_update ON payroll_entry_components';
    EXECUTE 'DROP POLICY IF EXISTS payroll_entry_components_delete ON payroll_entry_components';
    EXECUTE 'CREATE POLICY payroll_entry_components_select ON payroll_entry_components FOR SELECT USING (has_permission(auth.uid(), ''payroll'', ''view''))';
    EXECUTE 'CREATE POLICY payroll_entry_components_insert ON payroll_entry_components FOR INSERT WITH CHECK (has_permission(auth.uid(), ''payroll'', ''create''))';
    EXECUTE 'CREATE POLICY payroll_entry_components_update ON payroll_entry_components FOR UPDATE USING (has_permission(auth.uid(), ''payroll'', ''edit'')) WITH CHECK (has_permission(auth.uid(), ''payroll'', ''edit''))';
    EXECUTE 'CREATE POLICY payroll_entry_components_delete ON payroll_entry_components FOR DELETE USING (has_permission(auth.uid(), ''payroll'', ''delete''))';
    RAISE NOTICE 'RLS enabled on payroll_entry_components';
  ELSE
    RAISE NOTICE 'payroll_entry_components not found — skipping';
  END IF;
END;
$do$;

-- payroll_slips (if exists)
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payroll_slips' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE payroll_slips ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS payroll_slips_select ON payroll_slips';
    EXECUTE 'DROP POLICY IF EXISTS payroll_slips_insert ON payroll_slips';
    EXECUTE 'DROP POLICY IF EXISTS payroll_slips_update ON payroll_slips';
    EXECUTE 'DROP POLICY IF EXISTS payroll_slips_delete ON payroll_slips';
    EXECUTE 'CREATE POLICY payroll_slips_select ON payroll_slips FOR SELECT USING (has_permission(auth.uid(), ''payroll'', ''view''))';
    EXECUTE 'CREATE POLICY payroll_slips_insert ON payroll_slips FOR INSERT WITH CHECK (has_permission(auth.uid(), ''payroll'', ''create''))';
    EXECUTE 'CREATE POLICY payroll_slips_update ON payroll_slips FOR UPDATE USING (has_permission(auth.uid(), ''payroll'', ''edit'')) WITH CHECK (has_permission(auth.uid(), ''payroll'', ''edit''))';
    EXECUTE 'CREATE POLICY payroll_slips_delete ON payroll_slips FOR DELETE USING (has_permission(auth.uid(), ''payroll'', ''delete''))';
    RAISE NOTICE 'RLS enabled on payroll_slips';
  ELSE
    RAISE NOTICE 'payroll_slips not found — skipping';
  END IF;
END;
$do$;

-- salary_structures (if exists)
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'salary_structures' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS salary_structures_select ON salary_structures';
    EXECUTE 'DROP POLICY IF EXISTS salary_structures_insert ON salary_structures';
    EXECUTE 'DROP POLICY IF EXISTS salary_structures_update ON salary_structures';
    EXECUTE 'DROP POLICY IF EXISTS salary_structures_delete ON salary_structures';
    EXECUTE 'CREATE POLICY salary_structures_select ON salary_structures FOR SELECT USING (has_permission(auth.uid(), ''payroll'', ''view''))';
    EXECUTE 'CREATE POLICY salary_structures_insert ON salary_structures FOR INSERT WITH CHECK (has_permission(auth.uid(), ''payroll'', ''create''))';
    EXECUTE 'CREATE POLICY salary_structures_update ON salary_structures FOR UPDATE USING (has_permission(auth.uid(), ''payroll'', ''edit'')) WITH CHECK (has_permission(auth.uid(), ''payroll'', ''edit''))';
    EXECUTE 'CREATE POLICY salary_structures_delete ON salary_structures FOR DELETE USING (has_permission(auth.uid(), ''payroll'', ''delete''))';
    RAISE NOTICE 'RLS enabled on salary_structures';
  ELSE
    RAISE NOTICE 'salary_structures not found — skipping';
  END IF;
END;
$do$;
