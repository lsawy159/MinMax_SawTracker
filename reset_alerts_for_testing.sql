-- إعادة ضبط processed_at لآخر 15 تنبيه للاختبار
-- نفذ هذا في Supabase SQL Editor

UPDATE daily_excel_logs 
SET processed_at = NULL 
WHERE id IN (
  SELECT id 
  FROM daily_excel_logs 
  ORDER BY created_at DESC 
  LIMIT 15
);

-- للتحقق
SELECT 
  COUNT(*) as unprocessed_count,
  COUNT(DISTINCT alert_type) as alert_types_count
FROM daily_excel_logs 
WHERE processed_at IS NULL;
