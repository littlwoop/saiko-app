-- Add end_date column to user_challenge_starts table
-- This stores the calculated end date for repeating challenges (start_date + duration)
ALTER TABLE user_challenge_starts 
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the column
COMMENT ON COLUMN user_challenge_starts.end_date IS 'End date for repeating challenge (start_date + duration). Calculated when user joins the challenge.';
