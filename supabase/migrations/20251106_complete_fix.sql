-- Migration: Complete Database Fix for Saw Tracker
-- Created: 2025-11-06

-- 1. إصلاح users table أولاً
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- إصلاح RLS للـ users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to read users" ON public.users;
DROP POLICY IF EXISTS "Enable RLS on users" ON public.users;

-- إنشاء policies صحيحة للـ users
CREATE POLICY "Allow users to read all" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow users to insert own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Allow users to update own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow service role full access" ON public.users FOR ALL USING (auth.role() = 'service_role');

-- 2. إصلاح companies table - إضافة جميع الأعمدة المفقودة
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

-- 3. إصلاح employees table أيضاً
DROP TABLE IF EXISTS public.employees CASCADE;
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profession TEXT,
  nationality TEXT,
  birth_date DATE,
  phone TEXT,
  passport_number TEXT,
  residence_number BIGINT,
  joining_date DATE,
  contract_expiry DATE,
  residence_expiry DATE,
  project_name TEXT,
  bank_account TEXT,
  residence_image_url TEXT,
  employee_number TEXT,
  contract_number TEXT,
  insurance_number TEXT,
  salary DECIMAL(10,2),
  housing_allowance DECIMAL(10,2),
  transport_allowance DECIMAL(10,2),
  ending_subscription_insurance_date DATE,
  additional_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. إيقاف RLS مؤقتاً للاختبار
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 5. إضافة index للـ performance
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_expiry ON public.companies(commercial_registration_expiry);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 6. إدراج البيانات التجريبية للشركات
INSERT INTO public.companies (
  id, name, tax_number, unified_number, labor_subscription_number, 
  company_type, commercial_registration_expiry, insurance_subscription_expiry,
  ending_subscription_power_date, ending_subscription_moqeem_date, max_employees,
  created_at, updated_at
) VALUES 
(
  gen_random_uuid(), 
  'شركة سارة للمقاولات', 
  1234567890, 9876543210, 'L001', 'مقاولات',
  '2025-12-31', '2025-12-31', '2025-12-31', '2025-12-31', 4,
  NOW(), NOW()
),
(
  gen_random_uuid(), 
  'شركة النصر للتشغيل', 
  2345678901, 8765432109, 'L002', 'تشغيل وصيانة',
  '2025-11-20', '2025-11-25', '2025-11-20', '2025-11-25', 4,
  NOW(), NOW()
),
(
  gen_random_uuid(), 
  'شركة الحداثة المحدودة', 
  3456789012, 7654321098, 'L003', 'تجارة عامة',
  '2025-11-10', '2025-11-12', '2025-11-10', '2025-11-12', 4,
  NOW(), NOW()
),
(
  gen_random_uuid(), 
  'شركة المستقبل', 
  4567890123, 6543210987, 'L004', 'خدمات عامة',
  '2025-10-15', '2025-10-20', '2025-10-15', '2025-10-20', 4,
  NOW(), NOW()
),
(
  gen_random_uuid(), 
  'شركة النهضة الحديثة', 
  5678901234, 5432109876, 'L005', 'صيانة',
  '2025-11-28', '2025-11-30', '2025-11-28', '2025-11-30', 4,
  NOW(), NOW()
),
(
  '3edac455-f819-4420-815a-4db8518e33f3',
  'شركة سواعدنا للتشغيل والصيانة',
  6789012345,
  4321098765,
  'L006',
  'تشغيل وصيانة',
  '2025-11-15',
  '2025-11-18',
  '2025-11-15',
  '2025-11-18',
  4,
  NOW(),
  NOW()
);

-- 7. إدراج بيانات تجريبية للموظفين
INSERT INTO public.employees (
  company_id, name, profession, nationality, birth_date, phone,
  residence_number, joining_date, contract_expiry, residence_expiry
) 
SELECT 
  c.id,
  'موظف تجريبي ' || generate_series(1, 2),
  'عامل تشغيل',
  'فلبيني',
  '1990-01-01',
  '0501234567',
  9876543210,
  '2024-01-01',
  '2025-01-01',
  '2025-12-31'
FROM public.companies c 
WHERE c.name = 'شركة سواعدنا للتشغيل والصيانة'
LIMIT 2;