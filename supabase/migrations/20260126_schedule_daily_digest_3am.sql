
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_service_role_key TEXT := current_setting('app.service_role_key', true);
  v_project_url TEXT := current_setting('app.settings.project_url', true);
  v_existing_job_id BIGINT;
BEGIN
  -- This migration is environment-sensitive. Skip safely if the required
  -- database settings or extensions are unavailable.
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'Skipping daily-digest-email schedule: pg_cron extension is not available';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Skipping daily-digest-email schedule: pg_net extension is not available';
    RETURN;
  END IF;

  IF v_service_role_key IS NULL OR v_project_url IS NULL THEN
    RAISE NOTICE 'Skipping daily-digest-email schedule: required database settings are missing';
    RETURN;
  END IF;

  SELECT jobid
  INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'daily-digest-email'
  ORDER BY jobid DESC
  LIMIT 1;

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'daily-digest-email',
    '0 3 * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || %L,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('action', 'process-digest')
      );
      $cmd$,
      v_project_url || '/functions/v1/process-email-queue',
      v_service_role_key
    )
  );

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'activity_log'
  ) THEN
    INSERT INTO public.activity_log (entity_type, action, details, created_at)
    VALUES (
      'system',
      'schedule_update',
      jsonb_build_object(
        'job_name', 'daily-digest-email',
        'schedule', '0 3 * * *',
        'target', v_project_url || '/functions/v1/process-email-queue'
      ),
      now()
    );
  END IF;
END $$;
