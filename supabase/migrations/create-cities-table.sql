-- ============================================
-- Migración: Crear tabla cities y agregar city_id a players
-- Fecha: 2024
-- Descripción: Crea tabla de ciudades y actualiza players para usar city_id
-- ============================================

-- Paso 1: Crear tabla cities
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Paso 2: Crear índice para ordenamiento
CREATE INDEX IF NOT EXISTS idx_cities_order ON cities("order");

-- Paso 3: Insertar ciudades iniciales
INSERT INTO cities (name, "order") VALUES
  ('Guayaquil', 1),
  ('Samborondón', 2),
  ('Daule', 3)
ON CONFLICT (name) DO NOTHING;

-- Paso 4: Agregar columna city_id a players (si no existe)
ALTER TABLE players ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

-- Paso 5: Crear índice para city_id
CREATE INDEX IF NOT EXISTS idx_players_city_id ON players(city_id);

-- Paso 6: Habilitar Row Level Security (RLS)
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Paso 7: Crear política RLS para lectura pública de ciudades
-- Las ciudades son datos públicos que todos pueden leer
CREATE POLICY "Cities are publicly readable"
  ON cities FOR SELECT
  USING (true);

-- Paso 8: Agregar comentarios descriptivos
COMMENT ON TABLE cities IS 'Cities available for player registration and matchmaking';
COMMENT ON COLUMN players.city_id IS 'Reference to the city where the player is located';

-- Nota: Si ya existe una columna 'city' (TEXT) en players, puedes migrar los datos con:
-- UPDATE players p
-- SET city_id = c.id
-- FROM cities c
-- WHERE p.city = c.name AND p.city_id IS NULL;
