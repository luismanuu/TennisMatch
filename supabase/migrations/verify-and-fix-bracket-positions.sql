-- ============================================
-- VERIFY AND FIX BRACKET POSITIONS (SAFE VERSION)
-- ============================================
-- This script first shows what will be changed, then fixes bracket_position
-- for existing tournament matches that have null bracket_position values

-- STEP 1: Show current state BEFORE making changes
SELECT 
  'BEFORE FIX - Current state' as status,
  tournament_id,
  bracket_type,
  round_number,
  COUNT(*) as total_matches,
  COUNT(bracket_position) as matches_with_position,
  COUNT(*) FILTER (WHERE bracket_position IS NULL) as matches_without_position,
  COUNT(*) FILTER (WHERE is_bye = true) as bye_matches,
  COUNT(*) FILTER (WHERE match_id IS NULL) as matches_without_match_id
FROM tournament_matches
WHERE bracket_type IN ('main', 'backdraw')
GROUP BY tournament_id, bracket_type, round_number
ORDER BY tournament_id, bracket_type, round_number;

-- STEP 2: Show which matches will be updated
SELECT 
  'MATCHES TO UPDATE' as status,
  tm.id,
  tm.tournament_id,
  tm.bracket_type,
  tm.round_number,
  tm.bracket_position as current_position,
  tm.is_bye,
  tm.match_id,
  tm.player_id,
  ROW_NUMBER() OVER (
    PARTITION BY tm.tournament_id, tm.bracket_type, tm.round_number 
    ORDER BY 
      CASE WHEN tm.match_id IS NOT NULL THEN 0 ELSE 1 END,
      tm.id ASC
  ) as new_position
FROM tournament_matches tm
WHERE tm.bracket_type IN ('main', 'backdraw')
  AND tm.bracket_position IS NULL
ORDER BY tm.tournament_id, tm.bracket_type, tm.round_number, new_position;

-- STEP 3: Actually update the bracket_position (ONLY for null values)
-- This uses a CTE to calculate positions safely
WITH ranked_matches AS (
  SELECT 
    tm.id,
    tm.tournament_id,
    tm.bracket_type,
    tm.round_number,
    ROW_NUMBER() OVER (
      PARTITION BY tm.tournament_id, tm.bracket_type, tm.round_number 
      ORDER BY 
        CASE WHEN tm.match_id IS NOT NULL THEN 0 ELSE 1 END, -- Regular matches first
        tm.id ASC
    ) as new_position
  FROM tournament_matches tm
  WHERE tm.bracket_type IN ('main', 'backdraw')
    AND tm.bracket_position IS NULL
)
UPDATE tournament_matches
SET bracket_position = ranked_matches.new_position
FROM ranked_matches
WHERE tournament_matches.id = ranked_matches.id
  AND tournament_matches.bracket_position IS NULL;

-- STEP 4: Show state AFTER making changes
SELECT 
  'AFTER FIX - Final state' as status,
  tournament_id,
  bracket_type,
  round_number,
  COUNT(*) as total_matches,
  COUNT(bracket_position) as matches_with_position,
  COUNT(*) FILTER (WHERE bracket_position IS NULL) as matches_without_position,
  COUNT(*) FILTER (WHERE is_bye = true) as bye_matches,
  COUNT(*) FILTER (WHERE match_id IS NULL) as matches_without_match_id
FROM tournament_matches
WHERE bracket_type IN ('main', 'backdraw')
GROUP BY tournament_id, bracket_type, round_number
ORDER BY tournament_id, bracket_type, round_number;

-- STEP 5: Show all matches by round to verify nothing was deleted
SELECT 
  'ALL MATCHES BY ROUND' as status,
  tournament_id,
  bracket_type,
  round_number,
  bracket_position,
  is_bye,
  match_id IS NOT NULL as has_match,
  player_id IS NOT NULL as has_player_id,
  id
FROM tournament_matches
WHERE bracket_type IN ('main', 'backdraw')
ORDER BY tournament_id, bracket_type, round_number, bracket_position, id;

