-- ============================================
-- ADD DEFAULT ELO TO CATEGORIES
-- ============================================
-- Migration to add default_elo column to categories table
-- for the matchmaking and ranking system

-- Add default_elo column
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS default_elo INTEGER NOT NULL DEFAULT 1000;

-- Comment on the column
COMMENT ON COLUMN categories.default_elo IS 'Default ELO rating for new players in this category';

-- Backfill existing categories with linear ELO mapping based on order
-- Category 1 (Elite) = 2500, Category 7 (Beginner) = 1000
-- Formula: 2500 - ((order - 1) * 250) for categories 1-7
UPDATE categories
SET default_elo = CASE
  WHEN "order" = 1 THEN 2500  -- Elite
  WHEN "order" = 2 THEN 2250  -- Advanced
  WHEN "order" = 3 THEN 2000  -- Upper Intermediate
  WHEN "order" = 4 THEN 1750  -- Lower Intermediate
  WHEN "order" = 5 THEN 1500  -- Basic Intermediate
  WHEN "order" = 6 THEN 1250  -- Upper Beginner
  WHEN "order" = 7 THEN 1000  -- Beginner
  ELSE 1000                   -- Default fallback
END
WHERE default_elo = 1000; -- Only update if not already set
