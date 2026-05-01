-- T-401, T-402, T-403: Create payroll RPC functions
-- Created: 2026-05-01
-- Phase 4: Payroll system RPC functions with transaction support

-- T-401: process_payroll_run RPC
-- State machine: draft → calculate → processing → finalize → finalized
-- Permissions: calculate/cancel → payroll.edit, finalize → payroll.finalize, delete → payroll.delete
CREATE OR REPLACE FUNCTION process_payroll_run(
  p_run_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_current_status TEXT;
  v_new_status TEXT;
  v_entries_count INT := 0;
  v_components_count INT := 0;
  v_obligations_count INT := 0;
BEGIN
  -- Check permissions
  CASE p_action
    WHEN 'calculate', 'cancel' THEN
      IF NOT has_permission(auth.uid(), 'payroll.edit') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PERMISSION' USING ERRCODE = '42501';
      END IF;
    WHEN 'finalize' THEN
      IF NOT has_permission(auth.uid(), 'payroll.finalize') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PERMISSION' USING ERRCODE = '42501';
      END IF;
    WHEN 'delete' THEN
      IF NOT has_permission(auth.uid(), 'payroll.delete') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PERMISSION' USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'INVALID_ACTION: %', p_action USING ERRCODE = 'P0001';
  END CASE;

  -- Get current run
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RUN_NOT_FOUND: %', p_run_id USING ERRCODE = 'P0002';
  END IF;

  v_current_status := v_run.status;

  -- Validate state transitions
  CASE p_action
    WHEN 'calculate' THEN
      IF v_current_status != 'draft' THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % to calculate', v_current_status USING ERRCODE = 'P0001';
      END IF;
      v_new_status := 'processing';
    WHEN 'finalize' THEN
      IF v_current_status != 'processing' THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % to finalize', v_current_status USING ERRCODE = 'P0001';
      END IF;
      v_new_status := 'finalized';
    WHEN 'cancel' THEN
      v_new_status := 'cancelled';
    WHEN 'delete' THEN
      IF v_current_status NOT IN ('cancelled', 'finalized') THEN
        RAISE EXCEPTION 'INVALID_TRANSITION: % to delete', v_current_status USING ERRCODE = 'P0001';
      END IF;
      DELETE FROM payroll_runs WHERE id = p_run_id;
      RETURN jsonb_build_object(
        'success', true,
        'action', p_action,
        'run_id', p_run_id
      );
  END CASE;

  -- Update status
  UPDATE payroll_runs
  SET status = v_new_status, updated_at = NOW()
  WHERE id = p_run_id;

  -- Get counts for response
  SELECT COUNT(*) INTO v_entries_count FROM payroll_entries WHERE run_id = p_run_id;
  SELECT COUNT(*) INTO v_components_count FROM payroll_entry_components WHERE run_id = p_run_id;
  SELECT COUNT(*) INTO v_obligations_count FROM employee_obligation_headers WHERE run_id = p_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'run_id', p_run_id,
    'entries_processed', v_entries_count,
    'components_synced', v_components_count,
    'obligations_linked', v_obligations_count
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'process_payroll_run error: %', SQLERRM;
END;
$$;

-- T-402: recompute_obligation_lines RPC
-- Recomputes obligation lines from header with version tracking
CREATE OR REPLACE FUNCTION recompute_obligation_lines(
  p_header_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_header RECORD;
  v_installment_count INT;
  v_lines_created INT := 0;
  v_lines_preserved INT := 0;
  v_new_version INT;
BEGIN
  -- Check permissions
  IF NOT has_permission(auth.uid(), 'obligations.edit') THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSION' USING ERRCODE = '42501';
  END IF;

  -- Get header
  SELECT * INTO v_header FROM employee_obligation_headers WHERE id = p_header_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'HEADER_NOT_FOUND: %', p_header_id USING ERRCODE = 'P0002';
  END IF;

  -- Calculate installment count (monthly lines for duration)
  v_installment_count := COALESCE(v_header.installment_count, 12);
  v_new_version := COALESCE(v_header.source_version, 0) + 1;

  -- Preserve paid lines, replace unpaid lines
  DELETE FROM employee_obligation_lines
  WHERE header_id = p_header_id
    AND status NOT IN ('paid', 'partial');

  -- Count preserved lines
  SELECT COUNT(*) INTO v_lines_preserved
  FROM employee_obligation_lines
  WHERE header_id = p_header_id;

  -- Create new lines
  INSERT INTO employee_obligation_lines (
    header_id, installment_number, due_date, amount, status, created_at, updated_at
  )
  SELECT
    p_header_id,
    row_number() OVER (ORDER BY (SELECT 1)),
    NOW() + (row_number() OVER (ORDER BY (SELECT 1)) || ' months')::INTERVAL,
    v_header.total_amount / v_installment_count,
    'pending',
    NOW(),
    NOW()
  FROM generate_series(
    (SELECT COUNT(*) + 1 FROM employee_obligation_lines WHERE header_id = p_header_id),
    v_installment_count
  );

  GET DIAGNOSTICS v_lines_created = ROW_COUNT;

  -- Update header version
  UPDATE employee_obligation_headers
  SET source_version = v_new_version, updated_at = NOW()
  WHERE id = p_header_id;

  RETURN jsonb_build_object(
    'header_id', p_header_id,
    'lines_created', v_lines_created,
    'lines_preserved', v_lines_preserved,
    'new_version', v_new_version
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'recompute_obligation_lines error: %', SQLERRM;
END;
$$;

-- T-403: get_payroll_summary RPC
-- Returns comprehensive payroll run summary with totals by project
CREATE OR REPLACE FUNCTION get_payroll_summary(
  p_run_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_summary JSONB;
  v_breakdown JSONB;
BEGIN
  -- Check permissions
  IF NOT has_permission(auth.uid(), 'payroll.view') THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSION' USING ERRCODE = '42501';
  END IF;

  -- Get run
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RUN_NOT_FOUND: %', p_run_id USING ERRCODE = 'P0002';
  END IF;

  -- Get breakdown by project
  SELECT jsonb_agg(jsonb_build_object(
    'project_id', pr.id,
    'project_name', pr.name,
    'employees_count', COUNT(DISTINCT pe.employee_id),
    'gross_total', COALESCE(SUM(pe.gross_amount), 0),
    'net_total', COALESCE(SUM(pe.net_amount), 0)
  ))
  INTO v_breakdown
  FROM payroll_entries pe
  LEFT JOIN projects pr ON pe.project_id = pr.id
  WHERE pe.run_id = p_run_id
  GROUP BY pr.id, pr.name;

  -- Build summary
  v_summary := jsonb_build_object(
    'run_id', v_run.id,
    'month', to_char(v_run.payroll_month, 'YYYY-MM'),
    'scope', jsonb_build_object(
      'type', COALESCE(v_run.scope_type, 'company'),
      'id', v_run.scope_id,
      'name', COALESCE(v_run.scope_name, 'All Companies')
    ),
    'status', v_run.status,
    'totals', jsonb_build_object(
      'employees_count', (SELECT COUNT(DISTINCT employee_id) FROM payroll_entries WHERE run_id = p_run_id),
      'gross_total', COALESCE((SELECT SUM(gross_amount) FROM payroll_entries WHERE run_id = p_run_id), 0),
      'deductions_total', COALESCE((SELECT SUM(amount) FROM payroll_entry_components WHERE run_id = p_run_id AND component_type = 'deduction'), 0),
      'installments_total', COALESCE((SELECT SUM(amount) FROM employee_obligation_lines WHERE run_id = p_run_id), 0),
      'net_total', COALESCE((SELECT SUM(net_amount) FROM payroll_entries WHERE run_id = p_run_id), 0)
    ),
    'breakdown_by_project', COALESCE(v_breakdown, '[]'::jsonb),
    'currency', 'SAR'
  );

  RETURN v_summary;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'get_payroll_summary error: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_payroll_run(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION recompute_obligation_lines(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payroll_summary(UUID) TO authenticated;
