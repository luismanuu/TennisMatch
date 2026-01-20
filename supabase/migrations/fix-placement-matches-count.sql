-- ============================================
-- FIX PLACEMENT MATCHES COUNT
-- ============================================
-- Recalculate placement_matches_completed based only on competitive matches
-- (matches that appear in rating_history with is_placement_match = true)

-- Update placement_matches_completed for all players based on their competitive placement matches
UPDATE players p
SET placement_matches_completed = COALESCE((
  SELECT COUNT(*)
  FROM rating_history rh
  WHERE rh.player_id = p.id
    AND rh.is_placement_match = true
    AND rh.rating_reversed = false
), 0)
WHERE p.total_matches_played > 0;

-- Also ensure total_matches_played only counts competitive matches
-- (matches that have entries in rating_history)
UPDATE players p
SET total_matches_played = COALESCE((
  SELECT COUNT(DISTINCT rh.match_id)
  FROM rating_history rh
  WHERE rh.player_id = p.id
    AND rh.rating_reversed = false
), 0);

-- Verify the fix
-- SELECT 
--   id,
--   name,
--   total_matches_played,
--   placement_matches_completed,
--   elo,
--   CASE 
--     WHEN placement_matches_completed < 3 THEN 'In Placement'
--     ELSE 'Completed'
--   END as placement_status
-- FROM players
-- WHERE total_matches_played > 0
-- ORDER BY placement_matches_completed, total_matches_played;
