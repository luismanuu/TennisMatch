-- Migration: Allow tournaments without category (open to all players)
-- This makes category_id optional in tournaments table
-- Safe to run multiple times - checks if table and column exist first

DO $$
DECLARE
  fk_constraint_name TEXT;
BEGIN
  -- Check if tournaments table exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tournaments'
  ) THEN
    -- Check if category_id column exists and has NOT NULL constraint
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tournaments' 
      AND column_name = 'category_id'
      AND is_nullable = 'NO'
    ) THEN
      -- Find the foreign key constraint name for category_id
      SELECT tc.constraint_name INTO fk_constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'tournaments'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'category_id'
      LIMIT 1;
      
      -- Drop the NOT NULL constraint on category_id
      ALTER TABLE tournaments 
        ALTER COLUMN category_id DROP NOT NULL;
      
      RAISE NOTICE 'Successfully removed NOT NULL constraint from tournaments.category_id';
      
      -- Verify foreign key constraint exists and is correct
      IF fk_constraint_name IS NOT NULL THEN
        RAISE NOTICE 'Foreign key constraint % exists and allows NULL values', fk_constraint_name;
      ELSE
        -- If foreign key doesn't exist, create it
        IF EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'categories'
        ) THEN
          ALTER TABLE tournaments
            ADD CONSTRAINT tournaments_category_id_fkey 
            FOREIGN KEY (category_id) 
            REFERENCES categories(id) 
            ON DELETE RESTRICT;
          
          RAISE NOTICE 'Created foreign key constraint tournaments_category_id_fkey';
        ELSE
          RAISE WARNING 'Categories table does not exist, cannot create foreign key constraint';
        END IF;
      END IF;
    ELSE
      RAISE NOTICE 'Column tournaments.category_id already allows NULL or does not exist';
      
      -- Even if column already allows NULL, verify foreign key exists
      SELECT tc.constraint_name INTO fk_constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'tournaments'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'category_id'
      LIMIT 1;
      
      IF fk_constraint_name IS NULL THEN
        IF EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'categories'
        ) THEN
          ALTER TABLE tournaments
            ADD CONSTRAINT tournaments_category_id_fkey 
            FOREIGN KEY (category_id) 
            REFERENCES categories(id) 
            ON DELETE RESTRICT;
          
          RAISE NOTICE 'Created foreign key constraint tournaments_category_id_fkey';
        END IF;
      END IF;
    END IF;
    
    RAISE NOTICE 'Migration completed. category_id now allows NULL values (open tournaments)';
  ELSE
    RAISE NOTICE 'Table tournaments does not exist, skipping migration';
  END IF;
END $$;

