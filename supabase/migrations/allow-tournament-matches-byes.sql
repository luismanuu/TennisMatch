-- ============================================
-- ALLOW TOURNAMENT MATCHES FOR BYES
-- ============================================
-- This migration modifies tournament_matches to support bye matches
-- where match_id can be NULL and we store the player_id directly

-- Drop the existing unique constraint on (tournament_id, match_id)
-- because we need to allow multiple NULL match_ids for byes
ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_tournament_id_match_id_key;

-- Make match_id nullable for bye matches
ALTER TABLE tournament_matches ALTER COLUMN match_id DROP NOT NULL;

-- Add player_id column for bye matches (stores the player who gets the bye)
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE CASCADE;

-- Add a check constraint to ensure that for byes, player_id is set, and for non-byes, match_id is set
ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_bye_check;
ALTER TABLE tournament_matches ADD CONSTRAINT tournament_matches_bye_check CHECK (
  (is_bye = false AND match_id IS NOT NULL) OR
  (is_bye = true AND player_id IS NOT NULL)
);

-- Create a new unique constraint that handles NULL match_ids properly
-- For non-byes: (tournament_id, match_id) must be unique
-- For byes: (tournament_id, round_number, bracket_position) must be unique (since match_id is NULL)
-- We'll use a partial unique index for non-byes
CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_tournament_match_unique 
  ON tournament_matches(tournament_id, match_id) 
  WHERE match_id IS NOT NULL;

-- For byes, ensure uniqueness by (tournament_id, bracket_type, round_number, bracket_position)
CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_bye_unique 
  ON tournament_matches(tournament_id, bracket_type, round_number, bracket_position) 
  WHERE is_bye = true;

