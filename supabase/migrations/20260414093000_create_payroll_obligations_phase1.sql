BEGIN;

-- =====================================================
-- Phase 1: Payroll & Financial Obligations Schema
-- Creates soft delete support for employees, obligation
-- headers/lines, payroll runs, payroll entries/components,
-- payroll slips, indexes, and integrity triggers.
-- =====================================================

-- -----------------------------------------------------
-- 1) Add soft delete fields to employees
-- -----------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_soft_delete_consistency_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_soft_delete_consistency_check
  CHECK (
    (is_deleted = false AND deleted_at IS NULL)
    OR (is_deleted = true)
  );

-- This partial unique index protects the active workforce and keeps
-- residence_number usable as the payroll import identifier.
-- Only create if the column exists (it may be added by a later migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'residence_number'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'employees'
        AND indexname = 'uq_employees_residence_number_active'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uq_employees_residence_number_active
        ON public.employees (residence_number)
        WHERE is_deleted = false';
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------
-- 2) Create enums in idempotent DO blocks
-- -----------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'obligation_type_enum'
  ) THEN
    CREATE TYPE public.obligation_type_enum AS ENUM (
      'transfer',
      'renewal',
      'penalty',
      'advance',
      'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'obligation_plan_status_enum'
  ) THEN
    CREATE TYPE public.obligation_plan_status_enum AS ENUM (
      'draft',
      'active',
      'completed',
      'cancelled',
      'superseded'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'obligation_line_status_enum'
  ) THEN
    CREATE TYPE public.obligation_line_status_enum AS ENUM (
      'unpaid',
      'partial',
      'paid',
      'rescheduled',
      'cancelled'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_scope_type_enum'
  ) THEN
    CREATE TYPE public.payroll_scope_type_enum AS ENUM (
      'company',
      'project'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_input_mode_enum'
  ) THEN
    CREATE TYPE public.payroll_input_mode_enum AS ENUM (
      'manual',
      'excel',
      'mixed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_run_status_enum'
  ) THEN
    CREATE TYPE public.payroll_run_status_enum AS ENUM (
      'draft',
      'processing',
      'finalized',
      'cancelled'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_entry_status_enum'
  ) THEN
    CREATE TYPE public.payroll_entry_status_enum AS ENUM (
      'draft',
      'calculated',
      'finalized',
      'paid',
      'cancelled'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_component_type_enum'
  ) THEN
    CREATE TYPE public.payroll_component_type_enum AS ENUM (
      'earning',
      'deduction',
      'installment'
    );
  END IF;
END $$;

-- -----------------------------------------------------
-- 3) Shared helper to keep updated_at current
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- 4) Obligation headers table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_obligation_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  obligation_type public.obligation_type_enum NOT NULL,
  title TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  currency_code CHAR(3) NOT NULL DEFAULT 'SAR',
  start_month DATE NOT NULL CHECK (date_trunc('month', start_month)::date = start_month),
  installment_count SMALLINT NOT NULL CHECK (installment_count BETWEEN 1 AND 12),
  status public.obligation_plan_status_enum NOT NULL DEFAULT 'draft',
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  superseded_by_header_id UUID REFERENCES public.employee_obligation_headers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employee_obligation_headers IS 'Stores one financial obligation plan per employee record.';

-- -----------------------------------------------------
-- 5) Obligation lines table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_obligation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES public.employee_obligation_headers(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  due_month DATE NOT NULL CHECK (date_trunc('month', due_month)::date = due_month),
  amount_due NUMERIC(12,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
  line_status public.obligation_line_status_enum NOT NULL DEFAULT 'unpaid',
  source_version INTEGER NOT NULL DEFAULT 1 CHECK (source_version >= 1),
  manual_override BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  rescheduled_from_line_id UUID REFERENCES public.employee_obligation_lines(id) ON DELETE SET NULL,
  rescheduled_to_line_id UUID REFERENCES public.employee_obligation_lines(id) ON DELETE SET NULL,
  payroll_entry_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_obligation_lines_paid_not_more_than_due CHECK (amount_paid <= amount_due),
  CONSTRAINT employee_obligation_lines_override_reason_check CHECK (
    manual_override = false OR override_reason IS NOT NULL
  ),
  CONSTRAINT employee_obligation_lines_rescheduled_status_check CHECK (
    line_status <> 'rescheduled' OR rescheduled_to_line_id IS NOT NULL OR rescheduled_from_line_id IS NOT NULL
  )
);

COMMENT ON TABLE public.employee_obligation_lines IS 'Stores monthly obligation installments and payment progress.';

-- -----------------------------------------------------
-- 6) Payroll runs table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_month DATE NOT NULL CHECK (date_trunc('month', payroll_month)::date = payroll_month),
  scope_type public.payroll_scope_type_enum NOT NULL,
  scope_id UUID NOT NULL,
  input_mode public.payroll_input_mode_enum NOT NULL DEFAULT 'manual',
  status public.payroll_run_status_enum NOT NULL DEFAULT 'draft',
  uploaded_file_path TEXT,
  notes TEXT,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  CONSTRAINT payroll_runs_scope_month_unique UNIQUE (payroll_month, scope_type, scope_id)
);

