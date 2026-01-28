# حل مشكلة تكرار التنبيهات في ملفات Excel

## 📋 وصف المشكلة

عند تصدير التنبيهات إلى ملف Excel، كانت التنبيهات تظهر **مكررة** (مرتين أو أكثر) في نفس الملف.

### السبب الجذري: Race Condition

```
الخطوة 1: Dashboard يستدعي alertCache.getEmployeeAlerts()
الخطوة 2: useAlertsStats يستدعي alertCache.getEmployeeAlerts() في نفس الوقت
الخطوة 3: كلاهما يُنفذ generateEmployeeAlerts()
الخطوة 4: كلاهما يُدخل نفس التنبيهات في daily_excel_logs

النتيجة: تنبيهات مكررة في قاعدة البيانات → ملف Excel مكرر
```

الكود القديم كان يتحقق من التكرار بـ **SELECT + INSERT**، لكن في حالة الاستدعاءات المتزامنة:
- الاستدعاء الأول: SELECT (لا يوجد) → INSERT ✅
- الاستدعاء الثاني: SELECT **قبل أن ينتهي الأول** (لا يوجد) → INSERT ✅ ❌ مكرر!

## ✅ الحل المُطبق

### 1️⃣ Unique Constraint على قاعدة البيانات (Database Level)

**ملف:** `fix_excel_duplicates.sql`

```sql
-- للموظفين: employee_id + alert_type + التاريخ = فريد
CREATE UNIQUE INDEX idx_daily_excel_logs_employee_unique
ON daily_excel_logs (employee_id, alert_type, DATE(created_at))
WHERE employee_id IS NOT NULL;

-- للشركات: company_id + alert_type + التاريخ = فريد
CREATE UNIQUE INDEX idx_daily_excel_logs_company_unique
ON daily_excel_logs (company_id, alert_type, DATE(created_at))
WHERE company_id IS NOT NULL;
```

**الفائدة:**
- قاعدة البيانات تمنع التكرار تلقائياً (Atomic Operation)
- لا حاجة للتحقق اليدوي (يزيل Race Condition)
- يقلل عدد الاستعلامات من 2 إلى 1 لكل تنبيه

### 2️⃣ تبسيط الكود - الاعتماد على Database Constraint

**ملف:** `src/utils/employeeAlerts.ts` و `src/utils/alerts.ts`

**الكود القديم** (46 سطر):
```typescript
// التحقق اليدوي من التكرار
const { data: existingAlerts } = await supabase
  .from('daily_excel_logs')
  .select('id')
  .eq('employee_id', alert.employee.id)
  .eq('alert_type', alert.type)
  .gte('created_at', today.toISOString())
  .limit(1)

if (existingAlerts && existingAlerts.length > 0) {
  return // تخطي
}

// الإدخال
const { error } = await supabase
  .from('daily_excel_logs')
  .insert({...})
```

**الكود الجديد** (18 سطر):
```typescript
// الإدخال المباشر
const { error } = await supabase
  .from('daily_excel_logs')
  .insert({...})

// التعامل مع خطأ التكرار
if (error?.code === '23505') {
  logger.debug('⏭️ Alert already exists')
} else if (error) {
  logger.error('Failed to log alert:', error)
}
```

### 3️⃣ تنظيف التكرارات الموجودة

السكريبت `fix_excel_duplicates.sql` يحذف التكرارات الموجودة (يحتفظ بالأقدم):

```sql
DELETE FROM daily_excel_logs
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY employee_id, alert_type, DATE(created_at)
      ORDER BY created_at ASC
    ) AS row_num
    FROM daily_excel_logs
  ) t
  WHERE row_num > 1
);
```

## 📊 التحسينات الناتجة

| المقياس | قبل | بعد | التحسين |
|---------|-----|-----|----------|
| **استعلامات قاعدة البيانات** | 2 لكل تنبيه (SELECT + INSERT) | 1 لكل تنبيه (INSERT) | -50% |
| **Race Condition** | موجودة ❌ | محلولة ✅ | 100% |
| **سطور الكود** | 46 سطر | 18 سطر | -61% |
| **تكرار التنبيهات** | ممكن (2-3 مرات) | مستحيل | -100% |

## 🔧 خطوات التطبيق

### 1. تطبيق SQL على Supabase:

1. افتح Supabase SQL Editor
2. انسخ محتوى ملف `fix_excel_duplicates.sql`
3. نفذ السكريبت
4. تحقق من النتيجة (يجب أن يعود 0 rows):

```sql
-- التحقق من عدم وجود تكرارات
SELECT 
  COALESCE(employee_id::text, company_id::text) as entity_id,
  alert_type,
  DATE(created_at) as alert_date,
  COUNT(*) as count
FROM daily_excel_logs
GROUP BY COALESCE(employee_id::text, company_id::text), alert_type, DATE(created_at)
HAVING COUNT(*) > 1;
```

### 2. التغييرات في الكود تم تطبيقها:

- ✅ `src/utils/employeeAlerts.ts` - تم التبسيط
- ✅ `src/utils/alerts.ts` - تم التبسيط
- ✅ تم التحقق من الـ Type Safety (pnpm type-check)
- ✅ تم التحقق من الـ Linting (pnpm lint)

### 3. اختبار النظام:

1. سجّل دخول إلى النظام
2. اذهب إلى صفحة التنبيهات
3. اضغط "إرسال الآن" لتصدير Excel
4. افتح ملف Excel
5. تحقق أن كل تنبيه يظهر **مرة واحدة فقط**

## 📁 الملفات المُعدَّلة

```
✏️ src/utils/employeeAlerts.ts (تبسيط duplicate prevention)
✏️ src/utils/alerts.ts (تبسيط duplicate prevention)
📄 fix_excel_duplicates.sql (NEW - SQL للتطبيق على Supabase)
📄 FIX_EXCEL_DUPLICATES_AR.md (NEW - هذا الملف)
```

## 🎯 النتيجة النهائية

### قبل الإصلاح:
```
ملف Excel:
┌─────────────────┬─────────┐
│ التنبيه         │ العدد  │
├─────────────────┼─────────┤
│ إقامة منتهية   │ 5      │ ← تكرار!
│ إقامة منتهية   │ 5      │ ← مكرر
│ عقد منتهي       │ 3      │ ← تكرار!
│ عقد منتهي       │ 3      │ ← مكرر
└─────────────────┴─────────┘
```

### بعد الإصلاح:
```
ملف Excel:
┌─────────────────┬─────────┐
│ التنبيه         │ العدد  │
├─────────────────┼─────────┤
│ إقامة منتهية   │ 5      │ ✅ مرة واحدة فقط
│ عقد منتهي       │ 3      │ ✅ مرة واحدة فقط
└─────────────────┴─────────┘
```

## ⚠️ ملاحظات مهمة

1. **يجب تطبيق SQL على Supabase أولاً** قبل استخدام النظام
2. التكرارات القديمة سيتم حذفها تلقائياً (يحتفظ بالأقدم)
3. الكود الجديد يعتمد على Database Constraint - لا يعمل بدونها
4. خطأ `23505` هو رمز PostgreSQL للـ Unique Constraint Violation

## 🔍 للمزيد من المعلومات

- PostgreSQL Unique Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- Race Condition Pattern: https://en.wikipedia.org/wiki/Race_condition
- Database Transaction Isolation: https://www.postgresql.org/docs/current/transaction-iso.html
