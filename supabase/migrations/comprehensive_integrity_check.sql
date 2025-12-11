-- =====================================================
-- COMPREHENSIVE DATABASE INTEGRITY CHECK
-- Date: 2025-12-10
-- Purpose: Complete validation of database vs code consistency
-- =====================================================

-- =====================================================
-- PART 1: FIELD NAMING CONSISTENCY CHECK
-- =====================================================

-- Check Companies Table Field Names
SELECT 
  '=== COMPANIES FIELD NAMING AUDIT ===' as check_type,
  column_name,
  data_type,
  CASE 
    -- ✅ Current correct fields used in code
    WHEN column_name IN (
      'id', 'name', 'commercial_registration_expiry',
      'social_insurance_expiry', 'social_insurance_number', 'social_insurance_status',
      'commercial_registration_status',
      'ending_subscription_power_date', 'ending_subscription_moqeem_date',
      'max_employees', 'employee_count', 'notes', 'exemptions', 'company_type',
      'created_at', 'updated_at', 'user_id',
      'unified_number', 'labor_subscription_number', 'additional_fields'
    ) THEN '✅ CORRECT - Used in code'
    
    -- ⚠️ Old/deprecated fields that should NOT exist
    WHEN column_name IN (
      'insurance_subscription_expiry',  -- OLD: should be social_insurance_expiry
      'insurance_subscription_status',  -- OLD: should be social_insurance_status
      'tax_number',                     -- REMOVED
      'government_documents',           -- REMOVED
      'muqeem_expiry'                  -- REMOVED
    ) THEN '❌ DEPRECATED - Should be removed'
    
    ELSE '⚠️ UNKNOWN - Not documented in code'
  END as field_status,
  
  CASE 
    WHEN column_name = 'insurance_subscription_expiry' THEN 'Use: social_insurance_expiry'
    WHEN column_name = 'insurance_subscription_status' THEN 'Use: social_insurance_status'
    WHEN column_name IN ('tax_number', 'government_documents', 'muqeem_expiry') THEN 'Remove entirely'
    ELSE ''
  END as recommendation
FROM information_schema.columns
WHERE table_name = 'companies'
  AND table_schema = 'public'
ORDER BY 
  CASE 
    WHEN column_name IN ('id', 'name', 'commercial_registration_expiry') THEN 1
    WHEN column_name LIKE '%expiry%' OR column_name LIKE '%date%' THEN 2
    WHEN column_name LIKE '%status%' THEN 3
    ELSE 4
  END,
  column_name;

-- Check Employees Table Field Names
SELECT 
  '=== EMPLOYEES FIELD NAMING AUDIT ===' as check_type,
  column_name,
  data_type,
  CASE 
    -- ✅ Current correct fields used in code
    WHEN column_name IN (
      'id', 'name', 'company_id', 'project_id', 'project_name',
      'nationality', 'profession', 'passport_number', 'residence_number',
      'birth_date', 'phone', 'joining_date', 'bank_account', 'salary',
      'contract_expiry', 'residence_expiry', 
      'health_insurance_expiry',
      'hired_worker_contract_expiry',
      'residence_image_url', 'notes', 'additional_fields',
      'created_at', 'updated_at', 'user_id'
    ) THEN '✅ CORRECT - Used in code'
    
    -- ⚠️ Old/deprecated fields that should NOT exist
    WHEN column_name IN (
      'insurance_expiry',              -- OLD: should be health_insurance_expiry
      'health_insurance_number',       -- REMOVED
      'health_insurance_provider',     -- REMOVED
      'muqeem_expiry',                 -- REMOVED
      'ending_subscription_insurance_date'  -- OLD: should be health_insurance_expiry
    ) THEN '❌ DEPRECATED - Should be removed'
    
    WHEN column_name = 'iqama_number' THEN '⚠️ ALTERNATIVE - Use residence_number instead'
    WHEN column_name = 'border_number' THEN '⚠️ CHECK - Verify if still needed'
    
    ELSE '⚠️ UNKNOWN - Not documented in code'
  END as field_status,
  
  CASE 
    WHEN column_name = 'insurance_expiry' THEN 'Use: health_insurance_expiry'
    WHEN column_name = 'ending_subscription_insurance_date' THEN 'Use: health_insurance_expiry'
    WHEN column_name IN ('health_insurance_number', 'health_insurance_provider', 'muqeem_expiry') THEN 'Remove entirely'
    WHEN column_name = 'iqama_number' THEN 'Use residence_number instead'
    ELSE ''
  END as recommendation
