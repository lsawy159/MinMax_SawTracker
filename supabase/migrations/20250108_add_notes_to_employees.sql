-- Migration: إضافة حقل الملاحظات إلى جدول الموظفين
-- Created: 2025-01-08
-- Description: إضافة عمود notes إلى جدول employees

-- إضافة عمود notes إلى جدول employees
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- إضافة تعليق على العمود
COMMENT ON COLUMN public.employees.notes IS 'ملاحظات إضافية عن الموظف';

