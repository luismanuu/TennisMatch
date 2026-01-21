-- ============================================
-- UPDATE MATCH PROPOSAL TIME
-- ============================================
-- Match ID: 0419c9b3-5907-4a24-a35e-58e602f0ab00
-- 
-- Choose the appropriate query based on what you want to update:
-- 1. schedule_proposed_scheduled_at - If there's a schedule proposal pending
-- 2. acceptance_proposed_scheduled_at - If there's an acceptance change proposal
-- 3. scheduled_at - If you want to update the final scheduled time

-- OPTION 1: Update schedule proposal time (when a player proposed a new schedule)
-- Replace '2026-01-21 19:00:00' with your desired date and time
UPDATE matches
SET schedule_proposed_scheduled_at = '2026-01-21 19:00:00+00:00'::timestamptz
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';

-- OPTION 2: Update acceptance change proposal time (when player2 accepted with changes)
-- Replace '2026-01-21 19:00:00' with your desired date and time
UPDATE matches
SET acceptance_proposed_scheduled_at = '2026-01-21 19:00:00+00:00'::timestamptz
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';

-- OPTION 3: Update the final scheduled time (if the proposal was already approved)
-- Replace '2026-01-21 19:00:00' with your desired date and time
UPDATE matches
SET scheduled_at = '2026-01-21 19:00:00+00:00'::timestamptz
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';

-- OPTION 4: Update all three at once (if needed)
-- Replace '2026-01-21 19:00:00' with your desired date and time
UPDATE matches
SET 
  schedule_proposed_scheduled_at = '2026-01-21 19:00:00+00:00'::timestamptz,
  acceptance_proposed_scheduled_at = '2026-01-21 19:00:00+00:00'::timestamptz,
  scheduled_at = '2026-01-21 19:00:00+00:00'::timestamptz
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';

-- ============================================
-- VERIFY THE UPDATE
-- ============================================
-- Run this to see the current values after updating:
SELECT 
  id,
  scheduled_at,
  schedule_proposed_scheduled_at,
  acceptance_proposed_scheduled_at,
  schedule_proposed_by,
  match_accepted_by
FROM matches
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';
