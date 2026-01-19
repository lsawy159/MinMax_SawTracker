-- Fix email_queue table schema and RLS policies for web app access
-- This migration:
-- 1. Adds missing columns that the app expects
-- 2. Adds RLS policies for authenticated admin users
-- 3. Ensures compatibility between migration schema and app code

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add retry_count as alias/additional column (app uses this instead of retries)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_queue' AND column_name = 'retry_count') THEN
        ALTER TABLE email_queue ADD COLUMN retry_count INT DEFAULT 0 NOT NULL;
    END IF;

    -- Add completed_at as alias/additional column (app uses this instead of sent_at)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_queue' AND column_name = 'completed_at') THEN
        ALTER TABLE email_queue ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Update existing rows to sync retry_count with retries
UPDATE email_queue SET retry_count = retries WHERE retry_count = 0 AND retries > 0;

-- Update existing rows to sync completed_at with sent_at
UPDATE email_queue SET completed_at = sent_at WHERE completed_at IS NULL AND sent_at IS NOT NULL;

-- Add new status value 'completed' to enum if not exists
DO $$ 
BEGIN
    -- Check if 'completed' status doesn't exist, then add it
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_status')
    ) THEN
        ALTER TYPE email_status ADD VALUE 'completed';
    END IF;
END $$;

-- Note: Cannot update 'sent' to 'completed' in same transaction where enum is added
-- The app will use 'completed' for new records; old 'sent' records are fine

-- Remove old restrictive policies first
DROP POLICY IF EXISTS "Disable all access by default" ON email_queue;
DROP POLICY IF EXISTS "Allow service role to manage email_queue" ON email_queue;
DROP POLICY IF EXISTS "Allow authenticated admin users to manage email_queue" ON email_queue;
DROP POLICY IF EXISTS "Allow users with adminSettings permission to read email_queue" ON email_queue;
DROP POLICY IF EXISTS "Allow authenticated users to insert into email_queue" ON email_queue;

-- Create RLS policy for admin users (full access)
CREATE POLICY "Admin users full access to email_queue"
ON email_queue FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Create RLS policy for users with adminSettings permission (read only)
CREATE POLICY "AdminSettings permission can read email_queue"
ON email_queue FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND (
            users.role = 'admin'
            OR users.permissions->>'adminSettings' IN ('edit', 'view')
        )
    )
);

-- Allow authenticated users to insert emails (for enqueuing)
CREATE POLICY "Authenticated users can insert email_queue"
ON email_queue FOR INSERT
TO authenticated
WITH CHECK (true);

-- Service role needs full access (for background workers)
CREATE POLICY "Service role full access to email_queue"
ON email_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE email_queue IS 'Email queue for system correspondence - updated 2026-01-14';
