-- ============================================
-- RESCHEDULE FUNCTIONALITY - DATABASE MIGRATION
-- ============================================
-- Run this SQL directly in Supabase SQL Editor
-- This migration adds reschedule functionality to matches

-- Add reschedule columns to matches table
ALTER TABLE matches 
  ADD COLUMN IF NOT EXISTS reschedule_proposed_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS reschedule_proposed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reschedule_proposed_scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reschedule_approved_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS reschedule_rejected_by UUID REFERENCES players(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_reschedule_proposed_by ON matches(reschedule_proposed_by);
CREATE INDEX IF NOT EXISTS idx_matches_reschedule_approved_by ON matches(reschedule_approved_by);

