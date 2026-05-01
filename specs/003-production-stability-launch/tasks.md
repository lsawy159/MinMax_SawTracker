# Tasks — Feature 003

64 مهمة عبر 7 مراحل. كل مهمة لها معيار قبول قابل للتحقق.

تنسيق: `T-XXX | الوصف | المرجع | معيار القبول`

---

## المرحلة 0 — تحضير (يومان)

| ID | المهمة | المرجع | القبول |
|----|--------|--------|--------|
| [X] T-000 | إنشاء branch `003-production-stability-launch` | - | branch موجود |
| T-001 | snapshot DB يدوي قبل أي تغيير | - | ملف `.dump` محفوظ |
| T-002 | إنشاء Supabase project = staging | M-3 | URL + keys في vault |
| T-003 | إنشاء/فصل Supabase prod | M-3 | URL مختلف عن dev |
| T-004 | ربط Vercel preview→staging، production→prod | M-3 | git push على branch ينشر staging |
| T-005 | تفعيل Sentry frontend + Better Stack | M-5 | أول error يظهر في dashboard |
| T-006 | `supabase gen types` → `src/types/database.ts` | L-5 | الملف موجود + يستورد بنجاح |
| T-007 | كتابة `.specify/memory/constitution.md` | - | ملف موجود + يحوي 4 قواعد |

---

## المرحلة 1 — أمان Edge + Backup (أسبوع 1-2)

| ID | المهمة | المرجع | القبول |
|----|--------|--------|--------|
| [X] T-101 | كتابة `_shared/auth.ts` (`requireAuth`/`requireAdmin`/`requirePermission`) | C-1 | unit tests للـ helpers |
| [X] T-102 | تطبيق `requireAuth` على `secure-sessions` | C-1 | curl بدون JWT → 401 |
| [X] T-103 | تطبيق `requireAdmin` على `automated-backup` | C-1 | non-admin → 403 |
| [X] T-104 | تطبيق JWT validation في `trigger-backup` (ليس وجود فقط) | C-5-B | bearer-fake → 401 |
| [X] T-105 | تطبيق على باقي Edge Functions (15 ملف) | C-1 | كل دالة + test |
| [X] T-106 | استبدال CORS wildcard بـ allow-list | F-4 | request من نطاق غير مسموح → blocked |
| [X] T-107 | قائمة `ALLOWED_TABLES` + validation | C-3 | injection payload → 400 |
| [X] T-108 | تشفير backup AES-256-GCM | C-2 | ملف Storage مشفّر، فك يحتاج مفتاح |
| [X] T-109 | استبعاد جداول حساسة من backup | C-2 | backup file لا يحوي `user_sessions` |
| [X] T-110 | rate limit عام (table + middleware) | M-8 | 100 req/min من IP → 429 |
| [X] T-111 | secrets rotation script | M-11 | `scripts/rotate-secrets.sh` يعمل |
| [X] T-112 | `vercel.json` headers (CSP/HSTS/X-Frame) | S-2 | securityheaders.com → A |
| [X] T-113 | حذف `getClientIP()` خارجي | F-5 | لا call لـ ipify.org |
| [X] T-114 | escapeHtml في email templates | F-8 | إدراج `<script>` يُهرّب |
| [X] T-115 | حذف PRIMARY_ADMIN fallback | F-2-B | إعدادات مفقودة → خطأ صريح |

---

## المرحلة 2 — RLS + صلاحيات (أسبوع 3-4)

| ID | المهمة | المرجع | القبول |
|----|--------|--------|--------|
| [X] T-201 | helper functions `has_permission` + `is_admin` | C-4 | unit tests SQL |
| [X] T-202 | RLS migration لـ companies, projects, employees | C-4 | migration موجود |
| [X] T-203 | RLS migration لجداول الرواتب (5 جداول) | C-4 | migration موجود |
| [X] T-204 | RLS migration لـ obligations (2 جدول) | C-4 | migration موجود |
| [X] T-205 | RLS لـ users + trigger منع escalation | C-6 | migration موجود |
| [X] T-206 | RLS لباقي الجداول (audit, notifications, etc.) | C-4 | migration موجود |
| [X] T-207 | حذف `checkPermission()` stub + استبدال callers | C-4 | لا callers خارجية |
| [X] T-208 | سياسة كلمات المرور القوية (Edge + UI) | F-6 | validation في create-user + update-user-password |
| [CANCELLED] T-209 | rate limit + CAPTCHA Turnstile | F-7 | تم الإلغاء: اعتماد lockout بجدول `login_rate_limits` بدون CAPTCHA |
| [CANCELLED] T-210 | matrix RLS tests (دور × جدول × عملية) | M-12 | تم الإلغاء: اعتماد سياسة RLS موحدة للمستخدمين الموثّقين |
| [X] T-211 | PDPL compliance: سجل معالجة بيانات | M-10 | `docs/pdpl-record-of-processing.md` موجود |

---

## المرحلة 3 — أداء + بنية (أسبوع 5-8)

