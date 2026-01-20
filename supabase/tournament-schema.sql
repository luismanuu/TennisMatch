-- ============================================
-- TOURNAMENT MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================
-- Run this SQL directly in Supabase SQL Editor
-- This migration creates all tournament-related tables

-- 1. Tournaments table - Tournament metadata
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT, -- NULL means open to all categories
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  group_size INTEGER NOT NULL DEFAULT 4,
  players_per_group_advance INTEGER NOT NULL DEFAULT 2,
  registration_open BOOLEAN NOT NULL DEFAULT true,
  registration_deadline TIMESTAMP WITH TIME ZONE,
  max_players INTEGER,
  min_players INTEGER NOT NULL DEFAULT 4,
  created_by UUID NOT NULL REFERENCES players(id),
  organizer_id UUID REFERENCES players(id),
  description TEXT,
  rules TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_organizer_created_by CHECK (
    (organizer_id IS NULL) OR (organizer_id = created_by)
  )
);

-- 2. Tournament registrations - Player registrations
CREATE TABLE IF NOT EXISTS tournament_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'withdrawn', 'waitlisted')),
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  check_in_status TEXT CHECK (check_in_status IN ('checked_in', 'not_checked_in')),
  check_in_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(tournament_id, player_id)
);

-- 3. Tournament groups - Group assignments
CREATE TABLE IF NOT EXISTS tournament_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  group_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, group_number)
);

-- 4. Tournament group players - Players in each group
CREATE TABLE IF NOT EXISTS tournament_group_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seed_position INTEGER,
  UNIQUE(tournament_id, group_id, player_id)
);

-- 5. Tournament matches - Tournament-specific match tracking
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  bracket_type TEXT NOT NULL CHECK (bracket_type IN ('group', 'main', 'backdraw')),
  round_number INTEGER,
  group_id UUID REFERENCES tournament_groups(id) ON DELETE CASCADE,
  bracket_position TEXT,
  is_bye BOOLEAN NOT NULL DEFAULT false,
  round_deadline TIMESTAMP WITH TIME ZONE,
  UNIQUE(tournament_id, match_id)
);

-- 6. Tournament rounds - Round configuration and deadlines
CREATE TABLE IF NOT EXISTS tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_name TEXT NOT NULL,
  bracket_type TEXT NOT NULL CHECK (bracket_type IN ('group', 'main', 'backdraw')),
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, bracket_type, round_number)
);

-- 7. Tournament standings - Group stage standings (calculated/denormalized)
CREATE TABLE IF NOT EXISTS tournament_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  sets_won INTEGER NOT NULL DEFAULT 0,
  sets_lost INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_lost INTEGER NOT NULL DEFAULT 0,
  head_to_head_wins INTEGER NOT NULL DEFAULT 0,
  final_position INTEGER,
  qualified BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, group_id, player_id)
);

