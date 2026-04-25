BEGIN;

-- تعطيل التريجر مؤقتًا لتجنب أي إعادة إدراج فورية أثناء الحذف
ALTER TABLE public.email_queue DISABLE TRIGGER ALL;

WITH pre AS (
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS pre_pending,
    COUNT(*) FILTER (WHERE status = 'failed')  AS pre_failed
  FROM public.email_queue
),
to_delete AS (
  SELECT id, status FROM public.email_queue WHERE status IN ('pending', 'failed')
),
deleted_rows AS (
  DELETE FROM public.email_queue e
  USING to_delete t
  WHERE e.id = t.id
  RETURNING e.status
),
deleted AS (
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS deleted_pending,
    COUNT(*) FILTER (WHERE status = 'failed')  AS deleted_failed
  FROM deleted_rows
),
post AS (
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS post_pending,
    COUNT(*) FILTER (WHERE status = 'failed')  AS post_failed
  FROM public.email_queue
)
SELECT json_build_object(
  'pre',     (SELECT row_to_json(pre)     FROM pre),
  'deleted', (SELECT row_to_json(deleted) FROM deleted),
  'post',    (SELECT row_to_json(post)    FROM post)
) AS result;

-- إعادة تمكين التريجر
ALTER TABLE public.email_queue ENABLE TRIGGER ALL;

COMMIT;
