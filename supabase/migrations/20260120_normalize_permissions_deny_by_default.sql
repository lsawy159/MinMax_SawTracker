-- Migration: 20260120_normalize_permissions_deny_by_default.sql
--
-- Purpose: Upgrade all existing users' permissions to the new smart schema
-- with Deny by Default policy and consistent structure
--
-- Strategy:
-- 1. Create backup table with current permissions
-- 2. Normalize all user permissions to complete structure
-- 3. Admin users get full access, regular users get deny-by-default
-- 4. Verify migration success

BEGIN;

-- Step 1: Create backup table for rollback purposes
CREATE TABLE IF NOT EXISTS permissions_backup_20260120 AS
SELECT id, email, role, permissions, created_at
FROM public.users;

-- Confirm backup created
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM permissions_backup_20260120) > 0 THEN
    RAISE NOTICE 'Backup table created successfully with % rows', 
                 (SELECT COUNT(*) FROM permissions_backup_20260120);
  END IF;
END $$;

-- Step 2: Update all users with normalized permissions
-- Strategy: Build complete permission structure based on role

-- For Admin users: Grant all permissions
UPDATE public.users
SET permissions = jsonb_build_object(
  'dashboard', jsonb_build_object('view', true),
  'employees', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
  'companies', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
  'projects', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
  'alerts', jsonb_build_object('view', true),
  'advancedSearch', jsonb_build_object('view', true),
  'reports', jsonb_build_object('view', true, 'export', true),
  'activityLogs', jsonb_build_object('view', true),
  'importExport', jsonb_build_object('view', true, 'import', true, 'export', true),
  'users', jsonb_build_object('view', true),
  'settings', jsonb_build_object('view', true, 'edit', true),
  'adminSettings', jsonb_build_object('view', true, 'edit', true),
  'centralizedSettings', jsonb_build_object('view', true, 'edit', true)
)
WHERE role = 'admin';

