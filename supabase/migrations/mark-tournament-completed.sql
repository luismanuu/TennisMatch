-- ============================================
-- MARK TOURNAMENT AS COMPLETED
-- ============================================
-- This script marks a specific tournament as completed/finished
-- Replace 'YOUR_TOURNAMENT_ID' with the actual tournament ID

-- Option 1: Mark specific tournament by ID
-- Replace '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c' with your tournament ID
UPDATE tournaments
SET 
  status = 'completed',
  current_phase = 'completed',
  updated_at = NOW()
WHERE id = '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c';

-- Verify the update
SELECT 
  id,
  name,
  status,
  current_phase,
  tournament_type,
  updated_at
FROM tournaments
WHERE id = '5e0d74f3-f79d-49f8-b328-e1a74ff01b2c';

-- Option 2: If you want to mark multiple tournaments, uncomment and modify:
-- UPDATE tournaments
-- SET 
--   status = 'completed',
--   current_phase = 'completed',
--   updated_at = NOW()
-- WHERE id IN (
--   'tournament-id-1',
--   'tournament-id-2'
-- );

