-- Migration: حذف الأعمدة غير المستخدمة من جدول المؤسسات
-- Created: 2025-01-10
-- Description: حذف عمود company_type و government_documents_renewal من جدول companies
--              لأنها لم تعد مستخدمة في الكود

-- حذف عمود company_type من جدول companies
ALTER TABLE public.companies 
DROP COLUMN IF EXISTS company_type;

-- حذف عمود government_documents_renewal من جدول companies
ALTER TABLE public.companies 
DROP COLUMN IF EXISTS government_documents_renewal;

-- ملاحظة: هذا الحذف سيؤدي إلى فقدان أي بيانات موجودة في هذه الأعمدة
-- لكن هذا آمن لأن الكود لا يعتمد على هذه الأعمدة بعد الآن

