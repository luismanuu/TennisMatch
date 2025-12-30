-- Update categories to match the new structure
-- Run this in Supabase SQL Editor to update existing categories

-- Delete old categories
DELETE FROM categories WHERE name IN ('Principiante', 'Intermedio', 'Avanzado', 'Profesional');

-- Insert new categories (will skip if already exist due to ON CONFLICT)
INSERT INTO "categories" (name, description, "order") VALUES
  ('1era Categoría', 'NIVEL ELITE', 1),
  ('2da Categoría', 'NIVEL AVANZADO', 2),
  ('3ra Categoría', 'NIVEL MEDIO ALTO', 3),
  ('4ta Categoría', 'NIVEL MEDIO BAJO', 4),
  ('5ta Categoría', 'NIVEL BÁSICO MEDIO', 5),
  ('6ta Categoría', 'NIVEL PRINCIPIANTE ALTO', 6),
  ('7ma Categoría', 'NIVEL PRINCIPIANTE', 7)
ON CONFLICT (name) DO UPDATE 
SET description = EXCLUDED.description, "order" = EXCLUDED."order";

