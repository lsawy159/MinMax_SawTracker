-- جدولة إرسال الملخص اليومي للتنبيهات: الساعة 3 صباحاً يومياً
-- Schedule: Daily Digest Email at 3:00 AM (Every Day)
-- استخدام pg_cron مباشرة بدون جدول وسيط

-- التأكد من تفعيل pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- حذف أي مهمة قديمة لتجنب التكرار
SELECT cron.unschedule('daily-digest-email');

-- جدولة المهمة الجديدة عبر pg_cron بشكل مباشر
-- الصيغة: '0 3 * * *' = الساعة الثالثة صباحاً (03:00) يومياً
-- استدعاء HTTP POST للـ Edge Function
SELECT cron.schedule(
  'daily-digest-email',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xaqmuiowidnjlchexxdg.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('action', 'process-digest')
  );
  $$
);

-- تسجيل تأكيد الجدولة
INSERT INTO public.activity_log (entity_type, action, details, created_at)
VALUES (
  'system',
  'schedule_update',
  'Daily digest email scheduled for 3:00 AM every day via pg_cron',
  now()
);

-- تحقق من المهام المجدولة
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'daily-digest-email';
