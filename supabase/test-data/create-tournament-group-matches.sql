-- Script SQL para crear partidos de grupos para un torneo existente que ya empezó
-- Este script asume que:
-- 1. El torneo ya existe y tiene grupos creados
-- 2. Los jugadores ya están registrados y asignados a grupos
-- 3. El torneo está en fase de grupos (current_phase = 'group_stage')
-- 4. El torneo está activo (status = 'active')
--
-- IMPORTANTE: Los partidos se crean SIN agendar automáticamente.
-- Los jugadores deben agendar sus propios partidos usando la aplicación.
-- Los partidos se crean con:
--   - status: 'scheduled' (indica que está en el torneo pero sin fecha/hora)
--   - scheduled_at: NULL (los jugadores lo agendarán después)
--   - score: NULL
--   - played_at: NULL
--   - winner_id: NULL
--
-- ⚠️ ESTE SCRIPT ES IDEMPOTENTE: Puede ejecutarse múltiples veces sin crear duplicados.
-- Si los partidos ya existen, simplemente los omite.

-- UUID del torneo: 5e0d74f3-f79d-49f8-b328-e1a74ff01b2c

DO $$
DECLARE
  v_tournament_id UUID := '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c'; -- UUID del torneo
  v_group_record RECORD;
  v_player_ids UUID[];
  v_match_pair RECORD;
  v_match_id UUID;
  v_tournament_match_id UUID;
  v_match_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
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
          v_skipped_count := v_skipped_count + 1;
          RAISE NOTICE 'Match between players % and % already exists in group %, skipping', 
            v_player_ids[i], v_player_ids[j], v_group_record.group_name;
          CONTINUE;
        END IF;
        
        -- Crear el partido en la tabla matches
        -- IMPORTANTE: Los partidos se crean SIN agendar automáticamente
        -- Los jugadores deben agendar sus propios partidos usando la aplicación
        -- Solo se incluyen los campos mínimos necesarios
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
          'scheduled', -- Estado: programado para el torneo pero sin fecha/hora aún
          NULL -- Los jugadores agendarán después (scheduled_at será NULL hasta que lo agenden)
        )
        RETURNING id INTO v_match_id;
        
        -- Crear el registro en tournament_matches
        -- Usar ON CONFLICT como protección adicional (aunque ya verificamos arriba)
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
        ON CONFLICT (tournament_id, match_id) DO NOTHING;
        
        v_match_count := v_match_count + 1;
        RAISE NOTICE 'Created match % in group %', v_match_count, v_group_record.group_name;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Resumen para torneo %:', v_tournament_id;
  RAISE NOTICE '  - Partidos creados: %', v_match_count;
  RAISE NOTICE '  - Partidos omitidos (ya existían): %', v_skipped_count;
  RAISE NOTICE '  - Total procesados: %', v_match_count + v_skipped_count;
  RAISE NOTICE '========================================';
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
WHERE tg.tournament_id = '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c' -- UUID del torneo
GROUP BY tg.id, tg.group_name, tg.group_number
ORDER BY tg.group_number;

