-- Migration: إصلاح صلاحيات مديري النظام
-- Created: 2025-02-02
-- Description: تحديث صلاحيات جميع المستخدمين ذوي دور 'admin' لتكون صلاحيات المدير الكاملة

-- صلاحيات المدير الكاملة
DO $$
DECLARE
  admin_perms JSONB := '{
    "employees": {
      "view": true,
      "create": true,
      "edit": true,
      "delete": true
    },
    "companies": {
      "view": true,
      "create": true,
      "edit": true,
      "delete": true
    },
    "users": {
      "view": true,
      "create": true,
      "edit": true,
      "delete": true
    },
    "settings": {
      "view": true,
      "edit": true
    }
  }'::JSONB;
  updated_count INTEGER;
BEGIN
  -- تحديث صلاحيات جميع المستخدمين ذوي دور 'admin'
  UPDATE public.users
  SET permissions = admin_perms
  WHERE role = 'admin'
    AND (
      -- تحديث إذا كانت الصلاحيات فارغة أو غير صحيحة
      permissions IS NULL 
      OR permissions = '{}'::JSONB
      OR permissions != admin_perms
    );
  
  -- الحصول على عدد الصفوف المتأثرة
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- إرجاع عدد المستخدمين المحدثين
  RAISE NOTICE 'تم تحديث صلاحيات % مستخدم ذو دور admin', updated_count;
END $$;

-- التحقق من النتيجة
SELECT 
  id,
  email,
  full_name,
  role,
  permissions,
  is_active
FROM public.users
WHERE role = 'admin'
ORDER BY created_at;

