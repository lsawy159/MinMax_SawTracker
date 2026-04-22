-- Migration: Add username support for authentication
-- Date: 2026-01-31
-- Description: Add username column to users table with unique constraint
-- Users will login with username instead of email (email will be username@sawtracker.local internally)

-- ✅ Step 1: Add username column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- ✅ Step 2: Create unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx 
ON public.users (LOWER(username));

-- ✅ Step 3: Add check constraint for username format (alphanumeric, underscore, dash, dot)
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS username_format_check;

ALTER TABLE public.users
ADD CONSTRAINT username_format_check 
CHECK (username ~ '^[a-zA-Z0-9_.-]+$');

-- For existing users, derive safe unique usernames from email local-parts.
WITH prepared_usernames AS (
  SELECT
    id,
    COALESCE(
      NULLIF(LEFT(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_.-]', '_', 'g'), 40), ''),
      'user'
    ) AS base_username
  FROM public.users
  WHERE username IS NULL
), ranked_usernames AS (
  SELECT
    id,
    CASE
      WHEN ROW_NUMBER() OVER (PARTITION BY base_username ORDER BY id) = 1 THEN base_username
      ELSE LEFT(base_username, 35) || '_' || (ROW_NUMBER() OVER (PARTITION BY base_username ORDER BY id) - 1)::TEXT
    END AS generated_username
  FROM prepared_usernames
)
UPDATE public.users u
SET username = r.generated_username
FROM ranked_usernames r
WHERE u.id = r.id;

-- ✅ Step 5: Make username NOT NULL after populating existing data
ALTER TABLE public.users
ALTER COLUMN username SET NOT NULL;

-- ✅ Step 6: Add comment for documentation
COMMENT ON COLUMN public.users.username IS 'Username for login (alphanumeric, underscore, dash, dot). Email is auto-generated as username@sawtracker.local';

-- ✅ Step 7: Create helper function to validate username availability
CREATE OR REPLACE FUNCTION public.is_username_available(check_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE LOWER(username) = LOWER(check_username)
  );
END;
$$;

COMMENT ON FUNCTION public.is_username_available(TEXT) IS 'Check if a username is available (case-insensitive)';