COMMENT ON TABLE public.payroll_runs IS 'Represents one payroll execution for a specific month and scope.';

-- -----------------------------------------------------
-- 7) Payroll entries table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  residence_number_snapshot BIGINT NOT NULL,
  employee_name_snapshot TEXT NOT NULL,
  company_name_snapshot TEXT,
  project_name_snapshot TEXT,
  basic_salary_snapshot NUMERIC(12,2) NOT NULL CHECK (basic_salary_snapshot >= 0),
  daily_rate_snapshot NUMERIC(12,2) NOT NULL CHECK (daily_rate_snapshot >= 0),
  attendance_days NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (attendance_days >= 0),
  paid_leave_days NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (paid_leave_days >= 0),
  overtime_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (overtime_amount >= 0),
  overtime_notes TEXT,
  deductions_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (deductions_amount >= 0),
  deductions_notes TEXT,
  installment_deducted_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (installment_deducted_amount >= 0),
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  entry_status public.payroll_entry_status_enum NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_entries_run_employee_unique UNIQUE (payroll_run_id, employee_id)
);

COMMENT ON TABLE public.payroll_entries IS 'Stores one employee payroll calculation per payroll run.';

-- -----------------------------------------------------
-- 8) Payroll components table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_entry_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id UUID NOT NULL REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  component_type public.payroll_component_type_enum NOT NULL,
  component_code TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  notes TEXT,
  source_line_id UUID REFERENCES public.employee_obligation_lines(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payroll_entry_components IS 'Stores detailed earning/deduction/installment rows for a payroll entry.';

-- -----------------------------------------------------
-- 9) Payroll slips table
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id UUID NOT NULL UNIQUE REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  slip_number TEXT NOT NULL UNIQUE,
  storage_path TEXT,
  template_version TEXT NOT NULL DEFAULT 'v1',
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payroll_slips IS 'Stores generated payslip metadata and the rendering snapshot.';

-- -----------------------------------------------------
-- 10) Add forward foreign key from lines to payroll entries
-- -----------------------------------------------------
ALTER TABLE public.employee_obligation_lines
  DROP CONSTRAINT IF EXISTS employee_obligation_lines_payroll_entry_id_fkey;

ALTER TABLE public.employee_obligation_lines
  ADD CONSTRAINT employee_obligation_lines_payroll_entry_id_fkey
  FOREIGN KEY (payroll_entry_id)
  REFERENCES public.payroll_entries(id)
  ON DELETE SET NULL;

