-- ============================================
-- PROCESS MATCHES MISSING RATING_HISTORY
-- ============================================
-- This migration identifies matches that should have rating_history but don't
-- These matches need to be processed via the API endpoint /api/matches/[id]/calculate-elo
--
-- NOTE: This SQL file only identifies the matches. The actual processing must be done
-- via the API endpoint or admin tool, as it requires the full rating calculation logic.

-- Find all completed competitive matches without rating_history
-- These should be processed to create rating_history entries
SELECT 
  m.id as match_id,
  m.status,
  m.is_competitive,
  m.score,
  m.winner_id,
  m.player1_id,
  m.player2_id,
  m.played_at,
  m.created_at,
  CASE 
    WHEN m.winner_id IS NULL THEN 'Missing winner_id'
    WHEN m.player1_id IS NULL OR m.player2_id IS NULL THEN 'Missing player(s)'
    WHEN m.player1_id = m.player2_id THEN 'Self-match (invalid)'
    ELSE 'Ready to process'
  END as processing_status
FROM matches m
WHERE m.status = 'completed'
  AND m.is_competitive = true
  AND m.winner_id IS NOT NULL
  AND m.player1_id IS NOT NULL
  AND m.player2_id IS NOT NULL
  AND m.player1_id != m.player2_id
  AND NOT EXISTS (
    SELECT 1
    FROM rating_history rh
    WHERE rh.match_id = m.id
      AND rh.rating_reversed = false
  )
ORDER BY m.created_at ASC;

-- For specific player
SELECT 
  m.id as match_id,
  m.status,
  m.is_competitive,
  m.score,
  m.winner_id,
  m.played_at,
  'Ready to process' as processing_status
FROM matches m
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
  AND m.status = 'completed'
  AND m.is_competitive = true
  AND m.winner_id IS NOT NULL
  AND m.player1_id IS NOT NULL
  AND m.player2_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM rating_history rh
    WHERE rh.match_id = m.id
      AND rh.rating_reversed = false
  )
ORDER BY m.created_at ASC;
