-- ============================================
-- FIX BRACKET POSITIONS FOR EXISTING MATCHES
-- ============================================
-- This migration fixes bracket_position for existing tournament matches
-- that have null bracket_position values by calculating them based on match order

-- Function to update bracket_position for matches with null values
DO $$
DECLARE
  tournament_record RECORD;
  bracket_type_record TEXT;
  round_record INTEGER;
  match_record RECORD;
  position_counter INTEGER;
BEGIN
  -- Loop through each tournament
  FOR tournament_record IN 
    SELECT DISTINCT tournament_id FROM tournament_matches WHERE bracket_position IS NULL
  LOOP
    -- Loop through each bracket type (main, backdraw)
    FOR bracket_type_record IN SELECT unnest(ARRAY['main', 'backdraw'])
    LOOP
      -- Loop through each round
      FOR round_record IN 
        SELECT DISTINCT round_number 
        FROM tournament_matches 
        WHERE tournament_id = tournament_record.tournament_id 
          AND bracket_type = bracket_type_record
          AND bracket_position IS NULL
        ORDER BY round_number
      LOOP
        position_counter := 1;
        
        -- Update bracket_position for each match in this round, ordered by id
        FOR match_record IN
          SELECT id
          FROM tournament_matches
          WHERE tournament_id = tournament_record.tournament_id
            AND bracket_type = bracket_type_record
            AND round_number = round_record
            AND bracket_position IS NULL
          ORDER BY 
            CASE WHEN match_id IS NOT NULL THEN 0 ELSE 1 END, -- Regular matches first, then byes
            id ASC
        LOOP
          UPDATE tournament_matches
          SET bracket_position = position_counter
          WHERE id = match_record.id;
          
          position_counter := position_counter + 1;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Verify the fix
SELECT 
  tournament_id,
  bracket_type,
  round_number,
  COUNT(*) as total_matches,
  COUNT(bracket_position) as matches_with_position,
  COUNT(*) FILTER (WHERE bracket_position IS NULL) as matches_without_position
FROM tournament_matches
WHERE bracket_type IN ('main', 'backdraw')
GROUP BY tournament_id, bracket_type, round_number
ORDER BY tournament_id, bracket_type, round_number;

