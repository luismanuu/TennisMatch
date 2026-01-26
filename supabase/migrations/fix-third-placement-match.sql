-- ============================================
-- FIX THIRD PLACEMENT MATCH FLAG
-- ============================================
-- Issue: Some players have their 3rd match not marked as is_placement_match = true
-- This happens when the match was processed but the flag wasn't set correctly
--
-- This migration:
-- 1. Finds players who have exactly 2 placement matches but have 3+ competitive matches
-- 2. Marks their 3rd match (by processing order) as is_placement_match = true
-- 3. Recalculates placement_matches_completed

-- Step 1: Preview - Find the 3rd match for players who need fixing
-- (Uncomment to see what will be updated)
/*
SELECT 
  rh.id,
  rh.player_id,
  p.name,
  rh.match_id,
  rh.created_at,
  rh.is_placement_match,
  'Will be updated to is_placement_match = true' as action
FROM rating_history rh
JOIN players p ON p.id = rh.player_id
WHERE rh.rating_reversed = false
  AND rh.is_placement_match = false
  -- This is the 3rd match for this player (by processing order)
  AND (
    SELECT COUNT(*)
    FROM rating_history rh_before
    WHERE rh_before.player_id = rh.player_id
      AND rh_before.rating_reversed = false
      AND rh_before.created_at < rh.created_at
  ) = 2
  -- Player has exactly 2 placement matches
  AND (
    SELECT COUNT(*)
    FROM rating_history rh_count
    WHERE rh_count.player_id = rh.player_id
      AND rh_count.is_placement_match = true
      AND rh_count.rating_reversed = false
  ) = 2;
*/

-- Step 2: Update the 3rd match to be marked as placement
UPDATE rating_history rh
SET is_placement_match = true
WHERE rh.rating_reversed = false
  AND rh.is_placement_match = false
  -- This is the 3rd match for this player (by processing order)
  AND (
    SELECT COUNT(*)
    FROM rating_history rh_before
    WHERE rh_before.player_id = rh.player_id
      AND rh_before.rating_reversed = false
      AND rh_before.created_at < rh.created_at
  ) = 2
  -- Player has exactly 2 placement matches
  AND (
    SELECT COUNT(*)
    FROM rating_history rh_count
    WHERE rh_count.player_id = rh.player_id
      AND rh_count.is_placement_match = true
      AND rh_count.rating_reversed = false
  ) = 2;

-- Step 3: Recalculate placement_matches_completed for all affected players
UPDATE players p
SET placement_matches_completed = COALESCE((
  SELECT COUNT(*)
  FROM rating_history rh
  WHERE rh.player_id = p.id
    AND rh.is_placement_match = true
    AND rh.rating_reversed = false
), 0)
WHERE p.total_matches_played >= 3
  AND p.placement_matches_completed < 3;

-- Verification query (uncomment to check results after migration)
/*
SELECT 
  p.id,
  p.name,
  p.placement_matches_completed,
  COUNT(rh.id) FILTER (WHERE rh.is_placement_match = true AND rh.rating_reversed = false) as placement_matches_in_history,
  CASE 
    WHEN p.placement_matches_completed = COUNT(rh.id) FILTER (WHERE rh.is_placement_match = true AND rh.rating_reversed = false)
    THEN 'OK'
    ELSE 'MISMATCH'
  END as status
FROM players p
LEFT JOIN rating_history rh ON rh.player_id = p.id
WHERE p.total_matches_played >= 3
  AND p.placement_matches_completed < 3
GROUP BY p.id, p.name, p.placement_matches_completed
HAVING p.placement_matches_completed != COUNT(rh.id) FILTER (WHERE rh.is_placement_match = true AND rh.rating_reversed = false)
ORDER BY p.placement_matches_completed DESC;
*/
