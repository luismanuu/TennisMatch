-- Complete database setup for Tennis Match Platform
-- Run this in Supabase SQL Editor

-- Create tables
CREATE TABLE IF NOT EXISTS "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerk_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" UUID,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- Create indexes (IF NOT EXISTS is supported for indexes)
CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "players_clerk_id_key" ON "players"("clerk_id");
CREATE INDEX IF NOT EXISTS "idx_players_clerk_id" ON "players"("clerk_id");
CREATE INDEX IF NOT EXISTS "idx_players_category_id" ON "players"("category_id");
CREATE INDEX IF NOT EXISTS "idx_categories_order" ON "categories"("order");

-- Add foreign key (drop first if exists, then add)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'players_category_id_fkey'
    ) THEN
        ALTER TABLE "players" 
        ADD CONSTRAINT "players_category_id_fkey" 
        FOREIGN KEY ("category_id") 
        REFERENCES "categories"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create them
DROP POLICY IF EXISTS "Users can read their own profile" ON "players";
DROP POLICY IF EXISTS "Users can update their own profile" ON "players";
DROP POLICY IF EXISTS "Users can insert their own profile" ON "players";
DROP POLICY IF EXISTS "Categories are publicly readable" ON "categories";

CREATE POLICY "Users can read their own profile"
  ON "players" FOR SELECT
  USING (auth.jwt() ->> 'sub' = clerk_id);

CREATE POLICY "Users can update their own profile"
  ON "players" FOR UPDATE
  USING (auth.jwt() ->> 'sub' = clerk_id);

CREATE POLICY "Users can insert their own profile"
  ON "players" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'sub' = clerk_id);

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

-- Drop existing triggers if they exist, then create them
DROP TRIGGER IF EXISTS update_categories_updated_at ON "categories";
DROP TRIGGER IF EXISTS update_players_updated_at ON "players";

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

