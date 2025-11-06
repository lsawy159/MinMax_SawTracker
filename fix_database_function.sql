-- إنشاء دالة لإضافة الأعمدة المفقودة وتحديث البيانات
CREATE OR REPLACE FUNCTION fix_companies_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- إضافة الأعمدة المفقودة إذا لم تكن موجودة
  BEGIN
    ALTER TABLE companies ADD COLUMN commercial_registration_status TEXT DEFAULT 'غير محدد';
  EXCEPTION
    WHEN duplicate_column THEN
      NULL; -- العمود موجود بالفعل
  END;
  
  BEGIN
    ALTER TABLE companies ADD COLUMN insurance_subscription_status TEXT DEFAULT 'غير محدد';
  EXCEPTION
    WHEN duplicate_column THEN
      NULL; -- العمود موجود بالفعل
  END;
  
  -- إنشاء الفهارس إذا لم تكن موجودة
  CREATE INDEX IF NOT EXISTS idx_companies_commercial_status ON companies(commercial_registration_status);
  CREATE INDEX IF NOT EXISTS idx_companies_insurance_status ON companies(insurance_subscription_status);
  
  -- تحديث الحالات لجميع المؤسسات الموجودة
  UPDATE companies SET
    commercial_registration_status = CASE
      WHEN commercial_registration_expiry IS NULL THEN 'غير محدد'
      WHEN commercial_registration_expiry <= CURRENT_DATE THEN 'منتهي'
      WHEN commercial_registration_expiry <= CURRENT_DATE + INTERVAL '7 days' THEN 'حرج (ينتهي خلال 7 أيام)'
      WHEN commercial_registration_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 'متوسط (ينتهي خلال شهر)'
      ELSE 'ساري'
    END,
    insurance_subscription_status = CASE
      WHEN insurance_subscription_expiry IS NULL THEN 'غير محدد'
      WHEN insurance_subscription_expiry <= CURRENT_DATE THEN 'منتهي'
      WHEN insurance_subscription_expiry <= CURRENT_DATE + INTERVAL '7 days' THEN 'حرج (ينتهي خلال 7 أيام)'
      WHEN insurance_subscription_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 'متوسط (ينتهي خلال شهر)'
      ELSE 'ساري'
    END
  WHERE commercial_registration_status IS NULL OR insurance_subscription_status IS NULL;
  
  -- تحديث sequence رقم الهوية
  SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies) + 1);
  
  RAISE NOTICE 'تم إصلاح جدول companies بنجاح';
END;
$$;