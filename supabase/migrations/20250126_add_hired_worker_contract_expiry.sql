-- Migration: إضافة حقل تاريخ انتهاء عقد أجير للموظفين
-- Date: 2025-01-26
-- Description: إضافة عمود hired_worker_contract_expiry إلى جدول employees

-- ==========================================
-- إضافة العمود إلى جدول employees
-- ==========================================

ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS hired_worker_contract_expiry DATE;

-- ==========================================
-- إضافة فهرس على الحقل الجديد (اختياري - لتحسين الأداء)
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_employees_hired_worker_contract_expiry 
  ON public.employees(hired_worker_contract_expiry);

-- ==========================================
-- إضافة تعليق على العمود
-- ==========================================

COMMENT ON COLUMN public.employees.hired_worker_contract_expiry IS 'تاريخ انتهاء عقد أجير للموظف';

-- ==========================================
-- التحقق من أن العمود تم إضافته بنجاح
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'hired_worker_contract_expiry'
  ) THEN
    RAISE EXCEPTION 'فشل إضافة العمود hired_worker_contract_expiry';
  END IF;

  RAISE NOTICE 'تم إضافة العمود hired_worker_contract_expiry بنجاح!';
END $$;

