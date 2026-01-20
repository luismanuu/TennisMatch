-- Add city column to players table for ranking and matchmaking by city
ALTER TABLE players ADD COLUMN IF NOT EXISTS city TEXT;

-- Create index for city to improve query performance for matchmaking
CREATE INDEX IF NOT EXISTS idx_players_city ON players(city);

-- Add comment to explain the purpose
COMMENT ON COLUMN players.city IS 'City where the player is located, used for ranking and matchmaking';
