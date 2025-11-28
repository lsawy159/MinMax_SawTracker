-- Create read_alerts table to track which alerts have been read by users
CREATE TABLE IF NOT EXISTS read_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, alert_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_read_alerts_user_id ON read_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_read_alerts_alert_id ON read_alerts(alert_id);

-- Enable Row Level Security
ALTER TABLE read_alerts ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own read alerts
CREATE POLICY "Users can view their own read alerts"
  ON read_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own read alerts
CREATE POLICY "Users can insert their own read alerts"
  ON read_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own read alerts
CREATE POLICY "Users can update their own read alerts"
  ON read_alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Users can delete their own read alerts
CREATE POLICY "Users can delete their own read alerts"
  ON read_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

