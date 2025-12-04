-- Migration: إنشاء دوال SQL للتحقق من الصلاحيات
-- Created: 2025-02-15
-- Description: إنشاء دوال check_user_permission, get_user_permissions, has_any_permission للتحقق من صلاحيات المستخدمين

-- =========================================
-- 1. دالة check_user_permission
-- =========================================
-- الوظيفة: التحقق من صلاحية محددة للمستخدم الحالي
-- المدخلات: section (مثل 'employees'), action (مثل 'view', 'create', 'edit', 'delete')
-- المخرجات: BOOLEAN (true إذا كان لديه الصلاحية)

CREATE OR REPLACE FUNCTION public.check_user_permission(
  section TEXT,
  action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
  user_permissions JSONB;
  user_active BOOLEAN;
  section_perms JSONB;
  has_perm BOOLEAN;
BEGIN
  -- 1. التحقق من أن المستخدم مصادق عليه
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- 2. جلب بيانات المستخدم من جدول users
  SELECT 
    u.role,
    u.permissions,
    u.is_active
  INTO 
    user_role,
    user_permissions,
    user_active
  FROM public.users u
  WHERE u.id = auth.uid();

  -- إذا لم يتم العثور على المستخدم
  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  -- 3. إذا كان المستخدم مدير ونشط → إرجاع true (المدير له جميع الصلاحيات)
  IF user_role = 'admin' AND user_active = true THEN
    RETURN true;
  END IF;

  -- 4. إذا كان المستخدم غير نشط → إرجاع false
  IF user_active = false THEN
    RETURN false;
  END IF;

  -- 5. قراءة permissions->section->action من JSONB
  -- إذا كانت permissions NULL أو فارغة
  IF user_permissions IS NULL OR user_permissions = '{}'::JSONB THEN
    RETURN false;
  END IF;

  -- الحصول على صلاحيات القسم المحدد
  section_perms := user_permissions->section;

  -- إذا لم يكن القسم موجوداً
  IF section_perms IS NULL THEN
    RETURN false;
  END IF;

  -- التحقق من الصلاحية المحددة
  has_perm := (section_perms->action)::boolean;

  -- 6. إرجاع القيمة (إذا كانت true) أو false إذا كانت false أو NULL
  RETURN COALESCE(has_perm, false);
END;
$$;

-- =========================================
-- 2. دالة get_user_permissions
-- =========================================
-- الوظيفة: إرجاع جميع صلاحيات المستخدم الحالي كـ JSONB
-- الاستخدام: للتحقق من عدة صلاحيات دفعة واحدة أو في Edge Functions

CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
  user_permissions JSONB;
  user_active BOOLEAN;
BEGIN
  -- التحقق من أن المستخدم مصادق عليه
  IF auth.uid() IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;

  -- جلب بيانات المستخدم
  SELECT 
    u.role,
    u.permissions,
    u.is_active
  INTO 
    user_role,
    user_permissions,
    user_active
  FROM public.users u
  WHERE u.id = auth.uid();

  -- إذا لم يتم العثور على المستخدم أو غير نشط
  IF user_role IS NULL OR user_active = false THEN
    RETURN '{}'::JSONB;
  END IF;

  -- إذا كان مدير، إرجاع صلاحيات كاملة (يمكن استخدامها في Frontend)
  IF user_role = 'admin' THEN
    RETURN '{
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
  END IF;

  -- إرجاع صلاحيات المستخدم (أو {} إذا كانت NULL)
  RETURN COALESCE(user_permissions, '{}'::JSONB);
END;
$$;

-- =========================================
-- 3. دالة has_any_permission
-- =========================================
-- الوظيفة: التحقق من وجود أي صلاحية من قائمة صلاحيات
-- المدخلات: permissions_array JSONB (مصفوفة من {section, action})
-- المخرجات: BOOLEAN (true إذا كان لديه أي صلاحية من القائمة)

CREATE OR REPLACE FUNCTION public.has_any_permission(
  permissions_array JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  perm_item JSONB;
  section TEXT;
  action TEXT;
BEGIN
  -- التحقق من أن المستخدم مصادق عليه
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- إذا كانت المصفوفة فارغة
  IF permissions_array IS NULL OR jsonb_array_length(permissions_array) = 0 THEN
    RETURN false;
  END IF;

  -- التحقق من كل صلاحية في المصفوفة
  FOR perm_item IN SELECT * FROM jsonb_array_elements(permissions_array)
  LOOP
    section := perm_item->>'section';
    action := perm_item->>'action';

    -- إذا كان أي صلاحية موجودة، إرجاع true
    IF check_user_permission(section, action) THEN
      RETURN true;
    END IF;
  END LOOP;

  -- إذا لم توجد أي صلاحية، إرجاع false
  RETURN false;
END;
$$;

-- =========================================
-- 4. إضافة تعليقات على الدوال
-- =========================================
COMMENT ON FUNCTION public.check_user_permission(TEXT, TEXT) IS 'التحقق من صلاحية محددة للمستخدم الحالي (section, action)';
COMMENT ON FUNCTION public.get_user_permissions() IS 'إرجاع جميع صلاحيات المستخدم الحالي كـ JSONB';
COMMENT ON FUNCTION public.has_any_permission(JSONB) IS 'التحقق من وجود أي صلاحية من قائمة صلاحيات';

-- =========================================
-- 5. منح الصلاحيات
-- =========================================
-- السماح للمستخدمين المصادق عليهم باستدعاء الدوال
GRANT EXECUTE ON FUNCTION public.check_user_permission(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_permission(JSONB) TO authenticated;

-- السماح لخدمة service_role باستدعاء الدوال (للـ Edge Functions)
GRANT EXECUTE ON FUNCTION public.check_user_permission(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_any_permission(JSONB) TO service_role;

