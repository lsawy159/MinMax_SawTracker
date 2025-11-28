-- Migration: حذف حقل muqeem_expiry واستبداله بـ ending_subscription_moqeem_date
-- Date: 2025-01-27
-- Description: نقل البيانات من muqeem_expiry إلى ending_subscription_moqeem_date ثم حذف العمود

-- ==========================================
-- 1. نقل البيانات من muqeem_expiry إلى ending_subscription_moqeem_date
-- ==========================================

-- نقل البيانات فقط إذا كانت ending_subscription_moqeem_date فارغة و muqeem_expiry موجود
UPDATE public.companies
SET ending_subscription_moqeem_date = muqeem_expiry
WHERE muqeem_expiry IS NOT NULL
  AND ending_subscription_moqeem_date IS NULL;

-- ==========================================
-- 2. حذف العمود muqeem_expiry
-- ==========================================

ALTER TABLE public.companies 
  DROP COLUMN IF EXISTS muqeem_expiry;

-- ==========================================
-- 3. التحقق من أن العمود تم حذفه بنجاح
-- ==========================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'companies' 
    AND column_name = 'muqeem_expiry'
  ) THEN
    RAISE EXCEPTION 'فشل حذف العمود muqeem_expiry';
  END IF;

  RAISE NOTICE 'تم حذف العمود muqeem_expiry بنجاح!';
END $$;

