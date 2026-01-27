-- إعادة تعيين جميع التنبيهات لتصبح غير معالجة
UPDATE daily_excel_logs
SET processed_at = NULL
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- عرض الإحصائيات بعد التحديث
SELECT 
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as unprocessed_alerts,
  COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_alerts
FROM daily_excel_logs;
