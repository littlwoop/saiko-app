-- Create personal_bests table
CREATE TABLE IF NOT EXISTS personal_bests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL CHECK (achievement_type IN ('5k', '10k', 'half_marathon', 'marathon', 'longest_run', 'longest_bike_ride')),
  time_seconds INTEGER, -- For time-based achievements (5k, 10k, half, marathon)
  distance_meters INTEGER, -- For distance-based achievements (longest_run, longest_bike_ride)
  achievement_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_personal_bests_user_id ON personal_bests(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_bests_type ON personal_bests(achievement_type);

-- Enable RLS (Row Level Security)
ALTER TABLE personal_bests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own personal bests" ON personal_bests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personal bests" ON personal_bests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personal bests" ON personal_bests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personal bests" ON personal_bests
  FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_personal_bests_updated_at 
  BEFORE UPDATE ON personal_bests 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

