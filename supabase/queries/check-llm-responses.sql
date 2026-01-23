-- ============================================
-- SQL QUERIES TO CHECK LLM RESPONSES
-- ============================================

-- Query 1: All matches with LLM calculation (successful)
-- Shows matches where LLM was successfully used to calculate ELO
SELECT 
  m.id AS match_id,
  m.score,
  m.status,
  m.played_at,
  p1.name AS player1_name,
  p2.name AS player2_name,
  w.name AS winner_name,
  m.llm_elo_calculated,
  m.llm_calculation_model,
  m.llm_calculation_timestamp,
  m.llm_calculation_reasoning,
  m.llm_calculation_failed,
  -- Get ELO changes from rating_history
  rh1.elo_change AS player1_elo_change,
  rh2.elo_change AS player2_elo_change,
  rh1.elo_before AS player1_elo_before,
  rh1.elo_after AS player1_elo_after,
  rh2.elo_before AS player2_elo_before,
  rh2.elo_after AS player2_elo_after
FROM matches m
LEFT JOIN players p1 ON m.player1_id = p1.id
LEFT JOIN players p2 ON m.player2_id = p2.id
LEFT JOIN players w ON m.winner_id = w.id
LEFT JOIN rating_history rh1 ON m.id = rh1.match_id AND rh1.player_id = m.player1_id
LEFT JOIN rating_history rh2 ON m.id = rh2.match_id AND rh2.player_id = m.player2_id
WHERE m.llm_elo_calculated = true
ORDER BY m.llm_calculation_timestamp DESC
LIMIT 50;

-- Query 2: LLM calculation failures
-- Shows matches where LLM calculation failed and fallback was used
SELECT 
  m.id AS match_id,
  m.score,
  m.status,
  m.played_at,
  p1.name AS player1_name,
  p2.name AS player2_name,
  m.llm_calculation_failed,
  m.llm_calculation_reasoning,
  m.llm_calculation_timestamp,
  m.llm_calculation_model
FROM matches m
LEFT JOIN players p1 ON m.player1_id = p1.id
LEFT JOIN players p2 ON m.player2_id = p2.id
WHERE m.llm_calculation_failed = true
ORDER BY m.llm_calculation_timestamp DESC;

-- Query 3: Recent LLM calculations with full context
-- Shows the most recent LLM calculations with all details
SELECT 
  m.id AS match_id,
  m.score,
  m.played_at,
  p1.name AS player1_name,
  p1.elo AS player1_current_elo,
  p2.name AS player2_name,
  p2.elo AS player2_current_elo,
  w.name AS winner_name,
  m.llm_elo_calculated,
  m.llm_calculation_model,
  m.llm_calculation_timestamp,
  m.llm_calculation_failed,
  LEFT(m.llm_calculation_reasoning, 500) AS reasoning_preview, -- First 500 chars
  rh1.elo_change AS player1_elo_change,
  rh2.elo_change AS player2_elo_change,
  rh1.match_rating AS player1_match_rating,
  rh1.match_weight AS player1_match_weight,
  rh2.match_rating AS player2_match_rating,
  rh2.match_weight AS player2_match_weight
FROM matches m
LEFT JOIN players p1 ON m.player1_id = p1.id
LEFT JOIN players p2 ON m.player2_id = p2.id
LEFT JOIN players w ON m.winner_id = w.id
LEFT JOIN rating_history rh1 ON m.id = rh1.match_id AND rh1.player_id = m.player1_id
LEFT JOIN rating_history rh2 ON m.id = rh2.match_id AND rh2.player_id = m.player2_id
WHERE m.llm_elo_calculated = true OR m.llm_calculation_failed = true
ORDER BY m.llm_calculation_timestamp DESC NULLS LAST
LIMIT 20;

