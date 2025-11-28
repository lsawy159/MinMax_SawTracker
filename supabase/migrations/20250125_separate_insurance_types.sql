-- Migration: فصل التأمين الصحي للموظفين عن التأمينات الاجتماعية للمؤسسات
-- Date: 2025-01-25
-- Description: إعادة تسمية الحقول لفصل التأمينات بوضوح

-- ==========================================
-- 1. تحديث جدول companies
-- ==========================================

DO $$
BEGIN
  -- التحقق من وجود insurance_subscription_expiry وإعادة تسميته إذا كان موجوداً
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'insurance_subscription_expiry'
  ) THEN
    -- إعادة تسمية العمود القديم إلى الجديد
    ALTER TABLE public.companies 
      RENAME COLUMN insurance_subscription_expiry TO social_insurance_expiry;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'social_insurance_expiry'
  ) THEN
    -- إنشاء العمود الجديد إذا لم يكن موجوداً أصلاً
    ALTER TABLE public.companies 
      ADD COLUMN social_insurance_expiry DATE;
  END IF;

  -- التحقق من وجود insurance_subscription_status وإعادة تسميته إذا كان موجوداً
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'insurance_subscription_status'
  ) THEN
    ALTER TABLE public.companies 
      RENAME COLUMN insurance_subscription_status TO social_insurance_status;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'social_insurance_status'
  ) THEN
    ALTER TABLE public.companies 
      ADD COLUMN social_insurance_status TEXT;
  END IF;
END $$;

-- إضافة عمود جديد لرقم اشتراك التأمينات الاجتماعية
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS social_insurance_number TEXT;

-- حذف ending_subscription_insurance_date من companies (هذا للموظفين فقط)
-- نتركه في الوقت الحالي لتجنب فقدان البيانات، سنحذفه لاحقاً بعد التحقق

-- ==========================================
-- 2. تحديث جدول employees
-- ==========================================

DO $$
BEGIN
  -- التحقق من وجود ending_subscription_insurance_date وإعادة تسميته إذا كان موجوداً
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'ending_subscription_insurance_date'
  ) THEN
    -- إعادة تسمية العمود القديم إلى الجديد
    ALTER TABLE public.employees 
      RENAME COLUMN ending_subscription_insurance_date TO health_insurance_expiry;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'health_insurance_expiry'
  ) THEN
    -- إنشاء العمود الجديد إذا لم يكن موجوداً أصلاً
    ALTER TABLE public.employees 
      ADD COLUMN health_insurance_expiry DATE;
  END IF;

  -- التحقق من وجود insurance_number وإعادة تسميته إذا كان موجوداً
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'insurance_number'
  ) THEN
    ALTER TABLE public.employees 
      RENAME COLUMN insurance_number TO health_insurance_number;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'health_insurance_number'
  ) THEN
    ALTER TABLE public.employees 
      ADD COLUMN health_insurance_number TEXT;
  END IF;
END $$;

-- إضافة عمود جديد لتاريخ بداية التأمين الصحي (اختياري)
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS health_insurance_start DATE;

-- ==========================================
-- 3. تحديث الفهارس (Indexes) إذا لزم الأمر
-- ==========================================

-- إضافة فهرس على social_insurance_expiry
CREATE INDEX IF NOT EXISTS idx_companies_social_insurance_expiry 
  ON public.companies(social_insurance_expiry);

-- إضافة فهرس على health_insurance_expiry
CREATE INDEX IF NOT EXISTS idx_employees_health_insurance_expiry 
  ON public.employees(health_insurance_expiry);

-- ==========================================
-- 4. تحديث التعليقات (Comments) لتوضيح الحقول
-- ==========================================

COMMENT ON COLUMN public.companies.social_insurance_expiry IS 'تاريخ انتهاء التأمينات الاجتماعية للمؤسسة';
COMMENT ON COLUMN public.companies.social_insurance_number IS 'رقم اشتراك التأمينات الاجتماعية للمؤسسة';
COMMENT ON COLUMN public.companies.social_insurance_status IS 'حالة التأمينات الاجتماعية (محسوبة تلقائياً)';

COMMENT ON COLUMN public.employees.health_insurance_expiry IS 'تاريخ انتهاء التأمين الصحي للموظف';
COMMENT ON COLUMN public.employees.health_insurance_number IS 'رقم التأمين الصحي للموظف';
COMMENT ON COLUMN public.employees.health_insurance_start IS 'تاريخ بداية التأمين الصحي للموظف (اختياري)';

-- ==========================================
-- 5. التأكد من الحفاظ على البيانات
-- ==========================================

-- التحقق من أن الحقول الجديدة موجودة
DO $$
BEGIN
  -- التحقق من وجود الحقول الجديدة
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'social_insurance_expiry'
  ) THEN
    RAISE EXCEPTION 'فشل إنشاء/إعادة تسمية العمود social_insurance_expiry';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'health_insurance_expiry'
  ) THEN
    RAISE EXCEPTION 'فشل إنشاء/إعادة تسمية العمود health_insurance_expiry';
  END IF;

  RAISE NOTICE 'تم تحديث الحقول بنجاح!';
END $$;

