-- Function to clean up old emails
CREATE OR REPLACE FUNCTION cleanup_old_emails()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM email_queue
    WHERE (status = 'sent' OR status = 'failed')
      AND processed_at < NOW() - INTERVAL '30 days';

    -- Optionally, log the cleanup action if an audit_log table exists
    -- INSERT INTO audit_log (action_type, resource_type, resource_id, details)
    -- VALUES ('delete', 'email_queue_cleanup', NULL, 'Cleaned up old emails');

    RETURN NULL; -- Result is ignored since this is an AFTER trigger
END;
$$ LANGUAGE plpgsql;

-- Trigger to run cleanup_old_emails function after each update or insert on email_queue
CREATE TRIGGER trg_cleanup_old_emails
AFTER INSERT OR UPDATE ON email_queue
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_old_emails();

