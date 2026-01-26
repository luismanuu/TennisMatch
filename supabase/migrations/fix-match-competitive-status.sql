-- ============================================
-- FIX MATCH COMPETITIVE STATUS
-- ============================================
-- Issue: Some matches may have incorrect is_competitive status
-- Rule: If a match has rating_history entries, it should be competitive
--       If a match has no rating_history entries and is completed, it should be friendly
--
-- This migration fixes matches based on whether they have rating_history

-- Step 1: Mark matches as competitive if they have rating_history
-- (These matches were processed and affected ratings, so they must be competitive)
UPDATE matches m
SET is_competitive = true
WHERE EXISTS (
  SELECT 1
  FROM rating_history rh
  WHERE rh.match_id = m.id
)
AND m.is_competitive = false;

-- Step 2: Mark matches as friendly if they have no rating_history
-- This includes:
-- - Completed matches without rating_history (didn't affect ratings)
-- - Cancelled matches (should never be competitive)
-- - Any match without rating_history (if it was competitive, it would have rating_history)
UPDATE matches m
SET is_competitive = false
WHERE NOT EXISTS (
    SELECT 1
    FROM rating_history rh
    WHERE rh.match_id = m.id
  )
  AND m.is_competitive = true;

-- Verification query for specific player (uncomment to check)
/*
SELECT 
  m.id,
  m.is_competitive,
  m.status,
  m.score,
  CASE 
    WHEN EXISTS (SELECT 1 FROM rating_history rh WHERE rh.match_id = m.id) 
    THEN 'HAS RATING HISTORY'
    ELSE 'NO RATING HISTORY'
  END as rating_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM rating_history rh WHERE rh.match_id = m.id) AND m.is_competitive = false
    THEN 'SHOULD BE COMPETITIVE'
    WHEN NOT EXISTS (SELECT 1 FROM rating_history rh WHERE rh.match_id = m.id) AND m.is_competitive = true
    THEN 'SHOULD BE FRIENDLY'
    ELSE 'OK'
  END as issue
FROM matches m
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
ORDER BY m.played_at ASC, m.created_at ASC;
*/
