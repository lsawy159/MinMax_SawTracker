-- حذف التنبيهات المكررة (الاحتفاظ بأحدث نسخة فقط لكل تنبيه)
-- للموظفين
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, alert_type, expiry_date, DATE(created_at)
      ORDER BY created_at DESC
    ) as rn
  FROM daily_excel_logs
  WHERE employee_id IS NOT NULL
)
DELETE FROM daily_excel_logs
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- للشركات
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, alert_type, expiry_date, DATE(created_at)
      ORDER BY created_at DESC
    ) as rn
  FROM daily_excel_logs
  WHERE company_id IS NOT NULL
)
DELETE FROM daily_excel_logs
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- عرض إحصائيات بعد الحذف
SELECT 
  alert_type,
  COUNT(*) as total_alerts,
  COUNT(DISTINCT employee_id) as unique_employees,
  COUNT(DISTINCT company_id) as unique_companies
FROM daily_excel_logs
WHERE processed_at IS NULL
GROUP BY alert_type
ORDER BY total_alerts DESC;
