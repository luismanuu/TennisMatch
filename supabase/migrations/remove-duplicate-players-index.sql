-- Migration: Remove duplicate index on players table
-- Issue: idx_players_active_status and idx_players_status_deleted are identical
-- Solution: Drop idx_players_active_status, keep idx_players_status_deleted

-- Drop the duplicate index
DROP INDEX IF EXISTS idx_players_active_status;
