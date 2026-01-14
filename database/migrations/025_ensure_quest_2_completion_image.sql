-- Ensure quest 2 has the completion image set
-- This migration works with both old and new table structures

DO $$
DECLARE
  chapter_uuid UUID;
  quest_uuid UUID;
BEGIN
  -- Try to find chapter 1 (new structure) or quest with chapter_number = 1 (old structure)
  SELECT id INTO chapter_uuid FROM chapters WHERE chapter_number = 1 LIMIT 1;
  IF chapter_uuid IS NULL THEN
    SELECT id INTO chapter_uuid FROM quests WHERE chapter_number = 1 LIMIT 1;
  END IF;

  IF chapter_uuid IS NOT NULL THEN
    -- Try to find quest 2 (new structure: quests table with chapter_id)
    SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 2 LIMIT 1;
    
    -- If not found, try old structure (quest_steps table)
    IF quest_uuid IS NULL THEN
      SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 2 LIMIT 1;
    END IF;

    IF quest_uuid IS NOT NULL THEN
      -- Update quest 2 to ensure it has the completion image
      -- Try new structure first
      BEGIN
        UPDATE quests 
        SET completion_image_url = '/Quest/Shelter.png'
        WHERE id = quest_uuid 
        AND (completion_image_url IS NULL OR completion_image_url = '');
      EXCEPTION WHEN undefined_table THEN
        -- Fall back to old structure
        UPDATE quest_steps 
        SET completion_image_url = '/Quest/Shelter.png'
        WHERE id = quest_uuid 
        AND (completion_image_url IS NULL OR completion_image_url = '');
      END;
    END IF;
  END IF;
END $$;
