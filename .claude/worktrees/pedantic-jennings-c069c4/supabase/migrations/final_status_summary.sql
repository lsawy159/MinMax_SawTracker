-- ============================================
-- ملخص نهائي شامل لحالة قاعدة البيانات
-- ============================================
-- هذا السكريبت يعطي ملخص نهائي شامل
-- ============================================

-- 1. ملخص الأعمدة المهمة
SELECT 
    '1. الأعمدة المهمة' as section,
    CASE 
        WHEN COUNT(CASE WHEN column_name = 'company_type' THEN 1 END) = 1 THEN '✅ company_type موجود'
        ELSE '❌ company_type مفقود'
    END as company_type_status,
    CASE 
        WHEN COUNT(CASE WHEN column_name = 'employee_count' THEN 1 END) = 1 THEN '✅ employee_count موجود'
        ELSE '❌ employee_count مفقود'
    END as employee_count_status,
    CASE 
        WHEN COUNT(CASE WHEN column_name = 'tax_number' THEN 1 END) = 0 THEN '✅ tax_number محذوف (صحيح)'
        ELSE '❌ tax_number موجود (يجب حذفه)'
    END as tax_number_status,
    CASE 
        WHEN COUNT(CASE WHEN column_name = 'government_documents_renewal' THEN 1 END) = 0 THEN '✅ government_documents_renewal محذوف (صحيح)'
        ELSE '❌ government_documents_renewal موجود (يجب حذفه)'
    END as gov_docs_status
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'companies'
    AND column_name IN ('company_type', 'employee_count', 'tax_number', 'government_documents_renewal');

-- 2. ملخص الـ Indexes
SELECT 
    '2. الـ Indexes' as section,
    COUNT(*) as "إجمالي الـ Indexes",
    CASE 
        WHEN COUNT(*) >= 20 THEN '✅ جميع الـ Indexes موجودة (20/20)'
        ELSE '⚠️  ' || COUNT(*) || '/20 Indexes موجودة'
    END as "النتيجة"
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'employees', 'activity_log', 'notifications', 'user_sessions', 'read_alerts', 'projects')
    AND indexname LIKE 'idx_%';

-- 3. ملخص الجداول و RLS
SELECT 
    '3. الجداول و RLS' as section,
    COUNT(*) as "عدد الجداول",
    COUNT(CASE WHEN rowsecurity THEN 1 END) as "جداول مع RLS مفعل",
    CASE 
        WHEN COUNT(*) = 8 AND COUNT(CASE WHEN rowsecurity THEN 1 END) = 8 THEN '✅ جميع الجداول موجودة و RLS مفعل'
        WHEN COUNT(*) < 8 THEN '❌ بعض الجداول مفقودة'
        WHEN COUNT(CASE WHEN rowsecurity THEN 1 END) < 8 THEN '⚠️  بعض الجداول بدون RLS'
        ELSE '⚠️  يرجى المراجعة'
    END as "النتيجة"
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'employees', 'users', 'projects', 'activity_log', 'notifications', 'user_sessions', 'read_alerts');

-- 4. النتيجة النهائية الشاملة
SELECT 
    '4. النتيجة النهائية' as section,
    CASE 
        WHEN 
            -- الأعمدة
            (SELECT COUNT(*) FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'companies' 
             AND column_name IN ('company_type', 'employee_count')) = 2
            AND
            (SELECT COUNT(*) FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = 'companies' 
             AND column_name IN ('tax_number', 'government_documents_renewal')) = 0
            AND
            -- الـ Indexes
            (SELECT COUNT(*) FROM pg_indexes 
             WHERE schemaname = 'public' 
             AND tablename IN ('companies', 'employees', 'activity_log', 'notifications', 'user_sessions', 'read_alerts', 'projects')
             AND indexname LIKE 'idx_%') >= 20
            AND
            -- الجداول
            (SELECT COUNT(*) FROM pg_tables 
             WHERE schemaname = 'public' 
             AND tablename IN ('companies', 'employees', 'users', 'projects', 'activity_log', 'notifications', 'user_sessions', 'read_alerts')) = 8
            AND
            -- RLS
            (SELECT COUNT(*) FROM pg_tables 
             WHERE schemaname = 'public' 
             AND tablename IN ('companies', 'employees', 'users', 'projects', 'activity_log', 'notifications', 'user_sessions', 'read_alerts')
             AND rowsecurity) = 8
        THEN '✅ ✅ ✅ قاعدة البيانات في حالة ممتازة! كل شيء جاهز ✅ ✅ ✅'
        ELSE '⚠️  هناك بعض العناصر التي تحتاج إلى مراجعة. راجع التفاصيل أعلاه.'
    END as "الحالة النهائية";

