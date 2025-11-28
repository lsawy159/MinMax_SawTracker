-- ============================================
-- RLS Policies لـ Storage Bucket: backups
-- ============================================
-- هذا الملف يحتوي على Policies للسماح بالوصول إلى النسخ الاحتياطية
-- يجب تشغيله في Supabase SQL Editor

-- ============================================
-- الخطوة 1: حذف Policies القديمة (إن وجدت)
-- ============================================
DROP POLICY IF EXISTS "Allow authenticated users to read backups" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload backups" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete backups" ON storage.objects;

-- ============================================
-- الخطوة 2: إنشاء Policies جديدة
-- ============================================

-- Policy للقراءة (SELECT) - السماح للمستخدمين المسجلين بقراءة الملفات
CREATE POLICY "Allow authenticated users to read backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'backups');

-- Policy للكتابة (INSERT) - السماح للمستخدمين المسجلين برفع الملفات
CREATE POLICY "Allow authenticated users to upload backups"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups');

-- Policy للحذف (DELETE) - السماح للمستخدمين المسجلين بحذف الملفات
CREATE POLICY "Allow authenticated users to delete backups"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'backups');

-- ============================================
-- التحقق من Policies
-- ============================================
-- بعد تشغيل الكود أعلاه، شغّل هذا للتحقق:
-- SELECT 
--   policyname,
--   permissive,
--   roles,
--   cmd
-- FROM pg_policies
-- WHERE schemaname = 'storage'
--   AND tablename = 'objects'
--   AND policyname LIKE '%backup%';

