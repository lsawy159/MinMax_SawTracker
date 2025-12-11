-- =====================================================
-- CLEANUP DEPRECATED COLUMNS MIGRATION
-- Date: 2025-12-10
-- Purpose: Remove old/unused columns and settings safely
-- Priority: Execute in order (HIGH → MEDIUM → LOW)
-- =====================================================

-- =====================================================
-- STEP 1: HIGH PRIORITY - Verify Data Integrity First
-- =====================================================
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  -- Check for orphaned employees (without valid company)
  SELECT COUNT(*) INTO orphaned_count
  FROM employees 
  WHERE company_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM companies WHERE id = employees.company_id);
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % orphaned employees without valid company references', orphaned_count;
    RAISE NOTICE 'Please fix these records before proceeding with cleanup';
    -- List them for reference
    RAISE NOTICE 'Orphaned employee IDs: %', (
      SELECT string_agg(id::text, ', ')
      FROM employees 
      WHERE company_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM companies WHERE id = employees.company_id)
    );
  ELSE
    RAISE NOTICE '✓ No orphaned employees found - Data integrity OK';
  END IF;
END $$;

-- =====================================================
-- STEP 2: BACKUP CHECK - Verify columns exist before dropping
-- =====================================================
DO $$
DECLARE
  companies_deprecated_cols TEXT[];
  employees_deprecated_cols TEXT[];
  col_name TEXT;
BEGIN
  -- Check companies table deprecated columns
  SELECT ARRAY_AGG(column_name)
  INTO companies_deprecated_cols
  FROM information_schema.columns
  WHERE table_name = 'companies'
    AND column_name IN (
      'insurance_subscription_expiry',
      'tax_number',
      'government_documents',
      'muqeem_expiry'
    );
  
  -- Check employees table deprecated columns
  SELECT ARRAY_AGG(column_name)
  INTO employees_deprecated_cols
  FROM information_schema.columns
  WHERE table_name = 'employees'
    AND column_name IN (
      'insurance_expiry',
      'health_insurance_number',
      'health_insurance_provider',
      'muqeem_expiry'
    );
  
  -- Report findings
  IF companies_deprecated_cols IS NOT NULL THEN
    RAISE NOTICE '=== COMPANIES TABLE - Deprecated columns found ===';
    FOREACH col_name IN ARRAY companies_deprecated_cols
    LOOP
      RAISE NOTICE '  - %', col_name;
    END LOOP;
  ELSE
    RAISE NOTICE '✓ COMPANIES TABLE - No deprecated columns found';
  END IF;
  
  IF employees_deprecated_cols IS NOT NULL THEN
    RAISE NOTICE '=== EMPLOYEES TABLE - Deprecated columns found ===';
    FOREACH col_name IN ARRAY employees_deprecated_cols
    LOOP
      RAISE NOTICE '  - %', col_name;
    END LOOP;
  ELSE
    RAISE NOTICE '✓ EMPLOYEES TABLE - No deprecated columns found';
  END IF;
END $$;

-- =====================================================
-- STEP 3: MEDIUM PRIORITY - Remove Deprecated Columns from Companies
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== Starting Companies Table Cleanup ===';
  
  -- Drop insurance_subscription_expiry (replaced by social_insurance_expiry)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'insurance_subscription_expiry'
  ) THEN
    ALTER TABLE companies DROP COLUMN insurance_subscription_expiry;
    RAISE NOTICE '✓ Dropped insurance_subscription_expiry';
  ELSE
    RAISE NOTICE '  - insurance_subscription_expiry already removed';
  END IF;
  
  -- Drop tax_number (no longer needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'tax_number'
  ) THEN
    ALTER TABLE companies DROP COLUMN tax_number;
    RAISE NOTICE '✓ Dropped tax_number';
  ELSE
    RAISE NOTICE '  - tax_number already removed';
  END IF;
  
  -- Drop government_documents (no longer needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'government_documents'
  ) THEN
    ALTER TABLE companies DROP COLUMN government_documents;
    RAISE NOTICE '✓ Dropped government_documents';
  ELSE
    RAISE NOTICE '  - government_documents already removed';
  END IF;
  
  -- Drop muqeem_expiry (no longer needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'muqeem_expiry'
  ) THEN
    ALTER TABLE companies DROP COLUMN muqeem_expiry;
    RAISE NOTICE '✓ Dropped muqeem_expiry';
  ELSE
    RAISE NOTICE '  - muqeem_expiry already removed';
  END IF;
  
  RAISE NOTICE '=== Companies Table Cleanup Complete ===';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in companies cleanup: %', SQLERRM;
    RAISE;
