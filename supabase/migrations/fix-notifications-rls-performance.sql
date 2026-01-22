-- Migration: Fix RLS policy performance on notifications table
-- Issue: auth.jwt() is being re-evaluated for each row, causing suboptimal performance
-- Solution: Wrap auth.jwt() in (select auth.jwt()) to evaluate once per query

-- Drop existing policies
DROP POLICY IF EXISTS "Players can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Players can update own notifications" ON notifications;

-- Recreate policies with optimized auth.jwt() calls
-- Using (select auth.jwt()) ensures the function is evaluated once per query, not per row
CREATE POLICY "Players can view own notifications"
  ON notifications FOR SELECT
  USING (player_id IN (
    SELECT id FROM players WHERE clerk_id = (select auth.jwt()) ->> 'sub'
  ));

CREATE POLICY "Players can update own notifications"
  ON notifications FOR UPDATE
  USING (player_id IN (
    SELECT id FROM players WHERE clerk_id = (select auth.jwt()) ->> 'sub'
  ));
