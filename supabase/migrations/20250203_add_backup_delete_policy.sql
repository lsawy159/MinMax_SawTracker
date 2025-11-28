-- =========================================
-- Add DELETE policy for admins on backup_history
-- =========================================
-- This migration adds a DELETE policy to allow admin users to delete backup records
-- from the backup_history table. Previously, only SELECT was allowed for admins.

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Allow admins to delete backup history" ON public.backup_history;

-- Create DELETE policy for admins
-- This follows the same pattern as the existing SELECT policy
CREATE POLICY "Allow admins to delete backup history"
  ON public.backup_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

