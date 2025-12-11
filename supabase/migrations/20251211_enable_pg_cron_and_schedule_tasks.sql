-- Migration: تفعيل pg_cron وجدولة المهام التلقائية
-- Created: 2025-12-11
-- Description: تفعيل امتداد pg_cron وإنشاء جداول تسجيل والمهام المجدولة للنسخ الاحتياطية ومعالجة البريد

-- =========================================
-- 1. تفعيل امتداد pg_cron
-- =========================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

COMMENT ON EXTENSION pg_cron IS 'امتداد PostgreSQL لجدولة المهام الدورية (Cron Jobs)';

-- =========================================
-- 2. إنشاء جدول cron_jobs لتسجيل المهام المجدولة
-- =========================================
CREATE TABLE IF NOT EXISTS public.cron_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  job_description TEXT,
  function_name TEXT NOT NULL,
  schedule TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  is_paused BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_job_name ON public.cron_jobs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_is_enabled ON public.cron_jobs(is_enabled);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_is_paused ON public.cron_jobs(is_paused);

COMMENT ON TABLE public.cron_jobs IS 'جدول تسجيل المهام المجدولة (Cron Jobs)';
COMMENT ON COLUMN public.cron_jobs.job_name IS 'اسم المهمة الفريد';
COMMENT ON COLUMN public.cron_jobs.job_description IS 'وصف المهمة';
COMMENT ON COLUMN public.cron_jobs.function_name IS 'اسم الدالة أو Edge Function المراد تنفيذها';
COMMENT ON COLUMN public.cron_jobs.schedule IS 'جدول التنفيذ بصيغة cron (مثل: 0 12 * * * للساعة 12 ظهراً يومياً)';
COMMENT ON COLUMN public.cron_jobs.is_enabled IS 'هل المهمة مفعلة أم معطلة';
COMMENT ON COLUMN public.cron_jobs.is_paused IS 'هل المهمة موقوفة مؤقتاً (بدون حذف)';

