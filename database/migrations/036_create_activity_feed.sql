-- Create activity feed table
-- This table stores various activity events for the feed

CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'objective_progress',
    'challenge_join',
    'challenge_complete',
    'quest_join',
    'quest_complete'
  )),
  -- Reference fields (can be null depending on activity type)
  -- All foreign keys use CASCADE DELETE to automatically remove feed entries when referenced entities are deleted
  challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
  objective_id UUID REFERENCES objectives(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE,
  quest_objective_id UUID REFERENCES quest_objectives(id) ON DELETE CASCADE,
  -- Additional data stored as JSONB for flexibility
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_activity_type ON activity_feed(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_feed_challenge_id ON activity_feed(challenge_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_chapter_id ON activity_feed(chapter_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_created ON activity_feed(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all activity feed entries
CREATE POLICY "Users can view activity feed"
  ON activity_feed
  FOR SELECT
  USING (true);

-- Policy: Users can insert their own activity feed entries
CREATE POLICY "Users can insert their own activity feed"
  ON activity_feed
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own activity feed entries (for privacy)
CREATE POLICY "Users can delete their own activity feed"
  ON activity_feed
  FOR DELETE
  USING (auth.uid() = user_id);
