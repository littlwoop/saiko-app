-- Migration to rename quests to chapters and quest_steps to quests
-- This changes the terminology:
-- - quests table → chapters table
-- - quest_steps table → quests table
-- - step_number → quest_number

-- Step 1: Rename quests table to chapters
ALTER TABLE IF EXISTS quests RENAME TO chapters;

-- Step 2: Rename quest_steps table to quests
ALTER TABLE IF EXISTS quest_steps RENAME TO quests;

-- Step 3: Rename foreign key columns
-- In quests table (formerly quest_steps), rename quest_id to chapter_id
ALTER TABLE IF EXISTS quests RENAME COLUMN quest_id TO chapter_id;

-- Step 4: Rename step_number to quest_number in quests table
ALTER TABLE IF EXISTS quests RENAME COLUMN step_number TO quest_number;

-- Step 5: Update unique constraint name in quests table
ALTER TABLE IF EXISTS quests DROP CONSTRAINT IF EXISTS quest_steps_quest_id_step_number_key;
ALTER TABLE IF EXISTS quests ADD CONSTRAINT quests_chapter_id_quest_number_key UNIQUE(chapter_id, quest_number);

-- Step 6: Rename foreign key constraint in quests table
ALTER TABLE IF EXISTS quests DROP CONSTRAINT IF EXISTS quest_steps_quest_id_fkey;
ALTER TABLE IF EXISTS quests ADD CONSTRAINT quests_chapter_id_fkey 
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE;

-- Step 7: Update quest_objectives table - rename quest_step_id to quest_id
ALTER TABLE IF EXISTS quest_objectives RENAME COLUMN quest_step_id TO quest_id;

-- Step 8: Update foreign key constraint in quest_objectives
ALTER TABLE IF EXISTS quest_objectives DROP CONSTRAINT IF EXISTS quest_objectives_quest_step_id_fkey;
ALTER TABLE IF EXISTS quest_objectives ADD CONSTRAINT quest_objectives_quest_id_fkey 
  FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;

-- Step 9: Update user_quest_progress table
-- Rename quest_id to chapter_id (since it references chapters now)
ALTER TABLE IF EXISTS user_quest_progress RENAME COLUMN quest_id TO chapter_id;
-- Rename current_step_id to current_quest_id
ALTER TABLE IF EXISTS user_quest_progress RENAME COLUMN current_step_id TO current_quest_id;

-- Step 10: Update foreign key constraints in user_quest_progress
ALTER TABLE IF EXISTS user_quest_progress DROP CONSTRAINT IF EXISTS user_quest_progress_quest_id_fkey;
ALTER TABLE IF EXISTS user_quest_progress ADD CONSTRAINT user_quest_progress_chapter_id_fkey 
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS user_quest_progress DROP CONSTRAINT IF EXISTS user_quest_progress_current_step_id_fkey;
ALTER TABLE IF EXISTS user_quest_progress ADD CONSTRAINT user_quest_progress_current_quest_id_fkey 
  FOREIGN KEY (current_quest_id) REFERENCES quests(id);

-- Step 11: Update unique constraint in user_quest_progress
ALTER TABLE IF EXISTS user_quest_progress DROP CONSTRAINT IF EXISTS user_quest_progress_user_id_quest_id_key;
ALTER TABLE IF EXISTS user_quest_progress ADD CONSTRAINT user_quest_progress_user_id_chapter_id_key 
  UNIQUE(user_id, chapter_id);

-- Step 12: Update quest_progress_entries table
-- Rename quest_id to chapter_id
ALTER TABLE IF EXISTS quest_progress_entries RENAME COLUMN quest_id TO chapter_id;
-- Rename quest_step_id to quest_id
ALTER TABLE IF EXISTS quest_progress_entries RENAME COLUMN quest_step_id TO quest_id;

-- Step 13: Update foreign key constraints in quest_progress_entries
ALTER TABLE IF EXISTS quest_progress_entries DROP CONSTRAINT IF EXISTS quest_progress_entries_quest_id_fkey;
ALTER TABLE IF EXISTS quest_progress_entries ADD CONSTRAINT quest_progress_entries_chapter_id_fkey 
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS quest_progress_entries DROP CONSTRAINT IF EXISTS quest_progress_entries_quest_step_id_fkey;
ALTER TABLE IF EXISTS quest_progress_entries ADD CONSTRAINT quest_progress_entries_quest_id_fkey 
  FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;

