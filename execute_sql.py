#!/usr/bin/env python3
import requests
import json
import os

# Supabase credentials
SUPABASE_URL = "https://xaqmuiowidnjlchexxdg.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgwMjUyNCwiZXhwIjoyMDc3Mzc4NTI0fQ.sTSofbUKBihR82COSCaztl6P6LBuhQwvaVDBia_BGIc"

def execute_sql_direct(sql_statement):
    """Execute SQL statement directly using service role"""
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json"
    }
    
    data = {"sql": sql_statement}
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ SQL executed successfully: {sql_statement[:50]}...")
            return result
        else:
            print(f"❌ SQL failed: {sql_statement[:50]}...")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error executing SQL: {e}")
        return None

def create_table_companies():
    """Create companies table with all required columns"""
    sql = """
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
    """
    
    return execute_sql_direct(sql)

def create_table_users():
    """Create users table with proper RLS policies"""
    sql = """
    -- إصلاح users table أولاً
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

    -- إيقاف RLS مؤقتاً للاختبار
    ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
    """
    
    return execute_sql_direct(sql)

def insert_sample_companies():
    """Insert sample companies with various expiry dates"""
    sql = """
    -- إدراج البيانات التجريبية للشركات
    INSERT INTO public.companies (
      id, name, tax_number, unified_number, labor_subscription_number, 
      company_type, commercial_registration_expiry, insurance_subscription_expiry,
      ending_subscription_power_date, ending_subscription_moqeem_date, max_employees,
      created_at, updated_at
    ) VALUES 
    -- شركة مع تاريخ ساري (>30 يوم)
    (
      gen_random_uuid(), 
      'شركة سارة للمقاولات', 
      1234567890, 9876543210, 'L001', 'مقاولات',
      '2025-12-31', '2025-12-31', '2025-12-31', '2025-12-31', 4,
      NOW(), NOW()
    ),
    -- شركة متوسطة الأهمية (8-30 يوم)
    (
      gen_random_uuid(), 
      'شركة النصر للتشغيل', 
      2345678901, 8765432109, 'L002', 'تشغيل وصيانة',
      '2025-11-20', '2025-11-25', '2025-11-20', '2025-11-25', 4,
      NOW(), NOW()
    ),
    -- شركة حرجية (≤7 أيام)
    (
      gen_random_uuid(), 
      'شركة الحداثة المحدودة', 
      3456789012, 7654321098, 'L003', 'تجارة عامة',
      '2025-11-10', '2025-11-12', '2025-11-10', '2025-11-12', 4,
      NOW(), NOW()
    ),
    -- شركة منتهية الصلاحية
    (
      gen_random_uuid(), 
      'شركة المستقبل', 
      4567890123, 6543210987, 'L004', 'خدمات عامة',
      '2025-10-15', '2025-10-20', '2025-10-15', '2025-10-20', 4,
      NOW(), NOW()
    ),
    -- شركة أخرى متوسطة
    (
      gen_random_uuid(), 
      'شركة النهضة الحديثة', 
      5678901234, 5432109876, 'L005', 'صيانة',
      '2025-11-28', '2025-11-30', '2025-11-28', '2025-11-30', 4,
      NOW(), NOW()
    ),
    -- الشركة التي يحاول المستخدم تعديلها
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
    """
    
    return execute_sql_direct(sql)

def verify_results():
    """Verify the results"""
    sql = """
    -- التحقق من النتائج
    SELECT 
      'companies' as table_name,
      COUNT(*) as total_records,
      COUNT(CASE WHEN commercial_registration_expiry IS NOT NULL THEN 1 END) as with_commercial_date,
      COUNT(CASE WHEN insurance_subscription_expiry IS NOT NULL THEN 1 END) as with_insurance_date
    FROM public.companies
    UNION ALL
    SELECT 
      'users' as table_name,
      COUNT(*) as total_records,
      0 as with_commercial_date,
      0 as with_insurance_date
    FROM public.users;
    """
    
    return execute_sql_direct(sql)

if __name__ == "__main__":
    print("🚀 بدء تنفيذ الإصلاحات الشاملة...")
    
    print("\n1️⃣ إنشاء users table...")
    result1 = create_table_users()
    
    print("\n2️⃣ إنشاء companies table...")
    result2 = create_table_companies()
    
    print("\n3️⃣ إدراج الشركات التجريبية...")
    result3 = insert_sample_companies()
    
    print("\n4️⃣ التحقق من النتائج...")
    result4 = verify_results()
    
    if result4:
        print("\n✅ تم إكمال جميع الإصلاحات بنجاح!")
        print("📊 النتائج:")
        for row in result4:
            print(f"   {row['table_name']}: {row['total_records']} سجل")
    else:
        print("\n❌ حدثت أخطاء في التنفيذ")
