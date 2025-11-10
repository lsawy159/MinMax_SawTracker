-- التحقق من وجود جدول read_alerts
-- شغّل هذا SQL في Supabase Dashboard للتحقق من نجاح الـ migration

-- 1. التحقق من وجود الجدول
SELECT 
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_name = 'read_alerts'
AND table_schema = 'public';

-- 2. التحقق من وجود الأعمدة
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'read_alerts'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. التحقق من وجود الـ indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'read_alerts'
AND schemaname = 'public';

-- 4. التحقق من وجود الـ policies (RLS)
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'read_alerts'
AND schemaname = 'public';

-- 5. التحقق من تفعيل RLS
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'read_alerts'
AND schemaname = 'public';

