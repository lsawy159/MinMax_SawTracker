-- Migration: إنشاء الجداول الأمنية المفقودة
-- Created: 2025-02-07
-- Description: إنشاء جداول user_sessions, login_attempts, و user_permissions مع RLS policies

-- =========================================
-- 1. إنشاء جدول user_sessions
-- =========================================
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_info JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة indexes لجدول user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON public.user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON public.user_sessions(user_id, is_active);

-- =========================================
-- 2. إنشاء جدول login_attempts
-- =========================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('success', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة indexes لجدول login_attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON public.login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON public.login_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempt_type ON public.login_attempts(attempt_type);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON public.login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_date ON public.login_attempts(email, created_at DESC);

-- =========================================
-- 3. إنشاء جدول user_permissions
-- =========================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('employees', 'companies', 'users', 'reports', 'settings', 'backups')),
  permission_level TEXT NOT NULL CHECK (permission_level IN ('read', 'write', 'delete', 'export', 'admin')),
  granted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, resource_type, permission_level)
);

-- إضافة indexes لجدول user_permissions
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_resource_type ON public.user_permissions(resource_type);
CREATE INDEX IF NOT EXISTS idx_user_permissions_is_active ON public.user_permissions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires_at ON public.user_permissions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_active ON public.user_permissions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_permissions_resource_active ON public.user_permissions(resource_type, is_active);

-- =========================================
-- 4. تفعيل RLS Policies
-- =========================================

-- تفعيل RLS للجداول
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 5. RLS Policies لجدول user_sessions
-- =========================================

-- السماح للمستخدمين بقراءة جلساتهم الخاصة
DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- السماح للمستخدمين بإنشاء جلساتهم الخاصة
DROP POLICY IF EXISTS "Users can create own sessions" ON public.user_sessions;
CREATE POLICY "Users can create own sessions"
  ON public.user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- السماح للمستخدمين بتحديث جلساتهم الخاصة
DROP POLICY IF EXISTS "Users can update own sessions" ON public.user_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- السماح لخدمة service_role بالوصول الكامل (للـ Edge Functions)
DROP POLICY IF EXISTS "Allow service role full access to user_sessions" ON public.user_sessions;
CREATE POLICY "Allow service role full access to user_sessions"
  ON public.user_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- =========================================
-- 6. RLS Policies لجدول login_attempts
-- =========================================

-- السماح للمستخدمين بقراءة محاولات تسجيل الدخول الخاصة بهم
DROP POLICY IF EXISTS "Users can view own login attempts" ON public.login_attempts;
CREATE POLICY "Users can view own login attempts"
  ON public.login_attempts
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT id FROM public.users WHERE email = login_attempts.email)
  );

-- السماح للمستخدمين المصادق عليهم بإنشاء محاولات تسجيل الدخول
DROP POLICY IF EXISTS "Allow authenticated users to insert login attempts" ON public.login_attempts;
CREATE POLICY "Allow authenticated users to insert login attempts"
  ON public.login_attempts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- السماح لخدمة service_role بالوصول الكامل (للـ Edge Functions)
DROP POLICY IF EXISTS "Allow service role full access to login_attempts" ON public.login_attempts;
CREATE POLICY "Allow service role full access to login_attempts"
  ON public.login_attempts
  FOR ALL
  USING (auth.role() = 'service_role');

-- السماح للمديرين بقراءة جميع محاولات تسجيل الدخول
DROP POLICY IF EXISTS "Admins can view all login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view all login attempts"
  ON public.login_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =========================================
-- 7. RLS Policies لجدول user_permissions
-- =========================================

-- السماح للمستخدمين بقراءة أذوناتهم الخاصة
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;
CREATE POLICY "Users can view own permissions"
  ON public.user_permissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- السماح للمديرين بقراءة جميع الأذونات
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_permissions;
CREATE POLICY "Admins can view all permissions"
  ON public.user_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- السماح للمديرين بإدارة جميع الأذونات
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
CREATE POLICY "Admins can manage all permissions"
  ON public.user_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- السماح لخدمة service_role بالوصول الكامل (للـ Edge Functions)
DROP POLICY IF EXISTS "Allow service role full access to user_permissions" ON public.user_permissions;
CREATE POLICY "Allow service role full access to user_permissions"
  ON public.user_permissions
  FOR ALL
  USING (auth.role() = 'service_role');

-- =========================================
-- 8. إضافة تعليقات توضيحية
-- =========================================

-- تعليقات الجداول
COMMENT ON TABLE public.user_sessions IS 'جلسات المستخدمين النشطة في النظام';
COMMENT ON TABLE public.login_attempts IS 'سجل محاولات تسجيل الدخول (ناجحة وفاشلة)';
COMMENT ON TABLE public.user_permissions IS 'صلاحيات المستخدمين التفصيلية للموارد المختلفة';

-- تعليقات أعمدة user_sessions
COMMENT ON COLUMN public.user_sessions.session_token IS 'رمز الجلسة الفريد';
COMMENT ON COLUMN public.user_sessions.device_info IS 'معلومات الجهاز (متصفح، نظام تشغيل، إلخ)';
COMMENT ON COLUMN public.user_sessions.location IS 'الموقع الجغرافي المستخرج من IP';
COMMENT ON COLUMN public.user_sessions.expires_at IS 'تاريخ انتهاء صلاحية الجلسة';

-- تعليقات أعمدة login_attempts
COMMENT ON COLUMN public.login_attempts.attempt_type IS 'نوع المحاولة: success أو failed';
COMMENT ON COLUMN public.login_attempts.failure_reason IS 'سبب الفشل في حالة المحاولة الفاشلة';

-- تعليقات أعمدة user_permissions
COMMENT ON COLUMN public.user_permissions.resource_type IS 'نوع المورد: employees, companies, users, reports, settings, backups';
COMMENT ON COLUMN public.user_permissions.permission_level IS 'مستوى الصلاحية: read, write, delete, export, admin';
COMMENT ON COLUMN public.user_permissions.granted_by IS 'معرف المستخدم الذي منح الصلاحية';
COMMENT ON COLUMN public.user_permissions.expires_at IS 'تاريخ انتهاء الصلاحية (NULL يعني لا تنتهي)';

