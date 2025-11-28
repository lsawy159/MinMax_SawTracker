-- Migration: إنشاء جداول الإعدادات والنسخ الاحتياطي
-- Created: 2025-02-01
-- Description: إنشاء جداول general_settings و security_settings و backup_history

-- 1. إنشاء جدول general_settings
-- =========================================
CREATE TABLE IF NOT EXISTS public.general_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL,
  description TEXT,
  setting_type TEXT NOT NULL CHECK (setting_type IN ('text', 'number', 'boolean', 'select', 'time')),
  options JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة indexes للأداء
CREATE INDEX IF NOT EXISTS idx_general_settings_setting_key ON public.general_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_general_settings_category ON public.general_settings(category);
CREATE INDEX IF NOT EXISTS idx_general_settings_updated_at ON public.general_settings(updated_at DESC);

-- 2. إنشاء جدول security_settings
-- =========================================
CREATE TABLE IF NOT EXISTS public.security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'security',
  description TEXT,
  setting_type TEXT NOT NULL CHECK (setting_type IN ('text', 'number', 'boolean', 'select', 'time')),
  options JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة indexes للأداء
CREATE INDEX IF NOT EXISTS idx_security_settings_setting_key ON public.security_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_security_settings_category ON public.security_settings(category);
CREATE INDEX IF NOT EXISTS idx_security_settings_updated_at ON public.security_settings(updated_at DESC);

-- 3. إنشاء جدول backup_history
-- =========================================
CREATE TABLE IF NOT EXISTS public.backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'partial')),
  file_path TEXT NOT NULL,
  tables_included TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  file_size BIGINT,
  compression_ratio NUMERIC(5, 2),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة indexes للأداء
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON public.backup_history(status);
CREATE INDEX IF NOT EXISTS idx_backup_history_started_at ON public.backup_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_backup_type ON public.backup_history(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON public.backup_history(created_at DESC);

-- 4. إضافة RLS Policies
-- =========================================

-- تفعيل RLS للجداول
ALTER TABLE public.general_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- Policies لجدول general_settings
-- السماح للمستخدمين المصادق عليهم بقراءة الإعدادات العامة
DROP POLICY IF EXISTS "Allow authenticated users to read general settings" ON public.general_settings;
CREATE POLICY "Allow authenticated users to read general settings"
  ON public.general_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- السماح للمديرين فقط بإدارة الإعدادات العامة
DROP POLICY IF EXISTS "Allow admins to manage general settings" ON public.general_settings;
CREATE POLICY "Allow admins to manage general settings"
  ON public.general_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- السماح لخدمة service_role بالوصول الكامل
DROP POLICY IF EXISTS "Allow service role full access to general settings" ON public.general_settings;
CREATE POLICY "Allow service role full access to general settings"
  ON public.general_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies لجدول security_settings
-- السماح للمستخدمين المصادق عليهم بقراءة إعدادات الأمان
DROP POLICY IF EXISTS "Allow authenticated users to read security settings" ON public.security_settings;
CREATE POLICY "Allow authenticated users to read security settings"
  ON public.security_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- السماح للمديرين فقط بإدارة إعدادات الأمان
DROP POLICY IF EXISTS "Allow admins to manage security settings" ON public.security_settings;
CREATE POLICY "Allow admins to manage security settings"
  ON public.security_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- السماح لخدمة service_role بالوصول الكامل
DROP POLICY IF EXISTS "Allow service role full access to security settings" ON public.security_settings;
CREATE POLICY "Allow service role full access to security settings"
  ON public.security_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies لجدول backup_history
-- السماح للمديرين فقط بقراءة سجل النسخ الاحتياطي
DROP POLICY IF EXISTS "Allow admins to read backup history" ON public.backup_history;
CREATE POLICY "Allow admins to read backup history"
  ON public.backup_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- السماح لخدمة service_role بالوصول الكامل (لـ Edge Functions)
DROP POLICY IF EXISTS "Allow service role full access to backup history" ON public.backup_history;
CREATE POLICY "Allow service role full access to backup history"
  ON public.backup_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- 5. إضافة triggers لتحديث updated_at تلقائياً
-- =========================================
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_general_settings_updated_at_trigger ON public.general_settings;
CREATE TRIGGER update_general_settings_updated_at_trigger
  BEFORE UPDATE ON public.general_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

DROP TRIGGER IF EXISTS update_security_settings_updated_at_trigger ON public.security_settings;
CREATE TRIGGER update_security_settings_updated_at_trigger
  BEFORE UPDATE ON public.security_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- 6. إضافة تعليقات على الجداول
-- =========================================
COMMENT ON TABLE public.general_settings IS 'جدول الإعدادات العامة للنظام';
COMMENT ON TABLE public.security_settings IS 'جدول إعدادات الأمان المتقدمة';
COMMENT ON TABLE public.backup_history IS 'سجل عمليات النسخ الاحتياطي';

COMMENT ON COLUMN public.general_settings.setting_key IS 'المفتاح الفريد للإعداد';
COMMENT ON COLUMN public.general_settings.setting_value IS 'قيمة الإعداد بتنسيق JSON';
COMMENT ON COLUMN public.general_settings.category IS 'فئة الإعداد (system, backup, ui, reports, notifications)';
COMMENT ON COLUMN public.general_settings.setting_type IS 'نوع الإعداد (text, number, boolean, select, time)';
COMMENT ON COLUMN public.general_settings.options IS 'خيارات الإعداد (لنوع select)';

COMMENT ON COLUMN public.security_settings.setting_key IS 'المفتاح الفريد لإعداد الأمان';
COMMENT ON COLUMN public.security_settings.setting_value IS 'قيمة إعداد الأمان بتنسيق JSON';

COMMENT ON COLUMN public.backup_history.backup_type IS 'نوع النسخ الاحتياطي (full, incremental, partial)';
COMMENT ON COLUMN public.backup_history.file_path IS 'مسار ملف النسخ الاحتياطي';
COMMENT ON COLUMN public.backup_history.tables_included IS 'قائمة الجداول المشمولة في النسخ الاحتياطي';
COMMENT ON COLUMN public.backup_history.status IS 'حالة النسخ الاحتياطي (in_progress, completed, failed, cancelled)';
COMMENT ON COLUMN public.backup_history.file_size IS 'حجم ملف النسخ الاحتياطي بالبايت';
COMMENT ON COLUMN public.backup_history.compression_ratio IS 'نسبة الضغط (نسبة مئوية)';

