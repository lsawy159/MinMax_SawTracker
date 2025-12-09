-- ============================================
-- سكريبت التحقق من حالة قاعدة البيانات
-- ============================================
-- شغّل هذا السكريبت في Supabase SQL Editor قبل تطبيق أي migrations
-- ============================================

-- 1. التحقق من وجود الجداول الأساسية
-- ============================================
SELECT 
    'الجداول الأساسية' as section,
    tablename as table_name,
    CASE 
        WHEN rowsecurity THEN 'مفعل'
        ELSE 'معطل'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'employees', 'users', 'projects', 'activity_log', 'notifications', 'user_sessions', 'read_alerts')
ORDER BY tablename;

-- 2. التحقق من الأعمدة في جدول companies (التعارضات المحتملة)
-- ============================================
SELECT 
    'أعمدة companies' as section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'companies'
    AND column_name IN ('company_type', 'tax_number', 'government_documents_renewal', 'social_insurance_expiry', 'social_insurance_number', 'insurance_subscription_expiry', 'insurance_subscription_number')
ORDER BY column_name;

-- 3. التحقق من وجود جميع الأعمدة المطلوبة في companies
-- ============================================
SELECT 
    'جميع أعمدة companies' as section,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'companies'
ORDER BY ordinal_position;

-- 4. التحقق من الـ Indexes المطلوبة (من 20250121_add_database_indexes.sql)
-- ============================================
SELECT 
    'Indexes للـ companies' as section,
    indexname,
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

SELECT 
    'Indexes للـ employees' as section,
    indexname,
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

SELECT 
    'Indexes للـ activity_log' as section,
    indexname,
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

SELECT 
    'Indexes للـ notifications' as section,
    indexname,
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

SELECT 
    'Indexes للـ user_sessions' as section,
    indexname,
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

SELECT 
    'Indexes للـ read_alerts' as section,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'read_alerts'
    AND indexname IN (
        'idx_read_alerts_user_id',
        'idx_read_alerts_alert_id'
    )
ORDER BY indexname;

SELECT 
    'Indexes للـ projects' as section,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'projects'
    AND indexname IN (
        'idx_projects_created_at'
    )
ORDER BY indexname;

-- 5. ملخص الحالة
-- ============================================
DO $$
DECLARE
    has_company_type BOOLEAN;
    has_tax_number BOOLEAN;
    has_government_docs BOOLEAN;
    indexes_count INTEGER;
BEGIN
    -- التحقق من company_type
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'company_type'
    ) INTO has_company_type;
    
    -- التحقق من tax_number
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'tax_number'
    ) INTO has_tax_number;
    
    -- التحقق من government_documents_renewal
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'government_documents_renewal'
    ) INTO has_government_docs;
    
    -- عدد الـ indexes المطلوبة
    SELECT COUNT(*) INTO indexes_count
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND tablename IN ('companies', 'employees', 'activity_log', 'notifications', 'user_sessions', 'read_alerts', 'projects')
        AND indexname LIKE 'idx_%';
    
    -- عرض النتائج
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ملخص حالة قاعدة البيانات:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'company_type موجود: %', CASE WHEN has_company_type THEN 'نعم ✓' ELSE 'لا ✗' END;
    RAISE NOTICE 'tax_number موجود: %', CASE WHEN has_tax_number THEN 'نعم (يجب حذفه) ✗' ELSE 'لا (صحيح) ✓' END;
    RAISE NOTICE 'government_documents_renewal موجود: %', CASE WHEN has_government_docs THEN 'نعم (يجب حذفه) ✗' ELSE 'لا (صحيح) ✓' END;
    RAISE NOTICE 'عدد الـ Indexes: %', indexes_count;
    RAISE NOTICE '========================================';
    
    -- التحذيرات
    IF NOT has_company_type THEN
        RAISE WARNING '⚠️  company_type غير موجود! يجب إضافته لأن الكود يعتمد عليه.';
    END IF;
    
    IF has_tax_number THEN
        RAISE WARNING '⚠️  tax_number موجود! يجب حذفه لأنه لم يعد مستخدماً.';
    END IF;
    
    IF has_government_docs THEN
        RAISE WARNING '⚠️  government_documents_renewal موجود! يجب حذفه لأنه لم يعد مستخدماً.';
    END IF;
    
    IF indexes_count < 20 THEN
        RAISE WARNING '⚠️  عدد الـ Indexes قليل! يجب تطبيق 20250121_add_database_indexes.sql';
    END IF;
END $$;

