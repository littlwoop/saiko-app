-- Safe migration for strava_connections table
-- This handles cases where some parts already exist

-- Create strava_connections table
CREATE TABLE IF NOT EXISTS strava_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_athlete_id BIGINT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_strava_connections_user_id ON strava_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_connections_strava_athlete_id ON strava_connections(strava_athlete_id);

-- Enable RLS (Row Level Security)
ALTER TABLE strava_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop first if they exist)
DROP POLICY IF EXISTS "Users can view their own Strava connections" ON strava_connections;
DROP POLICY IF EXISTS "Users can insert their own Strava connections" ON strava_connections;
DROP POLICY IF EXISTS "Users can update their own Strava connections" ON strava_connections;
DROP POLICY IF EXISTS "Users can delete their own Strava connections" ON strava_connections;

CREATE POLICY "Users can view their own Strava connections" ON strava_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Strava connections" ON strava_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Strava connections" ON strava_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Strava connections" ON strava_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Create or replace the updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS update_strava_connections_updated_at ON strava_connections;
CREATE TRIGGER update_strava_connections_updated_at 
  BEFORE UPDATE ON strava_connections 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
