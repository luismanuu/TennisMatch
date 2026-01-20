-- ============================================
-- CREATE CITY SEGMENTS TABLE
-- ============================================
-- City segments group nearby cities for matchmaking
-- A city can belong to multiple segments

-- Create city_segments table
CREATE TABLE IF NOT EXISTS city_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE city_segments IS 'Groups of nearby cities for matchmaking';
COMMENT ON COLUMN city_segments.name IS 'Name of the city segment (e.g., "Guayaquil Metropolitan Area")';
COMMENT ON COLUMN city_segments.description IS 'Optional description of the segment';

-- Create city_segment_cities junction table
CREATE TABLE IF NOT EXISTS city_segment_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_segment_id UUID NOT NULL REFERENCES city_segments(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(city_segment_id, city_id)
);

-- Add comments
COMMENT ON TABLE city_segment_cities IS 'Junction table linking cities to segments';
COMMENT ON COLUMN city_segment_cities.city_segment_id IS 'Reference to city segment';
COMMENT ON COLUMN city_segment_cities.city_id IS 'Reference to city';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_city_segment_cities_city ON city_segment_cities(city_id);
CREATE INDEX IF NOT EXISTS idx_city_segment_cities_segment ON city_segment_cities(city_segment_id);

-- Enable RLS
ALTER TABLE city_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_segment_cities ENABLE ROW LEVEL SECURITY;

-- City segments are publicly readable (for matchmaking)
CREATE POLICY "City segments are publicly readable"
  ON city_segments FOR SELECT
  USING (true);

-- City segment cities are publicly readable
CREATE POLICY "City segment cities are publicly readable"
  ON city_segment_cities FOR SELECT
  USING (true);

-- Triggers to automatically update updated_at
CREATE TRIGGER update_city_segments_updated_at
  BEFORE UPDATE ON city_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed initial city segment for Guayaquil Metropolitan Area
INSERT INTO city_segments (name, description)
VALUES ('Área Metropolitana de Guayaquil', 'Includes Guayaquil, Samborondón, and Daule')
ON CONFLICT (name) DO NOTHING;

-- Add all existing cities to the default segment
INSERT INTO city_segment_cities (city_segment_id, city_id)
SELECT 
  (SELECT id FROM city_segments WHERE name = 'Área Metropolitana de Guayaquil'),
  id
FROM cities
ON CONFLICT (city_segment_id, city_id) DO NOTHING;
