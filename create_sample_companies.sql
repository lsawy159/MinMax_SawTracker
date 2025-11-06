-- ملف SQL لإنشاء الشركات التجريبية في Supabase
-- يمكن تشغيله مباشرة في SQL Editor في dashboard

-- أولاً: إضافة الشركات التجريبية مع الأعمدة الموجودة
INSERT INTO companies (name, unified_number, commercial_registration_expiry, insurance_subscription_expiry)
VALUES 
  ('شركة محمد النفيعي للتشغيل والصيانة', '7035540473', '2026-01-20', '2026-01-14'),
  ('شركة سواعدنا', '7035540462', '2025-12-25', '2025-12-18'),
  ('شركة حرج - تحتاج متابعة', '1001001', '2025-12-10', '2025-12-08'),
  ('شركة متوسط - متابعة مطلوبة', '1002002', '2025-12-20', '2025-12-15'),
  ('شركة ساري - آمنة', '1003003', '2026-04-15', '2026-04-10'),
  ('شركة منتهي - خطير', '1004004', '2025-11-01', '2025-10-15'),
  ('شركة بدون تواريخ - تحتاج تحديث', '1005005', NULL, NULL);

-- فحص النتائج
SELECT 
  name,
  unified_number,
  commercial_registration_expiry,
  insurance_subscription_expiry,
  CASE 
    WHEN commercial_registration_expiry IS NULL THEN 'غير محدد'
    WHEN commercial_registration_expiry <= CURRENT_DATE THEN 'منتهي'
    WHEN commercial_registration_expiry <= CURRENT_DATE + INTERVAL '7 days' THEN 'حرج'
    WHEN commercial_registration_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 'متوسط'
    ELSE 'ساري'
  END as commercial_reg_status,
  CASE 
    WHEN insurance_subscription_expiry IS NULL THEN 'غير محدد'
    WHEN insurance_subscription_expiry <= CURRENT_DATE THEN 'منتهي'
    WHEN insurance_subscription_expiry <= CURRENT_DATE + INTERVAL '7 days' THEN 'حرج'
    WHEN insurance_subscription_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 'متوسط'
    ELSE 'ساري'
  END as insurance_status
FROM companies
ORDER BY name;

-- حساب الإحصائيات
SELECT 
  COUNT(*) as total_companies,
  SUM(CASE WHEN commercial_registration_expiry IS NOT NULL THEN 1 ELSE 0 END) as companies_with_cr_expiry,
  SUM(CASE WHEN insurance_subscription_expiry IS NOT NULL THEN 1 ELSE 0 END) as companies_with_insurance_expiry,
  
  -- إحصائيات السجل التجاري
  SUM(CASE WHEN commercial_registration_expiry <= CURRENT_DATE THEN 1 ELSE 0 END) as expired_commercial,
  SUM(CASE WHEN commercial_registration_expiry > CURRENT_DATE AND commercial_registration_expiry <= CURRENT_DATE + INTERVAL '7 days' THEN 1 ELSE 0 END) as critical_commercial,
  SUM(CASE WHEN commercial_registration_expiry > CURRENT_DATE + INTERVAL '7 days' AND commercial_registration_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) as medium_commercial,
  SUM(CASE WHEN commercial_registration_expiry > CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) as valid_commercial,
  
  -- إحصائيات التأمين
  SUM(CASE WHEN insurance_subscription_expiry <= CURRENT_DATE THEN 1 ELSE 0 END) as expired_insurance,
  SUM(CASE WHEN insurance_subscription_expiry > CURRENT_DATE AND insurance_subscription_expiry <= CURRENT_DATE + INTERVAL '7 days' THEN 1 ELSE 0 END) as critical_insurance,
  SUM(CASE WHEN insurance_subscription_expiry > CURRENT_DATE + INTERVAL '7 days' AND insurance_subscription_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) as medium_insurance,
  SUM(CASE WHEN insurance_subscription_expiry > CURRENT_DATE + INTERVAL '30 days' THEN 1 ELSE 0 END) as valid_insurance
  
FROM companies;