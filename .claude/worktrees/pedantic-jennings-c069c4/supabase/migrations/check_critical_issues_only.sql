-- =====================================================
-- CRITICAL ISSUES ONLY CHECK
-- Date: 2025-12-10
-- Purpose: Check for REAL problems (not missing user data)
-- =====================================================

-- =====================================================
-- ISSUE 1: Check for deprecated columns still existing
-- =====================================================
SELECT 
  '=== CRITICAL: DEPRECATED COLUMNS STILL IN DATABASE ===' as issue_type,
  table_name,
  column_name,
  '❌ Should be removed' as action
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'companies' AND column_name IN (
      'insurance_subscription_expiry',
      'insurance_subscription_status',
      'tax_number',
      'government_documents',
      'muqeem_expiry'
    ))
    OR
    (table_name = 'employees' AND column_name IN (
      'insurance_expiry',
      'health_insurance_number',
      'health_insurance_provider',
      'muqeem_expiry',
      'ending_subscription_insurance_date'
    ))
  )
ORDER BY table_name, column_name;

-- =====================================================
-- ISSUE 2: Check for data in wrong/old columns
-- =====================================================
DO $$
DECLARE
  has_issues BOOLEAN := FALSE;
  old_company_insurance INTEGER := 0;
  old_employee_insurance INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CHECKING DATA IN WRONG COLUMNS ===';
  
  -- Check companies
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'insurance_subscription_expiry'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM companies WHERE insurance_subscription_expiry IS NOT NULL' 
    INTO old_company_insurance;
    
    IF old_company_insurance > 0 THEN
      RAISE NOTICE '❌ CRITICAL: % companies have data in OLD column (insurance_subscription_expiry)', old_company_insurance;
      has_issues := TRUE;
    END IF;
  END IF;
  
  -- Check employees
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'insurance_expiry'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM employees WHERE insurance_expiry IS NOT NULL' 
    INTO old_employee_insurance;
    
    IF old_employee_insurance > 0 THEN
      RAISE NOTICE '❌ CRITICAL: % employees have data in OLD column (insurance_expiry)', old_employee_insurance;
      has_issues := TRUE;
    END IF;
  END IF;
  
  IF NOT has_issues THEN
    RAISE NOTICE '✅ No data in old/wrong columns';
  END IF;
END $$;

-- =====================================================
-- ISSUE 3: Check for orphaned employees
-- =====================================================
SELECT 
  '=== CRITICAL: ORPHANED EMPLOYEES ===' as issue_type,
  COUNT(*) as orphaned_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '❌ Employees without valid company - Need fix'
    ELSE '✅ All employees have valid companies'
  END as status
FROM employees e
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = e.company_id);

-- If orphaned employees exist, show them
SELECT 
  '=== LIST OF ORPHANED EMPLOYEES ===' as info,
  id,
  name,
  company_id as invalid_company_id
FROM employees e
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = e.company_id)
LIMIT 10;

-- =====================================================
-- ISSUE 4: Check for old "critical" terminology in settings
-- =====================================================
SELECT 
  '=== CRITICAL: OLD TERMINOLOGY IN SETTINGS ===' as issue_type,
  setting_key,
  '❌ Contains old critical terminology' as issue
FROM system_settings
WHERE setting_key LIKE '%critical%'
   OR setting_value::text LIKE '%critical%';

-- =====================================================
-- ISSUE 5: Check threshold configuration
-- =====================================================
SELECT 
  '=== CONFIGURATION: THRESHOLD SETTINGS ===' as check_type,
  CASE 
    WHEN (SELECT COUNT(*) FROM system_settings 
          WHERE setting_key IN ('status_thresholds', 'notification_thresholds')) = 2 
    THEN '✅ Both threshold settings exist'
    ELSE '❌ Missing threshold settings'
  END as status,
  (SELECT COUNT(*) FROM system_settings 
   WHERE setting_key IN ('status_thresholds', 'notification_thresholds')) as settings_count;

-- =====================================================
-- ISSUE 6: Check for duplicate/inconsistent status terminology
-- =====================================================
SELECT 
  '=== CHECK: STATUS TERMINOLOGY ===' as check_type,
  commercial_registration_status,
  COUNT(*) as usage_count,
  CASE 
    WHEN commercial_registration_status IN ('منتهي', 'طارئ', 'عاجل', 'متوسط', 'ساري', 'غير محدد') THEN '✅ CORRECT'
    WHEN commercial_registration_status LIKE '%critical%' THEN '❌ OLD - Use طارئ instead'
    WHEN commercial_registration_status LIKE '%urgent%' THEN '❌ ENGLISH - Use Arabic'
    ELSE '⚠️ UNKNOWN - Check spelling'
  END as validation
FROM companies
WHERE commercial_registration_status IS NOT NULL
GROUP BY commercial_registration_status
HAVING commercial_registration_status NOT IN ('منتهي', 'طارئ', 'عاجل', 'متوسط', 'ساري', 'غير محدد')
ORDER BY COUNT(*) DESC;

