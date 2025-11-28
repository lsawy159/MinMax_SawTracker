-- Migration: إنشاء جدول system_settings
-- Created: 2025-01-27
-- Description: إنشاء جدول system_settings لتخزين إعدادات النظام مثل notification_thresholds

-- 1. إنشاء جدول system_settings
-- =========================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. إضافة indexes للأداء
-- =========================================
CREATE INDEX IF NOT EXISTS idx_system_settings_setting_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON public.system_settings(updated_at DESC);

-- 3. إضافة RLS Policies
-- =========================================

-- تفعيل RLS للجدول
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy للسماح للمستخدمين المصادق عليهم بقراءة الإعدادات
DROP POLICY IF EXISTS "Allow authenticated users to read system settings" ON public.system_settings;
CREATE POLICY "Allow authenticated users to read system settings"
  ON public.system_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy للسماح للمستخدمين المصادق عليهم بإنشاء وتعديل الإعدادات
DROP POLICY IF EXISTS "Allow authenticated users to manage system settings" ON public.system_settings;
CREATE POLICY "Allow authenticated users to manage system settings"
  ON public.system_settings
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policy للسماح لخدمة service_role بالوصول الكامل (لـ Edge Functions)
DROP POLICY IF EXISTS "Allow service role full access to system settings" ON public.system_settings;
CREATE POLICY "Allow service role full access to system settings"
  ON public.system_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- 4. إضافة trigger لتحديث updated_at تلقائياً
-- =========================================
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_system_settings_updated_at_trigger ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at_trigger
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- 5. إضافة تعليقات على الجدول
-- =========================================
COMMENT ON TABLE public.system_settings IS 'جدول إعدادات النظام العامة مثل notification_thresholds';
COMMENT ON COLUMN public.system_settings.setting_key IS 'المفتاح الفريد للإعداد';
COMMENT ON COLUMN public.system_settings.setting_value IS 'قيمة الإعداد بتنسيق JSON';
COMMENT ON COLUMN public.system_settings.created_at IS 'تاريخ إنشاء الإعداد';
COMMENT ON COLUMN public.system_settings.updated_at IS 'تاريخ آخر تحديث للإعداد';

