-- updated_at triggers (ported from supabase/*.sql) and reference seed data.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_categories_updated_at BEFORE UPDATE ON "categories" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_cities_updated_at BEFORE UPDATE ON "cities" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_city_segments_updated_at BEFORE UPDATE ON "city_segments" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_players_updated_at BEFORE UPDATE ON "players" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_pending_players_updated_at BEFORE UPDATE ON "pending_players" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON "tournaments" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_tournament_rounds_updated_at BEFORE UPDATE ON "tournament_rounds" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_tournament_standings_updated_at BEFORE UPDATE ON "tournament_standings" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER update_matches_updated_at BEFORE UPDATE ON "matches" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
INSERT INTO "categories" ("name", "description", "order", "default_elo") VALUES
  ('1era Categoría', 'NIVEL ELITE', 1, 2500),
  ('2da Categoría', 'NIVEL AVANZADO', 2, 2250),
  ('3ra Categoría', 'NIVEL MEDIO ALTO', 3, 2000),
  ('4ta Categoría', 'NIVEL MEDIO BAJO', 4, 1750),
  ('5ta Categoría', 'NIVEL BÁSICO MEDIO', 5, 1500),
  ('6ta Categoría', 'NIVEL PRINCIPIANTE ALTO', 6, 1250),
  ('7ma Categoría', 'NIVEL PRINCIPIANTE', 7, 1000)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "cities" ("name", "order") VALUES ('Guayaquil', 1), ('Samborondón', 2), ('Daule', 3)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "city_segments" ("name", "description")
VALUES ('Área Metropolitana de Guayaquil', 'Incluye Guayaquil, Samborondón y Daule')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "city_segment_cities" ("city_segment_id", "city_id")
SELECT s."id", c."id" FROM "city_segments" s CROSS JOIN "cities" c
WHERE s."name" = 'Área Metropolitana de Guayaquil'
ON CONFLICT ("city_segment_id", "city_id") DO NOTHING;
