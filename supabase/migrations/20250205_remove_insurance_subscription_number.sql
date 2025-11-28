-- Migration: Remove insurance_subscription_number column from companies table
-- Created: 2025-02-05
-- Description: إزالة عمود insurance_subscription_number (رقم اشتراك التأمينات للشركات) 
--              لأنه تم استبداله بـ social_insurance_number (رقم اشتراك التأمينات الاجتماعية)

-- التحقق من وجود العمود قبل إزالته
DO $$
BEGIN
  -- إزالة العمود إذا كان موجوداً
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'insurance_subscription_number'
  ) THEN
    ALTER TABLE public.companies 
    DROP COLUMN IF EXISTS insurance_subscription_number;
    
    RAISE NOTICE 'تم إزالة عمود insurance_subscription_number من جدول companies';
  ELSE
    RAISE NOTICE 'العمود insurance_subscription_number غير موجود في جدول companies';
  END IF;
END $$;

