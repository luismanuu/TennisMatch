-- Script SQL para crear partidos de grupos para un torneo existente que ya empezó
-- Este script asume que:
-- 1. El torneo ya existe y tiene grupos creados
-- 2. Los jugadores ya están registrados y asignados a grupos
-- 3. El torneo está en fase de grupos (current_phase = 'group_stage')
-- 4. El torneo está activo (status = 'active')

-- IMPORTANTE: Reemplaza 'TOURNAMENT_ID_AQUI' con el UUID del torneo
-- El UUID es el campo 'id' de la tabla tournaments
-- Ejemplo: '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c'

DO $$
DECLARE
  v_tournament_id UUID := 'TOURNAMENT_ID_AQUI'; -- ⚠️ CAMBIAR ESTE UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  v_group_record RECORD;
  v_player_ids UUID[];
  v_match_pair RECORD;
  v_match_id UUID;
  v_tournament_match_id UUID;
  v_match_count INTEGER := 0;
BEGIN
  -- Verificar que el torneo existe
  IF NOT EXISTS (SELECT 1 FROM tournaments WHERE id = v_tournament_id) THEN
    RAISE EXCEPTION 'Tournament with ID % does not exist', v_tournament_id;
  END IF;

  -- Iterar sobre cada grupo del torneo
  FOR v_group_record IN 
    SELECT id, group_name, group_number
    FROM tournament_groups
    WHERE tournament_id = v_tournament_id
    ORDER BY group_number
  LOOP
    RAISE NOTICE 'Processing group: % (ID: %)', v_group_record.group_name, v_group_record.id;
    
    -- Obtener todos los jugadores del grupo
    SELECT ARRAY_AGG(player_id ORDER BY seed_position)
    INTO v_player_ids
    FROM tournament_group_players
    WHERE tournament_id = v_tournament_id
      AND group_id = v_group_record.id;
    
    -- Verificar que hay jugadores en el grupo
    IF v_player_ids IS NULL OR array_length(v_player_ids, 1) < 2 THEN
      RAISE NOTICE 'Group % has less than 2 players, skipping', v_group_record.group_name;
      CONTINUE;
    END IF;
    
    RAISE NOTICE 'Group % has % players', v_group_record.group_name, array_length(v_player_ids, 1);
    
    -- Generar partidos round-robin para este grupo
    -- Cada jugador juega contra todos los demás jugadores del grupo
    FOR i IN 1..array_length(v_player_ids, 1) LOOP
      FOR j IN (i + 1)..array_length(v_player_ids, 1) LOOP
        -- Verificar si el partido ya existe
        IF EXISTS (
          SELECT 1
          FROM tournament_matches tm
          JOIN matches m ON tm.match_id = m.id
          WHERE tm.tournament_id = v_tournament_id
            AND tm.group_id = v_group_record.id
            AND tm.bracket_type = 'group'
            AND (
              (m.player1_id = v_player_ids[i] AND m.player2_id = v_player_ids[j]) OR
              (m.player1_id = v_player_ids[j] AND m.player2_id = v_player_ids[i])
            )
        ) THEN
          RAISE NOTICE 'Match between players % and % already exists in group %, skipping', 
            v_player_ids[i], v_player_ids[j], v_group_record.group_name;
          CONTINUE;
        END IF;
        
        -- Crear el partido en la tabla matches
        INSERT INTO matches (
          player1_id,
          player2_id,
          tournament_id,
          status,
          scheduled_at
        ) VALUES (
          v_player_ids[i],
          v_player_ids[j],
          v_tournament_id,
          'scheduled',
          NULL -- Los jugadores programarán después
        )
        RETURNING id INTO v_match_id;
        
        -- Crear el registro en tournament_matches
        INSERT INTO tournament_matches (
          tournament_id,
          match_id,
          bracket_type,
          round_number,
          group_id,
          is_bye
        ) VALUES (
          v_tournament_id,
          v_match_id,
          'group',
          1,
          v_group_record.id,
          false
        )
        RETURNING id INTO v_tournament_match_id;
        
        v_match_count := v_match_count + 1;
        RAISE NOTICE 'Created match % in group %', v_match_count, v_group_record.group_name;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Successfully created % matches for tournament %', v_match_count, v_tournament_id;
END $$;

-- Verificar los partidos creados
SELECT 
  tg.group_name,
  COUNT(tm.id) as total_matches,
  COUNT(CASE WHEN m.status = 'completed' THEN 1 END) as completed_matches,
  COUNT(CASE WHEN m.status = 'scheduled' THEN 1 END) as scheduled_matches,
  COUNT(CASE WHEN m.scheduled_at IS NULL THEN 1 END) as unscheduled_matches
FROM tournament_groups tg
LEFT JOIN tournament_matches tm ON tg.id = tm.group_id AND tm.bracket_type = 'group'
LEFT JOIN matches m ON tm.match_id = m.id
WHERE tg.tournament_id = 'TOURNAMENT_ID_AQUI' -- ⚠️ CAMBIAR ESTE UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
GROUP BY tg.id, tg.group_name, tg.group_number
ORDER BY tg.group_number;

