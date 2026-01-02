-- Migration: Add phone_number field to players table
-- Run this in Supabase SQL Editor to add phone_number support

-- Add phone_number column to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Note: phone_number is nullable (optional field)
-- No index needed as it's not used for lookups

