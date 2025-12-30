-- Categories table for dynamic category management
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table linked to Clerk users
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  elo INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_players_clerk_id ON players(clerk_id);
CREATE INDEX IF NOT EXISTS idx_players_category_id ON players(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories("order");

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for players table
-- Users can read their own profile
CREATE POLICY "Users can read their own profile"
  ON players FOR SELECT
  USING (auth.jwt() ->> 'sub' = clerk_id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON players FOR UPDATE
  USING (auth.jwt() ->> 'sub' = clerk_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON players FOR INSERT
  WITH CHECK (auth.jwt() ->> 'sub' = clerk_id);

-- RLS Policies for categories table
-- Categories are publicly readable
CREATE POLICY "Categories are publicly readable"
  ON categories FOR SELECT
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed initial categories
INSERT INTO categories (name, description, "order") VALUES
  ('Principiante', 'Jugadores que están comenzando en el tenis', 1),
  ('Intermedio', 'Jugadores con experiencia moderada', 2),
  ('Avanzado', 'Jugadores con alto nivel de juego', 3),
  ('Profesional', 'Jugadores de nivel profesional', 4)
ON CONFLICT (name) DO NOTHING;

