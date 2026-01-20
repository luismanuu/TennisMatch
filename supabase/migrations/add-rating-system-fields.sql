-- ============================================
-- ADD RATING SYSTEM FIELDS TO PLAYERS
-- ============================================
-- Migration to add MMR, placement matches, streaks, and decay tracking

-- Add MMR (hidden matchmaking rating, stored in standard deviations)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS mmr DECIMAL(6,3) DEFAULT 0.0;

-- Add MMR uncertainty (starts high, decreases with play)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS mmr_uncertainty DECIMAL(4,2) DEFAULT 2.0;

-- Add placement matches counter (0-3)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS placement_matches_completed INTEGER DEFAULT 0;

-- Add win streak counter
ALTER TABLE players
ADD COLUMN IF NOT EXISTS win_streak INTEGER DEFAULT 0;

-- Add loss streak counter
ALTER TABLE players
ADD COLUMN IF NOT EXISTS loss_streak INTEGER DEFAULT 0;

-- Add last match timestamp for inactivity tracking
ALTER TABLE players
ADD COLUMN IF NOT EXISTS last_match_at TIMESTAMP WITH TIME ZONE;

-- Add matches this month counter for decay prevention
ALTER TABLE players
ADD COLUMN IF NOT EXISTS matches_this_month INTEGER DEFAULT 0;

-- Add last decay check date to prevent double-decay
ALTER TABLE players
ADD COLUMN IF NOT EXISTS last_decay_check DATE;

-- Add total matches played counter (0 = unrated)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS total_matches_played INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN players.mmr IS 'Hidden matchmaking rating in standard deviations (-3.0 to +3.0)';
COMMENT ON COLUMN players.mmr_uncertainty IS 'Uncertainty factor for MMR (0.5 to 2.0)';
COMMENT ON COLUMN players.placement_matches_completed IS 'Number of placement matches completed (max 3)';
COMMENT ON COLUMN players.win_streak IS 'Current consecutive win count';
COMMENT ON COLUMN players.loss_streak IS 'Current consecutive loss count';
COMMENT ON COLUMN players.last_match_at IS 'Timestamp of last completed match';
COMMENT ON COLUMN players.matches_this_month IS 'Number of matches played this calendar month';
COMMENT ON COLUMN players.last_decay_check IS 'Last date decay was checked/applied';
COMMENT ON COLUMN players.total_matches_played IS 'Total completed matches (0 = unrated player)';

-- Create indexes for matchmaking and analytics
CREATE INDEX IF NOT EXISTS idx_players_mmr ON players(mmr);
CREATE INDEX IF NOT EXISTS idx_players_city_id_mmr ON players(city_id, mmr);
CREATE INDEX IF NOT EXISTS idx_players_last_match_at ON players(last_match_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_elo ON players(elo);
CREATE INDEX IF NOT EXISTS idx_players_total_matches ON players(total_matches_played);

-- Backfill total_matches_played for existing players based on completed matches
UPDATE players p
SET total_matches_played = COALESCE((
  SELECT COUNT(*)
  FROM matches m
  WHERE (m.player1_id = p.id OR m.player2_id = p.id)
    AND m.status = 'completed'
), 0);

-- Backfill last_match_at for existing players
UPDATE players p
SET last_match_at = (
  SELECT MAX(m.played_at)
  FROM matches m
  WHERE (m.player1_id = p.id OR m.player2_id = p.id)
    AND m.status = 'completed'
);

-- Backfill MMR from existing ELO for rated players (total_matches_played > 0)
-- Formula: MMR = (ELO - 2250) / 750
UPDATE players
SET mmr = (elo - 2250.0) / 750.0,
    mmr_uncertainty = CASE
      WHEN total_matches_played >= 20 THEN 0.5  -- Low uncertainty
      WHEN total_matches_played >= 10 THEN 1.0  -- Medium uncertainty
      WHEN total_matches_played >= 3 THEN 1.5   -- Higher uncertainty
      ELSE 2.0                                   -- Maximum uncertainty
    END,
    -- Set placement matches to 3 (completed) for players with matches
    placement_matches_completed = CASE
      WHEN total_matches_played >= 3 THEN 3
      ELSE total_matches_played
    END
WHERE total_matches_played > 0;

-- Set default_elo based MMR for unrated players (total_matches_played = 0)
-- They will use their category's default_elo when they play
UPDATE players p
SET mmr = COALESCE(
  (SELECT (c.default_elo - 2250.0) / 750.0 FROM categories c WHERE c.id = p.category_id),
  (1000 - 2250.0) / 750.0  -- Default if no category: (1000 - 2250) / 750 = -1.67
)
WHERE total_matches_played = 0 AND category_id IS NOT NULL;

-- Add constraint to ensure valid placement_matches_completed range
ALTER TABLE players
ADD CONSTRAINT check_placement_matches_range
CHECK (placement_matches_completed >= 0 AND placement_matches_completed <= 3);

-- Add constraint to ensure non-negative streaks
ALTER TABLE players
ADD CONSTRAINT check_positive_win_streak CHECK (win_streak >= 0);

ALTER TABLE players
ADD CONSTRAINT check_positive_loss_streak CHECK (loss_streak >= 0);

-- Add constraint to ensure uncertainty bounds
ALTER TABLE players
ADD CONSTRAINT check_uncertainty_bounds
CHECK (mmr_uncertainty >= 0.5 AND mmr_uncertainty <= 2.0);
