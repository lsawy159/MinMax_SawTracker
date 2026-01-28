-- ==========================================
-- FIX: Prevent Duplicate Alerts in Excel Files
-- Run this in Supabase SQL Editor
-- ==========================================

-- Problem: Race condition causes duplicate alert insertions
-- Solution: Add unique constraint to prevent duplicate alerts

-- Step 1: Clean existing duplicates (keep the oldest entry)
DELETE FROM daily_excel_logs
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY 
               COALESCE(employee_id::text, ''), 
               COALESCE(company_id::text, ''), 
               alert_type, 
               (created_at::date)
             ORDER BY created_at ASC
           ) AS row_num
    FROM daily_excel_logs
  ) t
  WHERE row_num > 1
);

-- Step 2: Create unique index to prevent future duplicates
-- For employee alerts: employee_id + alert_type + date
-- Using (created_at::date) instead of DATE() for immutability
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_excel_logs_employee_unique
ON daily_excel_logs (employee_id, alert_type, (created_at::date))
WHERE employee_id IS NOT NULL AND company_id IS NULL;

-- For company alerts: company_id + alert_type + date
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_excel_logs_company_unique
ON daily_excel_logs (company_id, alert_type, (created_at::date))
WHERE company_id IS NOT NULL AND employee_id IS NULL;

-- Step 3: Add comment for documentation
COMMENT ON INDEX idx_daily_excel_logs_employee_unique IS 
'Prevents duplicate employee alerts from being logged on the same day';

COMMENT ON INDEX idx_daily_excel_logs_company_unique IS 
'Prevents duplicate company alerts from being logged on the same day';

-- Verification: Check for any remaining duplicates
SELECT 
  COALESCE(employee_id::text, company_id::text) as entity_id,
  alert_type,
  (created_at::date) as alert_date,
  COUNT(*) as duplicate_count
FROM daily_excel_logs
GROUP BY COALESCE(employee_id::text, company_id::text), alert_type, (created_at::date)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Expected: No rows returned (zero duplicates)
