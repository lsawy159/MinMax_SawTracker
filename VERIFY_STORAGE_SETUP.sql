-- ============================================
-- التحقق من إعدادات Storage للنسخ الاحتياطية
-- ============================================
-- شغّل هذا الكود في SQL Editor للتحقق من كل شيء

-- ============================================
-- 1. التحقق من وجود Bucket "backups"
-- ============================================
SELECT 
  name as bucket_name,
  public,
  file_size_limit,
  created_at
FROM storage.buckets
WHERE name = 'backups';

-- النتيجة المتوقعة:
-- يجب أن ترى صف واحد مع:
-- bucket_name = 'backups'
-- public = false (خاص)

-- ============================================
-- 2. التحقق من وجود Policies
-- ============================================
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%backup%';

-- النتيجة المتوقعة:
-- يجب أن ترى 3 policies:
-- 1. Allow authenticated users to read backups (SELECT)
-- 2. Allow authenticated users to upload backups (INSERT)
-- 3. Allow authenticated users to delete backups (DELETE)

-- ============================================
-- 3. التحقق من الملفات الموجودة في Bucket
-- ============================================
-- ملاحظة: هذا قد لا يعمل مباشرة من SQL
-- الأفضل التحقق من Dashboard → Storage → backups

-- ============================================
-- 4. التحقق من RLS مفعّل على storage.objects
-- ============================================
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- النتيجة المتوقعة:
-- rowsecurity = true (RLS مفعّل)

