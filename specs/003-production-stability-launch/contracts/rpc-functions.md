# RPC Function Contracts

كل RPC `SECURITY DEFINER` تُنفّذ التحقق من الصلاحية داخلياً.

---

## 1. `process_payroll_run(p_run_id UUID, p_action TEXT) → JSONB`

**Permissions:**
- `calculate`, `cancel` → `payroll.edit`
- `finalize` → `payroll.finalize`
- `delete` → `payroll.delete`

**Inputs:**
- `p_run_id`: UUID موجود في `payroll_runs`
- `p_action`: enum `'calculate' | 'finalize' | 'cancel' | 'delete'`

**State machine:**
- `draft → calculate → processing`
- `processing → finalize → finalized`
- `* → cancel → cancelled`
- `cancelled | finalized → delete → (deleted)` (admin only)

**Output:**
```json
{
  "success": true,
  "action": "calculate",
  "run_id": "uuid",
  "entries_processed": 42,
  "components_synced": 168,
  "obligations_linked": 23
}
```

**Errors:**
- `INSUFFICIENT_PERMISSION` (42501)
- `INVALID_TRANSITION` (P0001) — مثلاً finalize على cancelled
- `RUN_NOT_FOUND` (P0002)

**Atomicity:** كل الإجراء داخل معاملة واحدة. أي failure → ROLLBACK كامل.

---

## 2. `dashboard_stats() → JSONB`

**Permissions:** `dashboard.view`

**Output:**
```json
{
  "companies_count": 12,
  "employees_count": 234,
  "projects_count": 8,
  "alerts_urgent": 5,
  "alerts_high": 18,
  "alerts_medium": 42,
  "recent_employees": [{...}, {...}]
}
```

**Performance:** stable function، يُكاش 60 ثانية على مستوى DB.

---

## 3. `compute_alerts(p_company_id UUID DEFAULT NULL) → SETOF alerts_record`

**Permissions:** `alerts.view`

**Inputs:** `p_company_id` (اختياري — لتنبيهات شركة محددة)

**Output:** صفوف تنبيهات بالشكل:
```json
{
  "id": "uuid",
  "alert_type": "residence_expiry",
  "entity_type": "employee",
  "entity_id": "uuid",
  "entity_name": "string",
  "days_remaining": 12,
  "priority": "urgent" | "high" | "medium" | "low",
  "target_date": "2026-05-12",
  "metadata": {}
}
```

**Logic:** يقرأ `system_settings.alert_thresholds` لتحديد الأولوية.

---

## 4. `cleanup_old_logs() → VOID`

**Permissions:** service role فقط (يُستدعى من pg_cron)

**Behavior:** حذف:
- `audit_log` > 365 يوم
- `activity_log` > 365 يوم
- `login_attempts` > 90 يوم
- `login_rate_limits` غير مقفلة > 30 يوم
- `cron_jobs_log` > 90 يوم
- `security_events` المحلولة > 180 يوم

**Schedule:** `pg_cron` يومياً 03:00 UTC.

---

## 5. `restore_from_backup(p_backup_id UUID, p_target_schema TEXT) → JSONB`

**Permissions:** admin فقط + يتحقق من `is_admin(auth.uid())`

**Inputs:**
- `p_backup_id`: UUID من `backups`
- `p_target_schema`: schema للاستعادة (لا تستعيد على `public` مباشرة في prod)

**Behavior:**
1. تحميل الملف من Storage
2. فك التشفير بالمفتاح المرتبط (`backup_encryption_keys`)
3. تنفيذ INSERT داخل schema منفصل
4. كتابة `backups.restore_tested_at`
5. كتابة audit

**Output:**
```json
{
  "success": true,
  "backup_id": "uuid",
  "rows_restored": 12345,
  "duration_seconds": 45
}
```

**Use case:** restore drill شهري — لا يلمس بيانات الإنتاج.

---

## 6. `recompute_obligation_lines(p_header_id UUID) → JSONB`

**Permissions:** `obligations.edit`

**Inputs:** `p_header_id` من `employee_obligation_headers`

**Behavior:**
- يحسب `installment_count` خطوط شهرية
- إذا نُفّذ على header موجود: يحفظ الخطوط القديمة المدفوعة، يستبدل الباقية، يضع `source_version + 1`

**Output:**
```json
{ "header_id": "uuid", "lines_created": 12, "lines_preserved": 3 }
```

---

## 7. `get_payroll_summary(p_run_id UUID) → JSONB`

**Permissions:** `payroll.view`

**Output:**
```json
{
  "run_id": "uuid",
  "month": "2026-04",
  "scope": { "type": "company", "id": "uuid", "name": "string" },
  "status": "finalized",
  "totals": {
    "employees_count": 42,
    "gross_total": 250000.00,
    "deductions_total": 15000.00,
    "installments_total": 8000.00,
    "net_total": 227000.00
  },
  "breakdown_by_project": [{...}],
  "currency": "SAR"
}
```

---

## أنماط الأخطاء الموحدة

```sql
RAISE EXCEPTION 'INVALID_TRANSITION: %' USING ERRCODE = 'P0001';
RAISE EXCEPTION 'NOT_FOUND: %' USING ERRCODE = 'P0002';
RAISE EXCEPTION 'INSUFFICIENT_PERMISSION' USING ERRCODE = '42501';
```

الواجهة تترجم `ERRCODE` لرسالة عربية قابلة للعرض.

---

*نهاية contracts*
