# Implementation Plan: 003 — Production Stability & Launch Readiness

**Spec:** `./spec.md`
**Branch المقترح:** `003-production-stability-launch`

---

## Technical Context

| البند | القيمة |
|-------|--------|
| Frontend | React 18 + TS 5.6 + Vite 7.2 |
| Backend | Supabase (Postgres 15 + Deno Edge Functions) |
| Auth | Supabase Auth (email/password + PKCE) |
| Hosting | Vercel (Node 22.x) |
| Email | Resend |
| Test | Vitest 4 + happy-dom + Deno test |
| Monitoring | Sentry (frontend + Edge) + Better Stack (uptime) — *جديد* |
| CI/CD | GitHub Actions — *جديد* |
| Encryption | Web Crypto AES-256-GCM (Deno) |
| Migrations | Supabase CLI migrations — *جديد فعّل* |
| PDF | jsPDF + jspdf-autotable (NEEDS CLARIFICATION: vs pdfmake) |
| Excel | exceljs (NEEDS CLARIFICATION: vs SheetJS xlsx) |

---

## Constitution Check

ملف constitution غير موجود في المشروع. القيود الذاتية:
- لا تغيير DB يدوي — كل تعديل migration
- لا secrets في الكود — env فقط
- لا breaking changes بدون feature flag
- اختبار قبل نشر — coverage gate في CI

**Gate:** PASS (لا انتهاكات).

---

## مراحل التنفيذ (مرتبطة بـ remediation_plan.md + إضافات production)

### المرحلة 0 — تحضير وقياس (يومان)

**Tasks:**
- T-000: إنشاء branch `003-production-stability-launch`
- T-001: snapshot DB يدوي (`pg_dump`) قبل أي تغيير
- T-002: إنشاء Supabase project ثانٍ = `staging`
- T-003: إنشاء Supabase project ثالث = `prod` (إذا الحالي = dev)
- T-004: ربط Vercel preview بـ staging، production بـ prod
- T-005: تفعيل Sentry (frontend DSN) + Better Stack (uptime monitor)
- T-006: تشغيل `supabase gen types typescript` ← `src/types/database.ts`
- T-007: إنشاء `.specify/memory/constitution.md` بالقيود أعلاه

**Deliverables:** 3 بيئات منفصلة، DSN في `.env.staging` و`.env.production`، types مولّدة.

---

### المرحلة 1 — أمان Edge + النسخ الاحتياطي (أسبوع 1-2) 🔴

من `remediation_plan.md` المرحلة 1: مهام 1.1 → 1.8.

**إضافات:**
- T-110: rate limit عام لكل Edge Function (table + middleware)
- T-111: secret rotation script + جدولة 90 يوم
- T-112: `vercel.json` headers + اختبار securityheaders.com

**معيار خروج:** كل Edge Function ترفض طلب بدون JWT، CORS مقيّد، نسخ احتياطي مشفّر، headers درجة A.

---

### المرحلة 2 — RLS + صلاحيات (أسبوع 3-4) 🔴

من `remediation_plan.md` المرحلة 2: مهام 2.1 → 2.5.

**إضافات:**
- T-210: اختبار RLS لكل جدول × كل دور × كل عملية (matrix)
- T-211: PDPL compliance: قائمة معالجة بيانات + سياسة احتفاظ موثّقة

**معيار خروج:** RLS موحّد مطبق على كل الجداول العامة (authenticated full access، anon denied).

---

### المرحلة 3 — أداء + بنية (أسبوع 5-8) 🟠

من `remediation_plan.md` المرحلة 3: مهام 3.1 → 3.5.

**إضافات:**
- T-310: indexes audit — كل FK + كل عمود WHERE/ORDER BY
- T-311: bundle size budget في CI (≤350KB gzipped)
- T-312: load test (k6) — 100 user متزامن

**معيار خروج:** Lighthouse ≥ 90 perf، load test < 1% errors، Dashboard < 1s.

---

### المرحلة 4 — رواتب + ErrorBoundary (أسبوع 9-10) 🟠

من `remediation_plan.md` المرحلة 4: مهام 4.1 → 4.3.

**إضافات:**
- T-410: dual-write transition للرواتب (4 أسبوع overlap قبل قطع كود قديم)
- T-411: snapshot قبل/بعد لكل دورة راتب — مقارنة آلية

**معيار خروج:** كل عمليات الرواتب عبر RPC، اختبارات معاملات تمرّ، 0 سجلات يتيمة.

---

### المرحلة 5 — جودة + اختبارات (أسبوع 11-12) 🟡

من `remediation_plan.md` المرحلة 5: مهام 5.1 → 5.11.

**إضافات:**
- T-510: E2E tests (Playwright) — 5 سيناريوهات حرجة (login → add employee → run payroll → backup → restore)
- T-511: visual regression (Chromatic أو Percy) للصفحات الـ 14

