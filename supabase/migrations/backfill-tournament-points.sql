-- ============================================
-- BACKFILL TOURNAMENT POINTS SYSTEM
-- ============================================
-- This script backfills points and game_difference for existing tournaments
-- Priority: Tournament ID 5e0d74f3-f79d-49f8-b328-e1a74ff01b2c
-- This script recalculates standings from completed matches

-- 1. Set default points_config for tournament 5e0d74f3-f79d-49f8-b328-e1a74ff01b2c if not set
UPDATE tournaments
SET points_config = '{"group_stage": 3, "playoffs": 5}'::jsonb
WHERE id = '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c'
  AND points_config IS NULL;

-- 2. Set default points_config for all other tournaments with NULL points_config
UPDATE tournaments
SET points_config = '{"group_stage": 3, "playoffs": 5}'::jsonb
WHERE points_config IS NULL;

-- 3. Create standings for all players in groups that don't have standings yet
INSERT INTO tournament_standings (tournament_id, group_id, player_id, wins, losses, sets_won, sets_lost, games_won, games_lost, points, game_difference, updated_at)
SELECT 
  tg.tournament_id,
  tg.id as group_id,
  tgp.player_id,
  0 as wins,
  0 as losses,
  0 as sets_won,
  0 as sets_lost,
  0 as games_won,
  0 as games_lost,
  0 as points,
  0 as game_difference,
  NOW() as updated_at
FROM tournament_groups tg
JOIN tournament_group_players tgp ON tg.id = tgp.group_id
LEFT JOIN tournament_standings ts ON 
  ts.tournament_id = tg.tournament_id 
  AND ts.group_id = tg.id 
  AND ts.player_id = tgp.player_id
WHERE ts.id IS NULL
ON CONFLICT (tournament_id, group_id, player_id) DO NOTHING;

-- 4. Recalculate standings from completed matches
-- This calculates wins, losses, sets, games, and points from actual match results
DO $$
DECLARE
  match_rec RECORD;
  tournament_rec RECORD;
  group_rec RECORD;
  player_id_var UUID;
  player1_id_var UUID;
  player2_id_var UUID;
  winner_id_var UUID;
  score_var TEXT;
  sets TEXT[];
  set_score TEXT;
  p1_games INTEGER;
  p2_games INTEGER;
  player1_sets INTEGER;
  player2_sets INTEGER;
  player1_games_total INTEGER;
  player2_games_total INTEGER;
  points_config_var JSONB;
  points_per_win INTEGER;
  standings_map JSONB;
  current_standing JSONB;
  game_diff INTEGER;
  parsed_sets JSONB;
  set_rec RECORD;
  temp_p1_games INTEGER;
  temp_p2_games INTEGER;
  score_based_winner_is_p1 BOOLEAN;
  p1_sets_from_score INTEGER;
  needs_inversion BOOLEAN;
  final_p1_games INTEGER;
  final_p2_games INTEGER;
