-- Migration: إضافة القيم الافتراضية لإعدادات الحالات
-- Created: 2025-01-30
-- Description: إضافة القيم الافتراضية لإعدادات الحالات في system_settings

-- إضافة القيم الافتراضية لإعدادات الحالات (إذا لم تكن موجودة)
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES (
  'status_thresholds',
  '{
    "commercial_reg_critical_days": 7,
    "commercial_reg_urgent_days": 30,
    "commercial_reg_medium_days": 45,
    "social_insurance_critical_days": 7,
    "social_insurance_urgent_days": 30,
    "social_insurance_medium_days": 45,
    "power_subscription_critical_days": 7,
    "power_subscription_urgent_days": 30,
    "power_subscription_medium_days": 45,
    "moqeem_subscription_critical_days": 7,
    "moqeem_subscription_urgent_days": 30,
    "moqeem_subscription_medium_days": 45
  }'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;

-- تحديث RLS Policies للسماح فقط للمديرين بتعديل الإعدادات
-- (القراءة متاحة لجميع المستخدمين المصادق عليهم)

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Allow authenticated users to manage system settings" ON public.system_settings;

-- سياسة جديدة: السماح للجميع بالقراءة
DROP POLICY IF EXISTS "Allow authenticated users to read system settings" ON public.system_settings;
CREATE POLICY "Allow authenticated users to read system settings"
  ON public.system_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- سياسة جديدة: السماح فقط للمديرين بإنشاء وتعديل الإعدادات
CREATE POLICY "Allow admins to manage system settings"
  ON public.system_settings
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

-- تعليقات
COMMENT ON COLUMN public.system_settings.setting_value IS 'قيمة الإعداد بتنسيق JSON - القيم المدخلة: status_thresholds, notification_thresholds';

