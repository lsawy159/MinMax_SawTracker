-- ==========================================
-- FIX: Prevent Duplicate Alerts in Excel Files
-- FINAL SOLUTION - Run this in Supabase SQL Editor
-- ==========================================

-- Problem: Duplicate alerts in Excel export (126 instead of 63)
-- Root cause: alert_date NULL values bypass unique constraint
-- Solution: Make alert_date NOT NULL + ensure all data populated

-- Step 1: Ensure alert_date column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_excel_logs' AND column_name = 'alert_date'
  ) THEN
    ALTER TABLE daily_excel_logs ADD COLUMN alert_date DATE;
  END IF;
END $$;

-- Step 2: Populate ALL missing alert_date values (CRITICAL!)
UPDATE daily_excel_logs 
SET alert_date = created_at::date 
WHERE alert_date IS NULL
  OR alert_date = CAST('1900-01-01' AS DATE);

-- Step 3: Verify all rows have alert_date
SELECT COUNT(*) as rows_without_date
FROM daily_excel_logs
WHERE alert_date IS NULL;
-- Expected: 0

-- Step 4: Make alert_date NOT NULL (prevent future NULLs)
ALTER TABLE daily_excel_logs
ALTER COLUMN alert_date SET NOT NULL;

-- Step 5: Create/replace trigger to auto-populate alert_date on insert
CREATE OR REPLACE FUNCTION set_alert_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.alert_date := NEW.created_at::date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_alert_date ON daily_excel_logs;
CREATE TRIGGER trigger_set_alert_date
  BEFORE INSERT ON daily_excel_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_alert_date();

-- Step 6: Delete ALL duplicates (aggressive cleaning)
DELETE FROM daily_excel_logs
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY 
               COALESCE(employee_id, 'null'), 
               COALESCE(company_id, 'null'), 
               alert_type, 
               alert_date
             ORDER BY created_at ASC
           ) AS row_num
    FROM daily_excel_logs
  ) t
  WHERE row_num > 1
);

-- Step 7: Create unique indexes (without WHERE clause to enforce strictly)
DROP INDEX IF EXISTS idx_daily_excel_logs_employee_unique;
DROP INDEX IF EXISTS idx_daily_excel_logs_company_unique;

CREATE UNIQUE INDEX idx_daily_excel_logs_employee_unique
ON daily_excel_logs (employee_id, alert_type, alert_date)
WHERE employee_id IS NOT NULL AND company_id IS NULL;

CREATE UNIQUE INDEX idx_daily_excel_logs_company_unique
ON daily_excel_logs (company_id, alert_type, alert_date)
WHERE company_id IS NOT NULL AND employee_id IS NULL;

-- Step 8: Final verification
SELECT 
  COALESCE(employee_id::text, company_id::text) as entity_id,
  alert_type,
  alert_date,
  COUNT(*) as count
FROM daily_excel_logs
GROUP BY COALESCE(employee_id::text, company_id::text), alert_type, alert_date
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Expected: SUCCESS (0 rows) - no duplicates remaining!