-- -----------------------------------------------------
-- 11) Integrity function: auto-calculate line payment status
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_obligation_line_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount_paid < 0 THEN
    RAISE EXCEPTION 'amount_paid cannot be negative';
  END IF;

  IF NEW.amount_paid > NEW.amount_due THEN
    RAISE EXCEPTION 'amount_paid (%) cannot exceed amount_due (%)', NEW.amount_paid, NEW.amount_due;
  END IF;

  IF NEW.line_status IN ('rescheduled', 'cancelled') AND NEW.amount_paid = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.amount_paid = 0 THEN
    NEW.line_status := 'unpaid';
  ELSIF NEW.amount_paid < NEW.amount_due THEN
    NEW.line_status := 'partial';
  ELSE
    NEW.line_status := 'paid';
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- 12) Integrity helpers: obligation total validation
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_obligation_header_total(p_header_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_amount NUMERIC(12,2);
  v_sum_amount_due NUMERIC(12,2);
BEGIN
  IF p_header_id IS NULL THEN
    RETURN;
  END IF;

  SELECT total_amount
  INTO v_total_amount
  FROM public.employee_obligation_headers
  WHERE id = p_header_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount_due), 0.00)
  INTO v_sum_amount_due
  FROM public.employee_obligation_lines
  WHERE header_id = p_header_id;

  IF v_sum_amount_due <> v_total_amount THEN
    RAISE EXCEPTION
      'Installment sum mismatch for header %: expected %, got %',
      p_header_id,
      v_total_amount,
      v_sum_amount_due;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_validate_obligation_header_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.validate_obligation_header_total(OLD.header_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.header_id IS DISTINCT FROM NEW.header_id THEN
    PERFORM public.validate_obligation_header_total(OLD.header_id);
  END IF;

  PERFORM public.validate_obligation_header_total(NEW.header_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_validate_obligation_header_record()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.validate_obligation_header_total(NEW.id);
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

-- -----------------------------------------------------
-- 13) Updated-at triggers for mutable tables
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS trg_employee_obligation_headers_set_updated_at ON public.employee_obligation_headers;
CREATE TRIGGER trg_employee_obligation_headers_set_updated_at
BEFORE UPDATE ON public.employee_obligation_headers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_employee_obligation_lines_set_updated_at ON public.employee_obligation_lines;
CREATE TRIGGER trg_employee_obligation_lines_set_updated_at
BEFORE UPDATE ON public.employee_obligation_lines
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payroll_runs_set_updated_at ON public.payroll_runs;
CREATE TRIGGER trg_payroll_runs_set_updated_at
BEFORE UPDATE ON public.payroll_runs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payroll_entries_set_updated_at ON public.payroll_entries;
CREATE TRIGGER trg_payroll_entries_set_updated_at
BEFORE UPDATE ON public.payroll_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payroll_entry_components_set_updated_at ON public.payroll_entry_components;
CREATE TRIGGER trg_payroll_entry_components_set_updated_at
BEFORE UPDATE ON public.payroll_entry_components
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payroll_slips_set_updated_at ON public.payroll_slips;
CREATE TRIGGER trg_payroll_slips_set_updated_at
BEFORE UPDATE ON public.payroll_slips
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------
-- 14) Status trigger for obligation lines
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS trg_employee_obligation_lines_status ON public.employee_obligation_lines;
CREATE TRIGGER trg_employee_obligation_lines_status
BEFORE INSERT OR UPDATE OF amount_due, amount_paid, line_status
ON public.employee_obligation_lines
FOR EACH ROW
EXECUTE FUNCTION public.set_obligation_line_status();

-- -----------------------------------------------------
-- 15) Deferrable constraint triggers for strict accounting
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS trg_validate_obligation_lines_total ON public.employee_obligation_lines;
CREATE CONSTRAINT TRIGGER trg_validate_obligation_lines_total
AFTER INSERT OR UPDATE OR DELETE ON public.employee_obligation_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_obligation_header_totals();

DROP TRIGGER IF EXISTS trg_validate_obligation_header_total ON public.employee_obligation_headers;
CREATE CONSTRAINT TRIGGER trg_validate_obligation_header_total
AFTER INSERT OR UPDATE OF total_amount ON public.employee_obligation_headers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_obligation_header_record();

-- -----------------------------------------------------
-- 16) Performance indexes
-- -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_obligation_headers_employee_id
  ON public.employee_obligation_headers (employee_id);

CREATE INDEX IF NOT EXISTS idx_obligation_headers_employee_status
  ON public.employee_obligation_headers (employee_id, status);

CREATE INDEX IF NOT EXISTS idx_obligation_lines_header_due_month
  ON public.employee_obligation_lines (header_id, due_month);

CREATE INDEX IF NOT EXISTS idx_obligation_lines_employee_due_month
  ON public.employee_obligation_lines (employee_id, due_month);

CREATE INDEX IF NOT EXISTS idx_obligation_lines_employee_status_due_month
  ON public.employee_obligation_lines (employee_id, line_status, due_month);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_month_scope
  ON public.payroll_runs (payroll_month, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee_id
  ON public.payroll_entries (employee_id);

CREATE INDEX IF NOT EXISTS idx_payroll_entries_residence_number_snapshot
  ON public.payroll_entries (residence_number_snapshot);

CREATE INDEX IF NOT EXISTS idx_payroll_components_entry_id
  ON public.payroll_entry_components (payroll_entry_id, sort_order);

COMMIT;