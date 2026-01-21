-- ============================================
-- FIX MATCH TIMEZONE - CORRECT ECUADOR TIME
-- ============================================
-- Match ID: 0419c9b3-5907-4a24-a35e-58e602f0ab00
-- 
-- Problem Analysis:
-- - schedule_proposed_scheduled_at: 2026-01-21T19:00:00+00:00 (UTC) = 21 enero 14:00 Ecuador ❌
-- - scheduled_at: 2026-01-23T00:00:00+00:00 (UTC) = 22 enero 19:00 Ecuador ❌
-- 
-- If the intended time was January 21 at 19:00 Ecuador time:
-- It should be stored as 2026-01-22T00:00:00+00:00 (UTC)
-- 
-- If the intended time was January 23 at 00:00 Ecuador time:
-- It should be stored as 2026-01-23T05:00:00+00:00 (UTC)
-- 
-- OPTION 1: If the match should be January 21 at 19:00 Ecuador time
UPDATE matches
SET 
  scheduled_at = '2026-01-22T00:00:00+00:00'::timestamptz,
  schedule_proposed_scheduled_at = '2026-01-22T00:00:00+00:00'::timestamptz
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';

-- OPTION 2: If the match should be January 23 at 00:00 Ecuador time (midnight)
-- UPDATE matches
-- SET 
--   scheduled_at = '2026-01-23T05:00:00+00:00'::timestamptz,
--   schedule_proposed_scheduled_at = '2026-01-23T05:00:00+00:00'::timestamptz
-- WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';

-- Verify the update:
SELECT 
  id,
  scheduled_at,
  scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Guayaquil' as scheduled_at_ecuador,
  schedule_proposed_scheduled_at,
  schedule_proposed_scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Guayaquil' as schedule_proposed_ecuador
FROM matches
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';
