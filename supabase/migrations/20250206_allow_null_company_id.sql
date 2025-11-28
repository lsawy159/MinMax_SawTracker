-- Migration: Allow company_id to be NULL in employees table
-- Created: 2025-02-06
-- Description: إزالة قيد NOT NULL من عمود company_id في جدول employees
--              للسماح للموظفين أن يكونوا بدون شركة عند حذف المؤسسات

-- إزالة قيد NOT NULL من عمود company_id
ALTER TABLE public.employees 
ALTER COLUMN company_id DROP NOT NULL;

-- تحديث foreign key constraint للسماح بقيم NULL
-- (عادة لا نحتاج لتعديل FK constraint لأن NULL مسموح في FK)

-- ملاحظة: الموظفون الذين لا يرتبطون بمؤسسة سيكون company_id = NULL

