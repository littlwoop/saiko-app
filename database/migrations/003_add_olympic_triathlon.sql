-- Add olympic_triathlon to personal_bests achievement_type constraint
-- This migration updates the CHECK constraint to include the new achievement type

-- Find and drop any existing CHECK constraints on achievement_type
DO $$ 
DECLARE
    constraint_name_var text;
BEGIN
    -- Find the constraint name
    SELECT tc.constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'personal_bests'
      AND tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
    LIMIT 1;
    
    -- Drop if found
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE personal_bests DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name_var);
    END IF;
END $$;

-- Add the new constraint with olympic_triathlon included
ALTER TABLE personal_bests 
ADD CONSTRAINT personal_bests_achievement_type_check 
CHECK (achievement_type IN ('5k', '10k', 'half_marathon', 'marathon', 'olympic_triathlon', 'longest_run', 'longest_bike_ride'));

