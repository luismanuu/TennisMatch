-- ============================================
-- TOURNAMENT POINTS SYSTEM - DATABASE MIGRATION
-- ============================================
-- Run this SQL directly in Supabase SQL Editor
-- This migration adds points configuration and standings tracking

-- 1. Add points_config to tournaments table
ALTER TABLE tournaments 
  ADD COLUMN IF NOT EXISTS points_config JSONB;

-- 2. Add points and game_difference to tournament_standings table
ALTER TABLE tournament_standings
  ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS game_difference INTEGER NOT NULL DEFAULT 0;

-- 3. Create index for points_config queries (optional, but helpful)
CREATE INDEX IF NOT EXISTS idx_tournaments_points_config ON tournaments USING GIN (points_config);

-- 4. Create index for standings queries by points
CREATE INDEX IF NOT EXISTS idx_tournament_standings_points ON tournament_standings(points DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_standings_game_difference ON tournament_standings(game_difference DESC);

-- 5. Backfill default points_config for existing tournaments
-- Set default values: { "group_stage": 3, "playoffs": 5 }
UPDATE tournaments
SET points_config = '{"group_stage": 3, "playoffs": 5}'::jsonb
WHERE points_config IS NULL;

-- 6. Backfill points and game_difference for existing standings
-- This will be calculated based on completed matches
-- For now, set initial values (will be recalculated by backfill script)
-- Points will be calculated from completed matches
-- Game difference = games_won - games_lost
UPDATE tournament_standings
SET game_difference = games_won - games_lost
WHERE game_difference = 0 AND (games_won > 0 OR games_lost > 0);

-- Note: Points will be backfilled by a separate script that processes completed matches
-- The backfill script will:
-- 1. Get all completed matches for each tournament
-- 2. Calculate points based on bracket_type and round_number
-- 3. Update tournament_standings with calculated points

