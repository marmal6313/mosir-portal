-- FIX: Add missing UPDATE policy for notifications table
-- Issue: Users could not mark notifications as read because UPDATE policy was missing
-- Date: 2026-02-24

-- Add UPDATE policy to allow users to mark their own notifications as read
CREATE POLICY notifications_update_policy ON notifications
  FOR UPDATE
  TO public
  USING (
    user_id = auth.uid()
    AND organization_id = auth_user_organization_id()
  )
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = auth_user_organization_id()
  );

-- Verify policies
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'notifications'
ORDER BY cmd, policyname;
