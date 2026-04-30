# Quickstart — مطوّر جديد على feature 003

---

## 1. تثبيت المتطلبات

```bash
# Node 22.x + npm
nvm install 22 && nvm use 22

# Supabase CLI
npm install -g supabase

# Vercel CLI (اختياري)
npm install -g vercel
```

---

## 2. إعداد البيئة

```bash
# clone + install
git clone <repo> && cd sawtracker
npm install

# نسخ env
cp .env.example .env.local
# املأ:
# VITE_SUPABASE_URL=<dev-project-url>
# VITE_SUPABASE_ANON_KEY=<dev-anon-key>
# VITE_SENTRY_DSN=<dsn>
```

---

## 3. تشغيل محلي

```bash
# DB محلي
supabase start

# تطبيق migrations
supabase db reset

# توليد types
npm run gen:types

# تشغيل التطبيق
npm run dev
# http://localhost:5173
```

---

## 4. تشغيل الاختبارات

```bash
# unit
npm test

# coverage
npm run test:coverage

# E2E (Playwright)
npm run test:e2e

# Edge Functions (Deno)
cd supabase/functions
deno test --allow-all
```

---

## 5. تطبيق migration جديد

```bash
# إنشاء ملف
supabase migration new add_login_rate_limits

# تحرير ملف SQL في supabase/migrations/

# تطبيق محلي
supabase db reset

# اختبار
npm test

# دفع لـ staging (عبر CI أو يدوي)
supabase db push --project-ref <staging-ref>

# بعد اختبار staging → دفع لـ prod (عبر CI)
```

---

## 6. اختبار restore drill (شهري)

```bash
# 1. تنزيل آخر نسخة احتياطية من Storage
supabase storage download backups/<latest>.enc

# 2. فك التشفير (محلي)
node scripts/decrypt-backup.js <file>.enc <key-id>

# 3. استعادة على staging schema منفصل
psql $STAGING_DB_URL -c "CREATE SCHEMA restore_test"
psql $STAGING_DB_URL -f decrypted.sql

# 4. التحقق من العدّ
node scripts/verify-restore.js

# 5. تحديث backups.restore_tested_at
```

**RTO target:** ≤ 4 ساعة. سجّل المدة في `docs/dr-drill-log.md`.

---

## 7. تشغيل CI محلياً

```bash
# نفس ما يفعل GitHub Actions
npm run lint
npm run typecheck
npm test -- --coverage
npm run build

# bundle size check
npm run size
```

---

## 8. Debug Edge Function محلياً

```bash
supabase functions serve <fn-name> --env-file .env.local

# في terminal آخر
curl -X POST http://localhost:54321/functions/v1/<fn-name> \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"action":"create"}'
```

---

## 9. سيناريوهات منتشرة

### "RLS كسر استعلام"

```sql
-- اختبار من psql
SET role authenticated;
SET request.jwt.claim.sub = '<user-uuid>';
SELECT * FROM employees LIMIT 1;
-- إذا فشل: راجع policy في supabase/migrations/<...>_rls.sql
```

### "JWT فاسد على Edge"

```bash
# تحقق من ALLOWED_ORIGINS env
supabase secrets list --project-ref <ref>

# اختبر مباشرة
curl ... # كما أعلاه
```

### "rate limit يحبسني"

```sql
DELETE FROM login_rate_limits WHERE email = '<your-email>';
```

---

## 10. checklist قبل PR

- [ ] `npm run lint` ينجح
- [ ] `npm run typecheck` ينجح
- [ ] `npm test` ينجح + coverage لا ينخفض
- [ ] migration له `down` script
- [ ] RLS policies للجداول الجديدة
- [ ] Edge Functions الجديدة عبر `requireAuth`
- [ ] لا secrets في الكود
- [ ] CHANGELOG محدّث
- [ ] PR description يشير لـ task ID (T-xxx) من plan.md

---

## 11. الإطلاق للإنتاج

```bash
# 1. merge PR إلى main
# 2. CI يشغّل tests + build
# 3. CI ينفّذ migrations على prod
# 4. Vercel ينشر فرونت
# 5. Better Stack uptime check خلال 5 دقائق
# 6. Sentry يراقب error rate
# 7. إذا spike → rollback (Vercel UI + revert migration إذا لزم)
```

---

*نهاية quickstart*
