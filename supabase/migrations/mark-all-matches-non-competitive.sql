-- ============================================
-- MARK ALL EXISTING MATCHES AS NON-COMPETITIVE
-- ============================================
-- This migration marks all existing matches as non-competitive (is_competitive = false)
-- Use this if you want existing matches to not affect ratings

UPDATE matches
SET is_competitive = false
WHERE is_competitive IS NULL OR is_competitive = true;

-- Verify the update
-- SELECT COUNT(*) as total_matches, 
--        COUNT(*) FILTER (WHERE is_competitive = true) as competitive_matches,
--        COUNT(*) FILTER (WHERE is_competitive = false) as non_competitive_matches
-- FROM matches;
