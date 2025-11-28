-- Migration: إزالة الحقول غير المرغوبة من جدول الموظفين
-- Created: 2025-01-31
-- Description: إزالة employee_number, contract_number, housing_allowance, transport_allowance, insurance_number

-- إزالة الأعمدة غير المرغوبة من جدول employees
ALTER TABLE public.employees 
DROP COLUMN IF EXISTS employee_number,
DROP COLUMN IF EXISTS contract_number,
DROP COLUMN IF EXISTS housing_allowance,
DROP COLUMN IF EXISTS transport_allowance,
DROP COLUMN IF EXISTS insurance_number;

-- ملاحظة: additional_fields تبقى لأنها تُستخدم للحقول المخصصة من قاعدة البيانات (custom_fields)

