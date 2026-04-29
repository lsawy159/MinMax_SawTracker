-- Migration: إصلاح جدول activity_log - إضافة الأعمدة والـ indexes المفقودة
-- Created: 2026-04-28
-- Description: استخدام DO block لتجنب أخطاء الأعمدة المفقودة عند إنشاء الـ indexes

-- إضافة الأعمدة المفقودة باستخدام DO block للتعامل مع الحالات المختلفة
DO $$
BEGIN
  -- إضافة العمود entity_type إذا لم يكن موجوداً
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'activity_log' 
    AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE public.activity_log ADD COLUMN entity_type TEXT;
  END IF;

  -- إضافة العمود entity_id إذا لم يكن موجوداً
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'activity_log' 
    AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.activity_log ADD COLUMN entity_id UUID;
  END IF;
END $$;

-- الآن يمكننا بأمان إنشاء الـ indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);

-- إضافة comments على الأعمدة
COMMENT ON COLUMN public.activity_log.entity_type IS 'نوع الكيان: employee, company, user, settings';
COMMENT ON COLUMN public.activity_log.entity_id IS 'معرف الكيان المتأثر بالعملية';