-- =====================================================
-- ISSUE 7: Check for missing required columns
-- =====================================================
DO $$
DECLARE
  missing_columns TEXT := '';
  has_commercial_reg BOOLEAN;
  has_social_insurance BOOLEAN;
  has_contract_expiry BOOLEAN;
  has_residence_expiry BOOLEAN;
  has_health_insurance BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CHECKING REQUIRED COLUMNS ===';
  
  -- Check companies
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'commercial_registration_expiry'
  ) INTO has_commercial_reg;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'social_insurance_expiry'
  ) INTO has_social_insurance;
  
  -- Check employees
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'contract_expiry'
  ) INTO has_contract_expiry;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'residence_expiry'
  ) INTO has_residence_expiry;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'health_insurance_expiry'
  ) INTO has_health_insurance;
  
  -- Report
  IF NOT has_commercial_reg THEN
    RAISE NOTICE '❌ CRITICAL: Missing commercial_registration_expiry column in companies';
  ELSE
    RAISE NOTICE '✅ companies.commercial_registration_expiry exists';
  END IF;
  
  IF NOT has_social_insurance THEN
    RAISE NOTICE '❌ CRITICAL: Missing social_insurance_expiry column in companies';
  ELSE
    RAISE NOTICE '✅ companies.social_insurance_expiry exists';
  END IF;
  
  IF NOT has_contract_expiry THEN
    RAISE NOTICE '❌ CRITICAL: Missing contract_expiry column in employees';
  ELSE
    RAISE NOTICE '✅ employees.contract_expiry exists';
  END IF;
  
  IF NOT has_residence_expiry THEN
    RAISE NOTICE '❌ CRITICAL: Missing residence_expiry column in employees';
  ELSE
    RAISE NOTICE '✅ employees.residence_expiry exists';
  END IF;
  
  IF NOT has_health_insurance THEN
    RAISE NOTICE '❌ CRITICAL: Missing health_insurance_expiry column in employees';
  ELSE
    RAISE NOTICE '✅ employees.health_insurance_expiry exists';
  END IF;
END $$;

-- =====================================================
-- FINAL SUMMARY: REAL ISSUES ONLY
-- =====================================================
DO $$
DECLARE
  deprecated_cols INTEGER;
  orphaned_employees INTEGER;
  old_settings INTEGER;
  threshold_settings INTEGER;
  has_critical_issues BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '           REAL PROBLEMS SUMMARY (Excluding Empty Data)';
  RAISE NOTICE '=================================================================';
  
  -- Count deprecated columns
  SELECT COUNT(*) INTO deprecated_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'companies' AND column_name IN (
        'insurance_subscription_expiry', 'insurance_subscription_status',
        'tax_number', 'government_documents', 'muqeem_expiry'
      ))
      OR
      (table_name = 'employees' AND column_name IN (
        'insurance_expiry', 'health_insurance_number', 
        'health_insurance_provider', 'muqeem_expiry'
      ))
    );
  
  -- Count orphaned employees
  SELECT COUNT(*) INTO orphaned_employees
  FROM employees
  WHERE company_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM companies WHERE id = employees.company_id);
  
  -- Count old settings
  SELECT COUNT(*) INTO old_settings
  FROM system_settings
  WHERE setting_key LIKE '%critical%';
  
  -- Count threshold settings
  SELECT COUNT(*) INTO threshold_settings
  FROM system_settings
  WHERE setting_key IN ('status_thresholds', 'notification_thresholds');
  
  RAISE NOTICE '';
  RAISE NOTICE '1. DEPRECATED COLUMNS:';
  IF deprecated_cols > 0 THEN
    RAISE NOTICE '   ❌ Found % deprecated columns that should be removed', deprecated_cols;
    RAISE NOTICE '   Impact: Database bloat, confusion';
    RAISE NOTICE '   Action: Run cleanup migration to remove them';
    has_critical_issues := TRUE;
  ELSE
    RAISE NOTICE '   ✅ No deprecated columns';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '2. ORPHANED DATA:';
  IF orphaned_employees > 0 THEN
    RAISE NOTICE '   ❌ Found % employees without valid company reference', orphaned_employees;
    RAISE NOTICE '   Impact: Data corruption, reports will fail';
    RAISE NOTICE '   Action: Fix or delete these records';
    has_critical_issues := TRUE;
  ELSE
    RAISE NOTICE '   ✅ No orphaned employees';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '3. CONFIGURATION:';
  IF threshold_settings < 2 THEN
    RAISE NOTICE '   ❌ Missing threshold settings (found % of 2)', threshold_settings;
    RAISE NOTICE '   Impact: Dashboard may not show correct statuses';
    RAISE NOTICE '   Action: Run threshold migration';
    has_critical_issues := TRUE;
  ELSE
    RAISE NOTICE '   ✅ Threshold settings configured correctly';
  END IF;
  
  IF old_settings > 0 THEN
    RAISE NOTICE '   ⚠️ Found % settings with old "critical" terminology', old_settings;
    RAISE NOTICE '   Impact: Minor - old terminology not used';
    RAISE NOTICE '   Action: Clean up old settings';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '4. MISSING USER DATA (Not a problem):';
  RAISE NOTICE '   ℹ️ Some employees missing contract/insurance dates';
  RAISE NOTICE '   Status: Normal - User has not entered these yet';
  RAISE NOTICE '   Action: None - Fill in as needed';
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  
  IF NOT has_critical_issues THEN
    RAISE NOTICE '             ✅ NO CRITICAL ISSUES FOUND!';
    RAISE NOTICE '             Database is healthy and consistent with code';
  ELSE
    RAISE NOTICE '             ⚠️ FOUND CRITICAL ISSUES - ACTION REQUIRED';
  END IF;
  
  RAISE NOTICE '=================================================================';
END $$;

-- =====================================================
-- END OF CRITICAL ISSUES CHECK
-- =====================================================
