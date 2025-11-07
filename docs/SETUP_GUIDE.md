# 📖 دليل الإعداد الكامل - MinMax SawTracker

هذا دليل خطوة بخطوة لإعداد المشروع من الصفر.

## 📋 المتطلبات الأساسية

### 1. تثبيت Node.js

```bash
# تحقق من الإصدار (يجب أن يكون >= 18)
node --version

# إذا لم يكن مثبتاً، حمّله من:
# https://nodejs.org/
```

### 2. تثبيت pnpm

```bash
# تثبيت pnpm عالمياً
npm install -g pnpm

# تحقق من التثبيت
pnpm --version
```

### 3. تثبيت Git

```bash
# تحقق من التثبيت
git --version

# إذا لم يكن مثبتاً:
# https://git-scm.com/downloads
```

---

## 🚀 الإعداد السريع

### الخطوة 1: استنساخ المشروع

```bash
git clone https://github.com/lsawy159/MinMax_SawTracker.git
cd MinMax_SawTracker
```

### الخطوة 2: تثبيت المكتبات

```bash
pnpm install
```

### الخطوة 3: إعداد Supabase

#### أ. إنشاء حساب

1. اذهب إلى [https://supabase.com](https://supabase.com)
2. اضغط "Start your project"
3. سجّل حساب جديد (GitHub, Google, أو Email)

#### ب. إنشاء مشروع جديد

1. من Dashboard، اضغط "New Project"
2. املأ المعلومات:
   - **Name**: `sawtracker` (أو أي اسم تفضله)
   - **Database Password**: اختر كلمة مرور قوية (احفظها!)
   - **Region**: اختر أقرب منطقة لك
   - **Pricing Plan**: Free (كافٍ للتطوير)
3. اضغط "Create new project"
4. انتظر ~2 دقيقة حتى يكتمل الإعداد

#### ج. الحصول على API Keys

1. من Dashboard، اذهب إلى **Settings** (أيقونة الترس)
2. اختر **API** من القائمة الجانبية
3. ستجد:
   - **Project URL**: انسخه
   - **anon/public key**: انسخه

#### د. إعداد Database Schema

1. من Dashboard، اذهب إلى **SQL Editor**
2. اضغط "New query"
3. افتح ملف `supabase/migrations/20251106_complete_fix.sql` من المشروع
4. انسخ محتواه والصقه في SQL Editor
5. اضغط "Run" (أو Ctrl+Enter)
6. انتظر حتى يكتمل التنفيذ
7. يجب أن ترى "Success. No rows returned"

### الخطوة 4: إعداد Environment Variables

```bash
# انسخ ملف المثال
cp .env.example .env

# افتح .env في محرر نصوص
nano .env
# أو
code .env
```

عدّل الملف وأضف المفاتيح:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_APP_ENV=development
```

**مهم جداً**: لا ترفع ملف `.env` إلى Git!

### الخطوة 5: تشغيل المشروع

```bash
pnpm dev
```

افتح المتصفح على: `http://localhost:5173`

---

## 🗄️ إعداد Database بالتفصيل

### الجداول الرئيسية

سيتم إنشاء الجداول التالية:

#### 1. `companies` - جدول المؤسسات

```sql
- id (uuid, primary key)
- name (text)
- tax_number (bigint, nullable)
- unified_number (numeric)
- labor_subscription_number (text)
- company_type (text)
- commercial_registration_expiry (date)
- insurance_subscription_expiry (date)
- max_employees (int)
- employee_count (int)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 2. `employees` - جدول الموظفين

```sql
- id (uuid, primary key)
- company_id (uuid, foreign key)
- name (text)
- profession (text)
- nationality (text)
- birth_date (date)
- phone (text)
- passport_number (text)
- residence_number (numeric)
- joining_date (date)
- contract_expiry (date)
- residence_expiry (date)
- ending_subscription_insurance_date (date)
- salary (numeric)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 3. `users` - جدول المستخدمين (مدمج مع Supabase Auth)

#### 4. `activity_logs` - سجل الأنشطة

#### 5. `notifications` - التنبيهات

### Row Level Security (RLS)

للأمان، يجب تفعيل RLS على الجداول:

```sql
-- مثال لجدول companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة (authenticated users)
CREATE POLICY "Enable read for authenticated users"
ON companies FOR SELECT
TO authenticated
USING (true);

-- سياسة للكتابة
CREATE POLICY "Enable insert for authenticated users"
ON companies FOR INSERT
TO authenticated
WITH CHECK (true);

-- سياسة للتحديث
CREATE POLICY "Enable update for authenticated users"
ON companies FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- سياسة للحذف
CREATE POLICY "Enable delete for authenticated users"
ON companies FOR DELETE
TO authenticated
USING (true);
```

كرر نفس الخطوات لجدول `employees`.

---

## 👤 إنشاء أول مستخدم

### الطريقة 1: من Dashboard

1. اذهب إلى **Authentication** > **Users**
2. اضغط "Add user"
3. املأ:
   - **Email**: admin@example.com
   - **Password**: كلمة مرور قوية
4. اضغط "Create user"

### الطريقة 2: من التطبيق

1. شغّل التطبيق: `pnpm dev`
2. اذهب إلى صفحة Login
3. اضغط "Sign Up" (إذا متوفر)
4. أو استخدم Supabase Auth UI

---

## 🧪 إضافة بيانات تجريبية

لتسهيل الاختبار، يمكنك إضافة بيانات تجريبية:

```sql
-- في SQL Editor، نفّذ:

-- إضافة شركات تجريبية
INSERT INTO companies (name, unified_number, labor_subscription_number, company_type, max_employees)
VALUES
  ('شركة البناء المتطور', 1234567890, 'LAB001', 'مقاولات', 50),
  ('مؤسسة التقنية الحديثة', 9876543210, 'LAB002', 'خدمات', 30),
  ('شركة التجارة العامة', 5555555555, 'LAB003', 'تجارة', 20);

-- إضافة موظفين تجريبيين
INSERT INTO employees (company_id, name, profession, nationality, phone, residence_number, joining_date)
VALUES
  ((SELECT id FROM companies LIMIT 1), 'أحمد محمد', 'مهندس', 'مصري', '0501234567', 2123456789, '2024-01-15'),
  ((SELECT id FROM companies LIMIT 1), 'محمد علي', 'فني', 'سوري', '0509876543', 2987654321, '2024-02-01');
```

---

## 🔧 استكشاف الأخطاء

### خطأ: "Missing Supabase environment variables"

**الحل**:
1. تأكد من وجود ملف `.env` في root المشروع
2. تأكد من أن المفاتيح صحيحة
3. أعد تشغيل dev server: `pnpm dev`

### خطأ: "Failed to fetch"

**الحل**:
1. تأكد من أن Supabase Project يعمل
2. تحقق من الـ URL في `.env`
3. تحقق من اتصال الإنترنت

### خطأ: Database errors

**الحل**:
1. تأكد من تطبيق migrations بشكل صحيح
2. تحقق من SQL Editor في Supabase
3. راجع RLS policies

### خطأ: Authentication issues

**الحل**:
1. تأكد من تفعيل Email provider في Supabase
2. تحقق من أن المستخدم موجود في **Authentication** > **Users**
3. جرّب تسجيل خروج ودخول مرة أخرى

---

## 📱 التشغيل على الأجهزة المحمولة

### الطريقة 1: Local Network

```bash
# شغّل المشروع مع host 0.0.0.0
pnpm dev --host

# ستحصل على رابط مثل:
# http://192.168.1.x:5173
```

افتح الرابط على جهازك المحمول (يجب أن تكون على نفس الشبكة)

### الطريقة 2: ngrok

```bash
# ثبّت ngrok
npm install -g ngrok

# في terminal آخر
ngrok http 5173
```

استخدم الرابط الذي يعطيك إياه ngrok

---

## 🚀 النشر (Deployment)

### على Vercel

```bash
# ثبّت Vercel CLI
npm install -g vercel

# ابنِ المشروع
pnpm build

# انشره
vercel
```

### على Netlify

```bash
# ثبّت Netlify CLI
npm install -g netlify-cli

# ابنِ المشروع
pnpm build

# انشره
netlify deploy --prod
```

**مهم**: لا تنسَ إضافة Environment Variables في لوحة التحكم!

---

## 🎯 الخطوات التالية

بعد الإعداد:

1. ✅ جرّب إضافة شركة جديدة
2. ✅ جرّب إضافة موظفين
3. ✅ افحص التنبيهات في Dashboard
4. ✅ جرّب Export/Import
5. ✅ استكشف الميزات المختلفة

---

## 📞 الدعم

إذا واجهت مشاكل:

1. راجع [README.md](../README.md)
2. ابحث في [GitHub Issues](https://github.com/lsawy159/MinMax_SawTracker/issues)
3. افتح issue جديد مع التفاصيل الكاملة

---

**بالتوفيق! 🎉**
