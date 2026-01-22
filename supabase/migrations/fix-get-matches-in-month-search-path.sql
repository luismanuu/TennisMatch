-- Migration: Fix search_path security issue in get_matches_in_month function
-- Issue: Function has role mutable search_path, which is a security vulnerability
-- Solution: Add SET search_path = 'public' to prevent search path manipulation attacks

CREATE OR REPLACE FUNCTION get_matches_in_month(p_player_id UUID, p_year INTEGER, p_month INTEGER)
RETURNS INTEGER
SET search_path = 'public'
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM rating_history
    WHERE player_id = p_player_id
      AND NOT rating_reversed
      AND EXTRACT(YEAR FROM created_at) = p_year
      AND EXTRACT(MONTH FROM created_at) = p_month
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_matches_in_month IS 'Get number of rated matches for a player in a specific month';
