-- ============================================
-- ALLOW TOURNAMENT MATCHES WITH SINGLE PLAYER
-- ============================================
-- This migration modifies the matches table to allow progressive bracket creation
-- where next-round matches can be created with only one player initially

-- First, make player1_id nullable for tournament matches
-- We'll do this by dropping the NOT NULL constraint and adding a check constraint
ALTER TABLE matches ALTER COLUMN player1_id DROP NOT NULL;

-- Drop the existing constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_check;

-- Create a new constraint that allows both player1_id and player2_id to be NULL
-- for tournament matches (enabling progressive bracket creation)
ALTER TABLE matches ADD CONSTRAINT matches_check CHECK (
  -- For tournament matches: allow both players to be NULL initially
  -- (at least one must be set eventually, but we allow progressive creation)
  (tournament_id IS NOT NULL AND (
    (player1_id IS NOT NULL OR player2_id IS NOT NULL OR pending_player2_id IS NOT NULL)
  )) OR
  -- For non-tournament matches: require player1_id and either player2_id or pending_player2_id
  (tournament_id IS NULL AND (
    player1_id IS NOT NULL AND (
      (player2_id IS NOT NULL AND pending_player2_id IS NULL) OR
      (player2_id IS NULL AND pending_player2_id IS NOT NULL)
    )
  ))
);

