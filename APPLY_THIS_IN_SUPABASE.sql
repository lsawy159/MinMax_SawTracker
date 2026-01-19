-- ==========================================
-- QUICK FIX: Email Queue Access for Web App
-- Run this in Supabase SQL Editor
-- ==========================================

-- Step 1: Add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_queue' AND column_name = 'retry_count') THEN
        ALTER TABLE email_queue ADD COLUMN retry_count INT DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'email_queue' AND column_name = 'completed_at') THEN
        ALTER TABLE email_queue ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Step 2: Sync existing data
UPDATE email_queue SET retry_count = retries WHERE retry_count = 0 AND retries > 0;
UPDATE email_queue SET completed_at = sent_at WHERE completed_at IS NULL AND sent_at IS NOT NULL;

-- Step 3: Add 'completed' status to enum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_status')
    ) THEN
        ALTER TYPE email_status ADD VALUE 'completed';
    END IF;
END $$;

-- Step 4: Remove old restrictive policies
DROP POLICY IF EXISTS "Disable all access by default" ON email_queue;
DROP POLICY IF EXISTS "Allow service role to manage email_queue" ON email_queue;
DROP POLICY IF EXISTS "Allow authenticated admin users to manage email_queue" ON email_queue;
DROP POLICY IF EXISTS "Allow users with adminSettings permission to read email_queue" ON email_queue;
DROP POLICY IF EXISTS "Allow authenticated users to insert into email_queue" ON email_queue;
DROP POLICY IF EXISTS "Admin users full access to email_queue" ON email_queue;
DROP POLICY IF EXISTS "AdminSettings permission can read email_queue" ON email_queue;
DROP POLICY IF EXISTS "Authenticated users can insert email_queue" ON email_queue;
DROP POLICY IF EXISTS "Service role full access to email_queue" ON email_queue;

-- Step 5: Create user-friendly RLS policies
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

CREATE POLICY "Authenticated users can insert email_queue"
ON email_queue FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role full access to email_queue"
ON email_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Done! Refresh your app.
