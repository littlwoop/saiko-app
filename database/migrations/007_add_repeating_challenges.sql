-- Add is_repeating flag to challenges table
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS is_repeating BOOLEAN NOT NULL DEFAULT FALSE;

-- Create user_challenge_starts table to track when users start repeating challenges
CREATE TABLE IF NOT EXISTS user_challenge_starts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, challenge_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_challenge_starts_user_id ON user_challenge_starts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenge_starts_challenge_id ON user_challenge_starts(challenge_id);
CREATE INDEX IF NOT EXISTS idx_user_challenge_starts_user_challenge ON user_challenge_starts(user_id, challenge_id);

-- Enable RLS
ALTER TABLE user_challenge_starts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own challenge starts
CREATE POLICY "Users can view their own challenge starts"
  ON user_challenge_starts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can view challenge starts for challenges they participate in or created
CREATE POLICY "Users can view challenge starts for their challenges"
  ON user_challenge_starts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM challenges 
      WHERE challenges.id = user_challenge_starts.challenge_id 
      AND (
        challenges."createdById" = auth.uid()::text
        OR is_user_participant(challenges.participants, auth.uid()::text)
      )
    )
  );

-- Policy: Users can insert their own challenge starts
CREATE POLICY "Users can insert their own challenge starts"
  ON user_challenge_starts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own challenge starts
CREATE POLICY "Users can update their own challenge starts"
  ON user_challenge_starts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own challenge starts
CREATE POLICY "Users can delete their own challenge starts"
  ON user_challenge_starts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_challenge_starts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_challenge_starts_updated_at
  BEFORE UPDATE ON user_challenge_starts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_challenge_starts_updated_at();
