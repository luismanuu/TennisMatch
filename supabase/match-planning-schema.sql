-- ============================================
-- MATCH PLANNING SYSTEM - DATABASE MIGRATION
-- ============================================
-- Run this SQL directly in Supabase SQL Editor
-- This migration updates the matches table for match planning

-- Add new columns to matches table
ALTER TABLE matches 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS score_proposed_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS score_proposed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS score_approved_by UUID REFERENCES players(id);

-- Make existing columns nullable where needed
ALTER TABLE matches 
  ALTER COLUMN score DROP NOT NULL,
  ALTER COLUMN played_at DROP NOT NULL,
  ALTER COLUMN winner_id DROP NOT NULL;

-- Migrate existing data: set scheduled_at from played_at for existing matches
UPDATE matches 
SET scheduled_at = played_at 
WHERE scheduled_at IS NULL AND played_at IS NOT NULL;

-- Set status for existing matches (assume they are completed)
UPDATE matches 
SET status = 'completed' 
WHERE status = 'scheduled' AND played_at IS NOT NULL AND score IS NOT NULL;

-- Create match_messages table for chat
CREATE TABLE IF NOT EXISTS match_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_at ON matches(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_score_proposed_by ON matches(score_proposed_by);
CREATE INDEX IF NOT EXISTS idx_match_messages_match_id ON match_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_match_messages_player_id ON match_messages(player_id);
CREATE INDEX IF NOT EXISTS idx_match_messages_created_at ON match_messages(created_at ASC);

-- Enable Row Level Security for match_messages
ALTER TABLE match_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for match_messages table
-- Players can read messages for matches they're involved in
CREATE POLICY "Players can read messages for their matches"
  ON match_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_messages.match_id
      AND (
        matches.player1_id = (SELECT id FROM players WHERE clerk_id = ((SELECT auth.jwt()) ->> 'sub'))
        OR matches.player2_id = (SELECT id FROM players WHERE clerk_id = ((SELECT auth.jwt()) ->> 'sub'))
        OR EXISTS (
          SELECT 1 FROM pending_players
          WHERE pending_players.id = matches.pending_player2_id
          AND pending_players.invited_by_player_id = (SELECT id FROM players WHERE clerk_id = ((SELECT auth.jwt()) ->> 'sub'))
        )
      )
    )
  );

-- Players can create messages for matches they're involved in
CREATE POLICY "Players can create messages for their matches"
  ON match_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_messages.match_id
      AND (
        matches.player1_id = (SELECT id FROM players WHERE clerk_id = ((SELECT auth.jwt()) ->> 'sub'))
        OR matches.player2_id = (SELECT id FROM players WHERE clerk_id = ((SELECT auth.jwt()) ->> 'sub'))
        OR EXISTS (
          SELECT 1 FROM pending_players
          WHERE pending_players.id = matches.pending_player2_id
          AND pending_players.invited_by_player_id = (SELECT id FROM players WHERE clerk_id = ((SELECT auth.jwt()) ->> 'sub'))
        )
      )
    )
    AND match_messages.player_id = (SELECT id FROM players WHERE clerk_id = ((SELECT auth.jwt()) ->> 'sub'))
  );

-- Update RLS policy for matches to allow both players to update
-- (not just player1)
DROP POLICY IF EXISTS "Users can update matches they created" ON matches;

CREATE POLICY "Users can update matches they are part of"
  ON matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE (
        players.id = matches.player1_id
        OR players.id = matches.player2_id
      )
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Add trigger to automatically update updated_at for match_messages
CREATE TRIGGER update_match_messages_updated_at
  BEFORE UPDATE ON match_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

