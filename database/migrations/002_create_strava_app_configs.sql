-- Create strava_app_configs table
CREATE TABLE IF NOT EXISTS strava_app_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_strava_app_configs_user_id ON strava_app_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_app_configs_active ON strava_app_configs(is_active);

-- Enable RLS (Row Level Security)
ALTER TABLE strava_app_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own Strava app configs" ON strava_app_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Strava app configs" ON strava_app_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Strava app configs" ON strava_app_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Strava app configs" ON strava_app_configs
  FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_strava_app_configs_updated_at 
  BEFORE UPDATE ON strava_app_configs 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
