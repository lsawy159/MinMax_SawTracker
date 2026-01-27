-- فحص حالة التنبيهات في الجدول
SELECT 
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as unprocessed_alerts,
  COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_alerts,
  MAX(created_at) as latest_alert_date,
  MIN(created_at) as oldest_alert_date
FROM daily_excel_logs;

-- عرض آخر 10 سجلات
SELECT 
  id,
  employee_id,
  alert_type,
  created_at,
  processed_at,
  CASE WHEN processed_at IS NULL THEN 'غير معالج' ELSE 'معالج' END as status
FROM daily_excel_logs
ORDER BY created_at DESC
LIMIT 10;