**معيار خروج:** coverage ≥ 90% منطق مالي + ≥ 80% Edge، E2E ناجح، 0 `as unknown as`.

---

### المرحلة 6 — Production Readiness (أسبوع 13-14) — *جديدة* 🟢

| ID | مهمة |
|----|------|
| T-601 | CI/CD pipeline (GitHub Actions): lint + type + test + build + deploy |
| T-602 | DR plan موثّق + drill ناجح (RTO ≤ 4h، RPO ≤ 24h) |
| T-603 | restore drill شهري مجدول |
| T-604 | runbooks: 5 سيناريوهات (DB down، email failure، RLS broke prod، breach، rollback) |
| T-605 | Pen test أساسي (OWASP Top 10) |
| T-606 | mobile QA matrix (iOS Safari، Android Chrome) لكل صفحة |
| T-607 | Empty/Loading/Error states لكل صفحة (14 × 3 = 42 حالة) |
| T-608 | سياسة خصوصية + شروط استخدام عربي (PDPL) — مراجعة قانونية |
| T-609 | seed data: شركة افتراضية + قوالب صلاحيات + إعدادات افتراضية |
| T-610 | دليل مستخدم عربي (admin/accountant/data-entry) — 3 ملفات |
| T-611 | email deliverability: SPF + DKIM + DMARC + warmup domain |
| T-612 | status page عام (status.<domain>) — Better Stack |
| T-613 | launch checklist + sign-off من stakeholders |

**معيار خروج:** كل بنود acceptance في `spec.md` مكتملة + sign-off.

---

## Phase 0: Research

### مفتوحة (NEEDS CLARIFICATION)

| # | سؤال | اختيار مقترح | بديل | قرار |
|---|------|--------------|-------|------|
| R-1 | PDF library | **jsPDF + jspdf-autotable** | pdfmake | جدولة في research.md |
| R-2 | Excel library | **exceljs** (دعم styling) | xlsx (أصغر، أسرع، بدون styling) | research.md |
| R-3 | E2E framework | **Playwright** | Cypress | research.md |
| R-4 | Visual regression | **Chromatic** (دمج Storybook) | Percy | research.md |
| R-5 | Hijri algorithm | umm-al-qura table (مكتبة `hijri-converter`) | حساب | research.md |
| R-6 | Rate limit storage | Postgres table + index | Redis | research.md |
| R-7 | Captcha | No CAPTCHA (internal trusted tool) | Cloudflare Turnstile/hCaptcha | research.md |
| R-8 | Status page | Better Stack مدمج | Statuspage.io | research.md |

كل بنود R-* تُحلّ في Phase 0 (`research.md`).

---

## Phase 1: Design Artifacts

- `data-model.md` — كل الجداول الجديدة (`login_rate_limits`, `backups`, `email_queue`, `daily_excel_logs` مع UNIQUE) + تعديلات (RLS، indexes)
- `contracts/` — عقود JSON Schema لكل Edge Function (`auth.requireAuth`, `automated-backup`, `secure-sessions`, RPC `process_payroll_run`, RPC `dashboard_stats`)
- `quickstart.md` — كيف يبدأ مطور جديد + كيف يشغّل drill استعادة + كيف ينفّذ migration

---

## Constitution Re-check (post-design)

- [ ] لا breaking changes بدون feature flag → التزام: dual-write للرواتب (T-410)
- [ ] لا secrets في الكود → التزام: rotation script (T-111)
- [ ] coverage gate → التزام: CI gate (T-601)
- [ ] لا تعديل DB يدوي → التزام: كل تغيير migration (T-006)

**Gate:** PASS.

---

## مخاطر مرحلية

| مرحلة | مخاطرة رئيسية | احتمال | تخفيف |
|-------|---------------|--------|-------|
| 1 | rate limit يقفل cron داخلي | متوسط | whitelist لمصادر cron |
| 2 | RLS يكسر استعلام legacy | عالي | shadow-deploy + diff queries |
| 3 | pagination يكسر تصدير | متوسط | تصدير streaming منفصل |
| 4 | RPC payroll يفشل في data قديم | عالي | dual-write + diff |
| 5 | E2E tests flaky | متوسط | retry + isolated DB |
| 6 | pen test يكشف ثغرة جديدة | منخفض | budget أسبوع إضافي |

---

## ملخص

| مرحلة | مدة | مهام | خطورة |
|-------|------|------|--------|
| 0 | يومان | 7 | تحضير |
| 1 | 2 أسبوع | 11 | 🔴 |
| 2 | 2 أسبوع | 7 | 🔴 |
| 3 | 4 أسبوع | 8 | 🟠 |
| 4 | 2 أسبوع | 5 | 🟠 |
| 5 | 2 أسبوع | 13 | 🟡 |
| 6 | 2 أسبوع | 13 | 🟢 |
| **الإجمالي** | **14 أسبوع** | **64 مهمة** | - |

---

*نهاية plan*
