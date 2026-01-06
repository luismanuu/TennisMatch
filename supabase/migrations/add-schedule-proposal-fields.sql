-- ============================================
-- SCHEDULE PROPOSAL FUNCTIONALITY - DATABASE MIGRATION
-- ============================================
-- Run this SQL directly in Supabase SQL Editor
-- This migration adds schedule proposal functionality for initial scheduling

-- Add schedule proposal columns to matches table
ALTER TABLE matches 
  ADD COLUMN IF NOT EXISTS schedule_proposed_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS schedule_proposed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS schedule_proposed_scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS schedule_approved_by UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS schedule_rejected_by UUID REFERENCES players(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_schedule_proposed_by ON matches(schedule_proposed_by);
CREATE INDEX IF NOT EXISTS idx_matches_schedule_approved_by ON matches(schedule_approved_by);

