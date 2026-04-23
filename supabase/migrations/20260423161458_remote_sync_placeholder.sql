-- Placeholder migration to align local history with remote migration version.
-- Version exists remotely but file is missing locally.
-- Intentional no-op.

DO $$
BEGIN
  RAISE NOTICE 'Remote sync placeholder 20260423161458';
END;
$$;
