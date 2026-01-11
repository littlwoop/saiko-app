-- Create objectives table
CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  unit TEXT,
  points_per_unit NUMERIC,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_objectives_challenge_id ON objectives(challenge_id);
CREATE INDEX IF NOT EXISTS idx_objectives_order ON objectives(challenge_id, "order");

-- Helper function to safely parse JSON string to JSONB (for TEXT input)
CREATE OR REPLACE FUNCTION safe_jsonb_parse(input_text TEXT)
RETURNS JSONB AS $$
BEGIN
  IF input_text IS NULL OR input_text = '' OR input_text = 'null' THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    RETURN input_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to safely check if user is in participants array (handles JSONB)
CREATE OR REPLACE FUNCTION is_user_participant(participants_data JSONB, user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF participants_data IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF jsonb_typeof(participants_data) != 'array' THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM jsonb_array_elements_text(participants_data) AS participant_id
    WHERE participant_id = user_id
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enable RLS (Row Level Security)
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view objectives for challenges they participate in or created
CREATE POLICY "Users can view objectives for their challenges" ON objectives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = objectives.challenge_id 
      AND (
        challenges."createdById" = auth.uid()::text
        OR is_user_participant(challenges.participants, auth.uid()::text)
      )
    )
  );

-- Only challenge creators can insert/update/delete objectives
CREATE POLICY "Challenge creators can insert objectives" ON objectives
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = objectives.challenge_id 
      AND challenges."createdById" = auth.uid()::text
    )
  );

CREATE POLICY "Challenge creators can update objectives" ON objectives
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = objectives.challenge_id 
      AND challenges."createdById" = auth.uid()::text
    )
  );

CREATE POLICY "Challenge creators can delete objectives" ON objectives
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = objectives.challenge_id 
      AND challenges."createdById" = auth.uid()::text
    )
  );

-- Add updated_at trigger (reuse existing function if it exists)
CREATE TRIGGER update_objectives_updated_at 
  BEFORE UPDATE ON objectives 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