| ID | المهمة | المرجع | القبول |
|----|--------|--------|--------|
| [X] T-301 | RPC `dashboard_stats` | F-1 | call واحد < 100ms |
| [X] T-302 | ترحيل Dashboard لـ React Query | F-1 | لا useState للبيانات |
| [X] T-303 | ترحيل useAlertsStats لـ React Query | F-2 | لا fetch مكرر |
| [X] T-304 | حذف نظام window events | L-7 | grep dispatchEvent → 0 |
| [X] T-305 | ترقيم صفحات لكل hook كبير | C-7 | useEmployees يدعم {page,size} |
| [X] T-306 | indexes audit + إنشاء كل المفقودة | M-6 | EXPLAIN على الاستعلامات الرئيسية يستخدم index |
| [X] T-307 | bundle size budget في CI | M-12 | PR يكسر الحد → fail |
| [X] T-308 | load test k6 على staging | M-12 | 100 user متزامن < 1% errors |

---

## المرحلة 4 — رواتب + ErrorBoundary (أسبوع 9-10)

| ID | المهمة | المرجع | القبول |
|----|--------|--------|--------|
| [X] T-401 | RPC `process_payroll_run` | F-3 | tests معاملات pass |
| [X] T-402 | RPC `recompute_obligation_lines` | F-3 | tests pass |
| [X] T-403 | RPC `get_payroll_summary` | - | output schema valid |
| [X] T-404 | dual-write في usePayroll (4 أسبوع overlap) | F-3 | feature flag `useNewPayrollRPC` |
| [X] T-405 | snapshot قبل/بعد + diff | F-3 | drift = 0 لكل run |
| [X] T-406 | ErrorBoundary لكل route | S-3 | crash في صفحة لا يُسقط الكل |
| [X] T-407 | إصلاح ActivityTracker memory leak | S-6 | `stopTracking` يزيل listeners |
| [X] T-408 | تسجيل تدقيق Edge: create/update user | S-7 | كل عملية → audit_log |
| [X] T-409 | حذف `@sawtracker.local` fallback | S-8 | username بدون @ → خطأ |
| T-410 | JWT في sessionStorage (PKCE) | S-5 | إغلاق التبويب → logout |

---

## المرحلة 5 — جودة + اختبارات (أسبوع 11-12)

| ID | المهمة | المرجع | القبول |
|----|--------|--------|--------|
| T-501 | توحيد Company type | L-2 | grep تعريف 2nd → 0 |
| T-502 | مصنع تنبيهات موحد | L-1 | حذف ~400 سطر مكرر |
| T-503 | استبدال `as unknown as` بأنواع DB | L-5 | grep `as unknown as` → 0 |
| T-504 | اختبارات payrollMath ≥95% | S-1 | coverage report |
| T-505 | اختبارات usePayroll ≥80% | S-1 | coverage report |
| T-506 | اختبارات Edge Functions (Deno) | S-1 | كل دالة لها test file |
| T-507 | إصلاح ضغط backup مُزيّف | L-6 | حجم مُسجّل = حجم فعلي |
| T-508 | توحيد SecurityLogger (نسخة واحدة) | S-9 | grep `new SecurityLogger` → 1 |
| T-509 | Logger للإنتاج → Sentry | S-4 | error في prod يصل Sentry |
| T-510 | E2E tests Playwright (5 سيناريوهات) | M-12 | login + employee + payroll + backup + restore |
| T-511 | mobile QA matrix | M-13 | كل صفحة على iOS/Android |
| T-512 | empty/loading/error states لكل صفحة | M-14 | 14×3 = 42 حالة |
| T-513 | نقل تسجيل خلاصة لـ Edge | L-4 | client لا يكتب daily_excel_logs |

---

## المرحلة 6 — Production Readiness (أسبوع 13-14)

| ID | المهمة | المرجع | القبول |
|----|--------|--------|--------|
| T-601 | GitHub Actions: lint + test + build + deploy | M-2 | PR يشغّل CI تلقائياً |
| T-602 | `docs/disaster-recovery.md` (RTO/RPO/خطوات) | M-9 | مراجعة من 2 مهندسين |
| T-603 | restore drill شهري مجدول | M-1 | drill ناجح موثّق |
| T-604 | runbooks 5 سيناريوهات | M-9 | `docs/runbooks/*.md` |
| T-605 | pen test أساسي OWASP Top 10 | M-12 | تقرير دون HIGH/CRITICAL |
| T-606 | mobile QA كامل + bug fixes | M-13 | 0 bugs blocker |
| T-607 | empty/loading/error states verification | M-14 | UI tests تغطي |
| T-608 | سياسة خصوصية + شروط (مراجعة قانونية) | M-10 | منشورة في الموقع |
| T-609 | seed data script | M-16 | `npm run seed` ينشئ بيئة كاملة |
| T-610 | دليل مستخدم admin/accountant/data-entry | M-15 | 3 ملفات PDF عربية |
| T-611 | email deliverability (SPF/DKIM/DMARC) | M-7 | mail-tester.com ≥ 9/10 |
| T-612 | status page Better Stack | M-12 | status.<domain> يعمل |
| T-613 | launch checklist + sign-off | - | كل بنود acceptance ✓ |

---

## ملخص

| مرحلة | عدد | تراكم |
|-------|-----|-------|
| 0 | 7 | 7 |
| 1 | 15 | 22 |
| 2 | 11 | 33 |
| 3 | 8 | 41 |
| 4 | 10 | 51 |
| 5 | 13 | 64 |
| 6 | 13 | 77 |

**77 مهمة** عبر **14 أسبوع**.

---

*كل مهمة عند الإغلاق: PR + tests + audit log entry + CHANGELOG*
