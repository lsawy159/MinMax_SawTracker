-- Migration: حذف حقول رقم التأمين الصحي وتاريخ بداية التأمين الصحي من جدول employees
-- Date: 2025-01-26
-- Description: حذف الأعمدة health_insurance_number و health_insurance_start من جدول employees
--              الإبقاء على health_insurance_expiry فقط

-- ==========================================
-- حذف الأعمدة من جدول employees
-- ==========================================

DO $$
BEGIN
  -- التحقق من وجود health_insurance_number وحذفه إذا كان موجوداً
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'health_insurance_number'
  ) THEN
    ALTER TABLE public.employees 
      DROP COLUMN health_insurance_number;
    RAISE NOTICE 'تم حذف العمود health_insurance_number بنجاح';
  ELSE
    RAISE NOTICE 'العمود health_insurance_number غير موجود';
  END IF;

  -- التحقق من وجود health_insurance_start وحذفه إذا كان موجوداً
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'health_insurance_start'
  ) THEN
    ALTER TABLE public.employees 
      DROP COLUMN health_insurance_start;
    RAISE NOTICE 'تم حذف العمود health_insurance_start بنجاح';
  ELSE
    RAISE NOTICE 'العمود health_insurance_start غير موجود';
  END IF;
END $$;

-- ==========================================
-- التحقق من أن الحقول تم حذفها بنجاح
-- ==========================================

DO $$
BEGIN
  -- التحقق من أن health_insurance_number تم حذفه
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'health_insurance_number'
  ) THEN
    RAISE EXCEPTION 'فشل حذف العمود health_insurance_number';
  END IF;

  -- التحقق من أن health_insurance_start تم حذفه
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'health_insurance_start'
  ) THEN
    RAISE EXCEPTION 'فشل حذف العمود health_insurance_start';
  END IF;

  -- التحقق من أن health_insurance_expiry لا يزال موجوداً
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'health_insurance_expiry'
  ) THEN
    RAISE EXCEPTION 'العمود health_insurance_expiry غير موجود - يجب أن يبقى موجوداً';
  END IF;

  RAISE NOTICE 'تم التحقق من حذف الحقول بنجاح!';
END $$;

