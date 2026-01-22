-- Migration: Fix SECURITY DEFINER issue on player_rating_stats view
-- Issue: View is defined with SECURITY DEFINER, which uses view creator's permissions
-- Solution: Recreate view with SECURITY INVOKER (default) to use querying user's permissions

-- Drop and recreate the view with SECURITY INVOKER (default)
-- By not specifying SECURITY DEFINER, the view defaults to SECURITY INVOKER
DROP VIEW IF EXISTS player_rating_stats;

CREATE VIEW player_rating_stats AS
SELECT
  player_id,
  COUNT(*) AS total_rated_matches,
  COUNT(*) FILTER (WHERE was_winner) AS wins,
  COUNT(*) FILTER (WHERE NOT was_winner) AS losses,
  MAX(elo_after) AS peak_elo,
  MIN(elo_after) AS lowest_elo,
  AVG(elo_change) FILTER (WHERE was_winner) AS avg_elo_gain,
  AVG(elo_change) FILTER (WHERE NOT was_winner) AS avg_elo_loss,
  MAX(created_at) AS last_rated_match_at,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS matches_last_30_days,
  COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS matches_this_month
FROM rating_history
WHERE NOT rating_reversed
GROUP BY player_id;

COMMENT ON VIEW player_rating_stats IS 'Aggregated rating statistics per player';
