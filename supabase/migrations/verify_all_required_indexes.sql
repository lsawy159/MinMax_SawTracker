-- ============================================
-- التحقق من وجود جميع الـ Indexes المطلوبة
-- ============================================
-- هذا السكريبت يتحقق من أن جميع الـ Indexes المطلوبة موجودة
-- ============================================

-- قائمة الـ Indexes المطلوبة (من 20250121_add_database_indexes.sql)
WITH required_indexes AS (
    SELECT 'companies' as table_name, 'idx_companies_unified_number' as index_name
    UNION ALL SELECT 'companies', 'idx_companies_labor_subscription_number'
    UNION ALL SELECT 'companies', 'idx_companies_created_at'
    UNION ALL SELECT 'employees', 'idx_employees_residence_number'
    UNION ALL SELECT 'employees', 'idx_employees_company_id'
    UNION ALL SELECT 'employees', 'idx_employees_residence_expiry'
    UNION ALL SELECT 'employees', 'idx_employees_contract_expiry'
    UNION ALL SELECT 'employees', 'idx_employees_project_id'
    UNION ALL SELECT 'activity_log', 'idx_activity_log_user_id'
    UNION ALL SELECT 'activity_log', 'idx_activity_log_created_at'
    UNION ALL SELECT 'activity_log', 'idx_activity_log_entity_type_id'
    UNION ALL SELECT 'notifications', 'idx_notifications_user_id'
    UNION ALL SELECT 'notifications', 'idx_notifications_is_read'
    UNION ALL SELECT 'notifications', 'idx_notifications_created_at'
    UNION ALL SELECT 'user_sessions', 'idx_user_sessions_user_id'
    UNION ALL SELECT 'user_sessions', 'idx_user_sessions_is_active'
    UNION ALL SELECT 'user_sessions', 'idx_user_sessions_expires_at'
    UNION ALL SELECT 'read_alerts', 'idx_read_alerts_user_id'
    UNION ALL SELECT 'read_alerts', 'idx_read_alerts_alert_id'
    UNION ALL SELECT 'projects', 'idx_projects_created_at'
),
existing_indexes AS (
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND tablename IN ('companies', 'employees', 'activity_log', 'notifications', 'user_sessions', 'read_alerts', 'projects')
        AND indexname LIKE 'idx_%'
)
SELECT 
    r.table_name as "الجدول",
    r.index_name as "الـ Index المطلوب",
    CASE 
        WHEN e.indexname IS NOT NULL THEN '✅ موجود'
        ELSE '❌ غير موجود'
    END as "الحالة"
FROM required_indexes r
LEFT JOIN existing_indexes e ON r.table_name = e.tablename AND r.index_name = e.indexname
ORDER BY r.table_name, r.index_name;

-- ملخص
WITH required_indexes AS (
    SELECT 'companies' as table_name, 'idx_companies_unified_number' as index_name
    UNION ALL SELECT 'companies', 'idx_companies_labor_subscription_number'
    UNION ALL SELECT 'companies', 'idx_companies_created_at'
    UNION ALL SELECT 'employees', 'idx_employees_residence_number'
    UNION ALL SELECT 'employees', 'idx_employees_company_id'
    UNION ALL SELECT 'employees', 'idx_employees_residence_expiry'
    UNION ALL SELECT 'employees', 'idx_employees_contract_expiry'
    UNION ALL SELECT 'employees', 'idx_employees_project_id'
    UNION ALL SELECT 'activity_log', 'idx_activity_log_user_id'
    UNION ALL SELECT 'activity_log', 'idx_activity_log_created_at'
    UNION ALL SELECT 'activity_log', 'idx_activity_log_entity_type_id'
    UNION ALL SELECT 'notifications', 'idx_notifications_user_id'
    UNION ALL SELECT 'notifications', 'idx_notifications_is_read'
    UNION ALL SELECT 'notifications', 'idx_notifications_created_at'
    UNION ALL SELECT 'user_sessions', 'idx_user_sessions_user_id'
    UNION ALL SELECT 'user_sessions', 'idx_user_sessions_is_active'
    UNION ALL SELECT 'user_sessions', 'idx_user_sessions_expires_at'
    UNION ALL SELECT 'read_alerts', 'idx_read_alerts_user_id'
    UNION ALL SELECT 'read_alerts', 'idx_read_alerts_alert_id'
    UNION ALL SELECT 'projects', 'idx_projects_created_at'
),
existing_indexes AS (
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND tablename IN ('companies', 'employees', 'activity_log', 'notifications', 'user_sessions', 'read_alerts', 'projects')
        AND indexname LIKE 'idx_%'
)
SELECT 
    'ملخص' as section,
    COUNT(DISTINCT r.index_name) as "إجمالي المطلوبة",
    COUNT(DISTINCT CASE WHEN e.indexname IS NOT NULL THEN r.index_name END) as "الموجودة",
    COUNT(DISTINCT CASE WHEN e.indexname IS NULL THEN r.index_name END) as "المفقودة",
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN e.indexname IS NULL THEN r.index_name END) = 0 THEN '✅ جميع الـ Indexes موجودة'
        ELSE '⚠️  هناك ' || COUNT(DISTINCT CASE WHEN e.indexname IS NULL THEN r.index_name END) || ' index مفقود'
    END as "النتيجة"
FROM required_indexes r
LEFT JOIN existing_indexes e ON r.table_name = e.tablename AND r.index_name = e.indexname;

