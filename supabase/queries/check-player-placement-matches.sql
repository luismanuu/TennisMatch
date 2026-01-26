-- ============================================
-- CHECK PLAYER PLACEMENT MATCHES
-- ============================================
-- Player ID: e4401b3a-ccbb-47d9-a98a-e3541364ea64
-- This query shows placement match status and history

-- 1. Player's current placement status
SELECT 
  id,
  name,
  elo,
  total_matches_played,
  placement_matches_completed,
  created_at,
  CASE 
    WHEN placement_matches_completed < 3 THEN 'En Placement'
    ELSE 'Completado'
  END as placement_status
FROM players
WHERE id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64';

-- 2. All placement matches from rating_history
SELECT 
  rh.id,
  rh.match_id,
  rh.elo_before,
  rh.elo_after,
  rh.elo_change,
  rh.is_placement_match,
  rh.is_unrated_match,
  rh.rating_reversed,
  rh.was_winner,
  rh.created_at as match_date,
  m.is_competitive,
  m.status as match_status,
  m.score,
  m.played_at,
  -- Opponent info
  opponent.name as opponent_name,
  opponent.elo as opponent_elo
FROM rating_history rh
LEFT JOIN matches m ON m.id = rh.match_id
LEFT JOIN players opponent ON opponent.id = rh.opponent_id
WHERE rh.player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
  AND rh.is_placement_match = true
  AND rh.rating_reversed = false
ORDER BY rh.created_at ASC;

-- 3. Count of placement matches (should match placement_matches_completed)
SELECT 
  COUNT(*) as placement_matches_count,
  COUNT(CASE WHEN rating_reversed = false THEN 1 END) as non_reversed_count,
  COUNT(CASE WHEN rating_reversed = true THEN 1 END) as reversed_count,
  COUNT(CASE WHEN was_winner = true THEN 1 END) as wins,
  COUNT(CASE WHEN was_winner = false THEN 1 END) as losses
FROM rating_history
WHERE player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
  AND is_placement_match = true;

-- 4. All matches for this player (to see if any are missing placement flag)
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
  -- Check if has rating_history entry
  CASE 
    WHEN rh.id IS NOT NULL THEN 'YES'
    ELSE 'NO'
  END as has_rating_history,
  -- Check if marked as placement match
  CASE 
    WHEN rh.is_placement_match = true THEN 'YES'
    ELSE 'NO'
  END as is_placement_in_history
FROM matches m
LEFT JOIN rating_history rh ON rh.match_id = m.id 
  AND rh.player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
  AND m.is_competitive = true
ORDER BY m.played_at ASC, m.created_at ASC;

-- 5. Summary: Placement matches vs total matches
SELECT 
  p.name,
  p.placement_matches_completed as placement_count_in_player_table,
  COUNT(rh.id) FILTER (WHERE rh.is_placement_match = true AND rh.rating_reversed = false) as placement_count_in_history,
  COUNT(DISTINCT rh.match_id) FILTER (WHERE rh.rating_reversed = false) as total_competitive_matches,
  CASE 
    WHEN p.placement_matches_completed != COUNT(rh.id) FILTER (WHERE rh.is_placement_match = true AND rh.rating_reversed = false)
    THEN 'MISMATCH - Needs fix'
    ELSE 'OK'
  END as status
FROM players p
LEFT JOIN rating_history rh ON rh.player_id = p.id
WHERE p.id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
GROUP BY p.id, p.name, p.placement_matches_completed;
