-- ==========================================
-- FIX: Prevent Duplicate Alerts in Excel Files
-- Run this in Supabase SQL Editor
-- ==========================================

-- Problem: Race condition causes duplicate alert insertions
-- Solution: Regular date column + trigger + unique constraint

-- Step 1: Add regular date column (not generated)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_excel_logs' AND column_name = 'alert_date'
  ) THEN
    ALTER TABLE daily_excel_logs ADD COLUMN alert_date DATE;
  END IF;
END $$;

-- Step 2: Populate existing data
UPDATE daily_excel_logs 
SET alert_date = created_at::date 
WHERE alert_date IS NULL;

-- Step 3: Create trigger to auto-populate alert_date on insert
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

-- Step 4: Clean existing duplicates (keep the oldest entry)
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
               alert_date
             ORDER BY created_at ASC
           ) AS row_num
    FROM daily_excel_logs
  ) t
  WHERE row_num > 1
);

-- Step 5: Create unique index to prevent future duplicates
-- For employee alerts: employee_id + alert_type + date
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_excel_logs_employee_unique
ON daily_excel_logs (employee_id, alert_type, alert_date)
WHERE employee_id IS NOT NULL AND company_id IS NULL;

-- For company alerts: company_id + alert_type + date
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_excel_logs_company_unique
ON daily_excel_logs (company_id, alert_type, alert_date)
WHERE company_id IS NOT NULL AND employee_id IS NULL;

-- Step 6: Add comments for documentation
COMMENT ON COLUMN daily_excel_logs.alert_date IS 
'Auto-populated date field for uniqueness constraint (populated by trigger)';

COMMENT ON INDEX idx_daily_excel_logs_employee_unique IS 
'Prevents duplicate employee alerts from being logged on the same day';

COMMENT ON INDEX idx_daily_excel_logs_company_unique IS 
'Prevents duplicate company alerts from being logged on the same day';

-- Step 7: Verification - Check for any remaining duplicates
SELECT 
  COALESCE(employee_id::text, company_id::text) as entity_id,
  alert_type,
  alert_date,
  COUNT(*) as duplicate_count
FROM daily_excel_logs
GROUP BY COALESCE(employee_id::text, company_id::text), alert_type, alert_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Expected: No rows returned (zero duplicates)
-- If you see this message with 0 rows: SUCCESS!
