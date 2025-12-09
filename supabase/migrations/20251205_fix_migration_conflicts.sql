-- ============================================
-- Migration: إصلاح التعارضات في Migrations
-- Created: 2025-12-05
-- Description: حل التعارضات بين migrations السابقة والتأكد من أن البنية صحيحة
-- ============================================
-- ⚠️ مهم: شغّل check_database_status.sql أولاً للتحقق من الحالة الحالية
-- ============================================

-- 1. إصلاح company_type (التعارض الرئيسي)
-- ============================================
-- المشكلة: 
--   - 20250110_remove_company_type_and_gov_docs.sql يحذف company_type
--   - 20250120_remove_tax_number_add_company_type.sql يضيف company_type
--   - الكود في src/lib/supabase.ts يستخدم company_type
-- الحل: التأكد من وجود company_type (مطلوب للكود)

DO $$
BEGIN
    -- التحقق من وجود company_type وإضافته إذا لم يكن موجوداً
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
            AND table_name = 'companies' 
            AND column_name = 'company_type'
    ) THEN
        ALTER TABLE public.companies 
        ADD COLUMN company_type TEXT;
        
        RAISE NOTICE '✓ تم إضافة عمود company_type';
    ELSE
        RAISE NOTICE '✓ عمود company_type موجود بالفعل';
    END IF;
END $$;

-- 2. إزالة tax_number (إذا كان موجوداً)
-- ============================================
-- tax_number لم يعد مستخدماً في الكود ويجب حذفه

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
            AND table_name = 'companies' 
            AND column_name = 'tax_number'
    ) THEN
        ALTER TABLE public.companies 
        DROP COLUMN IF EXISTS tax_number;
        
        RAISE NOTICE '✓ تم حذف عمود tax_number (لم يعد مستخدماً)';
    ELSE
        RAISE NOTICE '✓ عمود tax_number غير موجود (صحيح)';
    END IF;
END $$;

-- 3. إزالة government_documents_renewal (إذا كان موجوداً)
-- ============================================
-- government_documents_renewal لم يعد مستخدماً في الكود

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
            AND table_name = 'companies' 
            AND column_name = 'government_documents_renewal'
    ) THEN
        ALTER TABLE public.companies 
        DROP COLUMN IF EXISTS government_documents_renewal;
        
        RAISE NOTICE '✓ تم حذف عمود government_documents_renewal (لم يعد مستخدماً)';
    ELSE
        RAISE NOTICE '✓ عمود government_documents_renewal غير موجود (صحيح)';
    END IF;
END $$;

-- 4. التأكد من وجود الأعمدة المطلوبة للكود
-- ============================================
-- بناءً على src/lib/supabase.ts، هذه الأعمدة مطلوبة:

DO $$
BEGIN
    -- social_insurance_expiry (بدلاً من insurance_subscription_expiry القديم)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'social_insurance_expiry'
    ) THEN
        -- محاولة إعادة تسمية insurance_subscription_expiry إذا كان موجوداً
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = 'companies'
                AND column_name = 'insurance_subscription_expiry'
        ) THEN
            ALTER TABLE public.companies
            RENAME COLUMN insurance_subscription_expiry TO social_insurance_expiry;
            RAISE NOTICE '✓ تم إعادة تسمية insurance_subscription_expiry إلى social_insurance_expiry';
        ELSE
            ALTER TABLE public.companies
            ADD COLUMN social_insurance_expiry DATE;
            RAISE NOTICE '✓ تم إضافة عمود social_insurance_expiry';
        END IF;
    END IF;
    
    -- social_insurance_number
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'social_insurance_number'
    ) THEN
        ALTER TABLE public.companies
        ADD COLUMN social_insurance_number TEXT;
        RAISE NOTICE '✓ تم إضافة عمود social_insurance_number';
    END IF;
    
    -- social_insurance_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'social_insurance_status'
    ) THEN
        ALTER TABLE public.companies
        ADD COLUMN social_insurance_status TEXT;
        RAISE NOTICE '✓ تم إضافة عمود social_insurance_status';
    END IF;
    
    -- notes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.companies
        ADD COLUMN notes TEXT;
        RAISE NOTICE '✓ تم إضافة عمود notes';
    END IF;
    
    -- exemptions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'exemptions'
    ) THEN
        ALTER TABLE public.companies
        ADD COLUMN exemptions TEXT;
        RAISE NOTICE '✓ تم إضافة عمود exemptions';
    END IF;
    
    -- employee_count (إذا لم يكن موجوداً)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'employee_count'
    ) THEN
        ALTER TABLE public.companies
        ADD COLUMN employee_count INTEGER DEFAULT 0;
        RAISE NOTICE '✓ تم إضافة عمود employee_count';
    END IF;
END $$;

-- 5. إزالة insurance_subscription_number إذا كان موجوداً (تم استبداله بـ social_insurance_number)
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'insurance_subscription_number'
    ) THEN
        -- نقل البيانات إلى social_insurance_number إذا كان فارغاً
        UPDATE public.companies
        SET social_insurance_number = insurance_subscription_number
        WHERE social_insurance_number IS NULL 
            AND insurance_subscription_number IS NOT NULL;
        
        -- حذف العمود القديم
        ALTER TABLE public.companies
        DROP COLUMN IF EXISTS insurance_subscription_number;
        
        RAISE NOTICE '✓ تم نقل البيانات من insurance_subscription_number إلى social_insurance_number وحذف العمود القديم';
    END IF;
END $$;

-- 6. إزالة insurance_subscription_status إذا كان موجوداً (تم استبداله بـ social_insurance_status)
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'insurance_subscription_status'
    ) THEN
        -- نقل البيانات إلى social_insurance_status إذا كان فارغاً
        UPDATE public.companies
        SET social_insurance_status = insurance_subscription_status
        WHERE social_insurance_status IS NULL 
            AND insurance_subscription_status IS NOT NULL;
        
        -- حذف العمود القديم
        ALTER TABLE public.companies
        DROP COLUMN IF EXISTS insurance_subscription_status;
        
        RAISE NOTICE '✓ تم نقل البيانات من insurance_subscription_status إلى social_insurance_status وحذف العمود القديم';
    END IF;
END $$;

-- 7. ملخص التغييرات
-- ============================================
DO $$
DECLARE
    company_type_exists BOOLEAN;
    tax_number_exists BOOLEAN;
    gov_docs_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'company_type'
    ) INTO company_type_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'tax_number'
    ) INTO tax_number_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'government_documents_renewal'
    ) INTO gov_docs_exists;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ملخص إصلاح التعارضات:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'company_type: %', CASE WHEN company_type_exists THEN 'موجود ✓' ELSE 'غير موجود ✗' END;
    RAISE NOTICE 'tax_number: %', CASE WHEN tax_number_exists THEN 'موجود (خطأ) ✗' ELSE 'غير موجود (صحيح) ✓' END;
    RAISE NOTICE 'government_documents_renewal: %', CASE WHEN gov_docs_exists THEN 'موجود (خطأ) ✗' ELSE 'غير موجود (صحيح) ✓' END;
    RAISE NOTICE '========================================';
    
    IF company_type_exists AND NOT tax_number_exists AND NOT gov_docs_exists THEN
        RAISE NOTICE '✅ جميع التعارضات تم حلها بنجاح!';
    ELSE
        RAISE WARNING '⚠️  يرجى مراجعة النتائج أعلاه';
    END IF;
END $$;