-- For regular users: Start with deny-by-default and merge any existing permissions
UPDATE public.users
SET permissions = COALESCE(
  -- Try to preserve existing permissions for each section if they exist
  jsonb_build_object(
    'dashboard', COALESCE(
      jsonb_build_object('view', COALESCE((permissions->'dashboard'->>'view')::boolean, false)),
      jsonb_build_object('view', false)
    ),
    'employees', COALESCE(
      jsonb_build_object(
        'view', COALESCE((permissions->'employees'->>'view')::boolean, false),
        'create', COALESCE((permissions->'employees'->>'create')::boolean, false),
        'edit', COALESCE((permissions->'employees'->>'edit')::boolean, false),
        'delete', COALESCE((permissions->'employees'->>'delete')::boolean, false)
      ),
      jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false)
    ),
    'companies', COALESCE(
      jsonb_build_object(
        'view', COALESCE((permissions->'companies'->>'view')::boolean, false),
        'create', COALESCE((permissions->'companies'->>'create')::boolean, false),
        'edit', COALESCE((permissions->'companies'->>'edit')::boolean, false),
        'delete', COALESCE((permissions->'companies'->>'delete')::boolean, false)
      ),
      jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false)
    ),
    'projects', COALESCE(
      jsonb_build_object(
        'view', COALESCE((permissions->'projects'->>'view')::boolean, false),
        'create', COALESCE((permissions->'projects'->>'create')::boolean, false),
        'edit', COALESCE((permissions->'projects'->>'edit')::boolean, false),
        'delete', COALESCE((permissions->'projects'->>'delete')::boolean, false)
      ),
      jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false)
    ),
    'alerts', COALESCE(
      jsonb_build_object('view', COALESCE((permissions->'alerts'->>'view')::boolean, false)),
      jsonb_build_object('view', false)
    ),
    'advancedSearch', COALESCE(
      jsonb_build_object('view', COALESCE((permissions->'advancedSearch'->>'view')::boolean, false)),
      jsonb_build_object('view', false)
    ),
    'reports', COALESCE(
      jsonb_build_object(
        'view', COALESCE((permissions->'reports'->>'view')::boolean, false),
        'export', COALESCE((permissions->'reports'->>'export')::boolean, false)
      ),
      jsonb_build_object('view', false, 'export', false)
    ),
    'activityLogs', COALESCE(
      jsonb_build_object('view', COALESCE((permissions->'activityLogs'->>'view')::boolean, false)),
      jsonb_build_object('view', false)
    ),
    'importExport', COALESCE(
      jsonb_build_object(
        'view', COALESCE((permissions->'importExport'->>'view')::boolean, false),
        'import', COALESCE((permissions->'importExport'->>'import')::boolean, false),
        'export', COALESCE((permissions->'importExport'->>'export')::boolean, false)
      ),
      jsonb_build_object('view', false, 'import', false, 'export', false)
    ),
    'users', COALESCE(
      jsonb_build_object('view', COALESCE((permissions->'users'->>'view')::boolean, false)),
      jsonb_build_object('view', false)
    ),
    'settings', COALESCE(
      jsonb_build_object(
        'view', COALESCE((permissions->'settings'->>'view')::boolean, false),
        'edit', COALESCE((permissions->'settings'->>'edit')::boolean, false)
      ),
      jsonb_build_object('view', false, 'edit', false)
    ),
    'adminSettings', COALESCE(
      jsonb_build_object(
        'view', COALESCE((permissions->'adminSettings'->>'view')::boolean, false),
        'edit', COALESCE((permissions->'adminSettings'->>'edit')::boolean, false)
      ),
      jsonb_build_object('view', false, 'edit', false)
    ),
    'centralizedSettings', COALESCE(
      jsonb_build_object(
        'view', COALESCE((permissions->'centralizedSettings'->>'view')::boolean, false),
        'edit', COALESCE((permissions->'centralizedSettings'->>'edit')::boolean, false)
      ),
      jsonb_build_object('view', false, 'edit', false)
    )
  ),
  -- Fallback if permissions is NULL: Create empty permissions (all false)
  jsonb_build_object(
    'dashboard', jsonb_build_object('view', false),
    'employees', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false),
    'companies', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false),
    'projects', jsonb_build_object('view', false, 'create', false, 'edit', false, 'delete', false),
    'alerts', jsonb_build_object('view', false),
    'advancedSearch', jsonb_build_object('view', false),
    'reports', jsonb_build_object('view', false, 'export', false),
    'activityLogs', jsonb_build_object('view', false),
    'importExport', jsonb_build_object('view', false, 'import', false, 'export', false),
    'users', jsonb_build_object('view', false),
    'settings', jsonb_build_object('view', false, 'edit', false),
    'adminSettings', jsonb_build_object('view', false, 'edit', false),
    'centralizedSettings', jsonb_build_object('view', false, 'edit', false)
  )
)
WHERE role = 'user';

-- Step 3: Verify migration results
DO $$
DECLARE
  admin_count INT;
  user_count INT;
  null_perms_count INT;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE role = 'admin';
  SELECT COUNT(*) INTO user_count FROM public.users WHERE role = 'user';
  SELECT COUNT(*) INTO null_perms_count FROM public.users WHERE permissions IS NULL;
  
  RAISE NOTICE '=== MIGRATION VERIFICATION ===';
  RAISE NOTICE 'Admin users updated: %', admin_count;
  RAISE NOTICE 'Regular users updated: %', user_count;
  RAISE NOTICE 'Users with NULL permissions (should be 0): %', null_perms_count;
  RAISE NOTICE '==============================';
END $$;

-- Step 4: Log migration metadata
-- Create migration log entry (if logging table exists)
DO $$
BEGIN
  -- Try to insert log entry, silently skip if table doesn't exist
  INSERT INTO public.migration_logs (name, status, executed_at, details)
  VALUES (
    '20260120_normalize_permissions_deny_by_default',
    'completed',
    NOW(),
    jsonb_build_object(
      'admin_users_updated', (SELECT COUNT(*) FROM public.users WHERE role = 'admin'),
      'user_users_updated', (SELECT COUNT(*) FROM public.users WHERE role = 'user'),
      'backup_table', 'permissions_backup_20260120',
      'policy', 'deny-by-default',
      'schema_version', '2.0'
    )
  )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Migration logged successfully';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'migration_logs table does not exist, skipping log entry';
END $$;

COMMIT;

-- Rollback Instructions:
-- If migration fails, run: 
--   TRUNCATE public.users;
--   INSERT INTO public.users SELECT * FROM permissions_backup_20260120;
--   DROP TABLE permissions_backup_20260120;
