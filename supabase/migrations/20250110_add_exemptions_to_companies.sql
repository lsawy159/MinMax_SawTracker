-- Migration: إضافة حقل الاعفاءات إلى جدول المؤسسات
-- Created: 2025-01-10
-- Description: إضافة عمود exemptions إلى جدول companies

-- إضافة عمود exemptions إلى جدول companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS exemptions TEXT;

-- إضافة تعليق على العمود
COMMENT ON COLUMN public.companies.exemptions IS 'حقل الاعفاءات: تم الاعفاء، لم يتم الاعفاء، أو أخرى';