-- Step 14: Update unique constraint in quest_progress_entries
ALTER TABLE IF EXISTS quest_progress_entries DROP CONSTRAINT IF EXISTS quest_progress_entries_user_id_quest_id_quest_step_id_quest_objective_id_key;
ALTER TABLE IF EXISTS quest_progress_entries ADD CONSTRAINT quest_progress_entries_user_id_chapter_id_quest_id_quest_objective_id_key 
  UNIQUE(user_id, chapter_id, quest_id, quest_objective_id);

-- Step 15: Update indexes
DROP INDEX IF EXISTS idx_quest_steps_quest_id;
CREATE INDEX IF NOT EXISTS idx_quests_chapter_id ON quests(chapter_id);

DROP INDEX IF EXISTS idx_quest_steps_quest_step_number;
CREATE INDEX IF NOT EXISTS idx_quests_chapter_quest_number ON quests(chapter_id, quest_number);

DROP INDEX IF EXISTS idx_quest_objectives_quest_step_id;
CREATE INDEX IF NOT EXISTS idx_quest_objectives_quest_id ON quest_objectives(quest_id);

DROP INDEX IF EXISTS idx_quest_objectives_order;
CREATE INDEX IF NOT EXISTS idx_quest_objectives_order ON quest_objectives(quest_id, "order");

DROP INDEX IF EXISTS idx_user_quest_progress_quest_id;
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_chapter_id ON user_quest_progress(chapter_id);

DROP INDEX IF EXISTS idx_user_quest_progress_user_quest;
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user_chapter ON user_quest_progress(user_id, chapter_id);

DROP INDEX IF EXISTS idx_quest_progress_entries_quest_id;
CREATE INDEX IF NOT EXISTS idx_quest_progress_entries_chapter_id ON quest_progress_entries(chapter_id);

DROP INDEX IF EXISTS idx_quest_progress_entries_quest_step_id;
CREATE INDEX IF NOT EXISTS idx_quest_progress_entries_quest_id ON quest_progress_entries(quest_id);

-- Step 16: Update RLS policies - rename policies for chapters (formerly quests)
DROP POLICY IF EXISTS "Users can view quests" ON chapters;
CREATE POLICY "Users can view chapters" ON chapters
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert quests" ON chapters;
CREATE POLICY "Authenticated users can insert chapters" ON chapters
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update quests" ON chapters;
CREATE POLICY "Authenticated users can update chapters" ON chapters
  FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete quests" ON chapters;
CREATE POLICY "Authenticated users can delete chapters" ON chapters
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Step 17: Update RLS policies for quests (formerly quest_steps)
DROP POLICY IF EXISTS "Users can view quest steps" ON quests;
CREATE POLICY "Users can view quests" ON quests
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert quest steps" ON quests;
CREATE POLICY "Authenticated users can insert quests" ON quests
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update quest steps" ON quests;
CREATE POLICY "Authenticated users can update quests" ON quests
  FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete quest steps" ON quests;
CREATE POLICY "Authenticated users can delete quests" ON quests
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Step 18: Update RLS policies for quest_objectives
DROP POLICY IF EXISTS "Users can view quest objectives" ON quest_objectives;
CREATE POLICY "Users can view quest objectives" ON quest_objectives
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert quest objectives" ON quest_objectives;
CREATE POLICY "Authenticated users can insert quest objectives" ON quest_objectives
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update quest objectives" ON quest_objectives;
CREATE POLICY "Authenticated users can update quest objectives" ON quest_objectives
  FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete quest objectives" ON quest_objectives;
CREATE POLICY "Authenticated users can delete quest objectives" ON quest_objectives
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Step 19: Update trigger names
DROP TRIGGER IF EXISTS update_quests_updated_at ON chapters;
CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quest_steps_updated_at ON quests;
CREATE TRIGGER update_quests_updated_at
  BEFORE UPDATE ON quests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
