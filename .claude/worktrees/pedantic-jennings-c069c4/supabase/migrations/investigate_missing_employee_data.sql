-- =====================================================
-- MISSING DATA INVESTIGATION
-- Date: 2025-12-10
-- Purpose: Find where the missing employee expiry data is
-- =====================================================

-- Check if data exists in old column names
DO $$
DECLARE
  old_insurance_exists BOOLEAN;
  old_insurance_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '           INVESTIGATING MISSING EMPLOYEE DATA';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  
  -- Check if old insurance_expiry column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'insurance_expiry'
  ) INTO old_insurance_exists;
  
  IF old_insurance_exists THEN
    EXECUTE 'SELECT COUNT(*) FROM employees WHERE insurance_expiry IS NOT NULL' 
    INTO old_insurance_count;
    
    RAISE NOTICE '⚠️ OLD COLUMN EXISTS: insurance_expiry';
    RAISE NOTICE '   Records with data: %', old_insurance_count;
    
    IF old_insurance_count > 0 THEN
      RAISE NOTICE '   ❌ CRITICAL: Health insurance data is in OLD column!';
      RAISE NOTICE '   Action: Need to migrate data to health_insurance_expiry';
    END IF;
  ELSE
    RAISE NOTICE '✓ Old column insurance_expiry does not exist';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- Show sample of employees with missing data
SELECT 
  '=== SAMPLE: Employees WITHOUT Contract Dates ===' as info,
  id,
  name,
  company_id,
  joining_date,
  residence_expiry,
  contract_expiry,
  health_insurance_expiry,
  hired_worker_contract_expiry
FROM employees
WHERE contract_expiry IS NULL
LIMIT 5;

SELECT 
  '=== SAMPLE: Employees WITH Contract Dates ===' as info,
  id,
  name,
  company_id,
  joining_date,
  residence_expiry,
  contract_expiry,
  health_insurance_expiry,
  hired_worker_contract_expiry
FROM employees
WHERE contract_expiry IS NOT NULL
LIMIT 5;

-- Check if there's a pattern in missing data
SELECT 
  '=== MISSING DATA ANALYSIS ===' as analysis_type,
  COUNT(*) as total_employees,
  COUNT(CASE WHEN contract_expiry IS NULL THEN 1 END) as missing_contract,
  COUNT(CASE WHEN health_insurance_expiry IS NULL THEN 1 END) as missing_health_insurance,
  COUNT(CASE WHEN hired_worker_contract_expiry IS NULL THEN 1 END) as missing_hired_worker,
  COUNT(CASE WHEN contract_expiry IS NULL 
            AND health_insurance_expiry IS NULL 
            AND hired_worker_contract_expiry IS NULL THEN 1 END) as missing_all_three,
  ROUND(100.0 * COUNT(CASE WHEN contract_expiry IS NULL 
                          AND health_insurance_expiry IS NULL 
                          AND hired_worker_contract_expiry IS NULL THEN 1 END) 
        / NULLIF(COUNT(*), 0), 1) as percent_missing_all
FROM employees;

-- Check additional_fields for possible data
SELECT 
  '=== CHECK ADDITIONAL_FIELDS ===' as check_type,
  id,
  name,
  additional_fields,
  CASE 
    WHEN additional_fields ? 'health_insurance_expiry' THEN '⚠️ Has health_insurance in additional_fields'
    WHEN additional_fields ? 'insurance_expiry' THEN '⚠️ Has insurance_expiry in additional_fields'
    WHEN additional_fields ? 'contract_expiry' THEN '⚠️ Has contract_expiry in additional_fields'
    ELSE 'No expiry data in additional_fields'
  END as finding
FROM employees
WHERE additional_fields IS NOT NULL
  AND (
    additional_fields ? 'health_insurance_expiry' OR
    additional_fields ? 'insurance_expiry' OR
    additional_fields ? 'contract_expiry' OR
    additional_fields ? 'hired_worker_contract_expiry'
  )
LIMIT 10;

-- Check all columns in employees table
SELECT 
  '=== ALL EMPLOYEES COLUMNS ===' as info,
  column_name,
  data_type,
  CASE 
    WHEN column_name LIKE '%insurance%' THEN '🔍 Insurance related'
    WHEN column_name LIKE '%contract%' THEN '🔍 Contract related'
    WHEN column_name LIKE '%expiry%' THEN '🔍 Expiry date'
    ELSE ''
  END as category
FROM information_schema.columns
WHERE table_name = 'employees'
  AND table_schema = 'public'
ORDER BY 
  CASE 
    WHEN column_name LIKE '%expiry%' THEN 1
    WHEN column_name LIKE '%date%' THEN 2
    ELSE 3
  END,
  column_name;

-- Final recommendations
DO $$
DECLARE
  missing_contract INTEGER;
  missing_health INTEGER;
  missing_hired INTEGER;
  has_old_insurance BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '                    RECOMMENDATIONS';
  RAISE NOTICE '=================================================================';
  
  -- Count missing data
  SELECT 
    COUNT(CASE WHEN contract_expiry IS NULL THEN 1 END),
    COUNT(CASE WHEN health_insurance_expiry IS NULL THEN 1 END),
    COUNT(CASE WHEN hired_worker_contract_expiry IS NULL THEN 1 END)
  INTO missing_contract, missing_health, missing_hired
  FROM employees;
  
  -- Check old column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'insurance_expiry'
  ) INTO has_old_insurance;
  
  RAISE NOTICE '';
  RAISE NOTICE '1. CONTRACT DATES (contract_expiry):';
  IF missing_contract > 0 THEN
    RAISE NOTICE '   ⚠️ % employees missing contract expiry dates', missing_contract;
    RAISE NOTICE '   Action: Ask users to update employee records with contract dates';
  ELSE
    RAISE NOTICE '   ✅ All employees have contract dates';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '2. HEALTH INSURANCE (health_insurance_expiry):';
  IF missing_health > 0 THEN
    IF has_old_insurance THEN
      RAISE NOTICE '   ❌ % employees missing - Data might be in OLD column', missing_health;
      RAISE NOTICE '   Action: Run migration to move data from insurance_expiry to health_insurance_expiry';
    ELSE
      RAISE NOTICE '   ⚠️ % employees missing health insurance dates', missing_health;
      RAISE NOTICE '   Action: Ask users to add health insurance expiry dates';
    END IF;
  ELSE
    RAISE NOTICE '   ✅ All employees have health insurance dates';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '3. HIRED WORKER CONTRACT (hired_worker_contract_expiry):';
  IF missing_hired > 0 THEN
    RAISE NOTICE '   ⚠️ % employees missing hired worker contract dates', missing_hired;
    RAISE NOTICE '   Note: This field is optional - only for أجير employees';
    RAISE NOTICE '   Action: Update only for employees with أجير contracts';
  ELSE
    RAISE NOTICE '   ✅ All employees have hired worker contract dates';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
END $$;

-- =====================================================
-- END OF INVESTIGATION
-- =====================================================
