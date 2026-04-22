-- Superseded by 20250122_cleanup_system_settings_policies.sql.
-- Keep this migration as a true no-op to avoid policy churn/conflicts on pending environments.

DO $$
BEGIN
  RAISE NOTICE 'Skipping 20250122_fix_system_settings_rls.sql because 20250122_cleanup_system_settings_policies.sql is the canonical policy migration.';
END $$;
