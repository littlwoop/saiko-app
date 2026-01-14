-- Create quests table
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  chapter_number INTEGER,
  quest_number INTEGER,
  image_url TEXT,
  intro_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chapter_number, quest_number)
);

-- Create quest_steps table
CREATE TABLE IF NOT EXISTS quest_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completion_text TEXT,
  completion_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quest_id, step_number)
);

-- Create quest_objectives table (objectives for quest steps)
CREATE TABLE IF NOT EXISTS quest_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_step_id UUID NOT NULL REFERENCES quest_steps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  unit TEXT,
  points_per_unit NUMERIC,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_quest_progress table (tracks which quests users have started)
CREATE TABLE IF NOT EXISTS user_quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES quest_steps(id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quest_id)
);

-- Create quest_progress_entries table (tracks progress on quest objectives)
CREATE TABLE IF NOT EXISTS quest_progress_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  quest_step_id UUID NOT NULL REFERENCES quest_steps(id) ON DELETE CASCADE,
  quest_objective_id UUID NOT NULL REFERENCES quest_objectives(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  notes TEXT,
  username TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quest_id, quest_step_id, quest_objective_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_quest_steps_quest_id ON quest_steps(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_steps_quest_step_number ON quest_steps(quest_id, step_number);
CREATE INDEX IF NOT EXISTS idx_quest_objectives_quest_step_id ON quest_objectives(quest_step_id);
CREATE INDEX IF NOT EXISTS idx_quest_objectives_order ON quest_objectives(quest_step_id, "order");
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user_id ON user_quest_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_quest_id ON user_quest_progress(quest_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user_quest ON user_quest_progress(user_id, quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_entries_user_id ON quest_progress_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_entries_quest_id ON quest_progress_entries(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_entries_quest_step_id ON quest_progress_entries(quest_step_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_entries_quest_objective_id ON quest_progress_entries(quest_objective_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_entries_user_objective ON quest_progress_entries(user_id, quest_objective_id);

-- Enable RLS (Row Level Security)
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_progress_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quests table
-- All authenticated users can view quests
CREATE POLICY "Users can view quests" ON quests
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete quests (adjust based on your admin setup)
-- For now, allow authenticated users to insert (you can restrict this later)
CREATE POLICY "Authenticated users can insert quests" ON quests
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update quests" ON quests
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete quests" ON quests
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS Policies for quest_steps table
CREATE POLICY "Users can view quest steps" ON quest_steps
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert quest steps" ON quest_steps
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update quest steps" ON quest_steps
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete quest steps" ON quest_steps
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS Policies for quest_objectives table
CREATE POLICY "Users can view quest objectives" ON quest_objectives
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert quest objectives" ON quest_objectives
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update quest objectives" ON quest_objectives
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete quest objectives" ON quest_objectives
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- RLS Policies for user_quest_progress table
-- Users can view their own quest progress
CREATE POLICY "Users can view their own quest progress" ON user_quest_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own quest progress
CREATE POLICY "Users can insert their own quest progress" ON user_quest_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own quest progress
CREATE POLICY "Users can update their own quest progress" ON user_quest_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own quest progress
CREATE POLICY "Users can delete their own quest progress" ON user_quest_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for quest_progress_entries table
-- Users can view their own quest progress entries
CREATE POLICY "Users can view their own quest progress entries" ON quest_progress_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own quest progress entries
CREATE POLICY "Users can insert their own quest progress entries" ON quest_progress_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own quest progress entries
CREATE POLICY "Users can update their own quest progress entries" ON quest_progress_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own quest progress entries
CREATE POLICY "Users can delete their own quest progress entries" ON quest_progress_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_quests_updated_at
  BEFORE UPDATE ON quests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quest_steps_updated_at
  BEFORE UPDATE ON quest_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quest_objectives_updated_at
  BEFORE UPDATE ON quest_objectives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_quest_progress_updated_at
  BEFORE UPDATE ON user_quest_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quest_progress_entries_updated_at
  BEFORE UPDATE ON quest_progress_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
