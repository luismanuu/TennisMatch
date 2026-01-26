-- Add previous_rank field to players table for rank change tracking
-- This allows us to show rank change indicators (↑↓) in the leaderboard

ALTER TABLE players
ADD COLUMN IF NOT EXISTS previous_rank INTEGER;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_players_previous_rank ON players(previous_rank) WHERE previous_rank IS NOT NULL;

-- Add comment
COMMENT ON COLUMN players.previous_rank IS 'Stores the player''s rank from the previous leaderboard calculation. Used to show rank change indicators (↑↓). Updated periodically when rankings are recalculated.';
