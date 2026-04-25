-- Make obligation title automatic based on obligation type.
-- The UI no longer asks the user for a custom title.

DROP FUNCTION IF EXISTS public.create_employee_obligation_plan(
  UUID,
  public.obligation_type_enum,
  TEXT,
  NUMERIC,
  CHAR,
  DATE,
  NUMERIC[],
  public.obligation_plan_status_enum,
  TEXT
);

CREATE OR REPLACE FUNCTION public.create_employee_obligation_plan(
  p_employee_id UUID,
  p_obligation_type public.obligation_type_enum,
  p_title TEXT,
  p_total_amount NUMERIC,
  p_currency_code CHAR(3) DEFAULT 'SAR',
  p_start_month DATE DEFAULT NULL,
  p_installment_amounts NUMERIC[] DEFAULT NULL,
  p_status public.obligation_plan_status_enum DEFAULT 'active',
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  header_id UUID,
  line_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_header_id UUID;
  v_amount NUMERIC(12,2);
  v_total_installments NUMERIC(12,2) := 0.00;
  v_installment_count INTEGER;
  v_due_month DATE;
  v_effective_title TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.id = v_user_id
      AND u.is_active = true
      AND (
        u.role = 'admin'
        OR COALESCE((u.permissions -> 'employees' ->> 'create')::boolean, false)
        OR COALESCE((u.permissions -> 'employees' ->> 'edit')::boolean, false)
      )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id = p_employee_id
      AND COALESCE(e.is_deleted, false) = false
  ) THEN
    RAISE EXCEPTION 'Employee not found or deleted';
  END IF;

  v_effective_title := NULLIF(btrim(COALESCE(p_title, '')), '');

  IF v_effective_title IS NULL THEN
    v_effective_title := CASE p_obligation_type
      WHEN 'advance' THEN 'سلفة'
      WHEN 'transfer' THEN 'نقل كفالة'
      WHEN 'renewal' THEN 'تجديد'
      WHEN 'penalty' THEN 'غرامة'
      ELSE 'التزام آخر'
    END;
  END IF;

  IF p_total_amount IS NULL OR p_total_amount < 0 THEN
    RAISE EXCEPTION 'total_amount must be zero or greater';
  END IF;

  IF p_start_month IS NULL OR date_trunc('month', p_start_month)::date <> p_start_month THEN
    RAISE EXCEPTION 'start_month must be the first day of the month';
  END IF;

  IF p_currency_code IS NULL OR char_length(btrim(p_currency_code::text)) <> 3 THEN
    RAISE EXCEPTION 'currency_code must be exactly 3 characters';
  END IF;

  v_installment_count := array_length(p_installment_amounts, 1);

  IF v_installment_count IS NULL OR v_installment_count < 1 OR v_installment_count > 12 THEN
    RAISE EXCEPTION 'installment_amounts must contain between 1 and 12 values';
  END IF;

  FOREACH v_amount IN ARRAY p_installment_amounts LOOP
    IF v_amount IS NULL OR v_amount < 0 THEN
      RAISE EXCEPTION 'installment amounts must be zero or greater';
    END IF;

    v_total_installments := v_total_installments + ROUND(v_amount, 2);
  END LOOP;

  IF ROUND(v_total_installments, 2) <> ROUND(p_total_amount, 2) THEN
    RAISE EXCEPTION 'installment sum (%) does not match total_amount (%)', v_total_installments, p_total_amount;
  END IF;

  INSERT INTO public.employee_obligation_headers (
    employee_id,
    obligation_type,
    title,
    total_amount,
    currency_code,
    start_month,
    installment_count,
    status,
    created_by_user_id,
    notes
  )
  VALUES (
    p_employee_id,
    p_obligation_type,
    v_effective_title,
    ROUND(p_total_amount, 2),
    UPPER(btrim(p_currency_code::text))::char(3),
    p_start_month,
    v_installment_count,
    COALESCE(p_status, 'active'),
    v_user_id,
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_header_id;

  FOR i IN 1..v_installment_count LOOP
    v_due_month := (p_start_month + make_interval(months => i - 1))::date;

    INSERT INTO public.employee_obligation_lines (
      header_id,
      employee_id,
      due_month,
      amount_due,
      amount_paid
    )
    VALUES (
      v_header_id,
      p_employee_id,
      v_due_month,
      ROUND(p_installment_amounts[i], 2),
      0.00
    );
  END LOOP;

  RETURN QUERY
  SELECT v_header_id, v_installment_count;
END;
$$;
