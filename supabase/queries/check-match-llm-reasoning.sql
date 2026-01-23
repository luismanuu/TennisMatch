-- ============================================
-- CHECK LLM REASONING FOR A SPECIFIC MATCH
-- ============================================
-- Replace 'YOUR_MATCH_ID_HERE' with the actual match ID
-- This query checks both matches.llm_calculation_reasoning 
-- and rating_history.reasoning_preview (fallback)

SELECT 
  -- Match Information
  m.id AS match_id,
  m.score,
  m.status,
  m.played_at,
  m.location,
  
  -- Player Information
  p1.name AS player1_name,
  p1.elo AS player1_current_elo,
  p2.name AS player2_name,
  p2.elo AS player2_current_elo,
  w.name AS winner_name,
  
  -- LLM Calculation Details (from matches table)
  m.llm_elo_calculated,
  m.llm_calculation_failed,
  m.llm_calculation_model,
  m.llm_calculation_timestamp,
  m.llm_calculation_reasoning AS full_reasoning_from_matches,
  
  -- Reasoning preview from rating_history (same for both players since reasoning is about the match)
  -- Using COALESCE to get reasoning from either player's rating_history entry
  CASE 
    WHEN COALESCE(rh1.reasoning_preview, rh2.reasoning_preview) IS NOT NULL 
         AND LENGTH(COALESCE(rh1.reasoning_preview, rh2.reasoning_preview)) > 500 THEN
      LEFT(COALESCE(rh1.reasoning_preview, rh2.reasoning_preview), 500) || '...'
    ELSE COALESCE(rh1.reasoning_preview, rh2.reasoning_preview)
  END AS reasoning_preview,
  
  -- Diagnostic: Why might reasoning be missing?
  CASE 
    WHEN m.llm_elo_calculated IS NULL AND m.llm_calculation_failed IS NULL THEN 'LLM was never attempted (no API key or missing score?)'
    WHEN m.llm_calculation_failed = true THEN 'LLM calculation failed'
    WHEN m.llm_elo_calculated = false AND m.llm_calculation_failed = false THEN 'LLM not used (fallback calculation)'
    WHEN m.llm_elo_calculated = true AND m.llm_calculation_reasoning IS NULL THEN 'LLM succeeded but reasoning not saved (bug?)'
    ELSE 'OK'
  END AS reasoning_status,
  
  -- ELO Changes from Rating History
  rh1.elo_before AS player1_elo_before,
  rh1.elo_after AS player1_elo_after,
  rh1.elo_change AS player1_elo_change,
  rh2.elo_before AS player2_elo_before,
  rh2.elo_after AS player2_elo_after,
  rh2.elo_change AS player2_elo_change,
  
  -- UTR Rating Data (if available)
  rh1.match_rating AS player1_match_rating,
  rh1.match_weight AS player1_match_weight,
  rh2.match_rating AS player2_match_rating,
  rh2.match_weight AS player2_match_weight

FROM matches m
INNER JOIN players p1 ON m.player1_id = p1.id
INNER JOIN players p2 ON m.player2_id = p2.id
LEFT JOIN players w ON m.winner_id = w.id
LEFT JOIN LATERAL (
  SELECT * FROM rating_history 
  WHERE match_id = m.id 
    AND player_id = m.player1_id 
    AND rating_reversed = false
  ORDER BY created_at DESC
  LIMIT 1
) rh1 ON true
LEFT JOIN LATERAL (
  SELECT * FROM rating_history 
  WHERE match_id = m.id 
    AND player_id = m.player2_id 
    AND rating_reversed = false
  ORDER BY created_at DESC
  LIMIT 1
) rh2 ON true
WHERE m.id = 'YOUR_MATCH_ID_HERE'; -- Replace with actual match ID
