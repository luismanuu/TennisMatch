-- ============================================
-- CHECK WHY MATCHES DON'T HAVE RATING_HISTORY
-- ============================================
-- Player ID: e4401b3a-ccbb-47d9-a98a-e3541364ea64
-- Check why matches marked as competitive don't have rating_history

-- Check all matches for this player that are marked competitive but have no rating_history
SELECT 
  m.id,
  m.status,
  m.is_competitive,
  m.score,
  m.winner_id,
  m.player1_id,
  m.player2_id,
  m.played_at,
  m.created_at,
  -- Check conditions that prevent rating_history creation
  CASE 
    WHEN m.status != 'completed' THEN 'Status is not completed'
    WHEN m.winner_id IS NULL THEN 'No winner_id'
    WHEN m.player1_id IS NULL OR m.player2_id IS NULL THEN 'Missing player(s)'
    WHEN m.player1_id = m.player2_id THEN 'Self-match (invalid)'
    WHEN m.is_competitive = false THEN 'Marked as friendly'
    WHEN EXISTS (SELECT 1 FROM rating_history rh WHERE rh.match_id = m.id AND rh.rating_reversed = false) THEN 'Has rating_history (should be OK)'
    ELSE 'Unknown reason - should have rating_history'
  END as why_no_history,
  -- Check if match was created after rating_history system (Jan 20, 2026)
  CASE 
    WHEN m.created_at >= '2026-01-20'::timestamp THEN 'Created after rating_history system'
    ELSE 'Created before rating_history system'
  END as created_timing
FROM matches m
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
  AND m.is_competitive = true
  AND NOT EXISTS (
    SELECT 1
    FROM rating_history rh
    WHERE rh.match_id = m.id
      AND rh.rating_reversed = false
  )
ORDER BY m.created_at DESC;

-- Check if updateRatingsAfterMatch was called but failed
-- Look for any error logs or check if match has LLM calculation metadata
SELECT 
  m.id,
  m.status,
  m.is_competitive,
  m.score,
  m.llm_elo_calculated,
  m.llm_calculation_failed,
  m.llm_calculation_reasoning,
  CASE 
    WHEN m.llm_calculation_failed = true THEN 'LLM calculation failed'
    WHEN m.llm_elo_calculated = true THEN 'LLM was used (should have rating_history)'
    WHEN m.llm_elo_calculated = false AND m.status = 'completed' AND m.is_competitive = true THEN 'No LLM metadata (may not have been processed)'
    ELSE 'Unknown'
  END as processing_status
FROM matches m
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
  AND m.is_competitive = true
  AND m.status = 'completed'
  AND NOT EXISTS (
    SELECT 1
    FROM rating_history rh
    WHERE rh.match_id = m.id
      AND rh.rating_reversed = false
  )
ORDER BY m.created_at DESC;
