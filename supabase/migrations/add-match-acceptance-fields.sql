-- ============================================
-- MATCH ACCEPTANCE FUNCTIONALITY - DATABASE MIGRATION
-- ============================================
-- Run this SQL directly in Supabase SQL Editor
-- This migration adds match acceptance functionality

-- Add match acceptance columns to matches table
ALTER TABLE matches 
  ADD COLUMN IF NOT EXISTS match_proposed_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS match_accepted_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS match_rejected_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS acceptance_proposed_scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS acceptance_proposed_location TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_change_approved_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS acceptance_change_rejected_by UUID REFERENCES players(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_match_proposed_by ON matches(match_proposed_by);
CREATE INDEX IF NOT EXISTS idx_matches_match_accepted_by ON matches(match_accepted_by);

-- Add comments
COMMENT ON COLUMN matches.match_proposed_by IS 'Player who proposed/created the match (usually player1)';
COMMENT ON COLUMN matches.match_accepted_by IS 'Player who accepted the match proposal (usually player2)';
COMMENT ON COLUMN matches.match_rejected_by IS 'Player who rejected the match proposal';
COMMENT ON COLUMN matches.acceptance_proposed_scheduled_at IS 'Alternative scheduled_at proposed by player2 when accepting the match';
COMMENT ON COLUMN matches.acceptance_proposed_location IS 'Alternative location proposed by player2 when accepting the match';
COMMENT ON COLUMN matches.acceptance_change_approved_by IS 'Player who approved the acceptance change proposal (usually player1)';
COMMENT ON COLUMN matches.acceptance_change_rejected_by IS 'Player who rejected the acceptance change proposal (usually player1)';
