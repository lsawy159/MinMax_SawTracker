# تعليمات تشغيل Migration لجدول read_alerts

## الطريقة الأولى: تشغيل SQL يدوياً (موصى بها)

### الخطوات:

1. **افتح Supabase Dashboard**
   - اذهب إلى: https://supabase.com/dashboard
   - سجل دخولك

2. **اختر مشروعك**
   - اختر المشروع المناسب من القائمة

3. **افتح SQL Editor**
   - من القائمة الجانبية، اضغط على "SQL Editor"
   - أو اذهب مباشرة إلى: `https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/sql`

4. **انسخ محتوى ملف SQL**
   - افتح الملف: `supabase/migrations/20250101_create_read_alerts_table.sql`
   - انسخ كل المحتوى

5. **الصق SQL في المحرر**
   - الصق SQL في المحرر
   - تأكد من أن SQL كامل

6. **شغّل SQL**
   - اضغط على زر "Run" أو "Execute"
   - انتظر حتى يكتمل التنفيذ

7. **تحقق من النجاح**
   - يجب أن ترى رسالة نجاح
   - يمكنك التحقق من وجود الجدول في "Table Editor"

## الطريقة الثانية: استخدام Supabase CLI

إذا كان لديك Supabase CLI مثبت:

```bash
# تأكد من أنك في مجلد المشروع
cd sawtracker

# شغّل migration
npx supabase db push
```

## التحقق من نجاح Migration

بعد تشغيل SQL، يمكنك التحقق من:

1. **في Supabase Dashboard:**
   - اذهب إلى "Table Editor"
   - ابحث عن جدول `read_alerts`
   - يجب أن ترى الجدول مع الأعمدة التالية:
     - `id` (BIGSERIAL PRIMARY KEY)
     - `user_id` (UUID)
     - `alert_id` (TEXT)
     - `read_at` (TIMESTAMPTZ)
     - `created_at` (TIMESTAMPTZ)

2. **في SQL Editor:**
   ```sql
   SELECT * FROM read_alerts LIMIT 1;
   ```
   - يجب أن يعمل بدون أخطاء

## ملاحظات مهمة

- ✅ Migration آمن للتشغيل عدة مرات (يستخدم `CREATE TABLE IF NOT EXISTS`)
- ✅ لن يحذف بيانات موجودة
- ✅ يمكن تشغيله على أي بيئة (development, production)

