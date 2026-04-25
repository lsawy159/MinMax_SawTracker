-- Migration: Make social_insurance_expiry nullable (GOSI is permanent)
-- Date: 2026-01-29

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'social_insurance_expiry'
  ) THEN
    ALTER TABLE public.companies
      ALTER COLUMN social_insurance_expiry DROP NOT NULL;
  END IF;
END $$;
