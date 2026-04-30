# Feature Spec: Production Stability & Launch Readiness

**Feature ID:** 003
**التاريخ:** 30 أبريل 2026
**الحالة:** Draft
**المرجع:** `project_audit_report.md`, `remediation_plan.md`, `product_requirements_document.md`

---

## 1. الهدف

نقل SAWTracker من حالة "نموذج عمل" إلى حالة **"جاهز للإطلاق العام"** بمعايير قابلة للقياس، ضمن 14 أسبوع.

**ليس تطوير وظائف جديدة** — تثبيت + إغلاق ثغرات + سدّ فجوات الإنتاج.

---

## 2. المشكلة

تدقيق المشروع كشف 35 نتيجة:
- 6 CRITICAL (مصادقة Edge، حقن SQL، RLS مفقود، نسخ احتياطي مكشوف)
- 12 HIGH (ترقيم صفحات، CORS، معاملات رواتب، CSRF, kلمات مرور ضعيفة)
- 11 MEDIUM (جودة كود، مكررات، أنواع DB)
- 6 LOW

إضافة لذلك، 16 فجوة إنتاج (M-1 → M-16) خارج التدقيق:
CI/CD، Monitoring، Restore drill، Migrations، Indexes، Rate limit عام، DR، PDPL، secrets rotation، load test، mobile QA، UI states، docs، seed، email deliverability.

**النتيجة:** بدون معالجة شاملة → الإطلاق يكشف بيانات موظفين أجانب (PII حساس)، يفشل بيانات مالية، أو يتعطل تحت الحمل.

---

## 3. النطاق

### IN

- إغلاق كل نتائج التدقيق (35)
- معالجة فجوات الإنتاج (16)
- بناء بيئات منفصلة (dev/staging/prod)
- CI/CD pipeline + monitoring
- توثيق قانوني (PDPL سعودي) + تشغيلي (DR plan, runbooks)

### OUT

- ميزات وظيفية جديدة
- إعادة تصميم UI
- تكامل أنظمة خارجية جديدة
- mobile app native

---

## 4. متطلبات وظيفية (FR)

| ID | المتطلب | المصدر |
|----|---------|--------|
| FR-001 | كل Edge Function ترفض طلب بدون JWT صالح | C-1, C-5-B |
| FR-002 | RLS مُفعّل على كل جدول بسياسة موحّدة: authenticated full access، anon denied | C-4 |
| FR-003 | كل عملية رواتب داخل معاملة DB واحدة | F-3 |
| FR-004 | كل استعلام جدولي مع ترقيم صفحات (≤50 صف افتراضي) | C-7 |
| FR-005 | نسخ احتياطي مشفّر AES-256-GCM، يستثني جداول حساسة | C-2 |
| FR-006 | اختبار استعادة شهري من نسخة إنتاج | M-1 |
| FR-007 | login brute-force lockout عبر `login_rate_limits`: 5 فشل متتالي → قفل 30 دقيقة | F-7 |
| FR-008 | كلمة مرور: ≥12 حرف، تعقيد، مقارنة بقائمة شائعة | F-6 |
| FR-009 | كل عملية إنشاء/تعديل/حذف حساسة → `audit_log` | S-7 |
| FR-010 | CI/CD: lint + test + build + deploy تلقائي على push | M-2 |
| FR-011 | Monitoring: uptime + error rate + DB metrics | M-5 |
| FR-012 | بيئات منفصلة: dev، staging، prod (Supabase + Vercel) | M-3 |
| FR-013 | Migrations مرقمة في `supabase/migrations/` فقط | M-4 |
| FR-014 | كل صفحة لها 3 حالات: loading، empty، error | M-14 |
| FR-015 | سياسة خصوصية + شروط استخدام عربي وفق PDPL | M-10 |

---

## 5. متطلبات غير وظيفية (NFR)

| ID | المتطلب | معيار قياس |
|----|---------|-----------|
| NFR-001 | تحميل أول < 3 ثانية | Lighthouse (3G mobile) |
| NFR-002 | Dashboard < 1 ثانية بعد المصادقة | RPC واحد |
| NFR-003 | تغطية اختبارات منطق مالي ≥ 90% | Vitest coverage |
| NFR-004 | تغطية Edge Functions ≥ 80% | Deno test |
| NFR-005 | درجة A على securityheaders.com | فحص آلي |
| NFR-006 | RTO ≤ 4 ساعة، RPO ≤ 24 ساعة | DR drill |
| NFR-007 | Uptime ≥ 99.5% شهرياً | Better Stack |
| NFR-008 | Bundle size الأول ≤ 350 KB gzipped | bundlesize CI |

---

## 6. معايير القبول (Acceptance)

النشر مسموح فقط إذا:
- [ ] كل 35 نتيجة من التدقيق مُعالجة بـ PR + اختبار
- [ ] كل 16 بند فجوة إنتاج (M-1..M-16) منفّذة
- [ ] DR drill ناجح: استعادة كاملة على staging خلال ≤ 4 ساعة
- [ ] Pen test أساسي (OWASP Top 10) دون نتائج HIGH/CRITICAL
- [ ] Load test: 100 مستخدم متزامن دون errors > 1%
- [ ] Mobile QA: iOS + Android Chrome — كل الصفحات
- [ ] سياسة خصوصية + شروط منشورة + موقّعة من قانوني
- [ ] دليل مستخدم عربي مكتمل (admin + accountant + data entry)
- [ ] runbook حوادث موثّق (5 سيناريوهات على الأقل)

---

## 7. مخاطر مفترضة

| مخاطرة | تأثير | تخفيف |
|--------|-------|------|
| RLS يكسر استعلامات قائمة | عالي | تطبيق على staging أولاً + اختبارات شاملة |
| ترحيل Dashboard لـ React Query يكشف bugs مخفية | متوسط | feature flag + قياس قبل/بعد |
| RPC رواتب جديد يتعارض مع بيانات قديمة | عالي | snapshot + اختبار عودة + dual-write مرحلة انتقالية |
| CSP صارم يعطل أصول طرف ثالث | منخفض | report-only أولاً، ثم enforce |
| Rate limit يقفل مستخدمين شرعيين | متوسط | whitelist للمكاتب + threshold قابل للضبط |

---

*نهاية spec*
