-- ============================================
-- FIX FIRST MATCH PLACEMENT FLAG
-- ============================================
-- Issue: The first match for unrated players was not marked as is_placement_match = true
-- in rating_history, even though it counted towards placement_matches_completed.
-- This caused a discrepancy where players with 3 matches showed 2/3 placement matches.
--
-- This migration:
-- 1. Marks the first match in rating_history as is_placement_match = true for players
--    who have placement_matches_completed >= 1 but their first match isn't marked
-- 2. Recalculates placement_matches_completed based on rating_history

-- Step 1: Find and update the first match for each affected player
-- A player is affected if:
-- - They have placement_matches_completed >= 1
-- - Their first rating_history entry (by created_at) doesn't have is_placement_match = true
-- - That first entry has is_unrated_match = true (indicating it was their first match)

UPDATE rating_history rh
SET is_placement_match = true
FROM (
  -- Find the first match for each player
  SELECT DISTINCT ON (player_id)
    id,
    player_id,
    match_id
  FROM rating_history
  WHERE is_unrated_match = true
    AND is_placement_match = false
    AND rating_reversed = false
  ORDER BY player_id, created_at ASC
) first_matches
WHERE rh.id = first_matches.id
  AND EXISTS (
    -- Only update if player has placement_matches_completed >= 1
    SELECT 1
    FROM players p
    WHERE p.id = first_matches.player_id
      AND p.placement_matches_completed >= 1
  );

-- Step 2: Recalculate placement_matches_completed for all players
-- This ensures consistency between rating_history and players table
UPDATE players p
SET placement_matches_completed = COALESCE((
  SELECT COUNT(*)
  FROM rating_history rh
  WHERE rh.player_id = p.id
    AND rh.is_placement_match = true
    AND rh.rating_reversed = false
), 0)
WHERE p.total_matches_played > 0;

-- Verification query (uncomment to check results)
-- SELECT 
--   p.id,
--   p.name,
--   p.placement_matches_completed,
--   COUNT(rh.id) FILTER (WHERE rh.is_placement_match = true AND rh.rating_reversed = false) as placement_matches_in_history,
--   CASE 
--     WHEN p.placement_matches_completed = COUNT(rh.id) FILTER (WHERE rh.is_placement_match = true AND rh.rating_reversed = false)
--     THEN 'OK'
--     ELSE 'MISMATCH'
--   END as status
-- FROM players p
-- LEFT JOIN rating_history rh ON rh.player_id = p.id
-- WHERE p.total_matches_played > 0
-- GROUP BY p.id, p.name, p.placement_matches_completed
-- HAVING p.placement_matches_completed != COUNT(rh.id) FILTER (WHERE rh.is_placement_match = true AND rh.rating_reversed = false)
-- ORDER BY p.placement_matches_completed DESC;
