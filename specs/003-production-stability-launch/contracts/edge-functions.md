# Edge Function Contracts

كل دالة Edge تتبع نفس النمط: CORS preflight → requireAuth (إلا الاستثناءات) → validate → execute → audit_log → respond.

---

## النمط المشترك

```typescript
// _shared/auth.ts
export async function requireAuth(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw httpError(401, 'NO_TOKEN')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw httpError(401, 'INVALID_TOKEN')
  const { data: u } = await supabase.from('users')
    .select('id,role,is_active,permissions').eq('id', data.user.id).single()
  if (!u || !u.is_active) throw httpError(403, 'INACTIVE_USER')
  return { userId: u.id, role: u.role, permissions: u.permissions }
}

export async function requireAdmin(req: Request) {
  const ctx = await requireAuth(req)
  if (ctx.role !== 'admin') throw httpError(403, 'ADMIN_REQUIRED')
  return ctx
}

export async function requirePermission(req: Request, section: string, action: string) {
  const ctx = await requireAuth(req)
  if (ctx.role === 'admin') return ctx
  if (!ctx.permissions?.[section]?.[action]) throw httpError(403, 'PERMISSION_DENIED')
  return ctx
}
```

---

## CORS

```typescript
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean)
function corsHeaders(origin: string | null) {
  const o = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0] ?? ''
  return {
    'Access-Control-Allow-Origin': o,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}
```

---

## 1. `secure-sessions`

**Auth:** `requireAuth` (`terminate_all` يحتاج `requireAdmin` أو `userId === ctx.userId`)

**Request:**
```json
{
  "action": "create" | "validate" | "terminate" | "list" | "terminate_all",
  "session_token": "string?",
  "user_id": "uuid?",
  "device_info": {}
}
```

**Response 200:**
```json
{ "success": true, "data": {} }
```

**Errors:** 401 NO_TOKEN, 401 INVALID_TOKEN, 403 PERMISSION_DENIED, 400 MISSING_FIELD.

---

## 2. `automated-backup`

**Auth:** `requireAdmin` أو `requireServiceToken` (للـ cron)

**Request:**
```json
{
  "backup_type": "full" | "incremental" | "partial",
  "tables": ["string"],  // اختياري، يُتحقّق ضد ALLOWED_TABLES
  "manual_trigger": true
}
```

**Behavior:**
1. التحقق من كل اسم جدول ضد قائمة `ALLOWED_TABLES`
2. **استثناء**: `user_sessions`, `login_attempts`, `security_events`, `audit_log`
3. إنشاء snapshot JSON
4. تشفير AES-256-GCM بـ `BACKUP_ENCRYPTION_KEY`
5. رفع إلى bucket `backups` (private)
6. إنشاء signed URL صالح ساعة فقط
7. كتابة `backups` row + إرسال بريد للمسؤولين من `system_settings.notification_recipients`
8. إذا فشل أي step: `cron_jobs_log.status = 'failed'` + بريد تنبيه

**Response 200:**
```json
{
  "success": true,
  "backup_id": "uuid",
  "size_bytes": 1234567,
  "tables_count": 12,
  "encryption_key_id": "uuid"
}
```

**Errors:** 400 INVALID_TABLE, 403 ADMIN_REQUIRED, 500 BACKUP_FAILED, 500 ENCRYPTION_FAILED.

---

## 3. `trigger-backup`

**Auth:** `requireAdmin`

**Request:** `{ "backup_type": "full" | "incremental" }`

**Behavior:** validate JWT (ليس الوجود فقط) → استدعاء `automated-backup` مع credentials داخلي → سجل `cron_jobs_log`.

**Response 200:** `{ "success": true, "backup_id": "uuid" }`

---

## 4. `create-user`

**Auth:** `requireAdmin` + `requirePermission('users','create')`

**Request:**
```json
{
  "email": "string",
  "username": "string",
  "full_name": "string",
  "role": "admin" | "manager" | "user",
  "permissions": {},
  "temporary_password": "string"
}
```

**Validation:**
- email: RFC 5322
- username: `^[a-z0-9_]{3,32}$`
- temporary_password: ≥12 + تعقيد
- role: enum

**Behavior:**
1. `supabase.auth.admin.createUser({email, password})`
2. INSERT في `users` table مع `must_change_password = true`
3. كتابة `audit_log` + إرسال بريد ترحيب
4. إذا فشل auth.createUser → ROLLBACK في users