-- Query 4: LLM calculation statistics
-- Summary statistics about LLM usage
SELECT 
  COUNT(*) AS total_matches_with_llm_attempt,
  COUNT(*) FILTER (WHERE llm_elo_calculated = true) AS successful_llm_calculations,
  COUNT(*) FILTER (WHERE llm_calculation_failed = true) AS failed_llm_calculations,
  COUNT(*) FILTER (WHERE llm_elo_calculated = false AND llm_calculation_failed = false) AS no_llm_attempt,
  ROUND(
    COUNT(*) FILTER (WHERE llm_elo_calculated = true)::numeric / 
    NULLIF(COUNT(*) FILTER (WHERE llm_elo_calculated = true OR llm_calculation_failed = true), 0) * 100, 
    2
  ) AS success_rate_percent
FROM matches
WHERE status = 'completed';

-- Query 5: Full LLM reasoning for a specific match
-- Get complete LLM reasoning text (useful for debugging)
SELECT 
  m.id AS match_id,
  m.score,
  p1.name AS player1_name,
  p2.name AS player2_name,
  m.llm_calculation_reasoning AS full_reasoning,
  m.llm_calculation_model,
  m.llm_calculation_timestamp,
  m.llm_calculation_failed
FROM matches m
LEFT JOIN players p1 ON m.player1_id = p1.id
LEFT JOIN players p2 ON m.player2_id = p2.id
WHERE m.id = 'YOUR_MATCH_ID_HERE'; -- Replace with actual match ID

-- Query 6: LLM calculations by date range
-- Check LLM usage over time
SELECT 
  DATE(m.llm_calculation_timestamp) AS calculation_date,
  COUNT(*) AS total_calculations,
  COUNT(*) FILTER (WHERE m.llm_elo_calculated = true) AS successful,
  COUNT(*) FILTER (WHERE m.llm_calculation_failed = true) AS failed,
  m.llm_calculation_model
FROM matches m
WHERE m.llm_calculation_timestamp IS NOT NULL
GROUP BY DATE(m.llm_calculation_timestamp), m.llm_calculation_model
ORDER BY calculation_date DESC;

-- Query 7: Matches without LLM calculation
-- Find completed matches that haven't used LLM (maybe API key missing or error)
SELECT 
  m.id AS match_id,
  m.score,
  m.status,
  m.played_at,
  p1.name AS player1_name,
  p2.name AS player2_name,
  m.llm_elo_calculated,
  m.llm_calculation_failed
FROM matches m
LEFT JOIN players p1 ON m.player1_id = p1.id
LEFT JOIN players p2 ON m.player2_id = p2.id
WHERE m.status = 'completed'
  AND m.llm_elo_calculated IS NULL
  AND m.llm_calculation_failed IS NULL
ORDER BY m.played_at DESC
LIMIT 20;

-- Query 8: LLM response with UTR data
-- Shows LLM calculation along with UTR match rating and weight
SELECT 
  m.id AS match_id,
  m.score,
  p1.name AS player1_name,
  p2.name AS player2_name,
  m.llm_elo_calculated,
  m.llm_calculation_model,
  m.llm_calculation_timestamp,
  LEFT(m.llm_calculation_reasoning, 500) AS reasoning_preview,
  -- ELO changes
  rh1.elo_change AS p1_elo_change,
  rh2.elo_change AS p2_elo_change,
  -- UTR data
  rh1.match_rating AS p1_match_rating,
  rh1.match_weight AS p1_match_weight,
  rh1.games_won AS p1_games_won,
  rh1.games_lost AS p1_games_lost,
  rh1.total_games AS total_games,
  rh2.match_rating AS p2_match_rating,
  rh2.match_weight AS p2_match_weight
FROM matches m
LEFT JOIN players p1 ON m.player1_id = p1.id
LEFT JOIN players p2 ON m.player2_id = p2.id
LEFT JOIN rating_history rh1 ON m.id = rh1.match_id AND rh1.player_id = m.player1_id
LEFT JOIN rating_history rh2 ON m.id = rh2.match_id AND rh2.player_id = m.player2_id
WHERE m.llm_elo_calculated = true
ORDER BY m.llm_calculation_timestamp DESC
LIMIT 10;
