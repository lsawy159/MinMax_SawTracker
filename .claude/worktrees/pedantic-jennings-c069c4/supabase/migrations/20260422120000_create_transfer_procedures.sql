BEGIN;

CREATE TABLE IF NOT EXISTS public.transfer_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_date DATE NOT NULL,
  name TEXT NOT NULL,
  iqama BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'منقول',
      'تحت إجراء النقل',
      'بانتظار موافقة الكفيل',
      'بانتظار موافقة العامل',
      'بانتظار فترة الإشعار',
      'بإنتظار الجوازات',
      'ليس على الكفالة',
      'بإنتظار رخصة العمل'
    )
  ),
  current_unified_number BIGINT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_procedures_project_id
  ON public.transfer_procedures (project_id);

CREATE INDEX IF NOT EXISTS idx_transfer_procedures_status
  ON public.transfer_procedures (status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transfer_procedures_iqama_active
  ON public.transfer_procedures (iqama)
  WHERE status <> 'منقول';

ALTER TABLE public.transfer_procedures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read transfer procedures" ON public.transfer_procedures;
CREATE POLICY "Authenticated users can read transfer procedures"
ON public.transfer_procedures
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert transfer procedures" ON public.transfer_procedures;
CREATE POLICY "Authenticated users can insert transfer procedures"
ON public.transfer_procedures
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update transfer procedures" ON public.transfer_procedures;
CREATE POLICY "Authenticated users can update transfer procedures"
ON public.transfer_procedures
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete transfer procedures" ON public.transfer_procedures;
CREATE POLICY "Authenticated users can delete transfer procedures"
ON public.transfer_procedures
FOR DELETE
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_procedures_set_updated_at ON public.transfer_procedures;
CREATE TRIGGER trg_transfer_procedures_set_updated_at
BEFORE UPDATE ON public.transfer_procedures
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
