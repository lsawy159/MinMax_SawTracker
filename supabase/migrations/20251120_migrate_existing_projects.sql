-- Migration: Migrate Existing Project Names to Projects Table
-- Created: 2025-11-20
-- Description: تحويل أسماء المشاريع الموجودة في project_name إلى سجلات في جدول projects

-- 1. دالة مساعدة لتنظيف أسماء المشاريع (إزالة مسافات زائدة، توحيد الحالة)
CREATE OR REPLACE FUNCTION clean_project_name(project_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF project_name IS NULL OR TRIM(project_name) = '' THEN
    RETURN NULL;
  END IF;
  
  -- إزالة المسافات الزائدة من البداية والنهاية
  RETURN TRIM(REGEXP_REPLACE(project_name, '\s+', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. إنشاء المشاريع من الأسماء الفريدة الموجودة
DO $$
DECLARE
  project_record RECORD;
  cleaned_name TEXT;
  project_uuid UUID;
BEGIN
  -- حلقة عبر جميع الأسماء الفريدة من project_name
  FOR project_record IN
    SELECT DISTINCT clean_project_name(project_name) as name
    FROM public.employees
    WHERE clean_project_name(project_name) IS NOT NULL
      AND clean_project_name(project_name) != ''
  LOOP
    cleaned_name := project_record.name;
    
    -- التحقق من وجود المشروع بالفعل
    SELECT id INTO project_uuid
    FROM public.projects
    WHERE name = cleaned_name;
    
    -- إذا لم يكن موجود، إنشاؤه
    IF project_uuid IS NULL THEN
      INSERT INTO public.projects (name, status, created_at, updated_at)
      VALUES (cleaned_name, 'active', NOW(), NOW())
      RETURNING id INTO project_uuid;
      
      RAISE NOTICE 'تم إنشاء مشروع جديد: %', cleaned_name;
    END IF;
  END LOOP;
END $$;

-- 3. ربط الموظفين بالمشاريع الجديدة
UPDATE public.employees e
SET project_id = p.id
FROM public.projects p
WHERE clean_project_name(e.project_name) = p.name
  AND e.project_id IS NULL;

-- 4. إحصائيات عن الترقية
DO $$
DECLARE
  total_projects INTEGER;
  linked_employees INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_projects FROM public.projects;
  SELECT COUNT(*) INTO linked_employees FROM public.employees WHERE project_id IS NOT NULL;
  
  RAISE NOTICE 'تم إنشاء % مشروع', total_projects;
  RAISE NOTICE 'تم ربط % موظف بمشروع', linked_employees;
END $$;

-- 5. تنظيف: حذف الدالة المساعدة (اختياري - يمكن الاحتفاظ بها)
-- DROP FUNCTION IF EXISTS clean_project_name(TEXT);

