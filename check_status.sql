-- التحقق من حالة الجداول والأعمدة
SELECT 
  'companies' as table_name,
  COUNT(*) as total_records
FROM public.companies;

-- فحص الأعمدة في companies table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'companies' 
ORDER BY ordinal_position;