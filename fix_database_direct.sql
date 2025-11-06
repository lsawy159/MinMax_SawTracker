-- إضافة أعمدة حالة المؤسسات المفقودة
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS commercial_registration_status TEXT DEFAULT 'غير محدد',
ADD COLUMN IF NOT EXISTS insurance_subscription_status TEXT DEFAULT 'غير محدد';

-- إنشاء فهارس للأعمدة الجديدة لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_companies_commercial_status ON companies(commercial_registration_status);
CREATE INDEX IF NOT EXISTS idx_companies_insurance_status ON companies(insurance_subscription_status);

-- تحديث_rows_count محدثة
SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies) + 1);