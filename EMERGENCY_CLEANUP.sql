-- ================================================================
-- 🚨 EMERGENCY: Clear Pending Email Queue (589+ emails)
-- ================================================================
-- Execute this SQL in Supabase to immediately stop email flooding
-- ================================================================

-- 1. Check current queue status
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_email,
  MAX(created_at) as newest_email
FROM email_queue
GROUP BY status
ORDER BY count DESC;

-- 2. EMERGENCY: Mark all pending emails as failed
-- This prevents them from being sent while we stabilize the system
UPDATE email_queue
SET 
  status = 'failed',
  error_message = 'EMERGENCY_FLOOD_CLEANUP_2025_01_26 - marked failed to stop duplicate emails',
  last_attempt = NOW()
WHERE status = 'pending';

-- 3. Verify the cleanup
SELECT 
  status,
  COUNT(*) as count
FROM email_queue
GROUP BY status
ORDER BY count DESC;

-- 4. Create daily_alert_logs table if it doesn't exist
-- This will store temporary alert logs before consolidating into 03:00 AM digest
CREATE TABLE IF NOT EXISTS daily_alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  alert_type VARCHAR(100) NOT NULL,
  priority VARCHAR(20) CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP DEFAULT NULL,
  CONSTRAINT at_least_one_entity CHECK (
    (employee_id IS NOT NULL AND company_id IS NULL) OR 
    (employee_id IS NULL AND company_id IS NOT NULL)
  )
);

-- 5. Create index on daily_alert_logs for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_alert_logs_created_at 
ON daily_alert_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_alert_logs_priority 
ON daily_alert_logs(priority DESC);

-- 6. Set up a system_settings entry for DIGEST mode
INSERT INTO system_settings (setting_key, setting_value)
VALUES (
  'email_mode',
  '{"mode": "DIGEST", "digest_time": "03:00", "timezone": "Asia/Riyadh"}'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = '{"mode": "DIGEST", "digest_time": "03:00", "timezone": "Asia/Riyadh"}';

-- 7. Log the emergency action
INSERT INTO activity_log (user_id, action, entity_type, details)
VALUES (
  NULL,
  'emergency_cleanup',
  'email_queue',
  jsonb_build_object(
    'timestamp', NOW(),
    'action', 'EMERGENCY_FLOOD_CLEANUP',
    'reason', 'Multiple duplicate alert emails triggered by page refresh logic',
    'status', 'COMPLETED',
    'next_step', 'Implement 03:00 AM digest with daily_alert_logs'
  )
);

-- ================================================================
-- AFTER RUNNING ABOVE: Check email queue is cleared
-- ================================================================
SELECT COUNT(*) as pending_emails_remaining
FROM email_queue
WHERE status = 'pending';
