-- Add is_collaborative flag to challenges table
-- When true, all participants contribute to shared objectives instead of individual progress
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment to explain the column
COMMENT ON COLUMN challenges.is_collaborative IS 'When true, all participants contribute to shared objectives. Progress is aggregated across all participants.';
