-- ================================================================
-- Create daily_excel_logs table for alert consolidation
-- Alerts are saved here instead of email_queue to be consolidated into a single Excel file
-- ================================================================

CREATE TABLE IF NOT EXISTS public.daily_excel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Entity references
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Alert metadata
  alert_type VARCHAR(100) NOT NULL,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  
  -- Alert content
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_required TEXT,
  expiry_date DATE,
  
  -- Additional data for Excel
  details JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Constraint: Either employee or company, not both
  CONSTRAINT at_least_one_entity CHECK (
    (employee_id IS NOT NULL AND company_id IS NULL) OR 
    (employee_id IS NULL AND company_id IS NOT NULL)
  )
);

-- ================================================================
-- Create indexes for efficient querying
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_daily_excel_logs_created_at 
ON public.daily_excel_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_excel_logs_priority 
ON public.daily_excel_logs(priority DESC);

CREATE INDEX IF NOT EXISTS idx_daily_excel_logs_alert_type 
ON public.daily_excel_logs(alert_type);

CREATE INDEX IF NOT EXISTS idx_daily_excel_logs_employee_id 
ON public.daily_excel_logs(employee_id);

CREATE INDEX IF NOT EXISTS idx_daily_excel_logs_company_id 
ON public.daily_excel_logs(company_id);

CREATE INDEX IF NOT EXISTS idx_daily_excel_logs_processed_at 
ON public.daily_excel_logs(processed_at);

-- ================================================================
-- Enable RLS
-- ================================================================

ALTER TABLE public.daily_excel_logs ENABLE ROW LEVEL SECURITY;

-- Disable all access by default
CREATE POLICY "Disable all access by default"
ON public.daily_excel_logs FOR ALL
USING (FALSE);

-- Allow authenticated users (service role) to manage logs
CREATE POLICY "Allow service role to manage daily_excel_logs"
ON public.daily_excel_logs FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- Create view for today's unprocessed alerts (useful for UI)
-- ================================================================

CREATE OR REPLACE VIEW public.daily_excel_logs_today AS
SELECT *
FROM public.daily_excel_logs
WHERE DATE(created_at AT TIME ZONE 'Asia/Riyadh') = CURRENT_DATE AT TIME ZONE 'Asia/Riyadh'
  AND processed_at IS NULL
ORDER BY priority DESC, created_at DESC;

-- ================================================================
-- Summary comment
-- ================================================================
COMMENT ON TABLE public.daily_excel_logs IS 'Consolidated alert logs for daily Excel digest. Alerts are saved here instead of email_queue to avoid duplicate prevention checks and enable Excel consolidation at 03:00 AM Makkah time.';
