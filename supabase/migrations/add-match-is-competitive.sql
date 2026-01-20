-- ============================================
-- ADD is_competitive FIELD TO MATCHES
-- ============================================
-- This field allows marking matches as friendly/non-competitive
-- Only competitive matches count towards placement matches and ratings

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS is_competitive BOOLEAN NOT NULL DEFAULT true;

-- Add comment
COMMENT ON COLUMN matches.is_competitive IS 'Whether this match counts towards ratings and placement matches. False for friendly matches.';

-- Create index for filtering competitive matches
CREATE INDEX IF NOT EXISTS idx_matches_is_competitive ON matches(is_competitive) WHERE is_competitive = true;
