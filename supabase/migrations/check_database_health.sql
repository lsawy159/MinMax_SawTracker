-- =====================================================
-- DATABASE HEALTH CHECK & CLEANUP SCRIPT
-- Date: 2025-12-10
-- Purpose: Comprehensive database inspection and cleanup recommendations
-- =====================================================

-- =====================================================
-- SECTION 1: Check All Tables
-- =====================================================
SELECT 
  '=== ALL TABLES ===' as check_type,
  table_schema,
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- =====================================================
-- SECTION 2: Check system_settings (Current Configuration)
-- =====================================================
SELECT 
  '=== SYSTEM SETTINGS ===' as check_type,
  setting_key,
  setting_value,
  updated_at,
  CASE 
    WHEN setting_key = 'status_thresholds' THEN 'Companies Status Thresholds ✓'
    WHEN setting_key = 'notification_thresholds' THEN 'Employees Notification Thresholds ✓'
    ELSE 'Other Setting'
  END as description
FROM system_settings
ORDER BY setting_key;

-- =====================================================
-- SECTION 3: Check Companies Table Columns
-- =====================================================
SELECT 
  '=== COMPANIES TABLE COLUMNS ===' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    -- Valid columns
    WHEN column_name IN (
      'id', 'name', 'commercial_registration_number', 
      'commercial_registration_expiry', 'social_insurance_expiry',
      'ending_subscription_power_date', 'ending_subscription_moqeem_date',
      'max_employees', 'notes', 'exemptions', 'company_type',
      'created_at', 'updated_at', 'user_id'
    ) THEN '✓ Valid'
    
    -- Deprecated/Old columns that should be removed
    WHEN column_name IN (
      'insurance_subscription_expiry',  -- OLD: replaced by social_insurance_expiry
      'tax_number',                      -- OLD: removed
      'government_documents',            -- OLD: removed
      'muqeem_expiry'                    -- OLD: removed
    ) THEN '⚠️ DEPRECATED - Should be removed'
    
    ELSE '⚠️ Unknown column'
  END as status
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY 
  CASE 
    WHEN column_name IN ('id', 'name', 'commercial_registration_number') THEN 1
    WHEN column_name LIKE '%expiry%' OR column_name LIKE '%date%' THEN 2
    ELSE 3
  END,
  column_name;

-- =====================================================
-- SECTION 4: Check Employees Table Columns
-- =====================================================
SELECT 
  '=== EMPLOYEES TABLE COLUMNS ===' as check_type,
  column_name,
  data_type,
  is_nullable,
  CASE 
    -- Valid columns
    WHEN column_name IN (
      'id', 'name', 'nationality', 'profession', 'passport_number',
      'iqama_number', 'border_number', 'company_id', 'project_id',
      'contract_expiry', 'residence_expiry', 'health_insurance_expiry',
      'hired_worker_contract_expiry', 'notes',
      'created_at', 'updated_at', 'user_id'
    ) THEN '✓ Valid'
    
    -- Deprecated columns
    WHEN column_name IN (
      'insurance_expiry',           -- OLD: replaced by health_insurance_expiry
      'health_insurance_number',    -- OLD: removed
      'health_insurance_provider',  -- OLD: removed
      'muqeem_expiry'              -- OLD: removed
    ) THEN '⚠️ DEPRECATED - Should be removed'
    
    ELSE '⚠️ Unknown column'
  END as status
FROM information_schema.columns
WHERE table_name = 'employees'
ORDER BY 
  CASE 
    WHEN column_name IN ('id', 'name', 'company_id', 'project_id') THEN 1
    WHEN column_name LIKE '%expiry%' OR column_name LIKE '%date%' THEN 2
    ELSE 3
  END,
  column_name;

-- =====================================================
-- SECTION 5: Check for Orphaned Data
-- =====================================================

-- Check employees without valid company
SELECT 
  '=== ORPHANED EMPLOYEES (No Company) ===' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ No orphaned employees'
    ELSE '⚠️ Found orphaned employees'
  END as status
FROM employees e
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = e.company_id);

-- Check employees without valid project
SELECT 
  '=== EMPLOYEES WITHOUT PROJECT ===' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ Some employees have no project'
    ELSE '✓ All employees have projects'
  END as status
FROM employees
WHERE project_id IS NULL;

-- =====================================================
-- SECTION 6: Check Indexes
-- =====================================================
SELECT 
  '=== DATABASE INDEXES ===' as check_type,
  schemaname,
  tablename,
  indexname,
  indexdef,
  CASE 
    WHEN indexname LIKE '%_pkey' THEN '✓ Primary Key'
    WHEN indexname LIKE '%company_id%' THEN '✓ Foreign Key Index'
    WHEN indexname LIKE '%user_id%' THEN '✓ Foreign Key Index'
    WHEN indexname LIKE '%project_id%' THEN '✓ Foreign Key Index'
    WHEN indexname LIKE '%expiry%' THEN '✓ Performance Index'
    ELSE '⚠️ Review needed'
  END as index_type
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'employees', 'projects', 'system_settings')
ORDER BY tablename, indexname;

