-- ============================================
-- PERFORMANCE INDEXES - DATABASE OPTIMIZATION
-- ============================================
-- Run this SQL directly in Supabase SQL Editor
-- These indexes optimize common query patterns identified in performance analysis

-- Composite index for matches player OR queries
-- Optimizes: WHERE player1_id = X OR player2_id = X
CREATE INDEX IF NOT EXISTS idx_matches_players_composite 
ON matches(player1_id, player2_id);

-- Status + scheduled_at composite index for filtered sorting
-- Optimizes: WHERE status = X ORDER BY scheduled_at DESC
CREATE INDEX IF NOT EXISTS idx_matches_status_scheduled 
ON matches(status, scheduled_at DESC NULLS LAST);

-- Match messages composite index for efficient message queries
-- Optimizes: WHERE match_id = X ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_match_messages_match_created 
ON match_messages(match_id, created_at);

-- Players status + deleted_at partial index for active player queries
-- Optimizes: WHERE status = 'active' AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_players_status_deleted 
ON players(status, deleted_at) 
WHERE status = 'active' AND deleted_at IS NULL;

-- Additional indexes for optional foreign key lookups
-- Optimizes queries for score/reschedule related player lookups
CREATE INDEX IF NOT EXISTS idx_matches_score_proposed_by 
ON matches(score_proposed_by) 
WHERE score_proposed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_score_approved_by 
ON matches(score_approved_by) 
WHERE score_approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_reschedule_proposed_by 
ON matches(reschedule_proposed_by) 
WHERE reschedule_proposed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_reschedule_approved_by 
ON matches(reschedule_approved_by) 
WHERE reschedule_approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_reschedule_rejected_by 
ON matches(reschedule_rejected_by) 
WHERE reschedule_rejected_by IS NOT NULL;

-- Index for pending_players invited_by lookups
-- Optimizes filtering matches by pending_player2.invited_by_player_id
CREATE INDEX IF NOT EXISTS idx_pending_players_invited_by_composite 
ON pending_players(invited_by_player_id, status);




