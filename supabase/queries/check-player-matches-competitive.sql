-- ============================================
-- CHECK PLAYER MATCHES - COMPETITIVE STATUS
-- ============================================
-- Player ID: e4401b3a-ccbb-47d9-a98a-e3541364ea64
-- Check all matches and their competitive status

-- 1. All matches for this player
SELECT 
  m.id,
  m.player1_id,
  m.player2_id,
  m.winner_id,
  m.score,
  m.is_competitive,
  m.status,
  m.played_at,
  m.created_at,
  CASE 
    WHEN m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' THEN 'Player 1'
    WHEN m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' THEN 'Player 2'
  END as player_role,
  CASE 
    WHEN m.winner_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' THEN 'Won'
    WHEN m.winner_id IS NOT NULL AND m.winner_id != 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' THEN 'Lost'
    ELSE 'No winner'
  END as result,
  -- Check if has rating_history (only competitive matches have rating_history)
  CASE 
    WHEN rh.id IS NOT NULL THEN 'HAS RATING HISTORY (Competitive)'
    ELSE 'NO RATING HISTORY (Should be friendly or not processed)'
  END as rating_status
FROM matches m
LEFT JOIN rating_history rh ON rh.match_id = m.id 
  AND rh.player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
ORDER BY m.played_at ASC, m.created_at ASC;

-- 2. Summary: Count competitive vs friendly
SELECT 
  COUNT(*) FILTER (WHERE is_competitive = true) as competitive_matches,
  COUNT(*) FILTER (WHERE is_competitive = false) as friendly_matches,
  COUNT(*) FILTER (WHERE is_competitive IS NULL) as null_competitive,
  COUNT(*) as total_matches
FROM matches
WHERE (player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64');

-- 3. Matches with rating_history (these should be competitive)
SELECT 
  m.id,
  m.is_competitive,
  m.status,
  COUNT(rh.id) as rating_history_entries
FROM matches m
JOIN rating_history rh ON rh.match_id = m.id
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
GROUP BY m.id, m.is_competitive, m.status;

-- 4. Matches that should be competitive but aren't marked as such
SELECT 
  m.id,
  m.is_competitive,
  m.status,
  m.score,
  'Should be competitive (has rating_history)' as issue
FROM matches m
JOIN rating_history rh ON rh.match_id = m.id
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
  AND m.is_competitive = false;

-- 5. Matches marked as competitive but have no rating_history (should be friendly)
SELECT 
  m.id,
  m.is_competitive,
  m.status,
  m.score,
  'Should be friendly (no rating_history)' as issue
FROM matches m
LEFT JOIN rating_history rh ON rh.match_id = m.id
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
  AND m.is_competitive = true
  AND rh.id IS NULL;
