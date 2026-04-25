-- ================================================================
-- Prevent duplicate daily alerts per entity/type/day (Excel digest)
-- ================================================================

-- Employees: one alert per employee + type + day (expiry_date null-safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_excel_logs_unique_employee_alert_day
ON public.daily_excel_logs (
  employee_id,
  alert_type,
  COALESCE(expiry_date, DATE '1970-01-01'),
  DATE(created_at AT TIME ZONE 'Asia/Riyadh')
)
WHERE employee_id IS NOT NULL;

-- Companies: one alert per company + type + day (expiry_date null-safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_excel_logs_unique_company_alert_day
ON public.daily_excel_logs (
  company_id,
  alert_type,
  COALESCE(expiry_date, DATE '1970-01-01'),
  DATE(created_at AT TIME ZONE 'Asia/Riyadh')
)
WHERE company_id IS NOT NULL;