**Response:** `{ "success": true, "user_id": "uuid" }`

**Errors:** 400 INVALID_EMAIL, 400 WEAK_PASSWORD, 409 USER_EXISTS, 403 ADMIN_REQUIRED.

---

## 5. `update-user-password`

**Auth:** `requireAuth` (المستخدم نفسه أو admin)

**Request:**
```json
{
  "user_id": "uuid",
  "new_password": "string",
  "current_password": "string?"  // مطلوب إذا غير admin
}
```

**Validation كلمة المرور:**
- ≥12 حرف
- حرف كبير + صغير + رقم + رمز
- ليس في top-1000 common passwords
- ليس == username/email
- ليس == آخر 5 كلمات سابقة (history table — اختياري)

**Behavior:**
1. إذا غير admin: التحقق من `current_password` عبر sign in
2. `supabase.auth.admin.updateUserById(user_id, {password})`
3. UPDATE `users` SET `password_changed_at = NOW(), must_change_password = FALSE`
4. terminate كل الجلسات الأخرى للمستخدم
5. `audit_log` + بريد تنبيه

**Response:** `{ "success": true }`

**Errors:** 400 WEAK_PASSWORD, 401 WRONG_CURRENT, 403 NOT_ALLOWED.

---

## 6. `update-user-email`

**Auth:** `requireAdmin`

**Request:** `{ "user_id": "uuid", "new_email": "string" }`

**Behavior:** `supabase.auth.admin.updateUserById` → `users.email` → audit.

---

## 7. `login-rate-limit`

**Auth:** عام (لا يتطلب JWT)

**Request:** `{ "email": "string", "ip": "string?" }`

**Behavior:**
1. SELECT من `login_rate_limits` حسب `identifier` (email normalized)
2. إذا `locked_until > NOW()` → status 429
3. عند فشل login: INCREMENT attempts
4. عند `attempts >= 5` → `locked_until = NOW() + 30min`
5. عند نجاح login: حذف الصف

**Response 200:** `{ "allowed": true }`
**Response 429:** `{ "allowed": false, "locked_until": "ISO" }`

---

## 8. `process-email-queue`

**Auth:** `requireServiceToken` (cron only)

**Behavior:**
1. SELECT FROM `email_queue` WHERE `status='pending'` AND `scheduled_for <= NOW()` ORDER BY `created_at` LIMIT 50
2. لكل سطر: UPDATE → 'sending'
3. استدعاء Resend API
4. عند النجاح: UPDATE 'sent', `sent_at = NOW()`
5. عند الفشل: INCREMENT attempts، إذا `>= max_attempts` → 'failed' + تنبيه

**Response:** `{ "processed": 50, "sent": 48, "failed": 2 }`

---

## 9. `compute-daily-digest`

**Auth:** `requireServiceToken` (cron 06:00 KSA)

**Behavior:**
1. حساب التنبيهات للموظفين والشركات
2. INSERT INTO `daily_excel_logs` مع `ON CONFLICT (log_date, digest_key) DO NOTHING`
3. توليد Excel + رفعه + إنشاء signed URL
4. إنشاء سطر في `email_queue` للمستلمين

**Response:** `{ "alerts_count": 142, "email_queued": true }`

---

## 10. `health`

**Auth:** عام

**Response:**
```json
{
  "ok": true,
  "version": "1.0.0",
  "db_latency_ms": 23,
  "edge_runtime": "deno-1.x",
  "timestamp": "ISO"
}
```

استدعاء من Better Stack كل دقيقة.

---

## أكواد الأخطاء الموحدة

| الكود | HTTP | المعنى |
|-------|------|--------|
| NO_TOKEN | 401 | لا يوجد Authorization header |
| INVALID_TOKEN | 401 | JWT غير صالح أو منتهٍ |
| INACTIVE_USER | 403 | حساب معطّل |
| ADMIN_REQUIRED | 403 | يتطلب صلاحية مسؤول |
| PERMISSION_DENIED | 403 | صلاحية ناقصة |
| INVALID_TABLE | 400 | جدول غير مسموح |
| WEAK_PASSWORD | 400 | كلمة مرور لا تستوفي السياسة |
| RATE_LIMITED | 429 | تجاوز الحد |
| BACKUP_FAILED | 500 | فشل النسخ |
| INTERNAL | 500 | خطأ غير متوقع (لا تكشف تفاصيل) |

---

*نهاية contracts*
