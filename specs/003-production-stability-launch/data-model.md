# Data Model — التغييرات والإضافات

كل migration في `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`.

---

## 1. جداول جديدة

### 1.1 `login_rate_limits`

```sql
CREATE TABLE login_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email TEXT,
  attempts INT NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rate_limits_ip ON login_rate_limits(ip_address, last_attempt_at DESC);
CREATE INDEX idx_rate_limits_email ON login_rate_limits(email, last_attempt_at DESC);
CREATE INDEX idx_rate_limits_locked ON login_rate_limits(locked_until) WHERE locked_until IS NOT NULL;
```

### 1.2 `backup_encryption_keys`

```sql
CREATE TABLE backup_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_version INT NOT NULL,
  key_hash TEXT NOT NULL, -- SHA-256 للتحقق فقط، لا المفتاح نفسه
  active BOOLEAN DEFAULT TRUE,
  rotated_from UUID REFERENCES backup_encryption_keys(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  retired_at TIMESTAMPTZ
);
```

### 1.3 `backups`

```sql
CREATE TABLE backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT CHECK (backup_type IN ('full','incremental','partial')) NOT NULL,
  storage_path TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT TRUE,
  encryption_key_id UUID REFERENCES backup_encryption_keys(id),
  size_bytes BIGINT NOT NULL,
  tables_included TEXT[] NOT NULL,
  triggered_by TEXT NOT NULL, -- 'system' | 'manual' | <user_id>
  status TEXT CHECK (status IN ('running','completed','failed','restored')) NOT NULL,
  signed_url_expires_at TIMESTAMPTZ,
  restore_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_backups_status ON backups(status, created_at DESC);
```

### 1.4 `email_queue`

```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  cc TEXT[],
  bcc TEXT[],
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending','sending','sent','failed')) DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_email_queue_pending ON email_queue(scheduled_for) WHERE status = 'pending';
```

### 1.5 `system_settings`

```sql
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- مفاتيح أولية
INSERT INTO system_settings (key, value, description) VALUES
  ('notification_recipients', '{"primary_admin": null, "cc": [], "bcc": []}', 'مستلمو إشعارات النظام'),
  ('alert_thresholds', '{"residence":{"critical":7,"warning":30,"medium":90},"commercial_reg":{"critical":7,"warning":30,"medium":90}}', 'عتبات التنبيهات بالأيام'),
  ('backup_schedule', '{"enabled":true,"cron":"0 23 * * *","retention_count":30}', 'جدولة النسخ الاحتياطي'),
  ('password_policy', '{"min_length":12,"require_upper":true,"require_lower":true,"require_digit":true,"require_symbol":true}', 'سياسة كلمات المرور'),
  ('session_policy', '{"max_duration_hours":8,"idle_timeout_minutes":30}', 'سياسة الجلسات'),
  ('rate_limit_policy', '{"max_attempts":5,"lock_minutes":30}', 'سياسة rate limit');
```

### 1.6 `cron_jobs_log` (إذا غير موجود — يُذكر في trigger-backup)

```sql
CREATE TABLE IF NOT EXISTS cron_jobs_log (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('running','completed','failed')) NOT NULL,
  executed_by TEXT,
  execution_start TIMESTAMPTZ DEFAULT NOW(),
  execution_end TIMESTAMPTZ,
  execution_time_ms BIGINT,
  result_details JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cron_log_job ON cron_jobs_log(job_name, created_at DESC);
```

---

## 2. تعديلات على جداول قائمة

### 2.1 `users`

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS failed_login_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
```

### 2.2 indexes ناقصة على جداول قائمة

```sql
-- companies
CREATE INDEX IF NOT EXISTS idx_companies_unified_number ON companies(unified_number);
CREATE INDEX IF NOT EXISTS idx_companies_commercial_expiry ON companies(commercial_registration_expiry);

-- employees
CREATE INDEX IF NOT EXISTS idx_employees_residence ON employees(residence_number) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_employees_residence_expiry ON employees(residence_expiry) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_employees_health_expiry ON employees(health_insurance_expiry) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_employees_project ON employees(project_id) WHERE NOT is_deleted;

