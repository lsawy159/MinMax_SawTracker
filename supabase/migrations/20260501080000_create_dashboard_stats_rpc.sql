-- T-301: Create dashboard_stats RPC for dashboard page
-- Single call to get all dashboard statistics efficiently

CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS jsonb AS $$
DECLARE
  v_companies_count INT;
  v_employees_count INT;
  v_projects_count INT;
  v_alerts jsonb;
  v_recent_employees jsonb;
BEGIN
  -- Check permission
  IF NOT has_permission(auth.uid(), 'dashboard.view') THEN
    RAISE EXCEPTION 'INSUFFICIENT_PERMISSION' USING ERRCODE = '42501';
  END IF;

  -- Count companies
  SELECT COUNT(*) INTO v_companies_count
  FROM companies
  WHERE deleted_at IS NULL;

  -- Count employees
  SELECT COUNT(*) INTO v_employees_count
  FROM employees
  WHERE deleted_at IS NULL;

  -- Count projects
  SELECT COUNT(*) INTO v_projects_count
  FROM projects
  WHERE deleted_at IS NULL;

  -- Get alert counts by priority (using compute_alerts)
  SELECT jsonb_object_agg(
    COALESCE(priority, 'low'),
    COUNT(*)
  ) INTO v_alerts
  FROM (
    SELECT priority FROM compute_alerts(NULL)
  ) alerts_with_priority;

  -- Get recent employees
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'email', email,
      'company_id', company_id,
      'position', position,
      'status', status
    ) ORDER BY created_at DESC
  ) INTO v_recent_employees
  FROM employees
  WHERE deleted_at IS NULL
  LIMIT 5;

  -- Return aggregated stats
  RETURN jsonb_build_object(
    'companies_count', COALESCE(v_companies_count, 0),
    'employees_count', COALESCE(v_employees_count, 0),
    'projects_count', COALESCE(v_projects_count, 0),
    'alerts', COALESCE(v_alerts, '{}'::jsonb),
    'recent_employees', COALESCE(v_recent_employees, '[]'::jsonb),
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Set row-level security for function execution
GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO authenticated;
