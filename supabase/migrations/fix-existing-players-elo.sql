-- ============================================
-- FIX EXISTING PLAYERS ELO BASED ON CATEGORY
-- ============================================
-- Update players who have ELO 1000 but should have their category's default_elo
-- This fixes players who were created before the rating system was fully implemented

-- Update players with ELO 1000 to use their category's default_elo
-- Only update if they haven't played any matches yet (placement matches)
UPDATE players p
SET 
  elo = COALESCE(
    (SELECT c.default_elo FROM categories c WHERE c.id = p.category_id),
    1000  -- Fallback if no category
  ),
  mmr = COALESCE(
    (SELECT (c.default_elo - 2250.0) / 750.0 FROM categories c WHERE c.id = p.category_id),
    (1000 - 2250.0) / 750.0  -- Default MMR: (1000 - 2250) / 750 = -1.67
  )
WHERE 
  p.elo = 1000 
  AND p.total_matches_played = 0
  AND p.category_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM categories c 
    WHERE c.id = p.category_id 
    AND c.default_elo != 1000
  );

-- Also update ELO for players who have played matches but still have ELO 1000
-- This handles edge cases where players might have been created incorrectly
-- Only update if they're still in placement (less than 3 matches)
UPDATE players p
SET 
  elo = COALESCE(
    (SELECT c.default_elo FROM categories c WHERE c.id = p.category_id),
    p.elo  -- Keep current ELO if no category
  ),
  mmr = COALESCE(
    (SELECT (c.default_elo - 2250.0) / 750.0 FROM categories c WHERE c.id = p.category_id),
    p.mmr  -- Keep current MMR if no category
  )
WHERE 
  p.elo = 1000 
  AND p.total_matches_played > 0
  AND p.total_matches_played < 3  -- Still in placement
  AND p.category_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM categories c 
    WHERE c.id = p.category_id 
    AND c.default_elo != 1000
  );

-- Note: This migration fixes players who were created before the rating system
-- was fully implemented. Players who have completed 3+ matches should not
-- be updated as their ELO has been adjusted through actual gameplay.
