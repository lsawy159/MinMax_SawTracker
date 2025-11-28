-- Migration: إزالة عمود tax_number وإضافة company_type
-- Created: 2025-01-20
-- Description: إزالة عمود tax_number (الرقم التأميني) من جدول companies لأنه لم يعد مستخدماً
--              وإضافة عمود company_type إذا لم يكن موجوداً

-- إزالة عمود tax_number من جدول companies
ALTER TABLE public.companies 
DROP COLUMN IF EXISTS tax_number;

-- إضافة عمود company_type إذا لم يكن موجوداً
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'company_type'
    ) THEN
        ALTER TABLE public.companies 
        ADD COLUMN company_type TEXT;
    END IF;
END $$;

-- ملاحظة: سيتم فقدان أي بيانات موجودة في عمود tax_number
-- لكن هذا آمن لأن الكود لا يعتمد على هذا العمود بعد الآن

