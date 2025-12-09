-- ============================================
-- فحص سريع لحالة قاعدة البيانات
-- ============================================
-- هذا سكريبت مبسط للتحقق من الحالة الأساسية
-- ============================================

-- 1. التحقق من الأعمدة المهمة في companies
SELECT 
    'أعمدة companies' as section,
    column_name,
    CASE 
        WHEN column_name = 'company_type' THEN '✅ مطلوب للكود'
        WHEN column_name = 'employee_count' THEN '✅ مطلوب للكود'
        WHEN column_name = 'tax_number' THEN '❌ يجب حذفه'
        WHEN column_name = 'government_documents_renewal' THEN '❌ يجب حذفه'
        ELSE '✓'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'companies'
    AND column_name IN (
        'company_type',
        'employee_count',
        'tax_number',
        'government_documents_renewal',
        'social_insurance_expiry',
        'social_insurance_number',
        'notes',
        'exemptions'
    )
ORDER BY 
    CASE column_name
        WHEN 'company_type' THEN 1
        WHEN 'employee_count' THEN 2
        WHEN 'tax_number' THEN 3
        WHEN 'government_documents_renewal' THEN 4
        ELSE 5
    END;

-- 2. ملخص الأعمدة المطلوبة
SELECT 
    'ملخص الأعمدة' as section,
    COUNT(CASE WHEN column_name = 'company_type' THEN 1 END) as "company_type موجود",
    COUNT(CASE WHEN column_name = 'employee_count' THEN 1 END) as "employee_count موجود",
    COUNT(CASE WHEN column_name = 'tax_number' THEN 1 END) as "tax_number موجود (يجب حذفه)",
    COUNT(CASE WHEN column_name = 'government_documents_renewal' THEN 1 END) as "government_documents_renewal موجود (يجب حذفه)",
    CASE 
        WHEN COUNT(CASE WHEN column_name = 'company_type' THEN 1 END) = 1 
         AND COUNT(CASE WHEN column_name = 'employee_count' THEN 1 END) = 1
         AND COUNT(CASE WHEN column_name = 'tax_number' THEN 1 END) = 0
         AND COUNT(CASE WHEN column_name = 'government_documents_renewal' THEN 1 END) = 0
        THEN '✅ الحالة ممتازة'
        WHEN COUNT(CASE WHEN column_name = 'employee_count' THEN 1 END) = 0
        THEN '⚠️  employee_count مفقود - طبق 20251205_fix_migration_conflicts.sql'
        WHEN COUNT(CASE WHEN column_name = 'tax_number' THEN 1 END) = 1
         OR COUNT(CASE WHEN column_name = 'government_documents_renewal' THEN 1 END) = 1
        THEN '⚠️  هناك أعمدة قديمة يجب حذفها - طبق 20251205_fix_migration_conflicts.sql'
        ELSE '⚠️  يرجى المراجعة'
    END as "النتيجة"
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'companies'
    AND column_name IN ('company_type', 'employee_count', 'tax_number', 'government_documents_renewal');

-- 3. التحقق من الـ Indexes الأساسية
SELECT 
    'ملخص الـ Indexes' as section,
    COUNT(DISTINCT CASE WHEN tablename = 'companies' THEN indexname END) as "companies indexes",
    COUNT(DISTINCT CASE WHEN tablename = 'employees' THEN indexname END) as "employees indexes",
    COUNT(DISTINCT CASE WHEN tablename = 'activity_log' THEN indexname END) as "activity_log indexes",
    COUNT(DISTINCT CASE WHEN tablename = 'notifications' THEN indexname END) as "notifications indexes",
    COUNT(DISTINCT CASE WHEN tablename = 'user_sessions' THEN indexname END) as "user_sessions indexes",
    COUNT(DISTINCT CASE WHEN tablename = 'read_alerts' THEN indexname END) as "read_alerts indexes",
    COUNT(DISTINCT CASE WHEN tablename = 'projects' THEN indexname END) as "projects indexes",
    COUNT(*) as "إجمالي indexes",
    CASE 
        WHEN COUNT(*) >= 20 THEN '✅ جميع الـ Indexes موجودة'
        ELSE '⚠️  بعض الـ Indexes مفقودة - طبق 20250121_add_database_indexes.sql'
    END as "النتيجة"
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'employees', 'activity_log', 'notifications', 'user_sessions', 'read_alerts', 'projects')
    AND indexname LIKE 'idx_%';

-- 4. التحقق من الجداول الأساسية
SELECT 
    'الجداول الأساسية' as section,
    tablename as "اسم الجدول",
    CASE 
        WHEN rowsecurity THEN '✅ RLS مفعل'
        ELSE '⚠️  RLS معطل'
    END as "حالة RLS"
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'employees', 'users', 'projects', 'activity_log', 'notifications', 'user_sessions', 'read_alerts')
ORDER BY tablename;