FROM information_schema.columns
WHERE table_name = 'employees'
  AND table_schema = 'public'
ORDER BY 
  CASE 
    WHEN column_name IN ('id', 'name', 'company_id', 'project_id') THEN 1
    WHEN column_name LIKE '%expiry%' OR column_name LIKE '%date%' THEN 2
    ELSE 3
  END,
  column_name;

-- =====================================================
-- PART 2: DATA CONSISTENCY CHECKS
-- =====================================================

-- Check for data in old vs new field names (Companies)
DO $$
DECLARE
  old_insurance_count INTEGER;
  new_insurance_count INTEGER;
  mismatch_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== COMPANIES DATA MIGRATION CHECK ===';
  
  -- Check if old column exists and has data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'insurance_subscription_expiry'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM companies WHERE insurance_subscription_expiry IS NOT NULL' INTO old_insurance_count;
    RAISE NOTICE '⚠️ OLD FIELD (insurance_subscription_expiry): % records with data', old_insurance_count;
  ELSE
    old_insurance_count := 0;
    RAISE NOTICE '✓ OLD FIELD (insurance_subscription_expiry): Does not exist';
  END IF;
  
  -- Check new column
  SELECT COUNT(*) INTO new_insurance_count
  FROM companies 
  WHERE social_insurance_expiry IS NOT NULL;
  
  RAISE NOTICE '✓ NEW FIELD (social_insurance_expiry): % records with data', new_insurance_count;
  
  IF old_insurance_count > 0 AND new_insurance_count = 0 THEN
    RAISE NOTICE '❌ CRITICAL: Data exists in old field but not migrated to new field!';
  ELSIF old_insurance_count > 0 AND new_insurance_count > 0 THEN
    RAISE NOTICE '⚠️ WARNING: Data exists in both old and new fields - verify consistency';
  ELSIF old_insurance_count = 0 AND new_insurance_count > 0 THEN
    RAISE NOTICE '✓ GOOD: Using new field correctly';
  END IF;
END $$;

-- Check for data in old vs new field names (Employees)
DO $$
DECLARE
  old_insurance_count INTEGER;
  new_insurance_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== EMPLOYEES DATA MIGRATION CHECK ===';
  
  -- Check if old column exists and has data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'insurance_expiry'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM employees WHERE insurance_expiry IS NOT NULL' INTO old_insurance_count;
    RAISE NOTICE '⚠️ OLD FIELD (insurance_expiry): % records with data', old_insurance_count;
  ELSE
    old_insurance_count := 0;
    RAISE NOTICE '✓ OLD FIELD (insurance_expiry): Does not exist';
  END IF;
  
  -- Check new column
  SELECT COUNT(*) INTO new_insurance_count
  FROM employees 
  WHERE health_insurance_expiry IS NOT NULL;
  
  RAISE NOTICE '✓ NEW FIELD (health_insurance_expiry): % records with data', new_insurance_count;
  
  IF old_insurance_count > 0 AND new_insurance_count = 0 THEN
    RAISE NOTICE '❌ CRITICAL: Data exists in old field but not migrated to new field!';
  ELSIF old_insurance_count > 0 AND new_insurance_count > 0 THEN
    RAISE NOTICE '⚠️ WARNING: Data exists in both old and new fields - verify consistency';
  END IF;
END $$;

-- =====================================================
-- PART 3: TERMINOLOGY CONSISTENCY (Status Values)
-- =====================================================

-- Check Companies Status Terminology
SELECT 
  '=== COMPANIES STATUS TERMINOLOGY ===' as check_type,
  'commercial_registration_status' as field_name,
  commercial_registration_status as status_value,
  COUNT(*) as count,
  CASE 
    WHEN commercial_registration_status IN ('منتهي', 'طارئ', 'عاجل', 'متوسط', 'ساري', 'غير محدد') THEN '✅ CORRECT'
    WHEN commercial_registration_status LIKE '%critical%' THEN '❌ OLD TERMINOLOGY - Use طارئ'
    WHEN commercial_registration_status LIKE '%urgent%' THEN '❌ ENGLISH - Should be Arabic'
    ELSE '⚠️ UNKNOWN STATUS'
  END as status_validation
