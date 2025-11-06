-- إصلاح companies table - إضافة الأعمدة المفقودة
ALTER TABLE IF EXISTS public.companies ADD COLUMN IF NOT EXISTS ending_subscription_power_date DATE;
ALTER TABLE IF EXISTS public.companies ADD COLUMN IF NOT EXISTS ending_subscription_moqeem_date DATE;
ALTER TABLE IF EXISTS public.companies ADD COLUMN IF NOT EXISTS ending_subscription_insurance_date DATE;
ALTER TABLE IF EXISTS public.companies ADD COLUMN IF NOT EXISTS commercial_registration_status TEXT;
ALTER TABLE IF EXISTS public.companies ADD COLUMN IF NOT EXISTS insurance_subscription_status TEXT;
ALTER TABLE IF EXISTS public.companies ADD COLUMN IF NOT EXISTS max_employees INTEGER DEFAULT 4;

-- إيقاف RLS مؤقتاً
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;