-- =========================================
-- 3. إنشاء جدول cron_jobs_log لتسجيل نتائج التنفيذ
-- =========================================
CREATE TABLE IF NOT EXISTS public.cron_jobs_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  execution_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_end TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  execution_time_ms INTEGER,
  error_message TEXT,
  result_details JSONB,
  executed_by TEXT DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_job_name ON public.cron_jobs_log(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_status ON public.cron_jobs_log(status);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_created_at ON public.cron_jobs_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_execution_start ON public.cron_jobs_log(execution_start DESC);

COMMENT ON TABLE public.cron_jobs_log IS 'سجل تنفيذ المهام المجدولة (Cron Jobs Execution Log)';
COMMENT ON COLUMN public.cron_jobs_log.job_name IS 'اسم المهمة';
COMMENT ON COLUMN public.cron_jobs_log.execution_start IS 'وقت بدء التنفيذ';
COMMENT ON COLUMN public.cron_jobs_log.execution_end IS 'وقت انتهاء التنفيذ';
COMMENT ON COLUMN public.cron_jobs_log.status IS 'حالة التنفيذ (running, completed, failed, cancelled)';
COMMENT ON COLUMN public.cron_jobs_log.execution_time_ms IS 'مدة التنفيذ بالميلي ثانية';
COMMENT ON COLUMN public.cron_jobs_log.error_message IS 'رسالة الخطأ إن وجدت';
COMMENT ON COLUMN public.cron_jobs_log.result_details IS 'تفاصيل النتيجة (JSON)';

-- =========================================
-- 4. تفعيل RLS للجداول الجديدة
-- =========================================
ALTER TABLE public.cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_jobs_log ENABLE ROW LEVEL SECURITY;

-- السماح للمديرين فقط بقراءة المهام المجدولة
DROP POLICY IF EXISTS "Allow admins to read cron jobs" ON public.cron_jobs;
CREATE POLICY "Allow admins to read cron jobs"
  ON public.cron_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- السماح للمديرين فقط بإدارة المهام المجدولة
DROP POLICY IF EXISTS "Allow admins to manage cron jobs" ON public.cron_jobs;
CREATE POLICY "Allow admins to manage cron jobs"
  ON public.cron_jobs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- السماح لخدمة service_role بالوصول الكامل
DROP POLICY IF EXISTS "Allow service role full access to cron jobs" ON public.cron_jobs;
CREATE POLICY "Allow service role full access to cron jobs"
  ON public.cron_jobs
  FOR ALL
  USING (auth.role() = 'service_role');

-- السماح للمديرين فقط بقراءة سجل التنفيذ
DROP POLICY IF EXISTS "Allow admins to read cron logs" ON public.cron_jobs_log;
CREATE POLICY "Allow admins to read cron logs"
  ON public.cron_jobs_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- السماح لخدمة service_role بالوصول الكامل لتسجيل النتائج
DROP POLICY IF EXISTS "Allow service role full access to cron logs" ON public.cron_jobs_log;
CREATE POLICY "Allow service role full access to cron logs"
  ON public.cron_jobs_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- =========================================
-- 5. إنشاء الوظائف المجدولة
-- =========================================

-- إدراج في جدول cron_jobs (للتسجيل والمراقبة)
-- 5.1: جدولة النسخ الاحتياطي اليومي
-- التشغيل: الساعة 12 ظهراً UTC (= 3 صباحاً بتوقيت السعودية UTC+3)
-- صيغة Cron: 0 12 * * * (دقيقة ساعة يوم شهر يوم_الأسبوع)
INSERT INTO public.cron_jobs (job_name, job_description, function_name, schedule, is_enabled)
VALUES (
  'backup_daily',
  'النسخ الاحتياطي الكامل اليومي - الساعة 12 ظهراً UTC (3 صباحاً السعودية)',
  'automated-backup',
  '0 12 * * *',
  true
) ON CONFLICT (job_name) DO UPDATE SET 
  job_description = EXCLUDED.job_description,
  function_name = EXCLUDED.function_name,
  schedule = EXCLUDED.schedule,
  updated_at = NOW();

-- 5.2: معالجة قائمة انتظار البريد
-- التشغيل: كل 5 دقائق
-- صيغة Cron: */5 * * * *
INSERT INTO public.cron_jobs (job_name, job_description, function_name, schedule, is_enabled)
VALUES (
  'process_emails_every_5min',
  'معالجة قائمة انتظار البريد الإلكتروني - كل 5 دقائق',
  'process-email-queue',
  '*/5 * * * *',
  true
) ON CONFLICT (job_name) DO UPDATE SET 
  job_description = EXCLUDED.job_description,
  function_name = EXCLUDED.function_name,
  schedule = EXCLUDED.schedule,
  updated_at = NOW();

-- =========================================
-- 6. إضافة trigger لتحديث updated_at
-- =========================================
CREATE OR REPLACE FUNCTION update_cron_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cron_jobs_updated_at_trigger ON public.cron_jobs;
CREATE TRIGGER update_cron_jobs_updated_at_trigger
  BEFORE UPDATE ON public.cron_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_cron_jobs_updated_at();

-- =========================================
-- 7. تعليمات الحذف والإدارة (للمراجع المستقبلية)
-- =========================================

/*
  ===== عرض المعلومات =====
  
  -- عرض جميع المهام المجدولة المسجلة
  SELECT * FROM public.cron_jobs ORDER BY created_at DESC;
  
  -- عرض سجل التنفيذات الأخيرة (آخر 20 تنفيذ)
  SELECT job_name, status, execution_start, execution_time_ms, error_message 
  FROM public.cron_jobs_log 
  ORDER BY created_at DESC 
  LIMIT 20;
  
  -- عرض إحصائيات التنفيذ لكل مهمة
  SELECT 
    job_name,
    COUNT(*) as total_executions,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    AVG(execution_time_ms) as avg_execution_time_ms
  FROM public.cron_jobs_log
  GROUP BY job_name
  ORDER BY job_name;
  
  ===== إدارة المهام =====
  
  -- إيقاف مهمة مؤقتاً (بدون حذف)
  UPDATE public.cron_jobs SET is_paused = true WHERE job_name = 'backup_daily';
  
  -- تفعيل مهمة معطلة
  UPDATE public.cron_jobs SET is_paused = false WHERE job_name = 'backup_daily';
  
  -- تعطيل مهمة كلياً (من الواجهة)
  UPDATE public.cron_jobs SET is_enabled = false WHERE job_name = 'backup_daily';
  
  -- تفعيل مهمة معطلة
  UPDATE public.cron_jobs SET is_enabled = true WHERE job_name = 'backup_daily';
  
  -- حذف سجل التنفيذات القديمة (أقدم من 30 يوم)
  DELETE FROM public.cron_jobs_log 
  WHERE created_at < NOW() - INTERVAL '30 days';
*/

-- =========================================
-- نهاية الـ Migration
-- =========================================
