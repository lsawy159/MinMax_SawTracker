-- Migration: Backup Schedule Settings
-- Adds automated backup scheduling settings to system_settings

-- 0. Ensure required columns exist in system_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'category') THEN
    ALTER TABLE public.system_settings ADD COLUMN category TEXT DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'description') THEN
    ALTER TABLE public.system_settings ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'setting_type') THEN
    ALTER TABLE public.system_settings ADD COLUMN setting_type TEXT DEFAULT 'text';
  END IF;
END $$;

-- 1. Insert backup schedule settings (skip if already exist)
INSERT INTO system_settings (setting_key, setting_value, category, description, setting_type)
VALUES
  ('backup_schedule_enabled',  'false'::jsonb,    'backup', 'تفعيل النسخ الاحتياطي التلقائي',             'boolean'),
  ('backup_frequency',         '"daily"'::jsonb,  'backup', 'تكرار النسخ: daily / weekly / monthly',       'select'),
  ('backup_schedule_hour',     '2'::jsonb,        'backup', 'ساعة تشغيل النسخ الاحتياطي (0-23)',          'number'),
  ('backup_schedule_day',      '0'::jsonb,        'backup', 'يوم الأسبوع للنسخ الأسبوعي (0=الأحد)',       'number'),
  ('backup_retention_days',    '30'::jsonb,       'backup', 'عدد أيام الاحتفاظ بالنسخ الاحتياطية',       'number'),
  ('backup_last_run_at',       'null'::jsonb,     'backup', 'آخر تشغيل فعلي للنسخ الاحتياطي',            'text'),
  ('backup_next_run_at',       'null'::jsonb,     'backup', 'الموعد المجدول للنسخ الاحتياطي القادم',      'text')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Helper: Calculate next backup timestamp based on settings
CREATE OR REPLACE FUNCTION calculate_next_backup_at(
  p_frequency   text,
  p_hour        int,
  p_day_of_week int DEFAULT 0
) RETURNS timestamptz AS $$
DECLARE
  v_now   timestamptz := now() AT TIME ZONE 'UTC';
  v_today date        := (v_now AT TIME ZONE 'UTC')::date;
  v_candidate timestamptz;
BEGIN
  CASE p_frequency
    WHEN 'daily' THEN
      v_candidate := (v_today::text || ' ' || lpad(p_hour::text, 2, '0') || ':00:00')::timestamptz AT TIME ZONE 'UTC';
      IF v_candidate <= v_now THEN
        v_candidate := v_candidate + INTERVAL '1 day';
      END IF;

    WHEN 'weekly' THEN
      -- Find next occurrence of p_day_of_week (0=Sunday)
      DECLARE
        v_days_until int := (p_day_of_week - EXTRACT(DOW FROM v_now)::int + 7) % 7;
      BEGIN
        IF v_days_until = 0 THEN
          v_candidate := (v_today::text || ' ' || lpad(p_hour::text, 2, '0') || ':00:00')::timestamptz AT TIME ZONE 'UTC';
          IF v_candidate <= v_now THEN v_days_until := 7; END IF;
        END IF;
        IF v_days_until > 0 THEN
          v_candidate := ((v_today + v_days_until)::text || ' ' || lpad(p_hour::text, 2, '0') || ':00:00')::timestamptz AT TIME ZONE 'UTC';
        END IF;
      END;

    WHEN 'monthly' THEN
      -- First day of next month
      v_candidate := (date_trunc('month', v_now) + INTERVAL '1 month' + (p_hour || ' hours')::interval);
      IF v_candidate <= v_now THEN
        v_candidate := v_candidate + INTERVAL '1 month';
      END IF;

    ELSE
      v_candidate := v_now + INTERVAL '1 day';
  END CASE;

  RETURN v_candidate;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to refresh next_backup_at based on current settings
CREATE OR REPLACE FUNCTION refresh_next_backup_at() RETURNS void AS $$
DECLARE
  v_enabled   boolean;
  v_frequency text;
  v_hour      int;
  v_day       int;
  v_next      timestamptz;
BEGIN
  SELECT (setting_value)::boolean INTO v_enabled
    FROM system_settings WHERE setting_key = 'backup_schedule_enabled';

  IF NOT v_enabled THEN
    UPDATE system_settings SET setting_value = to_jsonb(null::text)
      WHERE setting_key = 'backup_next_run_at';
    RETURN;
  END IF;

  SELECT setting_value::text INTO v_frequency
    FROM system_settings WHERE setting_key = 'backup_frequency';
  SELECT setting_value::int INTO v_hour
    FROM system_settings WHERE setting_key = 'backup_schedule_hour';
  SELECT setting_value::int INTO v_day
    FROM system_settings WHERE setting_key = 'backup_schedule_day';

  v_next := calculate_next_backup_at(
    COALESCE(trim(both '"' from v_frequency), 'daily'),
    COALESCE(v_hour, 2),
    COALESCE(v_day, 0)
  );

  UPDATE system_settings
    SET setting_value = to_jsonb(v_next::text)
    WHERE setting_key = 'backup_next_run_at';
END;
$$ LANGUAGE plpgsql;

-- 4. Enable pg_cron and pg_net if available (Pro plan only — fails silently on free tier)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available (requires Pro plan) — using scheduler edge function instead';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net not available — skipping HTTP cron setup';
END $$;

-- 5. Ensure backup_history has triggered_by column
ALTER TABLE backup_history
  ADD COLUMN IF NOT EXISTS triggered_by text DEFAULT 'manual'
    CHECK (triggered_by IN ('manual', 'scheduled', 'cron'));