FROM companies
WHERE commercial_registration_status IS NOT NULL
GROUP BY commercial_registration_status
ORDER BY COUNT(*) DESC;

-- Check if using old "critical" terminology
SELECT 
  '=== CHECK OLD CRITICAL TERMINOLOGY ===' as check_type,
  setting_key,
  setting_value,
  '❌ Contains old terminology' as issue
FROM system_settings
WHERE setting_key LIKE '%critical%'
   OR setting_value::text LIKE '%critical%';

-- =====================================================
-- PART 4: THRESHOLD CONFIGURATION CONSISTENCY
-- =====================================================

-- Check system_settings for threshold configuration
SELECT 
  '=== THRESHOLD SETTINGS AUDIT ===' as check_type,
  setting_key,
  jsonb_pretty(setting_value) as configuration,
  updated_at,
  CASE 
    WHEN setting_key = 'status_thresholds' THEN 
      CASE 
        WHEN setting_value ? 'commercial_reg' THEN '✅ Has commercial_reg'
        ELSE '❌ Missing commercial_reg'
      END
    WHEN setting_key = 'notification_thresholds' THEN
      CASE 
        WHEN setting_value ? 'residence' THEN '✅ Has residence'
        ELSE '❌ Missing residence'
      END
    ELSE 'N/A'
  END as validation
FROM system_settings
WHERE setting_key IN ('status_thresholds', 'notification_thresholds')
ORDER BY setting_key;

-- Check threshold keys match expected structure
SELECT 
  '=== THRESHOLD KEYS VALIDATION ===' as check_type,
  setting_key,
  threshold_key,
  CASE 
    WHEN setting_key = 'status_thresholds' AND threshold_key IN ('commercial_reg', 'social_insurance', 'power_subscription', 'moqeem_subscription') THEN '✅ CORRECT'
    WHEN setting_key = 'notification_thresholds' AND threshold_key IN ('residence', 'contract', 'health_insurance', 'hired_worker_contract') THEN '✅ CORRECT'
    WHEN setting_key IN ('status_thresholds', 'notification_thresholds') THEN '⚠️ UNKNOWN KEY'
    ELSE '⚠️ UNKNOWN SETTING'
  END as key_validation
FROM system_settings
CROSS JOIN LATERAL jsonb_object_keys(setting_value) AS threshold_key
WHERE setting_key IN ('status_thresholds', 'notification_thresholds')
ORDER BY setting_key, threshold_key;

-- =====================================================
-- PART 5: REFERENTIAL INTEGRITY
-- =====================================================

-- Check employees with invalid company references
SELECT 
  '=== ORPHANED EMPLOYEES ===' as check_type,
  e.id,
  e.name,
  e.company_id as invalid_company_id,
  '❌ Company does not exist' as issue
FROM employees e
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = e.company_id)
LIMIT 10;

-- Check employees with invalid project references
SELECT 
  '=== ORPHANED EMPLOYEE PROJECTS ===' as check_type,
  e.id,
  e.name,
  e.project_id as invalid_project_id,
  '⚠️ Project does not exist' as issue
FROM employees e
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = e.project_id)
LIMIT 10;

-- =====================================================
-- PART 6: CRITICAL EXPIRY DATE FIELDS AUDIT
-- =====================================================

-- Companies: Check all expiry date fields
SELECT 
  '=== COMPANIES EXPIRY DATES ===' as check_type,
  COUNT(*) as total_companies,
  COUNT(commercial_registration_expiry) as has_commercial_reg,
  COUNT(social_insurance_expiry) as has_social_insurance,
  COUNT(ending_subscription_power_date) as has_power_subscription,
  COUNT(ending_subscription_moqeem_date) as has_moqeem_subscription,
  ROUND(100.0 * COUNT(commercial_registration_expiry) / NULLIF(COUNT(*), 0), 1) as commercial_reg_percent,
  ROUND(100.0 * COUNT(social_insurance_expiry) / NULLIF(COUNT(*), 0), 1) as social_insurance_percent
FROM companies;

