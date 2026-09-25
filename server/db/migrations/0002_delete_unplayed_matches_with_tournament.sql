-- matches.tournament_id is ON DELETE SET NULL so completed matches (and their rating history) survive a
-- tournament delete. Unplayed bracket matches may have one participant, which only the tournament branch of
-- matches_participants_check allows, so nulling their tournament_id would abort the delete. They belong to
-- the tournament and go with it.
CREATE OR REPLACE FUNCTION delete_unplayed_tournament_matches()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.matches WHERE tournament_id = OLD.id AND status <> 'completed';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER delete_unplayed_matches_before_tournament_delete
BEFORE DELETE ON "tournaments" FOR EACH ROW EXECUTE FUNCTION delete_unplayed_tournament_matches();
