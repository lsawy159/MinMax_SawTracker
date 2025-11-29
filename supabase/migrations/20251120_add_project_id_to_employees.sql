-- Migration: Add Project ID to Employees Table
-- Created: 2025-11-20
-- Description: إضافة حقل project_id لجدول الموظفين للربط بجدول المشاريع

-- 1. إضافة حقل project_id إلى جدول الموظفين
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2. إضافة Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_employees_project_id ON public.employees(project_id);

-- 3. تعليق على العمود
COMMENT ON COLUMN public.employees.project_id IS 'معرف المشروع المرتبط بالموظف (يمكن أن يكون NULL)';

-- ملاحظة: سنحتفظ بـ project_name مؤقتاً للتوافق مع البيانات القديمة

