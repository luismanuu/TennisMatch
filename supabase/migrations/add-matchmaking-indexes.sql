-- Migration: Add indexes for matchmaking algorithm optimization
-- Purpose: Optimize the monthly match counting query pattern

-- Partial index for completed matches with date ordering
-- This speeds up queries filtering by status='completed' with date ranges
CREATE INDEX IF NOT EXISTS idx_matches_completed_played_at 
ON matches(played_at DESC) 
WHERE status = 'completed';

-- Composite index for counting matches between specific players
-- Covers the pattern: WHERE player1_id = X AND player2_id = Y AND status = 'completed' AND played_at BETWEEN A AND B
CREATE INDEX IF NOT EXISTS idx_matches_player1_player2_status_date 
ON matches(player1_id, player2_id, status, played_at);

-- Reverse composite index for the opposite player direction
-- Covers: WHERE player1_id = Y AND player2_id = X (when checking from opponent's perspective)
CREATE INDEX IF NOT EXISTS idx_matches_player2_player1_status_date 
ON matches(player2_id, player1_id, status, played_at);

-- Index for filtering active players in matchmaking
-- Covers: WHERE status = 'active' AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_players_active_status 
ON players(status, deleted_at) 
WHERE status = 'active' AND deleted_at IS NULL;

-- Composite index for matchmaking player lookup with ELO range
-- Covers: WHERE city_id IN (...) AND status = 'active' AND elo BETWEEN X AND Y
CREATE INDEX IF NOT EXISTS idx_players_city_status_elo 
ON players(city_id, status, elo) 
WHERE status = 'active' AND deleted_at IS NULL;
