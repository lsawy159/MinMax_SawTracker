-- Migration: Permissions System Upgrade - Phase 1
-- تاريخ: 2026-04-25
-- الغرض: دعم role جديد (manager) + تحضير قاعدة البيانات لترقية الصلاحيات

-- 1. تحديث constraint على عمود role ليقبل manager
-- ملاحظة: إذا كان هناك CHECK constraint قديم، احذفه أولاً
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_check;

-- أضف CHECK جديد يقبل الأدوار الثلاثة
ALTER TABLE public.users
ADD CONSTRAINT users_role_check
CHECK (role IN ('admin', 'manager', 'user'));

-- 2. إضافة trigger لفرض single-admin rule
-- هذا يضمن أنه لا يمكن وجود أكثر من admin واحد في النظام
CREATE OR REPLACE FUNCTION enforce_single_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- إذا كان المستخدم الجديد يُعيّن كـ admin
  IF NEW.role = 'admin' THEN
    -- تحقق إذا كان هناك admin آخر نشط
    IF (SELECT COUNT(*) FROM public.users
        WHERE role = 'admin'
        AND id != NEW.id
        AND is_active = true) > 0 THEN
      RAISE EXCEPTION 'Only one active admin is allowed in the system';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- احذف trigger القديم إذا كان موجوداً
DROP TRIGGER IF EXISTS enforce_single_admin_trigger ON public.users;

-- أنشئ trigger جديد
CREATE TRIGGER enforce_single_admin_trigger
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION enforce_single_admin();

-- 3. معلومات توثيقية (لا تؤثر على الوظيفة)
-- النسخة الحالية من نظام الصلاحيات: 1.1 (يدعم كلا الصيغتين: JSON object و string[])
-- يمكن تحويل البيانات القديمة تدريجياً دون توقف الخدمة