-- payroll
CREATE INDEX IF NOT EXISTS idx_payroll_runs_month_scope ON payroll_runs(payroll_month, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_run ON payroll_entries(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee ON payroll_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_components_entry ON payroll_entry_components(payroll_entry_id);

-- obligations
CREATE INDEX IF NOT EXISTS idx_obligation_lines_employee_month ON employee_obligation_lines(employee_id, due_month);
CREATE INDEX IF NOT EXISTS idx_obligation_lines_status ON employee_obligation_lines(line_status, due_month);

-- audit/activity
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_time ON activity_log(user_id, created_at DESC);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE NOT is_archived;

-- security
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved ON security_events(severity, created_at DESC) WHERE NOT is_resolved;

-- daily_excel_logs UNIQUE (منع تكرار)
ALTER TABLE daily_excel_logs ADD CONSTRAINT uq_digest_per_day UNIQUE(log_date, digest_key);
```

### 2.3 user_sessions: استثناء من backup

تُحدّد عبر منطق Edge، لا تغيير schema.

---

## 3. RLS Policies (لكل جدول)

### 3.1 Helper function

```sql
CREATE OR REPLACE FUNCTION has_permission(p_uid UUID, p_section TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS(SELECT 1 FROM users WHERE id = p_uid AND role = 'admin' AND is_active = TRUE)
    OR EXISTS(
      SELECT 1 FROM users
      WHERE id = p_uid AND is_active = TRUE
      AND COALESCE((permissions -> p_section ->> p_action)::BOOLEAN, FALSE) = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION is_admin(p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM users WHERE id = p_uid AND role = 'admin' AND is_active = TRUE);
$$;
```

### 3.2 نمط لكل جدول

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY <table>_select ON <table> FOR SELECT
  USING (has_permission(auth.uid(), '<section>', 'view'));

CREATE POLICY <table>_insert ON <table> FOR INSERT
  WITH CHECK (has_permission(auth.uid(), '<section>', 'create'));

CREATE POLICY <table>_update ON <table> FOR UPDATE
  USING (has_permission(auth.uid(), '<section>', 'edit'))
  WITH CHECK (has_permission(auth.uid(), '<section>', 'edit'));

CREATE POLICY <table>_delete ON <table> FOR DELETE
  USING (has_permission(auth.uid(), '<section>', 'delete'));
```

**Mapping table → section:**

| جدول | قسم |
|-----|------|
| companies | companies |
| projects | projects |
| employees | employees |
| transfer_procedures | transfers |
| payroll_runs, payroll_entries, payroll_entry_components, payroll_slips | payroll |
| employee_obligation_headers, employee_obligation_lines | obligations |
| notifications | notifications |
| audit_log, activity_log | audit |
| security_events, login_attempts, user_sessions | security |
| system_settings | settings |
| backups, email_queue | data |
| users | users |
| login_rate_limits | (admin only) |

### 3.3 سياسة خاصة بـ users

```sql
-- المستخدم العادي يقرأ نفسه فقط
CREATE POLICY users_select_self ON users FOR SELECT
  USING (id = auth.uid() OR is_admin(auth.uid()));

-- المسؤول وحده يكتب
CREATE POLICY users_write_admin ON users FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY users_update_admin ON users FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY users_delete_admin ON users FOR DELETE USING (is_admin(auth.uid()));

-- trigger يمنع تعديل role/permissions ذاتياً (ضمان مزدوج)
CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id = auth.uid() AND NOT is_admin(auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.permissions IS DISTINCT FROM OLD.permissions THEN
      RAISE EXCEPTION 'لا يمكن تعديل صلاحياتك الذاتية';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_self_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_self_role_escalation();
```

---

## 4. RPC Functions

### 4.1 `process_payroll_run`

```sql
CREATE OR REPLACE FUNCTION process_payroll_run(
  p_run_id UUID,
  p_action TEXT -- 'calculate' | 'finalize' | 'cancel' | 'delete'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- التحقق من الصلاحية
  IF NOT has_permission(auth.uid(), 'payroll',
    CASE p_action WHEN 'finalize' THEN 'finalize' WHEN 'delete' THEN 'delete' ELSE 'edit' END
  ) THEN
    RAISE EXCEPTION 'صلاحية غير كافية';
  END IF;

  CASE p_action
    WHEN 'calculate' THEN
      -- يُنفّذ syncPayrollEntryComponents داخل معاملة واحدة
      -- (تفاصيل في contracts/process_payroll_run.md)
      v_result := jsonb_build_object('action', 'calculate', 'run_id', p_run_id);
    WHEN 'finalize' THEN
      UPDATE payroll_runs SET status = 'finalized', approved_by_user_id = auth.uid(), approved_at = NOW() WHERE id = p_run_id;
      v_result := jsonb_build_object('action', 'finalize', 'run_id', p_run_id);
    WHEN 'cancel' THEN
      UPDATE payroll_runs SET status = 'cancelled' WHERE id = p_run_id;
      -- فك ربط employee_obligation_lines.payroll_entry_id
      UPDATE employee_obligation_lines SET payroll_entry_id = NULL WHERE payroll_entry_id IN (SELECT id FROM payroll_entries WHERE payroll_run_id = p_run_id);
      v_result := jsonb_build_object('action', 'cancel', 'run_id', p_run_id);
    WHEN 'delete' THEN
      DELETE FROM payroll_runs WHERE id = p_run_id; -- CASCADE يحذف entries + components + slips
      v_result := jsonb_build_object('action', 'delete', 'run_id', p_run_id);
    ELSE
      RAISE EXCEPTION 'إجراء غير معروف: %', p_action;
  END CASE;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE; -- ROLLBACK تلقائي
END;
$$;
```

### 4.2 `dashboard_stats`

```sql
CREATE OR REPLACE FUNCTION dashboard_stats()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'companies_count', (SELECT COUNT(*) FROM companies),
    'employees_count', (SELECT COUNT(*) FROM employees WHERE NOT is_deleted),
    'projects_count', (SELECT COUNT(*) FROM projects WHERE status = 'active'),
    'alerts_urgent', (SELECT COUNT(*) FROM employees WHERE NOT is_deleted AND residence_expiry <= CURRENT_DATE + 7),
    'alerts_high', (SELECT COUNT(*) FROM employees WHERE NOT is_deleted AND residence_expiry <= CURRENT_DATE + 30 AND residence_expiry > CURRENT_DATE + 7),
    'alerts_medium', (SELECT COUNT(*) FROM employees WHERE NOT is_deleted AND residence_expiry <= CURRENT_DATE + 90 AND residence_expiry > CURRENT_DATE + 30),
    'recent_employees', (SELECT jsonb_agg(e.*) FROM (SELECT * FROM employees WHERE NOT is_deleted ORDER BY created_at DESC LIMIT 10) e)
  );
$$;
```

### 4.3 `cleanup_old_logs`

```sql
CREATE OR REPLACE FUNCTION cleanup_old_logs() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '365 days';
  DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '365 days';
  DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM login_rate_limits WHERE last_attempt_at < NOW() - INTERVAL '30 days' AND (locked_until IS NULL OR locked_until < NOW());
  DELETE FROM cron_jobs_log WHERE created_at < NOW() - INTERVAL '90 days';
  -- security_events: لا تُحذف غير المحلولة
  DELETE FROM security_events WHERE is_resolved = TRUE AND resolved_at < NOW() - INTERVAL '180 days';
END;
$$;
-- جدولة pg_cron يومي
SELECT cron.schedule('cleanup-logs', '0 3 * * *', 'SELECT cleanup_old_logs()');
```

---

## 5. حالات الانتقال

### 5.1 payroll_runs.status

```
draft ──calculate──> processing ──finalize──> finalized
  │                       │
  └──cancel──┬────────────┘
             ▼
         cancelled
```

`finalized` و`cancelled` نهائيتان. الحذف الفيزيائي يحتاج `delete` action.

### 5.2 employee_obligation_lines.line_status

```
unpaid ──partial_payment──> partial ──full_payment──> paid
   │                            │
   └──reschedule──> rescheduled (تنشئ خط جديد)
   │
   └──cancel──> cancelled
```

### 5.3 user account states

```
active ──5 failed──> locked (30 min) ──auto/clear on success──> active
   │
   └──admin disable──> inactive ──admin enable──> active
```

---

*نهاية data-model*
