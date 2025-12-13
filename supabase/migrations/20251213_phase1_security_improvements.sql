-- Phase 1 Security Improvements (consolidated minimal)
-- Creates audit_log, security_events, security_settings and RLS/policies

-- audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('login','logout','create','update','delete','export','permission_change','role_change','access_denied')),
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failure')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;
CREATE POLICY "Users can view own audit logs" ON public.audit_log FOR SELECT USING (auth.uid()=user_id);
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
CREATE POLICY "Admins can view all audit logs" ON public.audit_log FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='admin'));
DROP POLICY IF EXISTS "Allow creating audit logs" ON public.audit_log;
CREATE POLICY "Allow creating audit logs" ON public.audit_log FOR INSERT WITH CHECK (true);

-- security_events
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('failed_login','suspicious_activity','permission_escalation','data_access_anomaly','configuration_change','security_alert')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admins can view security events" ON public.security_events;
CREATE POLICY "Only admins can view security events" ON public.security_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='admin'));
DROP POLICY IF EXISTS "Allow creating security events" ON public.security_events;
CREATE POLICY "Allow creating security events" ON public.security_events FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only admins can update security events" ON public.security_events;
CREATE POLICY "Only admins can update security events" ON public.security_events FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='admin'));

-- security_settings
CREATE TABLE IF NOT EXISTS public.security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  last_modified_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admins can view security settings" ON public.security_settings;
CREATE POLICY "Only admins can view security settings" ON public.security_settings FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='admin'));
DROP POLICY IF EXISTS "Only admins can update security settings" ON public.security_settings;
CREATE POLICY "Only admins can update security settings" ON public.security_settings FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.role='admin'));

-- trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    INSERT INTO public.audit_log(user_id,action_type,resource_type,resource_id,old_values,status) VALUES (auth.uid(),'delete',TG_TABLE_NAME,CAST(OLD.id AS TEXT),row_to_json(OLD),'success');
    RETURN OLD;
  ELSIF TG_OP='UPDATE' THEN
    INSERT INTO public.audit_log(user_id,action_type,resource_type,resource_id,old_values,new_values,status) VALUES (auth.uid(),'update',TG_TABLE_NAME,CAST(NEW.id AS TEXT),row_to_json(OLD),row_to_json(NEW),'success');
    RETURN NEW;
  ELSIF TG_OP='INSERT' THEN
    INSERT INTO public.audit_log(user_id,action_type,resource_type,resource_id,new_values,status) VALUES (auth.uid(),'create',TG_TABLE_NAME,CAST(NEW.id AS TEXT),row_to_json(NEW),'success');
    RETURN NEW;
  END IF;
  RETURN NULL;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_security_settings_trigger ON public.security_settings;
CREATE TRIGGER audit_security_settings_trigger AFTER INSERT OR UPDATE OR DELETE ON public.security_settings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
