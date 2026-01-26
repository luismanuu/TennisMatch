-- ============================================
-- CHECK ALL MATCHES IN CHRONOLOGICAL ORDER
-- ============================================
-- Player ID: e4401b3a-ccbb-47d9-a98a-e3541364ea64
-- This shows all matches in the order they were processed

SELECT 
  ROW_NUMBER() OVER (ORDER BY rh.created_at ASC) as processing_order,
  m.id as match_id,
  m.played_at,
  rh.created_at as rating_calculated_at,
  rh.is_placement_match,
  rh.is_unrated_match,
  rh.rating_reversed,
  rh.was_winner,
  rh.elo_before,
  rh.elo_after,
  rh.elo_change,
  opponent.name as opponent_name,
  CASE 
    WHEN rh.is_unrated_match = true THEN 'First match for player'
    ELSE 'Player already had matches'
  END as match_context,
  CASE 
    WHEN rh.is_placement_match = true AND rh.rating_reversed = false THEN '✓ Placement'
    WHEN rh.is_placement_match = false AND rh.rating_reversed = false AND ROW_NUMBER() OVER (ORDER BY rh.created_at ASC) <= 3 THEN '✗ Should be placement!'
    WHEN rh.rating_reversed = true THEN 'Reverted (does not count)'
    ELSE 'Normal match'
  END as placement_status
FROM rating_history rh
JOIN matches m ON m.id = rh.match_id
LEFT JOIN players opponent ON opponent.id = rh.opponent_id
WHERE rh.player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
  AND rh.rating_reversed = false
ORDER BY rh.created_at ASC;

-- Summary: Count placement matches by processing order
WITH ordered_matches AS (
  SELECT 
    ROW_NUMBER() OVER (ORDER BY rh.created_at ASC) as match_number,
    rh.is_placement_match,
    rh.is_unrated_match,
    rh.rating_reversed
  FROM rating_history rh
  WHERE rh.player_id = 'e4401b3a-ccbb-47d9-a98a-e3541364ea64'
    AND rh.rating_reversed = false
  ORDER BY rh.created_at ASC
)
SELECT 
  match_number,
  is_placement_match,
  is_unrated_match,
  CASE 
    WHEN match_number <= 3 AND is_placement_match = true THEN '✓ Correct'
    WHEN match_number <= 3 AND is_placement_match = false THEN '✗ Missing placement flag!'
    WHEN match_number > 3 AND is_placement_match = true THEN '✗ Should not be placement!'
    ELSE 'OK'
  END as status
FROM ordered_matches
ORDER BY match_number;
