-- Supabase-specific RLS policies and triggers
-- Run this SQL manually in Supabase SQL Editor after running Prisma migrations
-- These are separated because they require Supabase's auth schema

-- Enable Row Level Security
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for players table
CREATE POLICY "Users can read their own profile"
  ON "players" FOR SELECT
  USING (auth.jwt() ->> 'sub' = clerk_id);

CREATE POLICY "Users can update their own profile"
  ON "players" FOR UPDATE
  USING (auth.jwt() ->> 'sub' = clerk_id);

CREATE POLICY "Users can insert their own profile"
  ON "players" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'sub' = clerk_id);

-- RLS Policies for categories table
CREATE POLICY "Categories are publicly readable"
  ON "categories" FOR SELECT
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
  BEFORE UPDATE ON "categories"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON "players"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed initial categories
INSERT INTO "categories" (name, description, "order") VALUES
  ('Principiante', 'Jugadores que están comenzando en el tenis', 1),
  ('Intermedio', 'Jugadores con experiencia moderada', 2),
  ('Avanzado', 'Jugadores con alto nivel de juego', 3),
  ('Profesional', 'Jugadores de nivel profesional', 4)
ON CONFLICT (name) DO NOTHING;

