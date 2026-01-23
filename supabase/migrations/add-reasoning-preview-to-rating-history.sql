-- ============================================
-- ADD REASONING PREVIEW TO RATING HISTORY
-- ============================================
-- Add reasoning_preview field to rating_history table
-- This stores a brief summary of the LLM calculation reasoning
-- for quick display without loading the full reasoning from matches table

-- Add reasoning_preview column to rating_history
ALTER TABLE rating_history
  ADD COLUMN IF NOT EXISTS reasoning_preview TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_rating_history_reasoning_preview 
  ON rating_history(reasoning_preview) 
  WHERE reasoning_preview IS NOT NULL;

-- Add comment
COMMENT ON COLUMN rating_history.reasoning_preview IS 
  'Brief summary of LLM calculation reasoning (max 1500 chars) for quick display';
