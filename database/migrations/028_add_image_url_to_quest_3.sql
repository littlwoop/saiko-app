-- Add image_url to quest 3 (Fast.png)
-- This migration adds the image_url field to quest 3

DO $$
DECLARE
  chapter_uuid UUID;
  quest_uuid UUID;
BEGIN
  -- Get the chapter ID (Chapter 1)
  SELECT id INTO chapter_uuid FROM chapters WHERE chapter_number = 1 LIMIT 1;
  IF chapter_uuid IS NULL THEN
    SELECT id INTO chapter_uuid FROM quests WHERE chapter_number = 1 AND quest_number = 1 LIMIT 1;
  END IF;

  IF chapter_uuid IS NOT NULL THEN
    -- Find quest 3
    SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 3 LIMIT 1;
    
    -- If not found, try old structure
    IF quest_uuid IS NULL THEN
      SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 3 LIMIT 1;
    END IF;

    IF quest_uuid IS NOT NULL THEN
      -- Add image_url column if it doesn't exist (for old structure)
      BEGIN
        ALTER TABLE quests ADD COLUMN IF NOT EXISTS image_url TEXT;
      EXCEPTION WHEN duplicate_column THEN
        -- Column already exists, continue
        NULL;
      END;

      -- Update quest 3 with image_url
      BEGIN
        UPDATE quests 
        SET image_url = '/Quest/Fast.png'
        WHERE id = quest_uuid;
      EXCEPTION WHEN undefined_table THEN
        -- Fall back to old structure - add column if needed
        BEGIN
          ALTER TABLE quest_steps ADD COLUMN IF NOT EXISTS image_url TEXT;
        EXCEPTION WHEN duplicate_column THEN
          NULL;
        END;
        UPDATE quest_steps 
        SET image_url = '/Quest/Fast.png'
        WHERE id = quest_uuid;
      END;
    END IF;
  END IF;
END $$;