END $$;

-- =====================================================
-- STEP 4: MEDIUM PRIORITY - Remove Deprecated Columns from Employees
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=== Starting Employees Table Cleanup ===';
  
  -- Drop insurance_expiry (replaced by health_insurance_expiry)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'insurance_expiry'
  ) THEN
    ALTER TABLE employees DROP COLUMN insurance_expiry;
    RAISE NOTICE '✓ Dropped insurance_expiry';
  ELSE
    RAISE NOTICE '  - insurance_expiry already removed';
  END IF;
  
  -- Drop health_insurance_number (no longer needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'health_insurance_number'
  ) THEN
    ALTER TABLE employees DROP COLUMN health_insurance_number;
    RAISE NOTICE '✓ Dropped health_insurance_number';
  ELSE
    RAISE NOTICE '  - health_insurance_number already removed';
  END IF;
  
  -- Drop health_insurance_provider (no longer needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'health_insurance_provider'
  ) THEN
    ALTER TABLE employees DROP COLUMN health_insurance_provider;
    RAISE NOTICE '✓ Dropped health_insurance_provider';
  ELSE
    RAISE NOTICE '  - health_insurance_provider already removed';
  END IF;
  
  -- Drop muqeem_expiry (no longer needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'muqeem_expiry'
  ) THEN
    ALTER TABLE employees DROP COLUMN muqeem_expiry;
    RAISE NOTICE '✓ Dropped muqeem_expiry';
  ELSE
    RAISE NOTICE '  - muqeem_expiry already removed';
  END IF;
  
  RAISE NOTICE '=== Employees Table Cleanup Complete ===';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in employees cleanup: %', SQLERRM;
    RAISE;
END $$;

-- =====================================================
-- STEP 5: LOW PRIORITY - Clean Up Old Settings
-- =====================================================
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '=== Starting System Settings Cleanup ===';
  
  -- Remove any settings with old "critical" terminology
  WITH deleted AS (
    DELETE FROM system_settings 
    WHERE setting_key LIKE '%critical%'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '✓ Removed % old settings with "critical" terminology', deleted_count;
  ELSE
    RAISE NOTICE '  - No old "critical" settings found';
  END IF;
  
  RAISE NOTICE '=== System Settings Cleanup Complete ===';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in settings cleanup: %', SQLERRM;
    RAISE;
END $$;

-- =====================================================
-- STEP 6: VERIFICATION - Confirm Cleanup Success
-- =====================================================
DO $$
DECLARE
  remaining_deprecated_companies INTEGER;
  remaining_deprecated_employees INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL VERIFICATION ===';
  
  -- Check companies table
  SELECT COUNT(*)
  INTO remaining_deprecated_companies
  FROM information_schema.columns
  WHERE table_name = 'companies'
    AND column_name IN (
      'insurance_subscription_expiry',
      'tax_number',
      'government_documents',
      'muqeem_expiry'
    );
  
  -- Check employees table
  SELECT COUNT(*)
  INTO remaining_deprecated_employees
  FROM information_schema.columns
  WHERE table_name = 'employees'
    AND column_name IN (
      'insurance_expiry',
      'health_insurance_number',
      'health_insurance_provider',
      'muqeem_expiry'
    );
  
  IF remaining_deprecated_companies = 0 THEN
    RAISE NOTICE '✓ Companies table - All deprecated columns removed successfully';
  ELSE
    RAISE NOTICE '⚠️ Companies table - Still has % deprecated columns', remaining_deprecated_companies;
  END IF;
  
  IF remaining_deprecated_employees = 0 THEN
    RAISE NOTICE '✓ Employees table - All deprecated columns removed successfully';
  ELSE
    RAISE NOTICE '⚠️ Employees table - Still has % deprecated columns', remaining_deprecated_employees;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== CLEANUP MIGRATION COMPLETED ===';
END $$;

-- =====================================================
-- STEP 7: Show Current Table Structure
-- =====================================================
SELECT 
  '=== COMPANIES TABLE - CURRENT COLUMNS ===' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

SELECT 
  '=== EMPLOYEES TABLE - CURRENT COLUMNS ===' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'employees'
ORDER BY ordinal_position;

-- =====================================================
-- END OF CLEANUP MIGRATION
-- =====================================================