-- Employees: Check all expiry date fields
SELECT 
  '=== EMPLOYEES EXPIRY DATES ===' as check_type,
  COUNT(*) as total_employees,
  COUNT(contract_expiry) as has_contract,
  COUNT(residence_expiry) as has_residence,
  COUNT(health_insurance_expiry) as has_health_insurance,
  COUNT(hired_worker_contract_expiry) as has_hired_worker_contract,
  ROUND(100.0 * COUNT(contract_expiry) / NULLIF(COUNT(*), 0), 1) as contract_percent,
  ROUND(100.0 * COUNT(residence_expiry) / NULLIF(COUNT(*), 0), 1) as residence_percent,
  ROUND(100.0 * COUNT(health_insurance_expiry) / NULLIF(COUNT(*), 0), 1) as health_insurance_percent
FROM employees;

-- =====================================================
-- PART 7: FINAL SUMMARY & RECOMMENDATIONS
-- =====================================================

DO $$
DECLARE
  companies_deprecated_count INTEGER;
  employees_deprecated_count INTEGER;
  orphaned_employees_count INTEGER;
  old_settings_count INTEGER;
  threshold_settings_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '              FINAL INTEGRITY CHECK SUMMARY';
  RAISE NOTICE '=================================================================';
  
  -- Count deprecated columns in companies
  SELECT COUNT(*) INTO companies_deprecated_count
  FROM information_schema.columns
  WHERE table_name = 'companies'
    AND column_name IN (
      'insurance_subscription_expiry',
      'insurance_subscription_status',
      'tax_number',
      'government_documents',
      'muqeem_expiry'
    );
  
  -- Count deprecated columns in employees
  SELECT COUNT(*) INTO employees_deprecated_count
  FROM information_schema.columns
  WHERE table_name = 'employees'
    AND column_name IN (
      'insurance_expiry',
      'health_insurance_number',
      'health_insurance_provider',
      'muqeem_expiry',
      'ending_subscription_insurance_date'
    );
  
  -- Count orphaned employees
  SELECT COUNT(*) INTO orphaned_employees_count
  FROM employees
  WHERE company_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM companies WHERE id = employees.company_id);
  
  -- Count old settings
  SELECT COUNT(*) INTO old_settings_count
  FROM system_settings
  WHERE setting_key LIKE '%critical%';
  
  -- Count threshold settings
  SELECT COUNT(*) INTO threshold_settings_count
  FROM system_settings
  WHERE setting_key IN ('status_thresholds', 'notification_thresholds');
  
  RAISE NOTICE '';
  RAISE NOTICE '1. FIELD NAMING:';
  IF companies_deprecated_count > 0 THEN
    RAISE NOTICE '   ❌ Companies table has % deprecated columns', companies_deprecated_count;
  ELSE
    RAISE NOTICE '   ✅ Companies table - All fields use correct naming';
  END IF;
  
  IF employees_deprecated_count > 0 THEN
    RAISE NOTICE '   ❌ Employees table has % deprecated columns', employees_deprecated_count;
  ELSE
    RAISE NOTICE '   ✅ Employees table - All fields use correct naming';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '2. DATA INTEGRITY:';
  IF orphaned_employees_count > 0 THEN
    RAISE NOTICE '   ❌ Found % orphaned employees without valid company', orphaned_employees_count;
  ELSE
    RAISE NOTICE '   ✅ All employees have valid company references';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '3. CONFIGURATION:';
  IF threshold_settings_count = 2 THEN
    RAISE NOTICE '   ✅ Threshold settings configured (status_thresholds, notification_thresholds)';
  ELSE
    RAISE NOTICE '   ❌ Missing threshold settings (found % of 2)', threshold_settings_count;
  END IF;
  
  IF old_settings_count > 0 THEN
    RAISE NOTICE '   ⚠️ Found % old settings with "critical" terminology', old_settings_count;
  ELSE
    RAISE NOTICE '   ✅ No old "critical" terminology in settings';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  
  -- Overall status
  IF companies_deprecated_count = 0 AND 
     employees_deprecated_count = 0 AND 
     orphaned_employees_count = 0 AND
     threshold_settings_count = 2 AND
     old_settings_count = 0 THEN
    RAISE NOTICE '               ✅ DATABASE FULLY CONSISTENT WITH CODE';
  ELSE
    RAISE NOTICE '               ⚠️ ACTION REQUIRED - See issues above';
  END IF;
  
  RAISE NOTICE '=================================================================';
END $$;

-- =====================================================
-- END OF INTEGRITY CHECK
-- =====================================================