-- =====================================================
-- SECTION 7: Check RLS Policies
-- =====================================================
SELECT 
  '=== ROW LEVEL SECURITY POLICIES ===' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- SECTION 8: Check Foreign Key Constraints
-- =====================================================
SELECT 
  '=== FOREIGN KEY CONSTRAINTS ===' as check_type,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  CASE 
    WHEN tc.table_name = 'employees' AND kcu.column_name = 'company_id' THEN '✓ Valid'
    WHEN tc.table_name = 'employees' AND kcu.column_name = 'project_id' THEN '✓ Valid'
    WHEN tc.table_name = 'employees' AND kcu.column_name = 'user_id' THEN '✓ Valid'
    WHEN tc.table_name = 'companies' AND kcu.column_name = 'user_id' THEN '✓ Valid'
    ELSE '⚠️ Review needed'
  END as status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- SECTION 9: Check Data Statistics
-- =====================================================
SELECT 
  '=== DATA STATISTICS ===' as check_type,
  'companies' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN commercial_registration_expiry IS NULL THEN 1 END) as missing_commercial_reg,
  COUNT(CASE WHEN social_insurance_expiry IS NULL THEN 1 END) as missing_social_insurance,
  COUNT(CASE WHEN ending_subscription_power_date IS NULL THEN 1 END) as missing_power_subscription,
  COUNT(CASE WHEN ending_subscription_moqeem_date IS NULL THEN 1 END) as missing_moqeem_subscription
FROM companies
UNION ALL
SELECT 
  '=== DATA STATISTICS ===' as check_type,
  'employees' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN contract_expiry IS NULL THEN 1 END) as missing_contract,
  COUNT(CASE WHEN residence_expiry IS NULL THEN 1 END) as missing_residence,
  COUNT(CASE WHEN health_insurance_expiry IS NULL THEN 1 END) as missing_health_insurance,
  COUNT(CASE WHEN hired_worker_contract_expiry IS NULL THEN 1 END) as missing_hired_worker_contract
FROM employees;

-- =====================================================
-- SECTION 10: Check for Unused/Old Settings
-- =====================================================
SELECT 
  '=== POTENTIALLY UNUSED SETTINGS ===' as check_type,
  setting_key,
  CASE 
    WHEN setting_key IN ('status_thresholds', 'notification_thresholds') THEN '✓ Currently in use'
    WHEN setting_key LIKE '%critical%' THEN '⚠️ OLD terminology - should use urgent instead'
    WHEN setting_key LIKE '%insurance_subscription%' THEN '⚠️ OLD field name - should use social_insurance'
    ELSE '⚠️ Review if still needed'
  END as status,
  setting_value,
  updated_at
FROM system_settings
ORDER BY updated_at DESC;

-- =====================================================
-- SECTION 11: Storage/Disk Usage
-- =====================================================
SELECT 
  '=== TABLE SIZES ===' as check_type,
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- SECTION 12: Summary & Recommendations
-- =====================================================
SELECT 
  '=== CLEANUP RECOMMENDATIONS ===' as section,
  recommendation,
  priority,
  sql_command
FROM (
  SELECT 
    1 as order_num,
    'Remove deprecated columns from companies table' as recommendation,
    'MEDIUM' as priority,
    'ALTER TABLE companies DROP COLUMN IF EXISTS insurance_subscription_expiry, DROP COLUMN IF EXISTS tax_number, DROP COLUMN IF EXISTS government_documents, DROP COLUMN IF EXISTS muqeem_expiry;' as sql_command
  UNION ALL
  SELECT 
    2,
    'Remove deprecated columns from employees table',
    'MEDIUM',
    'ALTER TABLE employees DROP COLUMN IF EXISTS insurance_expiry, DROP COLUMN IF EXISTS health_insurance_number, DROP COLUMN IF EXISTS health_insurance_provider, DROP COLUMN IF EXISTS muqeem_expiry;'
  UNION ALL
  SELECT 
    3,
    'Clean up old settings with critical terminology',
    'LOW',
    'DELETE FROM system_settings WHERE setting_key LIKE ''%critical%'';'
  UNION ALL
  SELECT 
    4,
    'Verify all employees have valid company references',
    'HIGH',
    'SELECT * FROM employees WHERE company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM companies WHERE id = employees.company_id);'
  UNION ALL
  SELECT 
    5,
    'Add missing indexes for performance',
    'LOW',
    '-- Check indexes section above for missing indexes'
) as recommendations
ORDER BY order_num;

-- =====================================================
-- END OF HEALTH CHECK
-- =====================================================
