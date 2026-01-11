-- Migrate existing objectives from JSON field to objectives table
-- This migration extracts objectives from the challenges.objectives JSON field
-- and inserts them into the new objectives table

-- Helper function to safely parse JSON string to JSONB (if not already created)
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

DO $$
DECLARE
  challenge_record RECORD;
  objective_record JSONB;
  objective_index INTEGER;
  objectives_jsonb JSONB;
  objectives_text TEXT;
BEGIN
  -- Loop through all challenges that have objectives
  -- Cast objectives to TEXT first to avoid automatic JSON parsing issues
  FOR challenge_record IN 
    SELECT id, objectives::TEXT as objectives_text
    FROM challenges 
    WHERE objectives IS NOT NULL
  LOOP
    -- Get the TEXT value
    objectives_text := challenge_record.objectives_text;
    
    -- Skip if empty or null
    IF objectives_text IS NULL OR objectives_text = '' OR objectives_text = 'null' THEN
      CONTINUE;
    END IF;
    
    -- Convert JSON string to JSONB for processing using safe function
    objectives_jsonb := safe_jsonb_parse(objectives_text);
    
    -- Skip if parsing failed or it's not an array
    IF objectives_jsonb IS NULL OR jsonb_typeof(objectives_jsonb) != 'array' THEN
      CONTINUE;
    END IF;
    
    -- Reset index for each challenge
    objective_index := 0;
    
    -- Loop through each objective in the JSON array
    FOR objective_record IN 
      SELECT * FROM jsonb_array_elements(objectives_jsonb)
    LOOP
      -- Insert objective into the new table
      INSERT INTO objectives (
        id,
        challenge_id,
        title,
        description,
        target_value,
        unit,
        points_per_unit,
        "order",
        created_at,
        updated_at
      )
      VALUES (
        -- Use the ID from JSON if it's a valid UUID, otherwise generate a new one
        CASE 
          WHEN objective_record->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
          THEN (objective_record->>'id')::UUID
          ELSE gen_random_uuid()
        END,
        challenge_record.id,
        COALESCE(objective_record->>'title', ''),
        NULLIF(objective_record->>'description', ''),
        CASE 
          WHEN objective_record->>'targetValue' IS NOT NULL 
          THEN (objective_record->>'targetValue')::NUMERIC
          ELSE NULL
        END,
        NULLIF(objective_record->>'unit', ''),
        CASE 
          WHEN objective_record->>'pointsPerUnit' IS NOT NULL 
          THEN (objective_record->>'pointsPerUnit')::NUMERIC
          ELSE NULL
        END,
        objective_index,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING; -- Skip if objective with this ID already exists
      
      objective_index := objective_index + 1;
    END LOOP;
  END LOOP;
END $$;

-- Optional: After verifying the migration, you can remove the objectives JSON column
-- Uncomment the following lines when ready to remove the old column:
-- ALTER TABLE challenges DROP COLUMN IF EXISTS objectives;
