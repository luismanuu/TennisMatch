-- ============================================
-- CREATE RATING HISTORY TABLE
-- ============================================
-- Tracks rating changes for analytics and potential recalculation

-- Create rating_history table
CREATE TABLE IF NOT EXISTS rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  elo_before INTEGER NOT NULL,
  elo_after INTEGER NOT NULL,
  elo_change INTEGER NOT NULL,
  mmr_before DECIMAL(6,3) NOT NULL,
  mmr_after DECIMAL(6,3) NOT NULL,
  mmr_change DECIMAL(6,3) NOT NULL,
  uncertainty_before DECIMAL(4,2) NOT NULL,
  uncertainty_after DECIMAL(4,2) NOT NULL,
  k_factor INTEGER NOT NULL,
  expected_score DECIMAL(4,3) NOT NULL,
  actual_score DECIMAL(4,3) NOT NULL,
  is_placement_match BOOLEAN DEFAULT false,
  is_unrated_match BOOLEAN DEFAULT false,
  win_streak_bonus INTEGER DEFAULT 0,
  opponent_id UUID REFERENCES players(id) ON DELETE SET NULL,
  opponent_elo INTEGER,
  opponent_mmr DECIMAL(6,3),
  was_winner BOOLEAN NOT NULL,
  rating_reversed BOOLEAN DEFAULT false,
  reversed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE rating_history IS 'Historical record of all rating changes';
COMMENT ON COLUMN rating_history.elo_change IS 'Change in ELO (positive for gain, negative for loss)';
COMMENT ON COLUMN rating_history.mmr_change IS 'Change in MMR (positive for gain, negative for loss)';
COMMENT ON COLUMN rating_history.k_factor IS 'K-factor used for this calculation';
COMMENT ON COLUMN rating_history.expected_score IS 'Expected win probability (0.0 to 1.0)';
COMMENT ON COLUMN rating_history.actual_score IS 'Actual result (1.0 for win, 0.0 for loss)';
COMMENT ON COLUMN rating_history.is_placement_match IS 'Was this a placement match';
COMMENT ON COLUMN rating_history.is_unrated_match IS 'Was this player unrated before match';
COMMENT ON COLUMN rating_history.win_streak_bonus IS 'Bonus ELO from win streak';
COMMENT ON COLUMN rating_history.rating_reversed IS 'Was this rating update reversed';
COMMENT ON COLUMN rating_history.reversed_at IS 'When the rating was reversed';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rating_history_player ON rating_history(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_history_match ON rating_history(match_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_created ON rating_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_history_player_month ON rating_history(player_id, created_at)
  WHERE NOT rating_reversed;

-- Enable RLS
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;

-- Rating history is publicly readable (for player profiles)
CREATE POLICY "Rating history is publicly readable"
  ON rating_history FOR SELECT
  USING (true);

-- Only system can insert/update rating history (via service role)
-- No INSERT/UPDATE policies for regular users

-- Create a view for player rating stats
CREATE OR REPLACE VIEW player_rating_stats AS
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

-- Function to get matches played in a specific month
CREATE OR REPLACE FUNCTION get_matches_in_month(p_player_id UUID, p_year INTEGER, p_month INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM rating_history
    WHERE player_id = p_player_id
      AND NOT rating_reversed
      AND EXTRACT(YEAR FROM created_at) = p_year
      AND EXTRACT(MONTH FROM created_at) = p_month
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_matches_in_month IS 'Get number of rated matches for a player in a specific month';
