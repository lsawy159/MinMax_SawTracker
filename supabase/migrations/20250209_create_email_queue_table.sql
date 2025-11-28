-- Migration: إنشاء جدول email_queue لنظام Queue
-- Created: 2025-02-09
-- Description: جدول لإدارة قائمة انتظار البريد الإلكتروني

-- =========================================
-- 1. إنشاء جدول email_queue
-- =========================================
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_emails TEXT[] NOT NULL,  -- قائمة الإيميلات
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  attachments JSONB DEFAULT '[]',  -- معلومات المرفقات (إن وجدت)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,  -- أولوية (0 = عادي، 1 = عالي)
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =========================================
-- 2. إضافة indexes للأداء
-- =========================================
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON public.email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_priority ON public.email_queue(status, priority, created_at);

-- =========================================
-- 3. إضافة RLS Policies
-- =========================================

-- تفعيل RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Policy: السماح للمديرين بقراءة جميع السجلات
DROP POLICY IF EXISTS "Allow admins to read email queue" ON public.email_queue;
CREATE POLICY "Allow admins to read email queue"
  ON public.email_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: السماح للمديرين بإضافة سجلات جديدة
DROP POLICY IF EXISTS "Allow admins to insert email queue" ON public.email_queue;
CREATE POLICY "Allow admins to insert email queue"
  ON public.email_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: السماح لخدمة service_role بالوصول الكامل (للمعالجة)
DROP POLICY IF EXISTS "Allow service role full access to email queue" ON public.email_queue;
CREATE POLICY "Allow service role full access to email queue"
  ON public.email_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- =========================================
-- 4. إضافة تعليقات على الجدول
-- =========================================
COMMENT ON TABLE public.email_queue IS 'جدول قائمة انتظار البريد الإلكتروني';
COMMENT ON COLUMN public.email_queue.to_emails IS 'قائمة عناوين البريد الإلكتروني المستلمة';
COMMENT ON COLUMN public.email_queue.subject IS 'موضوع البريد الإلكتروني';
COMMENT ON COLUMN public.email_queue.html_content IS 'محتوى البريد بتنسيق HTML';
COMMENT ON COLUMN public.email_queue.text_content IS 'محتوى البريد بتنسيق نصي';
COMMENT ON COLUMN public.email_queue.attachments IS 'معلومات المرفقات بتنسيق JSON';
COMMENT ON COLUMN public.email_queue.status IS 'حالة البريد (pending, processing, completed, failed)';
COMMENT ON COLUMN public.email_queue.priority IS 'أولوية البريد (0 = عادي، 1 = عالي)';
COMMENT ON COLUMN public.email_queue.retry_count IS 'عدد محاولات إعادة الإرسال';
COMMENT ON COLUMN public.email_queue.max_retries IS 'الحد الأقصى لعدد المحاولات';
COMMENT ON COLUMN public.email_queue.error_message IS 'رسالة الخطأ في حالة الفشل';

