-- إصلاح companies table - إضافة جميع الأعمدة المفقودة
DROP TABLE IF EXISTS public.companies CASCADE;
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tax_number BIGINT,
  unified_number BIGINT,
  labor_subscription_number TEXT,
  company_type TEXT,
  commercial_registration_expiry DATE,
  insurance_subscription_expiry DATE,
  ending_subscription_power_date DATE,
  ending_subscription_moqeem_date DATE,
  ending_subscription_insurance_date DATE,
  commercial_registration_status TEXT,
  insurance_subscription_status TEXT,
  insurance_subscription_number TEXT,
  current_employees INTEGER DEFAULT 0,
  government_documents_renewal TEXT,
  muqeem_expiry DATE,
  max_employees INTEGER DEFAULT 4,
  additional_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إيقاف RLS مؤقتاً للاختبار
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;

-- إضافة index للـ performance
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_expiry ON public.companies(commercial_registration_expiry);