-- Create email status enum
DO $$ BEGIN
    CREATE TYPE email_status AS ENUM ('pending', 'processing', 'sent', 'failed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create email priority enum
DO $$ BEGIN
    CREATE TYPE email_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_emails TEXT[] NOT NULL,
    cc_emails TEXT[], -- Optional
    bcc_emails TEXT[], -- Optional
    subject TEXT NOT NULL,
    html_content TEXT,
    text_content TEXT,
    status email_status DEFAULT 'pending' NOT NULL,
    priority email_priority DEFAULT 'medium' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    retries INT DEFAULT 0 NOT NULL,
    last_attempt TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue (status);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue (priority);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue (created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_at ON email_queue (scheduled_at);

-- RLS policies - only authenticated users can read/write (will be restricted further per project)
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Disable all access by default (most restrictive)
CREATE POLICY "Disable all access by default"
ON email_queue FOR ALL
USING (FALSE);

-- Allow authenticated users (service role) to manage emails
CREATE POLICY "Allow service role to manage email_queue"
ON email_queue FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
