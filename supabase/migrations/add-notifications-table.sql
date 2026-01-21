-- ============================================
-- NOTIFICATIONS TABLE - DATABASE MIGRATION
-- ============================================
-- Persistent notification tracking for match proposals and actions
-- Run this SQL directly in Supabase SQL Editor

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'match_proposal',      -- Match proposed, needs acceptance
    'match_created',       -- Match confirmed/created (e.g., tournament)
    'score_proposal',      -- Score proposed, needs approval
    'schedule_proposal',   -- Schedule proposed, needs approval
    'reschedule_proposal', -- Reschedule requested
    'acceptance_change'    -- Acceptance with schedule change
  )),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata for notification display (JSON for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_player_id ON notifications(player_id);
CREATE INDEX IF NOT EXISTS idx_notifications_player_unread ON notifications(player_id) WHERE NOT is_read AND NOT is_dismissed;
CREATE INDEX IF NOT EXISTS idx_notifications_match_id ON notifications(match_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Prevent duplicate notifications (unique per player, type, match when not dismissed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique ON notifications(player_id, type, match_id) 
  WHERE NOT is_dismissed;

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Players can only see their own notifications
CREATE POLICY "Players can view own notifications"
  ON notifications FOR SELECT
  USING (player_id IN (
    SELECT id FROM players WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

-- Players can update their own notifications (mark as read/dismissed)
CREATE POLICY "Players can update own notifications"
  ON notifications FOR UPDATE
  USING (player_id IN (
    SELECT id FROM players WHERE clerk_id = auth.jwt() ->> 'sub'
  ));

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'Stores persistent notification state for match proposals and actions';
COMMENT ON COLUMN notifications.type IS 'Type of notification: match_proposal, match_created, score_proposal, schedule_proposal, reschedule_proposal, acceptance_change';
COMMENT ON COLUMN notifications.metadata IS 'Additional context like player names, scores, timestamps';
COMMENT ON COLUMN notifications.is_read IS 'Whether notification has been viewed by player';
COMMENT ON COLUMN notifications.is_dismissed IS 'Whether notification has been permanently dismissed';
