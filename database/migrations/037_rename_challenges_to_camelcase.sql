-- Migration to rename all snake_case columns in challenges table to camelCase
-- This unifies the naming convention across the database
-- Uses DO block to conditionally rename columns only if they exist

DO $$
BEGIN
  -- Rename created_by_id to createdById (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'created_by_id'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN created_by_id TO "createdById";
  END IF;

  -- Rename creator_name to creatorName (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'creator_name'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN creator_name TO "creatorName";
  END IF;

  -- Rename start_date to startDate (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN start_date TO "startDate";
  END IF;

  -- Rename end_date to endDate (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN end_date TO "endDate";
  END IF;

  -- Rename total_points to totalPoints (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'total_points'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN total_points TO "totalPoints";
  END IF;

  -- Rename is_repeating to isRepeating (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'is_repeating'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN is_repeating TO "isRepeating";
  END IF;

  -- Rename is_collaborative to isCollaborative (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'is_collaborative'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN is_collaborative TO "isCollaborative";
  END IF;

  -- Rename challenge_type to challengeType (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'challenge_type'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN challenge_type TO "challengeType";
  END IF;

  -- Rename created_at to createdAt (if exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE challenges RENAME COLUMN created_at TO "createdAt";
  END IF;
END $$;

-- Update comment on isCollaborative column
COMMENT ON COLUMN challenges."isCollaborative" IS 'When true, all participants contribute to shared objectives. Progress is aggregated across all participants.';

-- Drop and recreate RLS policies that reference the old column names
-- First, drop existing policies on objectives table
DROP POLICY IF EXISTS "Users can view objectives for their challenges" ON objectives;
DROP POLICY IF EXISTS "Challenge creators can insert objectives" ON objectives;
DROP POLICY IF EXISTS "Challenge creators can update objectives" ON objectives;
DROP POLICY IF EXISTS "Challenge creators can delete objectives" ON objectives;

-- Recreate policies with new column names
CREATE POLICY "Users can view objectives for their challenges" ON objectives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = objectives.challenge_id 
      AND (
        challenges."createdById" = auth.uid()::text
        OR is_user_participant(challenges.participants, auth.uid()::text)
      )
    )
  );

CREATE POLICY "Challenge creators can insert objectives" ON objectives
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = objectives.challenge_id 
      AND challenges."createdById" = auth.uid()::text
    )
  );

CREATE POLICY "Challenge creators can update objectives" ON objectives
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = objectives.challenge_id 
      AND challenges."createdById" = auth.uid()::text
    )
  );

CREATE POLICY "Challenge creators can delete objectives" ON objectives
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM challenges 
      WHERE challenges.id = objectives.challenge_id 
      AND challenges."createdById" = auth.uid()::text
    )
  );

-- Drop and recreate policies on user_challenge_starts table
DROP POLICY IF EXISTS "Users can view challenge starts for their challenges" ON user_challenge_starts;

CREATE POLICY "Users can view challenge starts for their challenges"
  ON user_challenge_starts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM challenges 
      WHERE challenges.id = user_challenge_starts.challenge_id 
      AND (
        challenges."createdById" = auth.uid()::text
        OR is_user_participant(challenges.participants, auth.uid()::text)
      )
    )
  );
