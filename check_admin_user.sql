-- استعلام للتحقق من بيانات المستخدم admin@sawtracker.com
-- نفذ هذا في Supabase SQL Editor

-- 1. البحث عن المستخدم في جدول users
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  permissions,
  created_at,
  last_login
FROM public.users
WHERE email = 'admin@sawtracker.com';

-- 2. التحقق من جميع المديرين في النظام
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM public.users
WHERE role = 'admin'
ORDER BY created_at ASC;

-- 3. إذا كان المستخدم موجود لكن ليس admin، نفذ هذا لإصلاحه:
-- (استبدل USER_ID_HERE بـ ID المستخدم من الاستعلام الأول)
/*
UPDATE public.users
SET 
  role = 'admin',
  is_active = true,
  permissions = '{
    "employees": {"view": true, "create": true, "edit": true, "delete": true},
    "companies": {"view": true, "create": true, "edit": true, "delete": true},
    "users": {"view": true, "create": true, "edit": true, "delete": true},
    "settings": {"view": true, "edit": true}
  }'::jsonb
WHERE email = 'admin@sawtracker.com';
*/

-- 4. إذا كان المستخدم غير موجود في جدول users، نفذ هذا:
-- (استبدل AUTH_USER_ID_HERE بـ ID من auth.users)
/*
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  permissions,
  is_active
)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', 'أحمد الصاوي') as full_name,
  'admin' as role,
  '{
    "employees": {"view": true, "create": true, "edit": true, "delete": true},
    "companies": {"view": true, "create": true, "edit": true, "delete": true},
    "users": {"view": true, "create": true, "edit": true, "delete": true},
    "settings": {"view": true, "edit": true}
  }'::jsonb as permissions,
  true as is_active
FROM auth.users
WHERE email = 'admin@sawtracker.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'admin',
  is_active = true,
  permissions = EXCLUDED.permissions;
*/

