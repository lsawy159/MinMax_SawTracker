-- تحديث البيانات القديمة في daily_excel_logs لإضافة residence_number من جدول employees
UPDATE daily_excel_logs d
SET details = jsonb_set(
  COALESCE(details, '{}'::jsonb),
  '{residence_number}',
  to_jsonb(e.residence_number)
)
FROM employees e
WHERE d.employee_id = e.id 
  AND d.employee_id IS NOT NULL
  AND (details->>'residence_number' IS NULL OR details->>'residence_number' = '');

-- تحديث البيانات القديمة لإضافة unified_number من جدول companies للموظفين
UPDATE daily_excel_logs d
SET details = jsonb_set(
  COALESCE(details, '{}'::jsonb),
  '{unified_number}',
  to_jsonb(c.unified_number)
)
FROM employees e
JOIN companies c ON e.company_id = c.id
WHERE d.employee_id = e.id 
  AND d.employee_id IS NOT NULL
  AND (details->>'unified_number' IS NULL OR details->>'unified_number' = '');

-- تحديث unified_number للشركات مباشرة
UPDATE daily_excel_logs d
SET details = jsonb_set(
  COALESCE(details, '{}'::jsonb),
  '{unified_number}',
  to_jsonb(c.unified_number)
)
FROM companies c
WHERE d.company_id = c.id 
  AND d.company_id IS NOT NULL
  AND (details->>'unified_number' IS NULL OR details->>'unified_number' = '');

-- للتحقق من التحديثات
SELECT 
  COUNT(*) total_count,
  COUNT(CASE WHEN employee_id IS NOT NULL THEN 1 END) employee_alerts,
  COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) company_alerts,
  COUNT(CASE WHEN employee_id IS NOT NULL AND details->>'residence_number' IS NOT NULL THEN 1 END) with_residence,
  COUNT(CASE WHEN employee_id IS NOT NULL AND details->>'unified_number' IS NOT NULL THEN 1 END) employees_with_unified,
  COUNT(CASE WHEN company_id IS NOT NULL AND details->>'unified_number' IS NOT NULL THEN 1 END) companies_with_unified
FROM daily_excel_logs
WHERE processed_at IS NULL;
