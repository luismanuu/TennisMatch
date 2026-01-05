-- Migration: Add tournament_type and current_phase to tournaments table
-- This allows tracking tournament format and current phase progression

DO $$
BEGIN
  -- Check if tournaments table exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tournaments'
  ) THEN
    -- Add tournament_type column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tournaments' 
      AND column_name = 'tournament_type'
    ) THEN
      ALTER TABLE tournaments 
        ADD COLUMN tournament_type TEXT NOT NULL DEFAULT 'groups_playoffs' 
        CHECK (tournament_type IN ('groups_playoffs', 'single_elimination', 'double_elimination', 'round_robin'));
      
      RAISE NOTICE 'Successfully added tournament_type column to tournaments table';
    ELSE
      RAISE NOTICE 'Column tournaments.tournament_type already exists';
    END IF;

    -- Add current_phase column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tournaments' 
      AND column_name = 'current_phase'
    ) THEN
      ALTER TABLE tournaments 
        ADD COLUMN current_phase TEXT DEFAULT 'registration' 
        CHECK (current_phase IN ('registration', 'group_stage', 'playoffs', 'completed'));
      
      RAISE NOTICE 'Successfully added current_phase column to tournaments table';
    ELSE
      RAISE NOTICE 'Column tournaments.current_phase already exists';
    END IF;
  ELSE
    RAISE NOTICE 'Table tournaments does not exist, skipping migration';
  END IF;
END $$;

