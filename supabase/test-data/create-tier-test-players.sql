-- Test Data: Create test players for each tier (Gold, Platinum, Diamond, Master, Grandmaster)
-- Run this in Supabase SQL Editor
-- These players will be ranked (total_matches_played > 0)

DO $$
DECLARE
  v_category_id UUID;
  v_city_id UUID;
  v_player_id UUID;
BEGIN
  -- Get first available category (or use NULL if none exists)
  SELECT id INTO v_category_id
  FROM categories
  ORDER BY "order"
  LIMIT 1;
  
  -- Get first available city (or use NULL if none exists)
  SELECT id INTO v_city_id
  FROM cities
  ORDER BY "order"
  LIMIT 1;
  
  RAISE NOTICE 'Using category_id: %, city_id: %', v_category_id, v_city_id;
  
  -- Gold Tier (2000-2499 ELO) - using 2250
  INSERT INTO players (
    clerk_id,
    name,
    phone_number,
    category_id,
    city_id,
    elo,
    total_matches_played,
    status
  ) VALUES (
    'test_player_gold_' || gen_random_uuid()::text,
    'Test Player Gold',
    '+593 912345678',
    v_category_id,
    v_city_id,
    2250, -- Gold tier (2000-2499)
    10, -- Has played matches, so is ranked
    'active'
  )
  ON CONFLICT (clerk_id) DO UPDATE
  SET name = EXCLUDED.name,
      elo = EXCLUDED.elo,
      total_matches_played = EXCLUDED.total_matches_played
  RETURNING id INTO v_player_id;
  
  RAISE NOTICE 'Created Gold player: %', v_player_id;
  
  -- Platinum Tier (2500-2999 ELO) - using 2750
  INSERT INTO players (
    clerk_id,
    name,
    phone_number,
    category_id,
    city_id,
    elo,
    total_matches_played,
    status
  ) VALUES (
    'test_player_platinum_' || gen_random_uuid()::text,
    'Test Player Platinum',
    '+593 912345679',
    v_category_id,
    v_city_id,
    2750, -- Platinum tier (2500-2999)
    15, -- Has played matches, so is ranked
    'active'
  )
  ON CONFLICT (clerk_id) DO UPDATE
  SET name = EXCLUDED.name,
      elo = EXCLUDED.elo,
      total_matches_played = EXCLUDED.total_matches_played
  RETURNING id INTO v_player_id;
  
  RAISE NOTICE 'Created Platinum player: %', v_player_id;
  
  -- Diamond Tier (3000-3499 ELO) - using 3250
  INSERT INTO players (
    clerk_id,
    name,
    phone_number,
    category_id,
    city_id,
    elo,
    total_matches_played,
    status
  ) VALUES (
    'test_player_diamond_' || gen_random_uuid()::text,
    'Test Player Diamond',
    '+593 912345680',
    v_category_id,
    v_city_id,
    3250, -- Diamond tier (3000-3499)
    20, -- Has played matches, so is ranked
    'active'
  )
  ON CONFLICT (clerk_id) DO UPDATE
  SET name = EXCLUDED.name,
      elo = EXCLUDED.elo,
      total_matches_played = EXCLUDED.total_matches_played
  RETURNING id INTO v_player_id;
  
  RAISE NOTICE 'Created Diamond player: %', v_player_id;
  
  -- Master Tier (3500-3999 ELO) - using 3750
  INSERT INTO players (
    clerk_id,
    name,
    phone_number,
    category_id,
    city_id,
    elo,
    total_matches_played,
    status
  ) VALUES (
    'test_player_master_' || gen_random_uuid()::text,
    'Test Player Master',
    '+593 912345681',
    v_category_id,
    v_city_id,
    3750, -- Master tier (3500-3999)
    25, -- Has played matches, so is ranked
    'active'
  )
  ON CONFLICT (clerk_id) DO UPDATE
  SET name = EXCLUDED.name,
      elo = EXCLUDED.elo,
      total_matches_played = EXCLUDED.total_matches_played
  RETURNING id INTO v_player_id;
  
  RAISE NOTICE 'Created Master player: %', v_player_id;
  
  -- Grandmaster Tier (4000+ ELO) - using 4200
  INSERT INTO players (
    clerk_id,
    name,
    phone_number,
    category_id,
    city_id,
    elo,
    total_matches_played,
    status
  ) VALUES (
    'test_player_grandmaster_' || gen_random_uuid()::text,
    'Test Player Grandmaster',
    '+593 912345682',
    v_category_id,
    v_city_id,
    4200, -- Grandmaster tier (4000+)
    30, -- Has played matches, so is ranked
    'active'
  )
  ON CONFLICT (clerk_id) DO UPDATE
  SET name = EXCLUDED.name,
      elo = EXCLUDED.elo,
      total_matches_played = EXCLUDED.total_matches_played
  RETURNING id INTO v_player_id;
  
  RAISE NOTICE 'Created Grandmaster player: %', v_player_id;
  
  RAISE NOTICE 'Successfully created test players for all tiers!';
END $$;
