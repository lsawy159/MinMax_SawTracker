-- Migration: إضافة حقل الملاحظات إلى جدول المؤسسات
-- Created: 2025-01-09
-- Description: إضافة عمود notes إلى جدول companies

-- إضافة عمود notes إلى جدول companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- إضافة تعليق على العمود
COMMENT ON COLUMN public.companies.notes IS 'ملاحظات إضافية عن المؤسسة';

