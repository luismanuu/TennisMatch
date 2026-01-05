-- Migration: Fix current_phase for existing tournaments
-- This script updates tournaments that were created before the phase system was added
-- It sets the correct phase based on tournament status and whether brackets have been generated

DO $$
DECLARE
  v_tournament_record RECORD;
  v_has_groups BOOLEAN;
  v_has_playoff_matches BOOLEAN;
  v_all_group_matches_complete BOOLEAN;
  v_all_playoff_matches_complete BOOLEAN;
BEGIN
  -- Loop through all tournaments
  FOR v_tournament_record IN 
    SELECT id, status, current_phase, tournament_type
    FROM tournaments
  LOOP
    -- Check if tournament has groups (brackets generated)
    SELECT EXISTS(
      SELECT 1 
      FROM tournament_groups 
      WHERE tournament_id = v_tournament_record.id
      LIMIT 1
    ) INTO v_has_groups;
    
    -- Check if tournament has playoff matches
    SELECT EXISTS(
      SELECT 1 
      FROM tournament_matches 
      WHERE tournament_id = v_tournament_record.id 
        AND bracket_type IN ('main', 'backdraw')
      LIMIT 1
    ) INTO v_has_playoff_matches;
    
    -- Determine the correct phase based on tournament state
    IF v_tournament_record.status = 'completed' THEN
      -- Tournament is completed, set phase to completed
      UPDATE tournaments
      SET current_phase = 'completed',
          updated_at = NOW()
      WHERE id = v_tournament_record.id;
      
      RAISE NOTICE 'Tournament %: Set phase to completed (status: completed)', v_tournament_record.id;
      
    ELSIF v_has_groups THEN
      -- Tournament has groups (brackets generated)
      
      -- Check if all group matches are completed
      SELECT NOT EXISTS(
        SELECT 1
        FROM tournament_matches tm
        JOIN matches m ON tm.match_id = m.id
        WHERE tm.tournament_id = v_tournament_record.id
          AND tm.bracket_type = 'group'
          AND (m.status != 'completed' OR m.winner_id IS NULL)
      ) INTO v_all_group_matches_complete;
      
      IF v_has_playoff_matches THEN
        -- Tournament has playoff matches, check if they're all complete
        SELECT NOT EXISTS(
          SELECT 1
          FROM tournament_matches tm
          JOIN matches m ON tm.match_id = m.id
          WHERE tm.tournament_id = v_tournament_record.id
            AND tm.bracket_type IN ('main', 'backdraw')
            AND (m.status != 'completed' OR m.winner_id IS NULL)
        ) INTO v_all_playoff_matches_complete;
        
        IF v_all_playoff_matches_complete THEN
          -- All playoff matches complete, set to completed
          UPDATE tournaments
          SET current_phase = 'completed',
              status = 'completed',
              updated_at = NOW()
          WHERE id = v_tournament_record.id;
          
          RAISE NOTICE 'Tournament %: Set phase to completed (all playoff matches complete)', v_tournament_record.id;
        ELSE
          -- Playoff matches exist but not all complete, set to playoffs
          UPDATE tournaments
          SET current_phase = 'playoffs',
              updated_at = NOW()
          WHERE id = v_tournament_record.id;
          
          RAISE NOTICE 'Tournament %: Set phase to playoffs (has playoff matches)', v_tournament_record.id;
        END IF;
      ELSIF v_all_group_matches_complete THEN
        -- All group matches complete but no playoff matches yet, should be in group_stage
        -- (organizer needs to advance manually, but we'll set it to group_stage for now)
        UPDATE tournaments
        SET current_phase = 'group_stage',
            updated_at = NOW()
        WHERE id = v_tournament_record.id;
        
        RAISE NOTICE 'Tournament %: Set phase to group_stage (all group matches complete, no playoffs yet)', v_tournament_record.id;
      ELSE
        -- Has groups but group matches not all complete, set to group_stage
        UPDATE tournaments
        SET current_phase = 'group_stage',
            updated_at = NOW()
        WHERE id = v_tournament_record.id;
        
        RAISE NOTICE 'Tournament %: Set phase to group_stage (has groups, matches in progress)', v_tournament_record.id;
      END IF;
      
    ELSE
      -- No groups yet, but tournament is active
      IF v_tournament_record.status = 'active' THEN
        -- Tournament is active but no brackets, keep in registration
        UPDATE tournaments
        SET current_phase = 'registration',
            updated_at = NOW()
        WHERE id = v_tournament_record.id;
        
        RAISE NOTICE 'Tournament %: Set phase to registration (active but no brackets)', v_tournament_record.id;
      ELSE
        -- Tournament is upcoming, set to registration
        UPDATE tournaments
        SET current_phase = 'registration',
            updated_at = NOW()
        WHERE id = v_tournament_record.id;
        
        RAISE NOTICE 'Tournament %: Set phase to registration (upcoming)', v_tournament_record.id;
      END IF;
    END IF;
    
  END LOOP;
  
  RAISE NOTICE 'Migration completed: All tournaments have been updated with correct phases';
END $$;

-- Verify the results
SELECT 
  id,
  name,
  status,
  current_phase,
  tournament_type,
  (SELECT COUNT(*) FROM tournament_groups WHERE tournament_id = tournaments.id) as groups_count,
  (SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = tournaments.id AND bracket_type = 'group') as group_matches_count,
  (SELECT COUNT(*) FROM tournament_matches WHERE tournament_id = tournaments.id AND bracket_type IN ('main', 'backdraw')) as playoff_matches_count
FROM tournaments
ORDER BY created_at DESC;

