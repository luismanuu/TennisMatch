-- ============================================
-- INVESTIGATE PLACEMENT MATCHES FOR PLAYER
-- ============================================
-- Player ID: e904ca73-b49d-47d5-a6ee-a378a28290b3
-- Issue: Player says they played 3 competitive matches but system shows 2/3 placement matches

-- 1. Check player's current status
SELECT 
  id,
  name,
  elo,
  total_matches_played,
  placement_matches_completed,
  created_at,
  status
FROM players
WHERE id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3';

-- 2. Check all matches for this player
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
    WHEN m.player1_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3' THEN 'Player 1'
    WHEN m.player2_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3' THEN 'Player 2'
  END as player_role,
  CASE 
    WHEN m.winner_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3' THEN 'Won'
    WHEN m.winner_id IS NOT NULL AND m.winner_id != 'e904ca73-b49d-47d5-a6ee-a378a28290b3' THEN 'Lost'
    ELSE 'No winner'
  END as result
FROM matches m
WHERE (m.player1_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3' 
   OR m.player2_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3')
ORDER BY m.played_at ASC, m.created_at ASC;

-- 3. Check rating_history entries for this player
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
  rh.created_at,
  m.is_competitive,
  m.status as match_status,
  m.score,
  m.played_at
FROM rating_history rh
JOIN matches m ON m.id = rh.match_id
WHERE rh.player_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3'
ORDER BY rh.created_at ASC;

-- 4. Count placement matches from rating_history (what the system should show)
SELECT 
  COUNT(*) as placement_matches_count,
  COUNT(CASE WHEN rating_reversed = false THEN 1 END) as non_reversed_count,
  COUNT(CASE WHEN rating_reversed = true THEN 1 END) as reversed_count
FROM rating_history
WHERE player_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3'
  AND is_placement_match = true;

-- 5. Check if any matches are non-competitive
SELECT 
  COUNT(*) as non_competitive_matches,
  STRING_AGG(m.id::text, ', ') as match_ids
FROM matches m
WHERE (m.player1_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3' 
   OR m.player2_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3')
  AND m.is_competitive = false;

-- 6. Check matches that don't have rating_history entries (potential issue)
SELECT 
  m.id,
  m.player1_id,
  m.player2_id,
  m.winner_id,
  m.score,
  m.is_competitive,
  m.status,
  m.played_at,
  CASE 
    WHEN rh.id IS NULL THEN 'NO RATING HISTORY'
    ELSE 'HAS RATING HISTORY'
  END as rating_status
FROM matches m
LEFT JOIN rating_history rh ON rh.match_id = m.id 
  AND rh.player_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3'
WHERE (m.player1_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3' 
   OR m.player2_id = 'e904ca73-b49d-47d5-a6ee-a378a28290b3')
ORDER BY m.played_at ASC, m.created_at ASC;