-- Add tournament_id to matches table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'tournament_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tournaments_category_id ON tournaments(category_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer_id ON tournaments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_date ON tournaments(start_date);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_tournament_id ON tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_player_id ON tournament_registrations(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_registrations_status ON tournament_registrations(status);
CREATE INDEX IF NOT EXISTS idx_tournament_groups_tournament_id ON tournament_groups(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_group_players_tournament_id ON tournament_group_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_group_players_group_id ON tournament_group_players(group_id);
CREATE INDEX IF NOT EXISTS idx_tournament_group_players_player_id ON tournament_group_players(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_match_id ON tournament_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket_type ON tournament_matches(bracket_type);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_group_id ON tournament_matches(group_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tournament_id ON tournament_rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_bracket_type ON tournament_rounds(bracket_type);
CREATE INDEX IF NOT EXISTS idx_tournament_standings_tournament_id ON tournament_standings(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_standings_group_id ON tournament_standings(group_id);
CREATE INDEX IF NOT EXISTS idx_tournament_standings_player_id ON tournament_standings(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id) WHERE tournament_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_group_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_standings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tournaments table
-- Tournaments are publicly readable
CREATE POLICY "Tournaments are publicly readable"
  ON tournaments FOR SELECT
  USING (true);

-- Only admins and organizers can create tournaments
CREATE POLICY "Admins and organizers can create tournaments"
  ON tournaments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = tournaments.created_by
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Only admins and tournament creators can update tournaments
CREATE POLICY "Admins and tournament creators can update tournaments"
  ON tournaments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Only admins and tournament creators can delete tournaments
CREATE POLICY "Admins and tournament creators can delete tournaments"
  ON tournaments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- RLS Policies for tournament_registrations
-- Tournament registrations are publicly readable (for tournament pages)
CREATE POLICY "Tournament registrations are publicly readable"
  ON tournament_registrations FOR SELECT
  USING (true);

-- Players can register themselves, or admins/organizers can register any player
CREATE POLICY "Players and organizers can register for tournaments"
  ON tournament_registrations FOR INSERT
  WITH CHECK (
    -- Players can register themselves
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = tournament_registrations.player_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
    OR
    -- Admins and organizers can register any player
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_registrations.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can update registrations
CREATE POLICY "Admins and organizers can update registrations"
  ON tournament_registrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_registrations.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can delete registrations
CREATE POLICY "Admins and organizers can delete registrations"
  ON tournament_registrations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_registrations.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- RLS Policies for tournament_groups (publicly readable, admin/organizer writable)
CREATE POLICY "Tournament groups are publicly readable"
  ON tournament_groups FOR SELECT
  USING (true);

-- Admins and organizers can insert tournament groups
CREATE POLICY "Admins and organizers can insert tournament groups"
  ON tournament_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_groups.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can update tournament groups
CREATE POLICY "Admins and organizers can update tournament groups"
  ON tournament_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_groups.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can delete tournament groups
CREATE POLICY "Admins and organizers can delete tournament groups"
  ON tournament_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_groups.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- RLS Policies for tournament_group_players (publicly readable, admin/organizer writable)
CREATE POLICY "Tournament group players are publicly readable"
  ON tournament_group_players FOR SELECT
  USING (true);

-- Admins and organizers can insert tournament group players
CREATE POLICY "Admins and organizers can insert tournament group players"
  ON tournament_group_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_group_players.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can update tournament group players
CREATE POLICY "Admins and organizers can update tournament group players"
  ON tournament_group_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_group_players.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can delete tournament group players
CREATE POLICY "Admins and organizers can delete tournament group players"
  ON tournament_group_players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_group_players.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- RLS Policies for tournament_matches (publicly readable, admin/organizer writable)
CREATE POLICY "Tournament matches are publicly readable"
  ON tournament_matches FOR SELECT
  USING (true);

-- Admins and organizers can insert tournament matches
CREATE POLICY "Admins and organizers can insert tournament matches"
  ON tournament_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_matches.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can update tournament matches
CREATE POLICY "Admins and organizers can update tournament matches"
  ON tournament_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_matches.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can delete tournament matches
CREATE POLICY "Admins and organizers can delete tournament matches"
  ON tournament_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_matches.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- RLS Policies for tournament_rounds (publicly readable, admin/organizer writable)
CREATE POLICY "Tournament rounds are publicly readable"
  ON tournament_rounds FOR SELECT
  USING (true);

-- Admins and organizers can insert tournament rounds
CREATE POLICY "Admins and organizers can insert tournament rounds"
  ON tournament_rounds FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_rounds.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can update tournament rounds
CREATE POLICY "Admins and organizers can update tournament rounds"
  ON tournament_rounds FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_rounds.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can delete tournament rounds
CREATE POLICY "Admins and organizers can delete tournament rounds"
  ON tournament_rounds FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_rounds.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- RLS Policies for tournament_standings (publicly readable, admin/organizer writable)
CREATE POLICY "Tournament standings are publicly readable"
  ON tournament_standings FOR SELECT
  USING (true);

-- Admins and organizers can insert tournament standings
CREATE POLICY "Admins and organizers can insert tournament standings"
  ON tournament_standings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_standings.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can update tournament standings
CREATE POLICY "Admins and organizers can update tournament standings"
  ON tournament_standings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_standings.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Admins and organizers can delete tournament standings
CREATE POLICY "Admins and organizers can delete tournament standings"
  ON tournament_standings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments
      JOIN players ON (
        players.id = tournaments.created_by
        OR players.id = tournaments.organizer_id
      )
      WHERE tournaments.id = tournament_standings.tournament_id
      AND players.clerk_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Add triggers to automatically update updated_at
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_rounds_updated_at
  BEFORE UPDATE ON tournament_rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_standings_updated_at
  BEFORE UPDATE ON tournament_standings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

