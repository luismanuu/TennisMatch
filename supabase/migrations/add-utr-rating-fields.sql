-- ============================================
-- UTR RATING SYSTEM - DATABASE MIGRATION
-- ============================================
-- Add UTR-related fields to support UTR rating calculations
-- and LLM-based ELO calculation tracking

-- Add UTR fields to rating_history table
ALTER TABLE rating_history
  ADD COLUMN IF NOT EXISTS match_rating DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS match_weight DECIMAL(4, 3),
  ADD COLUMN IF NOT EXISTS games_won INT,
  ADD COLUMN IF NOT EXISTS games_lost INT,
  ADD COLUMN IF NOT EXISTS total_games INT;

-- Add UTR fields to players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS utr_rating DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS utr_reliability DECIMAL(4, 3);

-- Add LLM calculation tracking fields to matches table
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS llm_elo_calculated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS llm_calculation_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS llm_calculation_model TEXT,
  ADD COLUMN IF NOT EXISTS llm_calculation_timestamp TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS llm_calculation_failed BOOLEAN DEFAULT false;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rating_history_match_rating ON rating_history(match_rating);
CREATE INDEX IF NOT EXISTS idx_rating_history_match_weight ON rating_history(match_weight);
CREATE INDEX IF NOT EXISTS idx_players_utr_rating ON players(utr_rating);
CREATE INDEX IF NOT EXISTS idx_matches_llm_calculated ON matches(llm_elo_calculated);

-- Add comments for documentation
COMMENT ON COLUMN rating_history.match_rating IS 'Match rating for UTR calculation (calculated per player, not symmetric)';
COMMENT ON COLUMN rating_history.match_weight IS 'Match weight = Format Weight × Competitiveness Weight × Reliability Weight';
COMMENT ON COLUMN rating_history.games_won IS 'Number of games won by the player in this match';
COMMENT ON COLUMN rating_history.games_lost IS 'Number of games lost by the player in this match';
COMMENT ON COLUMN rating_history.total_games IS 'Total games played in the match';
COMMENT ON COLUMN players.utr_rating IS 'UTR rating: weighted average of up to 30 most recent match ratings within 12 months';
COMMENT ON COLUMN players.utr_reliability IS 'Reliability factor based on match count and recency (0.3 to 1.0)';
COMMENT ON COLUMN matches.llm_elo_calculated IS 'Whether ELO changes were calculated using LLM';
COMMENT ON COLUMN matches.llm_calculation_reasoning IS 'LLM reasoning for the ELO calculation';
COMMENT ON COLUMN matches.llm_calculation_model IS 'LLM model used for calculation (e.g., gpt-4o-mini)';
COMMENT ON COLUMN matches.llm_calculation_timestamp IS 'When LLM calculation occurred';
COMMENT ON COLUMN matches.llm_calculation_failed IS 'Whether LLM calculation failed and fallback was used';
