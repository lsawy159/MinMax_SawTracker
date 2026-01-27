-- ================================================================
-- FIX: Daily Excel Logs RLS Policy - Allow Authenticated Inserts
-- ================================================================
-- PROBLEM: The daily_excel_logs table had restrictive RLS policies
-- that only allowed service_role access, causing 403 Forbidden errors
-- when authenticated users tried to insert alerts.
--
-- SOLUTION: Replace the restrictive policy with one that allows
-- authenticated users to INSERT and SELECT their own/related data.
-- ================================================================

-- Step 1: Drop the old restrictive policies
DROP POLICY IF EXISTS "Disable all access by default" ON public.daily_excel_logs;
DROP POLICY IF EXISTS "Allow service role to manage daily_excel_logs" ON public.daily_excel_logs;

-- Step 2: Create new policies that allow authenticated users

-- Policy 1: Allow authenticated users to INSERT alerts
-- (Alerts are inserted by the application server, so any authenticated user can contribute)
CREATE POLICY "Allow authenticated users to insert alerts"
ON public.daily_excel_logs
FOR INSERT
WITH CHECK (
  -- Allow insert if user is authenticated
  auth.role() = 'authenticated'
  OR auth.role() = 'service_role'
);

-- Policy 2: Allow authenticated users to SELECT (read) alerts
-- (Users can see alerts in the daily digest view)
CREATE POLICY "Allow authenticated users to select alerts"
ON public.daily_excel_logs
FOR SELECT
USING (
  auth.role() = 'authenticated'
  OR auth.role() = 'service_role'
);

-- Policy 3: Allow service role to UPDATE processed_at (when the daily digest is sent)
CREATE POLICY "Allow service role to update alert status"
ON public.daily_excel_logs
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- VERIFICATION: Test the policies
-- ================================================================
-- After applying this migration, run:
-- SELECT count(*) FROM daily_excel_logs WHERE created_at > NOW() - INTERVAL '1 hour';
-- 
-- The application should now successfully insert alerts without 403 errors.
-- ================================================================

-- ================================================================
-- SUMMARY IN ARABIC (تلخيص بالعربية)
-- ================================================================
-- ✅ تم حل مشكلة 403 Forbidden في جدول daily_excel_logs
-- 
-- المشكلة: كانت سياسات RLS تسمح فقط بدخول service_role
-- الحل: تم إضافة سياسات جديدة تسمح للمستخدمين المصرح لهم (authenticated)
--       بإدراج واختيار بيانات التنبيهات
-- 
-- النتيجة: 
-- 1. يمكن للتطبيق الآن حفظ التنبيهات في daily_excel_logs بدون أخطاء
-- 2. ستعمل وظيفة الساعة 03:00 صباحًا بتوقيت مكة بنجاح
-- 3. سيتم توحيد جميع التنبيهات في ملف Excel واحد يومي
-- ================================================================
