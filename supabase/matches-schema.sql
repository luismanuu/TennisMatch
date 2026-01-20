-- Pending players table for non-registered opponents
CREATE TABLE IF NOT EXISTS pending_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES categories(id),
  invited_by_player_id UUID NOT NULL REFERENCES players(id),
  clerk_invitation_id TEXT,
  invitation_token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES players(id),
  player2_id UUID REFERENCES players(id),
  pending_player2_id UUID REFERENCES pending_players(id),
  winner_id UUID REFERENCES players(id),
  score TEXT NOT NULL,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure either player2_id or pending_player2_id is set, but not both
  CHECK (
    (player2_id IS NOT NULL AND pending_player2_id IS NULL) OR
    (player2_id IS NULL AND pending_player2_id IS NOT NULL)
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_players_email ON pending_players(email);
CREATE INDEX IF NOT EXISTS idx_pending_players_invited_by ON pending_players(invited_by_player_id);
CREATE INDEX IF NOT EXISTS idx_pending_players_status ON pending_players(status);
CREATE INDEX IF NOT EXISTS idx_pending_players_token ON pending_players(invitation_token);
CREATE INDEX IF NOT EXISTS idx_matches_player1 ON matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2 ON matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_pending_player2 ON matches(pending_player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at DESC);

-- Enable Row Level Security
ALTER TABLE pending_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pending_players table
-- Users can read pending players they invited
CREATE POLICY "Users can read pending players they invited"
  ON pending_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = pending_players.invited_by_player_id
      AND players.clerk_id = (auth.jwt() ->> 'sub')
    )
  );

-- Users can create pending players (authenticated users)
CREATE POLICY "Authenticated users can create pending players"
  ON pending_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = pending_players.invited_by_player_id
      AND players.clerk_id = (auth.jwt() ->> 'sub')
    )
  );

-- Users can update pending players they invited
CREATE POLICY "Users can update pending players they invited"
  ON pending_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = pending_players.invited_by_player_id
      AND players.clerk_id = (auth.jwt() ->> 'sub')
    )
  );

-- RLS Policies for matches table
-- Matches are publicly readable
CREATE POLICY "Matches are publicly readable"
  ON matches FOR SELECT
  USING (true);

-- Authenticated users can create matches
CREATE POLICY "Authenticated users can create matches"
  ON matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = matches.player1_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Users can update matches they are part of (player1 or player2)
CREATE POLICY "Users can update matches they are part of"
  ON matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE (
        players.id = matches.player1_id
        OR players.id = matches.player2_id
      )
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Triggers to automatically update updated_at
CREATE TRIGGER update_pending_players_updated_at
  BEFORE UPDATE ON pending_players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

