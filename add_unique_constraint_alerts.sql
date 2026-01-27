-- إضافة unique constraint لمنع تكرار التنبيهات على مستوى قاعدة البيانات

-- للموظفين: منع تكرار نفس التنبيه لنفس الموظف في نفس اليوم
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_excel_logs_unique_employee_alert
ON daily_excel_logs (
  employee_id, 
  alert_type, 
  expiry_date,
  DATE(created_at)
)
WHERE employee_id IS NOT NULL;

-- للشركات: منع تكرار نفس التنبيه لنفس الشركة في نفس اليوم
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_excel_logs_unique_company_alert
ON daily_excel_logs (
  company_id, 
  alert_type, 
  expiry_date,
  DATE(created_at)
)
WHERE company_id IS NOT NULL;

-- التحقق من الـ indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'daily_excel_logs'
  AND indexname LIKE '%unique%';
