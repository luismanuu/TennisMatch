-- ============================================
-- OPTIMIZE NOTIFICATIONS QUERY PERFORMANCE
-- ============================================
-- Add composite index for the common query pattern:
-- WHERE player_id = X AND is_dismissed = false ORDER BY created_at DESC

-- Drop existing index if it exists (we'll replace it with a better one)
DROP INDEX IF EXISTS idx_notifications_player_unread;

-- Create optimized composite index for the pending notifications query
-- This index covers: player_id, is_dismissed filter, and created_at ordering
CREATE INDEX IF NOT EXISTS idx_notifications_player_pending 
  ON notifications(player_id, created_at DESC) 
  WHERE NOT is_dismissed;

-- Add comment
COMMENT ON INDEX idx_notifications_player_pending IS 
  'Optimized index for querying pending (non-dismissed) notifications by player, ordered by created_at DESC';
