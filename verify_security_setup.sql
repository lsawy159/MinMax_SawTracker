-- ============================================
-- ملف التحقق الشامل - نظام الأمان والنسخ الاحتياطي
-- ============================================
-- هذا الملف للتحقق من أن كل شيء تم إعداده بشكل صحيح
-- انسخ والصق كل قسم في SQL Editor واحدة تلو الأخرى

-- ============================================
-- القسم 1: التحقق من الجداول
-- ============================================
SELECT 
    'القسم 1: التحقق من الجداول' as section,
    '' as details;

-- التحقق من وجود الجداول المطلوبة
SELECT 
    table_name,
    CASE 
        WHEN table_name = 'security_settings' THEN '✅ جدول إعدادات الأمان'
        WHEN table_name = 'backup_history' THEN '✅ جدول سجل النسخ الاحتياطي'
        WHEN table_name = 'general_settings' THEN '✅ جدول الإعدادات العامة'
        ELSE '❓ جدول آخر'
    END as description
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('security_settings', 'backup_history', 'general_settings')
ORDER BY table_name;

-- ============================================
-- القسم 2: التحقق من بنية الجداول
-- ============================================
SELECT 
    'القسم 2: التحقق من بنية الجداول' as section,
    '' as details;

-- التحقق من أعمدة security_settings
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'security_settings'
ORDER BY ordinal_position;

-- التحقق من أعمدة backup_history
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'backup_history'
ORDER BY ordinal_position;

-- ============================================
-- القسم 3: التحقق من RLS Policies
-- ============================================
SELECT 
    'القسم 3: التحقق من RLS Policies' as section,
    '' as details;

-- التحقق من تفعيل RLS
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ مفعّل'
        ELSE '❌ غير مفعّل'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('security_settings', 'backup_history', 'general_settings')
ORDER BY tablename;

-- التحقق من Policies الموجودة
SELECT 
    tablename,
    policyname,
    cmd as command_type,
    CASE 
        WHEN cmd = 'SELECT' THEN 'قراءة'
        WHEN cmd = 'ALL' THEN 'كل العمليات'
        ELSE cmd::text
    END as description
FROM pg_policies
WHERE tablename IN ('security_settings', 'backup_history', 'general_settings')
ORDER BY tablename, policyname;

-- ============================================
-- القسم 4: التحقق من البيانات الموجودة
-- ============================================
SELECT 
    'القسم 4: التحقق من البيانات الموجودة' as section,
    '' as details;

-- عرض جميع الإعدادات في security_settings
SELECT 
    setting_key,
    setting_type,
    CASE 
        WHEN setting_type = 'boolean' THEN setting_value::text
        WHEN setting_type = 'number' THEN setting_value::text
        WHEN setting_type = 'text' AND jsonb_typeof(setting_value) = 'string' THEN setting_value::text
        ELSE 'JSON/Complex'
    END as value_preview,
    description,
    updated_at
FROM security_settings
ORDER BY setting_key;

-- عرض آخر 5 نسخ احتياطية
SELECT 
    id,
    backup_type,
    status,
    CASE 
        WHEN file_size IS NOT NULL THEN 
            ROUND(file_size::numeric / 1024 / 1024, 2) || ' MB'
        ELSE 'غير محدد'
    END as file_size_mb,
    started_at,
    completed_at,
    error_message
FROM backup_history
ORDER BY started_at DESC
LIMIT 5;

-- ============================================
-- القسم 5: التحقق من Indexes
-- ============================================
SELECT 
    'القسم 5: التحقق من Indexes' as section,
    '' as details;

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('security_settings', 'backup_history', 'general_settings')
ORDER BY tablename, indexname;

-- ============================================
-- القسم 6: التحقق من Triggers
-- ============================================
SELECT 
    'القسم 6: التحقق من Triggers' as section,
    '' as details;

SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('security_settings', 'backup_history', 'general_settings')
ORDER BY event_object_table, trigger_name;

-- ============================================
-- القسم 7: تقرير شامل عن الحالة
-- ============================================
SELECT 
    'القسم 7: تقرير شامل' as section,
    '' as details;

WITH status_report AS (
    SELECT 
        'الجداول' as item,
        CASE 
            WHEN COUNT(*) = 3 THEN '✅ جاهز (' || COUNT(*) || '/3)'
            ELSE '⚠️ ناقص (' || COUNT(*) || '/3)'
        END as status
    FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name IN ('security_settings', 'backup_history', 'general_settings')
    
    UNION ALL
    
    SELECT 
        'Policies لـ security_settings',
        CASE 
            WHEN COUNT(*) >= 3 THEN '✅ جاهز (' || COUNT(*) || ')'
            ELSE '⚠️ ناقص (' || COUNT(*) || ')'
        END
    FROM pg_policies
    WHERE tablename = 'security_settings'
    
    UNION ALL
    
    SELECT 
        'إعدادات الأمان',
        CASE 
            WHEN COUNT(*) > 0 THEN '✅ موجود (' || COUNT(*) || ')'
            ELSE '⚠️ فارغ'
        END
    FROM security_settings
    
    UNION ALL
    
    SELECT 
        'النسخ الاحتياطية',
        CASE 
            WHEN COUNT(*) > 0 THEN '✅ موجود (' || COUNT(*) || ')'
            ELSE '⚠️ لا توجد'
        END
    FROM backup_history
    
    UNION ALL
    
    SELECT 
        'RLS مفعّل',
        CASE 
            WHEN COUNT(*) = 3 THEN '✅ مفعّل'
            ELSE '⚠️ غير مفعّل'
        END
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('security_settings', 'backup_history', 'general_settings')
      AND rowsecurity = true
)
SELECT 
    item,
    status
FROM status_report
ORDER BY item;

-- ============================================
-- ملاحظات مهمة
-- ============================================
/*
✅ إذا كانت النتائج كلها "جاهز" → كل شيء يعمل
⚠️ إذا كانت بعض النتائج "ناقص" → راجع الملف:
   supabase/migrations/20250201_create_settings_and_backup_tables.sql
   
❌ إذا كانت الجداول غير موجودة → نفذ migration file كاملاً
*/

