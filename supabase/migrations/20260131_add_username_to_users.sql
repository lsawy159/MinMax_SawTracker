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

-- ✅ Step 4: Populate existing users with username derived from email
-- For existing users, extract username from email (part before @)
UPDATE public.users
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL;

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
