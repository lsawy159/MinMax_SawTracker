-- Migration: إضافة Database Indexes لتحسين الأداء
-- Created: 2025-01-21
-- Description: إضافة indexes على الحقول المستخدمة بكثرة في الاستعلامات

-- Indexes for companies table
CREATE INDEX IF NOT EXISTS idx_companies_unified_number 
ON companies(unified_number);

CREATE INDEX IF NOT EXISTS idx_companies_labor_subscription_number 
ON companies(labor_subscription_number);

CREATE INDEX IF NOT EXISTS idx_companies_created_at 
ON companies(created_at DESC);

-- Indexes for employees table
CREATE INDEX IF NOT EXISTS idx_employees_residence_number 
ON employees(residence_number);

CREATE INDEX IF NOT EXISTS idx_employees_company_id 
ON employees(company_id);

CREATE INDEX IF NOT EXISTS idx_employees_residence_expiry 
ON employees(residence_expiry);

CREATE INDEX IF NOT EXISTS idx_employees_contract_expiry 
ON employees(contract_expiry);

CREATE INDEX IF NOT EXISTS idx_employees_project_id 
ON employees(project_id) WHERE project_id IS NOT NULL;

-- Indexes for activity_log table
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id 
ON activity_log(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at 
ON activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type_id 
ON activity_log(entity_type, entity_id);

-- Indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read 
ON notifications(is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

-- Indexes for user_sessions table
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active 
ON user_sessions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at 
ON user_sessions(expires_at);

-- Indexes for read_alerts table
CREATE INDEX IF NOT EXISTS idx_read_alerts_user_id 
ON read_alerts(user_id);

CREATE INDEX IF NOT EXISTS idx_read_alerts_alert_id 
ON read_alerts(alert_id);

-- Indexes for projects table
CREATE INDEX IF NOT EXISTS idx_projects_created_at 
ON projects(created_at DESC);

