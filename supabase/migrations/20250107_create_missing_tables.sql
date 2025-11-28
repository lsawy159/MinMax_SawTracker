-- Migration: إنشاء الجداول المفقودة
-- Created: 2025-01-07
-- Description: إنشاء جداول activity_log و custom_fields مع RLS policies

-- 1. إنشاء جدول activity_log
-- =========================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  operation TEXT,
  operation_status TEXT DEFAULT 'success',
  affected_rows INTEGER DEFAULT 1,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة indexes للأداء
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log(action);

-- 2. إنشاء جدول custom_fields
-- =========================================
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('employee', 'company')),
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'textarea', 'boolean')),
  field_options JSONB DEFAULT '{}',
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_type, field_name)
);

-- إضافة indexes
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity_type ON public.custom_fields(entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_is_active ON public.custom_fields(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_fields_display_order ON public.custom_fields(entity_type, display_order);

-- 3. إضافة RLS Policies
-- =========================================

-- تفعيل RLS للجداول
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- Policies لجدول activity_log
-- السماح للمستخدمين المصادق عليهم بقراءة سجلات النشاط
DROP POLICY IF EXISTS "Allow authenticated users to read activity logs" ON public.activity_log;
CREATE POLICY "Allow authenticated users to read activity logs"
  ON public.activity_log
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- السماح للمستخدمين المصادق عليهم بإنشاء سجلات نشاط
DROP POLICY IF EXISTS "Allow authenticated users to insert activity logs" ON public.activity_log;
CREATE POLICY "Allow authenticated users to insert activity logs"
  ON public.activity_log
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- السماح لخدمة service_role بالوصول الكامل (لـ Edge Functions)
DROP POLICY IF EXISTS "Allow service role full access to activity logs" ON public.activity_log;
CREATE POLICY "Allow service role full access to activity logs"
  ON public.activity_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies لجدول custom_fields
-- السماح للمستخدمين المصادق عليهم بقراءة الحقول المخصصة
DROP POLICY IF EXISTS "Allow authenticated users to read custom fields" ON public.custom_fields;
CREATE POLICY "Allow authenticated users to read custom fields"
  ON public.custom_fields
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- السماح للمستخدمين المصادق عليهم بإنشاء وتعديل الحقول المخصصة
DROP POLICY IF EXISTS "Allow authenticated users to manage custom fields" ON public.custom_fields;
CREATE POLICY "Allow authenticated users to manage custom fields"
  ON public.custom_fields
  FOR ALL
  USING (auth.role() = 'authenticated');

-- السماح لخدمة service_role بالوصول الكامل
DROP POLICY IF EXISTS "Allow service role full access to custom fields" ON public.custom_fields;
CREATE POLICY "Allow service role full access to custom fields"
  ON public.custom_fields
  FOR ALL
  USING (auth.role() = 'service_role');

-- 4. إضافة trigger لتحديث updated_at في custom_fields
-- =========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_custom_fields_updated_at ON public.custom_fields;
CREATE TRIGGER update_custom_fields_updated_at
  BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. إضافة تعليقات على الجداول
-- =========================================
COMMENT ON TABLE public.activity_log IS 'سجل جميع الأنشطة والعمليات في النظام';
COMMENT ON TABLE public.custom_fields IS 'الحقول المخصصة للموظفين والمؤسسات';

COMMENT ON COLUMN public.activity_log.entity_type IS 'نوع الكيان: employee, company, user, settings';
COMMENT ON COLUMN public.activity_log.entity_id IS 'معرف الكيان المتأثر';
COMMENT ON COLUMN public.activity_log.details IS 'تفاصيل إضافية عن العملية';
COMMENT ON COLUMN public.custom_fields.entity_type IS 'نوع الكيان: employee أو company';
COMMENT ON COLUMN public.custom_fields.field_options IS 'خيارات الحقل (مثل قائمة الاختيار)';

