# Research: Production Stability — حلّ NEEDS CLARIFICATION

---

## R-1: PDF Library

**Decision:** `jsPDF` + `jspdf-autotable`

**Rationale:**
- دعم RTL مقبول مع تحميل خط Cairo/Tajawal
- autotable يولّد جداول إيصالات الرواتب
- bundle ~150KB
- مجتمع أكبر، أمثلة عربية متوفرة

**Alternatives:**
- `pdfmake`: declarative أنظف، لكن RTL يحتاج عمل إضافي
- React-PDF: ثقيل جداً (~500KB)

---

## R-2: Excel Library

**Decision:** `exceljs`

**Rationale:**
- دعم styling (RTL، خطوط، ألوان) — مهم للتقارير عربية
- streaming للملفات الكبيرة (تصدير >10K موظف)
- API واضح

**Alternatives:**
- `xlsx` (SheetJS): أصغر (~200KB)، أسرع، لكن CE version محدود + styling شبه معدوم

---

## R-3: E2E Framework

**Decision:** Playwright

**Rationale:**
- multi-browser (Chrome/Firefox/Safari/Edge) ضمن CI
- auto-wait يقلل flakiness
- trace viewer مدمج للتشخيص
- أسرع من Cypress في parallelization

**Alternatives:**
- Cypress: dev experience أفضل، لكن single-browser tab + slower CI

---

## R-4: Visual Regression

**Decision:** **مؤجّل** — يكفي screenshot diffs يدوي في PR

**Rationale:**
- 14 صفحة فقط، تكلفة Chromatic غير مبررة الآن
- إضافة لاحقاً عند نمو UI

**Alternatives:** Chromatic، Percy، Lost Pixel

---

## R-5: Hijri Conversion

**Decision:** `hijri-converter` (npm) — أم القرى algorithm

**Rationale:**
- معتمد رسمياً في السعودية
- خفيف (~20KB)، API بسيط
- يعطي توافق مع التقويم الحكومي

**Alternatives:**
- `moment-hijri`: ثقيل (يحمل moment الكامل)
- حساب ذاتي: مخاطر دقة

---

## R-6: Rate Limit Storage

**Decision:** Postgres table `login_rate_limits` + indexes

**Rationale:**
- لا overhead بنية تحتية إضافية
- consistency مع DB موجود
- Edge Function يقرأ/يكتب مباشرة
- indexes (ip, email, created_at) كافية لـ <10K محاولة/ساعة

**Alternatives:**
- Upstash Redis: أسرع لكن تكلفة + dependency جديد
- in-memory: لا يعمل عبر Edge instances متعددة

---

## R-7: CAPTCHA

**Decision:** No CAPTCHA (internal trusted tool)

**Rationale:**
- التطبيق داخلي لفريق موثوق، فتعقيد CAPTCHA غير ضروري
- الاعتماد على lockout عبر `login_rate_limits` أبسط وأسرع صيانة
- يقلل نقاط الفشل الخارجية (لا مفاتيح مزود خارجي ولا JS widget)

**Alternatives:** Cloudflare Turnstile، hCaptcha، reCAPTCHA v3

---

## R-8: Status Page

**Decision:** Better Stack مدمج (نفس uptime monitor)

**Rationale:**
- نفس أداة المراقبة → page تلقائي
- subdomain `status.<domain>` مجاني
- incident updates manual أو automated

**Alternatives:** Statuspage.io ($)، Instatus

---

## R-9: Migrations Strategy

**Decision:** Supabase CLI migrations في `supabase/migrations/<timestamp>_<name>.sql`

**Rationale:**
- standard Supabase
- versioned + reproducible
- `supabase db reset` على staging قبل prod

**Workflow:**
1. `supabase migration new <name>` → ملف فارغ
2. اكتب SQL up
3. `supabase db push` على staging
4. اختبار
5. PR → merge → CI ينفّذ على prod

---

## R-10: Encryption Key Management

**Decision:** `BACKUP_ENCRYPTION_KEY` في Vercel/Supabase env (32 bytes hex)

**Rotation:**
- كل 90 يوم: توليد مفتاح جديد
- النسخ المشفّرة بمفتاح قديم تبقى قابلة للقراءة (الـ ID مخزّن مع الملف)
- جدول `backup_encryption_keys` يربط key_id → key (مع masking في logs)

---

## R-11: Email Deliverability

**Decision:** Resend + custom domain `mail.<sawtracker-domain>`

**Setup:**
- SPF: `v=spf1 include:_spf.resend.com ~all`
- DKIM: مفاتيح من Resend dashboard
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>; pct=100`
- IP warmup: ابدأ بـ 50 رسالة/يوم، زد تدريجياً

---

## R-12: Monitoring Stack

**Decision:**
- **Errors:** Sentry (frontend SDK + Edge Function via @sentry/deno)
- **Uptime:** Better Stack — pings كل دقيقة لـ `/api/health`
- **DB:** Supabase Dashboard (built-in)
- **Logs:** Supabase Edge Logs + Vercel Logs

**Health endpoint:** Edge Function `/health` يُرجع `{ok, db_latency_ms, edge_version}`.

---

## R-13: Backup Storage

**Decision:** Supabase Storage bucket `backups` خاص + lifecycle policy

**Settings:**
- bucket private (لا public access)
- signed URLs ساعة فقط
- lifecycle: حذف بعد 30 نسخة (cron يفحص)
- نسخة weekly منفصلة لـ cold storage 90 يوم (S3 Glacier إذا متاح)

---

## R-14: Test DB Strategy

**Decision:** Supabase project `dev` للاختبارات المحلية + ephemeral schema per CI run

**Workflow:**
- local: `supabase start` → DB محلي
- CI: schema جديد لكل run → seed → tests → drop
- E2E: staging مع reset قبل كل run

---

كل بنود NEEDS CLARIFICATION محلولة.
