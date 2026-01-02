-- ============================================
-- SOFT DELETE MIGRATION FOR PLAYERS
-- ============================================
-- Run this SQL directly in Supabase SQL Editor
-- This migration adds soft delete functionality to preserve historical match data

-- Add soft delete columns to players table
ALTER TABLE players 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'deleted')),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);
CREATE INDEX IF NOT EXISTS idx_players_deleted_at ON players(deleted_at);

-- Update existing players to be active (in case of NULL values)
UPDATE players SET status = 'active' WHERE status IS NULL;

