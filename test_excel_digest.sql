-- تفعيل 10 تنبيهات جديدة للاختبار
UPDATE daily_excel_logs 
SET processed_at = NULL 
WHERE id IN (
  SELECT id 
  FROM daily_excel_logs 
  ORDER BY created_at DESC 
  LIMIT 10
);

-- للتحقق من عدد التنبيهات غير المعالجة
SELECT COUNT(*) as unprocessed_count FROM daily_excel_logs WHERE processed_at IS NULL;
