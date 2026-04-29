BEGIN;

CREATE OR REPLACE FUNCTION public.sync_employee_salary_from_payroll_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL OR COALESCE(NEW.basic_salary_snapshot, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.employees
  SET salary = NEW.basic_salary_snapshot,
      updated_at = now()
  WHERE id = NEW.employee_id
    AND salary IS DISTINCT FROM NEW.basic_salary_snapshot;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_employee_salary_from_payroll_entry()
IS 'Keeps employees.salary synchronized with payroll_entries.basic_salary_snapshot when payroll entries are inserted or updated.';

DROP TRIGGER IF EXISTS trg_payroll_entries_sync_employee_salary ON public.payroll_entries;
CREATE TRIGGER trg_payroll_entries_sync_employee_salary
AFTER INSERT OR UPDATE OF employee_id, basic_salary_snapshot ON public.payroll_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_employee_salary_from_payroll_entry();

COMMIT;
