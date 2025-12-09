-- ============================================
-- سكريبت التحقق من حالة الـ Indexes فقط
-- ============================================
-- شغّل هذا السكريبت للتحقق من الـ Indexes المطلوبة
-- ============================================

-- Indexes للـ companies
SELECT 
    'Indexes للـ companies' as section,
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as status,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'companies'
    AND indexname IN (
        'idx_companies_unified_number',
        'idx_companies_labor_subscription_number',
        'idx_companies_created_at'
    )
ORDER BY indexname;

-- Indexes للـ employees
SELECT 
    'Indexes للـ employees' as section,
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as status,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'employees'
    AND indexname IN (
        'idx_employees_residence_number',
        'idx_employees_company_id',
        'idx_employees_residence_expiry',
        'idx_employees_contract_expiry',
        'idx_employees_project_id'
    )
ORDER BY indexname;

-- Indexes للـ activity_log
SELECT 
    'Indexes للـ activity_log' as section,
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as status,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'activity_log'
    AND indexname IN (
        'idx_activity_log_user_id',
        'idx_activity_log_created_at',
        'idx_activity_log_entity_type_id'
    )
ORDER BY indexname;

-- Indexes للـ notifications
SELECT 
    'Indexes للـ notifications' as section,
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as status,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'notifications'
    AND indexname IN (
        'idx_notifications_user_id',
        'idx_notifications_is_read',
        'idx_notifications_created_at'
    )
ORDER BY indexname;

-- Indexes للـ user_sessions
SELECT 
    'Indexes للـ user_sessions' as section,
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as status,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'user_sessions'
    AND indexname IN (
        'idx_user_sessions_user_id',
        'idx_user_sessions_is_active',
        'idx_user_sessions_expires_at'
    )
ORDER BY indexname;

-- Indexes للـ read_alerts
SELECT 
    'Indexes للـ read_alerts' as section,
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as status,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'read_alerts'
    AND indexname IN (
        'idx_read_alerts_user_id',
        'idx_read_alerts_alert_id'
    )
ORDER BY indexname;

-- Indexes للـ projects
SELECT 
    'Indexes للـ projects' as section,
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as status,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'projects'
    AND indexname IN (
        'idx_projects_created_at'
    )
ORDER BY indexname;

-- ملخص شامل
SELECT 
    'ملخص الـ Indexes' as section,
    tablename as table_name,
    COUNT(*) as indexes_count,
    STRING_AGG(indexname, ', ' ORDER BY indexname) as indexes_list
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'employees', 'activity_log', 'notifications', 'user_sessions', 'read_alerts', 'projects')
    AND indexname LIKE 'idx_%'
GROUP BY tablename
ORDER BY tablename;

-- إجمالي عدد الـ Indexes المطلوبة
SELECT 
    'إجمالي' as section,
    COUNT(*) as total_indexes,
    COUNT(DISTINCT tablename) as tables_with_indexes
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'employees', 'activity_log', 'notifications', 'user_sessions', 'read_alerts', 'projects')
    AND indexname LIKE 'idx_%';

