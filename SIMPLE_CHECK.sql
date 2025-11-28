-- ============================================
-- فحص سريع: التحقق من كل شيء
-- ============================================
-- شغّل هذا في SQL Editor

-- 1. التحقق من Policies
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%backup%';

-- النتيجة المتوقعة: 3 policies
-- إذا لم تر أي شيء → Policies غير موجودة
-- إذا رأيت 3 policies → Policies موجودة ✅

-- 2. التحقق من Bucket
SELECT 
  name,
  public,
  created_at
FROM storage.buckets
WHERE name = 'backups';

-- النتيجة المتوقعة: صف واحد مع name = 'backups'
-- إذا لم تر أي شيء → Bucket غير موجود
-- إذا رأيت صف → Bucket موجود ✅

-- 3. التحقق من النسخ الاحتياطية في قاعدة البيانات
SELECT 
  file_path,
  status,
  file_size,
  started_at
FROM backup_history
WHERE status = 'completed'
ORDER BY started_at DESC
LIMIT 3;

-- النتيجة المتوقعة: قائمة بالنسخ الاحتياطية المكتملة
-- إذا رأيت قائمة → النسخ الاحتياطية موجودة في قاعدة البيانات ✅
-- ملاحظة: هذا لا يعني أن الملفات موجودة في Storage!
-- يجب التحقق من Storage Dashboard أيضاً

