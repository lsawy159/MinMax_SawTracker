-- Migration: T-202 — RLS for companies, projects, employees
-- Depends on: 20260501010000_rls_helper_functions.sql

-- ──────────────────────────────────────────────────────────
-- companies
-- ──────────────────────────────────────────────────────────
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent re-run)
DROP POLICY IF EXISTS companies_select ON companies;
DROP POLICY IF EXISTS companies_insert ON companies;
DROP POLICY IF EXISTS companies_update ON companies;
DROP POLICY IF EXISTS companies_delete ON companies;

CREATE POLICY companies_select ON companies
  FOR SELECT USING (has_permission(auth.uid(), 'companies', 'view'));

CREATE POLICY companies_insert ON companies
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'companies', 'create'));

CREATE POLICY companies_update ON companies
  FOR UPDATE
  USING     (has_permission(auth.uid(), 'companies', 'edit'))
  WITH CHECK(has_permission(auth.uid(), 'companies', 'edit'));

CREATE POLICY companies_delete ON companies
  FOR DELETE USING (has_permission(auth.uid(), 'companies', 'delete'));

-- ──────────────────────────────────────────────────────────
-- projects
-- ──────────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select ON projects;
DROP POLICY IF EXISTS projects_insert ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS projects_delete ON projects;

CREATE POLICY projects_select ON projects
  FOR SELECT USING (has_permission(auth.uid(), 'projects', 'view'));

CREATE POLICY projects_insert ON projects
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'projects', 'create'));

CREATE POLICY projects_update ON projects
  FOR UPDATE
  USING     (has_permission(auth.uid(), 'projects', 'edit'))
  WITH CHECK(has_permission(auth.uid(), 'projects', 'edit'));

CREATE POLICY projects_delete ON projects
  FOR DELETE USING (has_permission(auth.uid(), 'projects', 'delete'));

-- ──────────────────────────────────────────────────────────
-- employees
-- ──────────────────────────────────────────────────────────
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select ON employees;
DROP POLICY IF EXISTS employees_insert ON employees;
DROP POLICY IF EXISTS employees_update ON employees;
DROP POLICY IF EXISTS employees_delete ON employees;

CREATE POLICY employees_select ON employees
  FOR SELECT USING (has_permission(auth.uid(), 'employees', 'view'));

CREATE POLICY employees_insert ON employees
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'employees', 'create'));

CREATE POLICY employees_update ON employees
  FOR UPDATE
  USING     (has_permission(auth.uid(), 'employees', 'edit'))
  WITH CHECK(has_permission(auth.uid(), 'employees', 'edit'));

CREATE POLICY employees_delete ON employees
  FOR DELETE USING (has_permission(auth.uid(), 'employees', 'delete'));

-- ──────────────────────────────────────────────────────────
-- transfer_procedures (section: transfers)
-- ──────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transfer_procedures' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE transfer_procedures ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS transfer_procedures_select ON transfer_procedures';
    EXECUTE 'DROP POLICY IF EXISTS transfer_procedures_insert ON transfer_procedures';
    EXECUTE 'DROP POLICY IF EXISTS transfer_procedures_update ON transfer_procedures';
    EXECUTE 'DROP POLICY IF EXISTS transfer_procedures_delete ON transfer_procedures';
    EXECUTE 'CREATE POLICY transfer_procedures_select ON transfer_procedures FOR SELECT USING (has_permission(auth.uid(), ''transfers'', ''view''))';
    EXECUTE 'CREATE POLICY transfer_procedures_insert ON transfer_procedures FOR INSERT WITH CHECK (has_permission(auth.uid(), ''transfers'', ''create''))';
    EXECUTE 'CREATE POLICY transfer_procedures_update ON transfer_procedures FOR UPDATE USING (has_permission(auth.uid(), ''transfers'', ''edit'')) WITH CHECK (has_permission(auth.uid(), ''transfers'', ''edit''))';
    EXECUTE 'CREATE POLICY transfer_procedures_delete ON transfer_procedures FOR DELETE USING (has_permission(auth.uid(), ''transfers'', ''delete''))';
    RAISE NOTICE 'RLS enabled on transfer_procedures';
  ELSE
    RAISE NOTICE 'transfer_procedures table not found — skipping';
  END IF;
END;
$do$;
