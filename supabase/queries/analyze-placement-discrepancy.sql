-- ============================================
-- ANALYZE PLACEMENT MATCHES DISCREPANCY
-- ============================================
-- Player ID: e4401b3a-ccbb-47d9-a98a-e3541364ea64
-- Issue: 5 competitive matches but only 2 placement matches
-- This query shows the chronological order and status of each match

-- Show all competitive matches in chronological order with placement status
SELECT 
  ROW_NUMBER() OVER (ORDER BY COALESCE(m.played_at, m.created_at) ASC) as match_number,
  m.id as match_id,
  COALESCE(m.played_at, m.created_at) as match_date,
  m.score,
  m.is_competitive,
  m.status as match_status,
  -- Rating history info
  rh.id as rating_history_id,
  rh.is_placement_match,
  rh.is_unrated_match,
  rh.rating_reversed,
  rh.was_winner,
  rh.elo_before,
  rh.elo_after,
  rh.elo_change,
  rh.created_at as rating_calculated_at,
  -- Opponent info
  opponent.name as opponent_name,
  -- Analysis
  CASE 
    WHEN rh.id IS NULL THEN 'NO RATING HISTORY - Match not processed'
    WHEN rh.rating_reversed = true THEN 'REVERTED - Does not count'
    WHEN rh.is_placement_match = true THEN 'PLACEMENT MATCH ✓'
    WHEN rh.is_placement_match = false AND rh.is_unrated_match = true THEN 'FIRST MATCH - Should be placement but is not!'
    WHEN rh.is_placement_match = false THEN 'NOT PLACEMENT - Normal match'
    ELSE 'UNKNOWN'
  END as analysis
FROM matches m
LEFT JOIN rating_history rh ON rh.match_id = m.id 
  AND rh.player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
LEFT JOIN players opponent ON opponent.id = rh.opponent_id
WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
   OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
  AND m.is_competitive = true
ORDER BY COALESCE(m.played_at, m.created_at) ASC, m.created_at ASC;

-- Detailed breakdown: Show what should have been placement matches
WITH match_sequence AS (
  SELECT 
    m.id as match_id,
    COALESCE(m.played_at, m.created_at) as match_date,
    rh.id as rating_history_id,
    rh.is_placement_match,
    rh.is_unrated_match,
    rh.rating_reversed,
    rh.created_at as rating_date,
    ROW_NUMBER() OVER (ORDER BY COALESCE(m.played_at, m.created_at) ASC, m.created_at ASC) as chronological_order
  FROM matches m
  LEFT JOIN rating_history rh ON rh.match_id = m.id 
    AND rh.player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
    AND rh.rating_reversed = false
  WHERE (m.player1_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64' 
     OR m.player2_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64')
    AND m.is_competitive = true
  ORDER BY COALESCE(m.played_at, m.created_at) ASC, m.created_at ASC
)
SELECT 
  chronological_order,
  match_id,
  match_date,
  CASE 
    WHEN chronological_order <= 3 THEN 'SHOULD BE PLACEMENT'
    ELSE 'Should NOT be placement'
  END as expected_status,
  CASE 
    WHEN is_placement_match = true THEN 'IS PLACEMENT ✓'
    WHEN is_placement_match = false AND is_unrated_match = true THEN 'FIRST MATCH - Missing placement flag!'
    WHEN is_placement_match = false THEN 'NOT PLACEMENT ✗'
    WHEN rating_history_id IS NULL THEN 'NO RATING HISTORY'
    ELSE 'UNKNOWN'
  END as actual_status,
  CASE 
    WHEN chronological_order <= 3 AND is_placement_match = false AND rating_reversed = false THEN 'PROBLEM: Should be placement but is not!'
    WHEN chronological_order <= 3 AND is_placement_match = true THEN 'OK'
    WHEN chronological_order > 3 AND is_placement_match = false THEN 'OK'
    WHEN chronological_order > 3 AND is_placement_match = true THEN 'PROBLEM: Should not be placement but is!'
    ELSE 'CHECK MANUALLY'
  END as issue
FROM match_sequence;

-- Check if first match is missing placement flag (the bug we fixed)
SELECT 
  'First match placement check' as check_type,
  rh.id,
  rh.match_id,
  rh.is_placement_match,
  rh.is_unrated_match,
  rh.rating_reversed,
  m.played_at,
  rh.created_at,
  CASE 
    WHEN rh.is_unrated_match = true AND rh.is_placement_match = false AND rh.rating_reversed = false 
    THEN 'BUG FOUND: First match should be placement but is not!'
    WHEN rh.is_unrated_match = true AND rh.is_placement_match = true 
    THEN 'OK: First match correctly marked as placement'
    ELSE 'N/A'
  END as status
FROM rating_history rh
JOIN matches m ON m.id = rh.match_id
WHERE rh.player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
  AND rh.rating_reversed = false
ORDER BY rh.created_at ASC
LIMIT 1;
