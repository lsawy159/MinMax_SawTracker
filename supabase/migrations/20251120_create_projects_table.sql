-- Migration: Create Projects Table
-- Created: 2025-11-20
-- Description: إنشاء جدول المشاريع لإدارة المشاريع بشكل منفصل

-- 1. إنشاء جدول المشاريع
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. إنشاء Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_projects_name ON public.projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- 3. إنشاء trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at_trigger
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- 4. تعطيل RLS مؤقتاً (يمكن تفعيله لاحقاً)
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

-- 5. تعليقات على الجدول
COMMENT ON TABLE public.projects IS 'جدول المشاريع لإدارة المشاريع في النظام';
COMMENT ON COLUMN public.projects.name IS 'اسم المشروع (يجب أن يكون فريد)';
COMMENT ON COLUMN public.projects.description IS 'وصف المشروع (اختياري)';
COMMENT ON COLUMN public.projects.status IS 'حالة المشروع: active (نشط), inactive (متوقف), completed (مكتمل)';

