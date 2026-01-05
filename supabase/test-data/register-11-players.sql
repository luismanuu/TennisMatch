-- Test Data: Create 11 players and register them in tournament
-- Tournament ID: 5e0d74f3-f79d-49f8-b328-e1a74ff01b2c
-- Run this in Supabase SQL Editor

-- First, get the tournament category_id (if any)
DO $$
DECLARE
  v_tournament_category_id UUID;
  v_tournament_id UUID := '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c';
  test_player_ids UUID[];
  v_player_id UUID;
  i INTEGER;
BEGIN
  -- Get tournament category_id
  SELECT category_id INTO v_tournament_category_id
  FROM tournaments
  WHERE id = v_tournament_id;
  
  -- If tournament has no category, get a random category for test players
  IF v_tournament_category_id IS NULL THEN
    SELECT id INTO v_tournament_category_id
    FROM categories
    ORDER BY "order"
    LIMIT 1;
  END IF;
  
  RAISE NOTICE 'Tournament category_id: %', v_tournament_category_id;
  
  -- Create 11 test players
  FOR i IN 1..11 LOOP
    INSERT INTO players (
      clerk_id,
      name,
      phone_number,
      category_id,
      elo
    ) VALUES (
      'test_player_' || i || '_' || gen_random_uuid()::text,
      'Jugador Test ' || i,
      '+593 9' || LPAD((900000000 + i)::text, 8, '0'),
      v_tournament_category_id,
      1000 + (i * 50) -- Varying ELO for variety
    )
    ON CONFLICT (clerk_id) DO UPDATE
    SET name = EXCLUDED.name,
        phone_number = EXCLUDED.phone_number,
        category_id = EXCLUDED.category_id,
        elo = EXCLUDED.elo
    RETURNING id INTO v_player_id;
    
    test_player_ids := array_append(test_player_ids, v_player_id);
    RAISE NOTICE 'Created player %: %', i, v_player_id;
  END LOOP;
  
  -- Register all players in the tournament
  FOR i IN 1..array_length(test_player_ids, 1) LOOP
    INSERT INTO tournament_registrations (
      tournament_id,
      player_id,
      status,
      confirmed_at
    ) VALUES (
      v_tournament_id,
      test_player_ids[i],
      'confirmed',
      NOW()
    )
    ON CONFLICT (tournament_id, player_id) DO UPDATE
    SET status = 'confirmed',
        confirmed_at = NOW(),
        withdrawn_at = NULL;
    
    RAISE NOTICE 'Registered player % in tournament', i;
  END LOOP;
  
  RAISE NOTICE 'Successfully created 11 test players and registered them in tournament %', v_tournament_id;
END $$;

-- Verify the registrations
SELECT 
  tr.id as registration_id,
  p.name as player_name,
  p.phone_number,
  c.name as category_name,
  tr.status,
  tr.confirmed_at
FROM tournament_registrations tr
JOIN players p ON tr.player_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE tr.tournament_id = '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c'
ORDER BY p.name;

