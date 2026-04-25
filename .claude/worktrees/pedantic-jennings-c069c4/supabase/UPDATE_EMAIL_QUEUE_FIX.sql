-- إصلاح قائمة انتظار البريد الإلكتروني: استبدال المستلم الوهمي
-- Mandatory Log: سجل جميع الحالات قبل الاستبدال

-- LOG: عرض جميع السجلات المعلقة التي تحتوي على 'admin@sawtracker.com'
SELECT id, to_emails
FROM public.email_queue
WHERE status = 'pending'
  AND 'admin@sawtracker.com' = ANY(to_emails);

-- تنفيذ الاستبدال: استبدال 'admin@sawtracker.com' بـ 'ahmad.alsawy159@gmail.com'
-- NOTE: يستخدم array_replace لاستبدال القيمة داخل مصفوفة البريد
UPDATE public.email_queue
SET to_emails = array_replace(to_emails, 'admin@sawtracker.com', 'ahmad.alsawy159@gmail.com'),
    error_message = NULL
WHERE status = 'pending'
  AND 'admin@sawtracker.com' = ANY(to_emails);

-- LOG: تحقق بعد الاستبدال
SELECT id, to_emails
FROM public.email_queue
WHERE status = 'pending'
  AND 'ahmad.alsawy159@gmail.com' = ANY(to_emails);
