-- Migration: تحديث صلاحيات المدير لتشمل جميع الأقسام
-- Created: 2025-02-15
-- Description: تحديث permissions لجميع المستخدمين ذوي role = 'admin' لتشمل جميع الأقسام المطلوبة

-- الصلاحيات الكاملة للمدير
DO $$
DECLARE
  admin_perms JSONB := '{
    "employees": {"view": true, "create": true, "edit": true, "delete": true},
    "companies": {"view": true, "create": true, "edit": true, "delete": true},
    "users": {"view": true, "create": true, "edit": true, "delete": true},
    "settings": {"view": true, "edit": true},
    "adminSettings": {"view": true, "edit": true},
    "projects": {"view": true, "create": true, "edit": true, "delete": true},
    "reports": {"view": true, "export": true},
    "alerts": {"view": true},
    "advancedSearch": {"view": true},
    "importExport": {"view": true, "import": true, "export": true},
    "activityLogs": {"view": true},
    "dashboard": {"view": true}
  }'::JSONB;
  updated_count INTEGER;
BEGIN
  -- تحديث صلاحيات جميع المستخدمين ذوي دور 'admin'
  UPDATE public.users
  SET permissions = admin_perms
  WHERE role = 'admin'
    AND (
      -- تحديث إذا كانت الصلاحيات فارغة أو غير صحيحة أو ناقصة
      permissions IS NULL 
      OR permissions = '{}'::JSONB
      OR permissions != admin_perms
      -- أو إذا كانت تفتقد أي قسم من الأقسام المطلوبة
      OR permissions->'adminSettings' IS NULL
      OR permissions->'projects' IS NULL
      OR permissions->'alerts' IS NULL
      OR permissions->'advancedSearch' IS NULL
      OR permissions->'importExport' IS NULL
      OR permissions->'activityLogs' IS NULL
      OR permissions->'dashboard' IS NULL
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
  is_active,
  CASE 
    WHEN permissions->'adminSettings' IS NOT NULL 
      AND permissions->'projects' IS NOT NULL 
      AND permissions->'alerts' IS NOT NULL 
      AND permissions->'advancedSearch' IS NOT NULL 
      AND permissions->'importExport' IS NOT NULL 
      AND permissions->'activityLogs' IS NOT NULL 
      AND permissions->'dashboard' IS NOT NULL 
    THEN 'OK'
    ELSE 'MISSING SECTIONS'
  END as permission_status
FROM public.users
WHERE role = 'admin'
ORDER BY created_at;

