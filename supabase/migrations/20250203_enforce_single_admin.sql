-- Migration: فرض وجود مدير واحد فقط في النظام
-- Created: 2025-02-03
-- Description: إضافة constraint وفحوصات لمنع وجود أكثر من مدير واحد

-- 1. إنشاء دالة للتحقق من وجود مدير واحد فقط
-- =========================================
CREATE OR REPLACE FUNCTION public.check_single_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- إذا كان المستخدم الجديد أو المحدث ليس admin، لا حاجة للتحقق
  IF NEW.role != 'admin' THEN
    RETURN NEW;
  END IF;

  -- حساب عدد المديرين النشطين
  SELECT COUNT(*) INTO admin_count
  FROM public.users
  WHERE role = 'admin' 
    AND is_active = true
    AND id != NEW.id; -- استثناء المستخدم الحالي

  -- إذا كان هناك مدير آخر، منع العملية
  IF admin_count > 0 THEN
    RAISE EXCEPTION 'Cannot have more than one admin. Only one admin is allowed in the system.';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. إنشاء trigger للتحقق من المدير الوحيد عند INSERT
-- =========================================
DROP TRIGGER IF EXISTS enforce_single_admin_insert ON public.users;
CREATE TRIGGER enforce_single_admin_insert
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_single_admin();

-- 3. إنشاء trigger للتحقق من المدير الوحيد عند UPDATE
-- =========================================
DROP TRIGGER IF EXISTS enforce_single_admin_update ON public.users;
CREATE TRIGGER enforce_single_admin_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'admin' OR OLD.role != NEW.role)
  EXECUTE FUNCTION public.check_single_admin();

-- 4. إضافة تعليق على الدالة
-- =========================================
COMMENT ON FUNCTION public.check_single_admin() IS 'دالة للتحقق من وجود مدير واحد فقط في النظام';

-- 5. التحقق من وجود مدير واحد حالياً (إذا كان هناك أكثر من مدير، سنترك الأول فقط)
-- =========================================
DO $$
DECLARE
  admin_count INTEGER;
  first_admin_id UUID;
BEGIN
  -- حساب عدد المديرين
  SELECT COUNT(*) INTO admin_count
  FROM public.users
  WHERE role = 'admin' AND is_active = true;

  -- إذا كان هناك أكثر من مدير، نحتفظ بالأول فقط (الأقدم)
  IF admin_count > 1 THEN
    -- الحصول على أول مدير (الأقدم)
    SELECT id INTO first_admin_id
    FROM public.users
    WHERE role = 'admin' AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- تغيير دور باقي المديرين إلى user
    UPDATE public.users
    SET role = 'user'
    WHERE role = 'admin' 
      AND is_active = true
      AND id != first_admin_id;

    RAISE NOTICE 'تم تغيير دور % مدير إضافي إلى user. تم الاحتفاظ بالمدير الأول فقط.', admin_count - 1;
  END IF;
END $$;