BEGIN
  -- Process each tournament
  FOR tournament_rec IN
    SELECT id, points_config
    FROM tournaments
    WHERE points_config IS NOT NULL
  LOOP
    points_config_var := tournament_rec.points_config;
    points_per_win := COALESCE((points_config_var->>'group_stage')::INTEGER, 3);
    
    RAISE NOTICE 'Processing tournament: % (Points per win: %)', tournament_rec.id, points_per_win;
    
    -- Process each group in the tournament
    FOR group_rec IN
      SELECT id, group_name
      FROM tournament_groups
      WHERE tournament_id = tournament_rec.id
    LOOP
      RAISE NOTICE '  Processing group: %', group_rec.group_name;
      standings_map := '{}'::jsonb;
      
      -- Initialize standings for all players in the group
      FOR player_id_var IN
        SELECT player_id FROM tournament_group_players WHERE group_id = group_rec.id
      LOOP
        standings_map := jsonb_set(standings_map, ARRAY[player_id_var::TEXT], 
          '{"wins": 0, "losses": 0, "sets_won": 0, "sets_lost": 0, "games_won": 0, "games_lost": 0, "points": 0, "game_difference": 0}'::jsonb, TRUE);
      END LOOP;
      
      -- Process all completed matches for this group
      FOR match_rec IN
        SELECT
          m.player1_id,
          m.player2_id,
          m.winner_id,
          m.score
        FROM matches m
        JOIN tournament_matches tm ON m.id = tm.match_id
        WHERE tm.tournament_id = tournament_rec.id
          AND tm.group_id = group_rec.id
          AND tm.bracket_type = 'group'
          AND m.status = 'completed'
          AND m.winner_id IS NOT NULL
          AND m.score IS NOT NULL
      LOOP
        player1_id_var := match_rec.player1_id;
        player2_id_var := match_rec.player2_id;
        winner_id_var := match_rec.winner_id;
        score_var := match_rec.score;
        
        player1_sets := 0;
        player2_sets := 0;
        player1_games_total := 0;
        player2_games_total := 0;
        
        -- Parse score (same logic as TypeScript code in tournament-brackets.ts)
        -- Score format: "6-4, 6-3" or "6-4,3-6,6-2" or "WO" for walkover
        IF UPPER(TRIM(score_var)) = 'WO' THEN
          -- Walkover: no games or sets are counted, only win/loss and points
          -- Sets and games remain 0 (already initialized above)
          -- Only the win/loss and points will be updated below
        ELSE
          -- Parse score with robust error handling for various formats
          -- Handles: "6-4, 6-3", "6-4,6-3", "6-4 6-3" (space instead of comma), "8-6" (pro set)
          -- Normalize the score string
          score_var := TRIM(score_var);
          
          -- Replace multiple spaces with single space
          score_var := REGEXP_REPLACE(score_var, '\s+', ' ', 'g');
          
          -- Normalize comma spacing: "6-4, 6-3" or "6-4 , 6-3" -> "6-4,6-3"
          score_var := REGEXP_REPLACE(score_var, '\s*,\s*', ',', 'g');
          
          -- If no comma but has space, treat space as separator (handles "6-4 6-3")
          IF POSITION(',' IN score_var) = 0 AND POSITION(' ' IN score_var) > 0 THEN
            -- Replace spaces with commas
            score_var := REGEXP_REPLACE(score_var, '\s+', ',', 'g');
          END IF;
          
          -- Split by comma or treat as single set if no comma
          IF POSITION(',' IN score_var) > 0 THEN
            -- Multiple sets: split by comma and filter empty strings
            sets := ARRAY(
              SELECT TRIM(unnest) 
              FROM unnest(string_to_array(score_var, ',')) 
              WHERE TRIM(unnest) != ''
            );
          ELSE
            -- Single set (pro set): treat entire score as one set
            sets := ARRAY[score_var];
          END IF;
          
          -- Parse sets and determine if score needs inversion based on winner_id
          -- First, parse all sets to determine who won based on score
          parsed_sets := '[]'::jsonb;
          score_based_winner_is_p1 := false;
          p1_sets_from_score := 0;
          needs_inversion := false;
          
          BEGIN
            -- First pass: parse all sets
            FOREACH set_score IN ARRAY sets LOOP
              BEGIN
                -- Trim whitespace
                set_score := TRIM(set_score);
                
                -- Skip empty sets
                IF set_score = '' OR set_score IS NULL THEN
                  CONTINUE;
                END IF;
                
                -- Normalize dash spacing: "6 - 4" -> "6-4"
                set_score := REGEXP_REPLACE(set_score, '\s*-\s*', '-', 'g');
                
                -- Split by dash to get games for each player
                temp_p1_games := COALESCE(
                  NULLIF(REGEXP_REPLACE(SPLIT_PART(set_score, '-', 1), '[^0-9]', '', 'g'), '')::INTEGER, 
                  0
                );
                temp_p2_games := COALESCE(
                  NULLIF(REGEXP_REPLACE(SPLIT_PART(set_score, '-', 2), '[^0-9]', '', 'g'), '')::INTEGER, 
                  0
                );
                
                -- Validate: both parts must have been split correctly
                IF SPLIT_PART(set_score, '-', 1) = set_score THEN
                  CONTINUE;
                END IF;
                
                -- Only process if we got valid numbers
                IF temp_p1_games > 0 OR temp_p2_games > 0 THEN
                  parsed_sets := jsonb_insert(parsed_sets, '{-1}', jsonb_build_object('p1', temp_p1_games, 'p2', temp_p2_games));
                  
                  -- Track set winners to determine score-based winner
                  IF temp_p1_games > temp_p2_games THEN
                    p1_sets_from_score := p1_sets_from_score + 1;
                    score_based_winner_is_p1 := true;
                  ELSIF temp_p2_games > temp_p1_games THEN
                    score_based_winner_is_p1 := false;
                  END IF;
                END IF;
              EXCEPTION WHEN OTHERS THEN
                CONTINUE;
              END;
            END LOOP;
            
            -- Determine if score needs inversion: if score-based winner doesn't match actual winner_id
            IF (winner_id_var = player1_id_var AND NOT score_based_winner_is_p1) OR
               (winner_id_var = player2_id_var AND score_based_winner_is_p1) THEN
              needs_inversion := true;
            END IF;
            
            -- Second pass: apply inversion if needed and calculate totals
            FOR set_rec IN SELECT * FROM jsonb_array_elements(parsed_sets) LOOP
              IF needs_inversion THEN
                final_p1_games := (set_rec.value->>'p2')::INTEGER;
                final_p2_games := (set_rec.value->>'p1')::INTEGER;
              ELSE
                final_p1_games := (set_rec.value->>'p1')::INTEGER;
                final_p2_games := (set_rec.value->>'p2')::INTEGER;
              END IF;
              
              player1_games_total := player1_games_total + final_p1_games;
              player2_games_total := player2_games_total + final_p2_games;
              
              -- Determine set winner
              IF final_p1_games > final_p2_games THEN
                player1_sets := player1_sets + 1;
              ELSIF final_p2_games > final_p1_games THEN
                player2_sets := player2_sets + 1;
              END IF;
            END LOOP;
          END;
        END IF;
        
        -- Update standings for player1
        current_standing := standings_map -> player1_id_var::TEXT;
        IF current_standing IS NOT NULL THEN
          current_standing := jsonb_set(current_standing, ARRAY['sets_won'], 
            to_jsonb((current_standing->>'sets_won')::INTEGER + player1_sets));
          current_standing := jsonb_set(current_standing, ARRAY['sets_lost'], 
            to_jsonb((current_standing->>'sets_lost')::INTEGER + player2_sets));
          current_standing := jsonb_set(current_standing, ARRAY['games_won'], 
            to_jsonb((current_standing->>'games_won')::INTEGER + player1_games_total));
          current_standing := jsonb_set(current_standing, ARRAY['games_lost'], 
            to_jsonb((current_standing->>'games_lost')::INTEGER + player2_games_total));
          
          IF winner_id_var = player1_id_var THEN
            current_standing := jsonb_set(current_standing, ARRAY['wins'], 
              to_jsonb((current_standing->>'wins')::INTEGER + 1));
            current_standing := jsonb_set(current_standing, ARRAY['points'], 
              to_jsonb((current_standing->>'points')::INTEGER + points_per_win));
          ELSE
            current_standing := jsonb_set(current_standing, ARRAY['losses'], 
              to_jsonb((current_standing->>'losses')::INTEGER + 1));
          END IF;
          
          standings_map := jsonb_set(standings_map, ARRAY[player1_id_var::TEXT], current_standing);
        END IF;
        
        -- Update standings for player2
        current_standing := standings_map -> player2_id_var::TEXT;
        IF current_standing IS NOT NULL THEN
          current_standing := jsonb_set(current_standing, ARRAY['sets_won'], 
            to_jsonb((current_standing->>'sets_won')::INTEGER + player2_sets));
          current_standing := jsonb_set(current_standing, ARRAY['sets_lost'], 
            to_jsonb((current_standing->>'sets_lost')::INTEGER + player1_sets));
          current_standing := jsonb_set(current_standing, ARRAY['games_won'], 
            to_jsonb((current_standing->>'games_won')::INTEGER + player2_games_total));
          current_standing := jsonb_set(current_standing, ARRAY['games_lost'], 
            to_jsonb((current_standing->>'games_lost')::INTEGER + player1_games_total));
          
          IF winner_id_var = player2_id_var THEN
            current_standing := jsonb_set(current_standing, ARRAY['wins'], 
              to_jsonb((current_standing->>'wins')::INTEGER + 1));
            current_standing := jsonb_set(current_standing, ARRAY['points'], 
              to_jsonb((current_standing->>'points')::INTEGER + points_per_win));
          ELSE
            current_standing := jsonb_set(current_standing, ARRAY['losses'], 
              to_jsonb((current_standing->>'losses')::INTEGER + 1));
          END IF;
          
          standings_map := jsonb_set(standings_map, ARRAY[player2_id_var::TEXT], current_standing);
        END IF;
      END LOOP;
      
      -- Calculate game_difference and update tournament_standings
      FOR player_id_var IN SELECT * FROM jsonb_object_keys(standings_map) LOOP
        current_standing := standings_map -> player_id_var::TEXT;
        game_diff := (current_standing->>'games_won')::INTEGER - (current_standing->>'games_lost')::INTEGER;
        current_standing := jsonb_set(current_standing, ARRAY['game_difference'], to_jsonb(game_diff));
        
        INSERT INTO tournament_standings (
          tournament_id, group_id, player_id, wins, losses, sets_won, sets_lost, 
          games_won, games_lost, points, game_difference, updated_at
        )
        VALUES (
          tournament_rec.id,
          group_rec.id,
          player_id_var::UUID,
          (current_standing->>'wins')::INTEGER,
          (current_standing->>'losses')::INTEGER,
          (current_standing->>'sets_won')::INTEGER,
          (current_standing->>'sets_lost')::INTEGER,
          (current_standing->>'games_won')::INTEGER,
          (current_standing->>'games_lost')::INTEGER,
          (current_standing->>'points')::INTEGER,
          (current_standing->>'game_difference')::INTEGER,
          NOW()
        )
        ON CONFLICT (tournament_id, group_id, player_id) DO UPDATE SET
          wins = EXCLUDED.wins,
          losses = EXCLUDED.losses,
          sets_won = EXCLUDED.sets_won,
          sets_lost = EXCLUDED.sets_lost,
          games_won = EXCLUDED.games_won,
          games_lost = EXCLUDED.games_lost,
          points = EXCLUDED.points,
          game_difference = EXCLUDED.game_difference,
          updated_at = NOW();
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Backfill completed successfully';
END $$;

-- 5. Update game_difference for all standings (recalculate to ensure accuracy)
UPDATE tournament_standings
SET game_difference = games_won - games_lost;

-- Note: This script recalculates standings from actual match results.
-- For ongoing tournaments, use the recalculate-standings API endpoint after matches are completed.

