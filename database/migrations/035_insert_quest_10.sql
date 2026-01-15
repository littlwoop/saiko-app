-- Insert Quest 10: Der erhöhte Punkt
-- This migration inserts quest 10 for Chapter 1

DO $$
DECLARE
  chapter_uuid UUID;
  quest_uuid UUID;
  objective_exists BOOLEAN := FALSE;
BEGIN
  -- Get the chapter ID (Chapter 1)
  -- Try new structure first (chapters), fall back to old (quests)
  SELECT id INTO chapter_uuid FROM chapters WHERE chapter_number = 1 LIMIT 1;
  IF chapter_uuid IS NULL THEN
    SELECT id INTO chapter_uuid FROM quests WHERE chapter_number = 1 AND quest_number = 1 LIMIT 1;
  END IF;

  IF chapter_uuid IS NULL THEN
    RAISE EXCEPTION 'Chapter 1 not found. Please run migration 023 first.';
  END IF;

  -- Insert Quest 10: Der erhöhte Punkt
  -- Try new structure first (quests table), fall back to old (quest_steps)
  BEGIN
    INSERT INTO quests (
      id,
      chapter_id,
      quest_number,
      title,
      description,
      completion_text,
      completion_image_url,
      image_url
    ) VALUES (
      gen_random_uuid(),
      chapter_uuid,
      10,
      'Der erhöhte Punkt',
      'Die lange Etappe liegt hinter dir.
Der Boden unter den Füßen wird fester, der Weg breiter. Er trägt dein Gewicht, ohne nachzugeben. Du gehst nicht mehr nur durch die Landschaft – du bewegst dich auf einer Linie, die Bestand hat.

Dann fällt es dir auf.
Nicht direkt vor dir, sondern seitlich, auf einem Hügel. Etwas unterbricht die gleichmäßigen Farben. Kein Lichtstrahl, kein Signal – nur ein kurzes Aufblitzen, wenn sich der Winkel ändert.

Du bleibst stehen.
Der Weg würde weiterführen. Aber das dort oben zieht deine Aufmerksamkeit an.

Manche Abzweigungen verlangen keine Erklärung.',
      'Je näher du kommst, desto klarer wird das Glänzen.
Kein Blendwerk. Kein Zufall. Es ist da – ruhig, beständig, unabhängig von dir.

Als du den Höhenpunkt erreichst, öffnet sich die Sicht. Der Weg unter dir wirkt kleiner, überschaubar. Das Glänzen ist jetzt greifbar nah.

Etwas dort unten reflektiert das Licht anders als Stein oder Wasser.
Kurz nur. Dann verschwindet es wieder aus deinem Blickfeld.

Du weißt nicht, was es ist.
Aber du weißt, dass du hinunter musst.

Der Weg, den du gerade gegangen bist, reicht nicht mehr aus.',
      NULL,
      NULL
    )
    ON CONFLICT (chapter_id, quest_number) DO NOTHING
    RETURNING id INTO quest_uuid;
    EXCEPTION WHEN undefined_table THEN
      -- Fall back to old structure
      BEGIN
        ALTER TABLE quest_steps ADD COLUMN IF NOT EXISTS image_url TEXT;
      EXCEPTION WHEN duplicate_column THEN
        NULL;
      END;
      INSERT INTO quest_steps (
        id,
        quest_id,
        step_number,
        title,
        description,
        completion_text,
        completion_image_url,
        image_url
      ) VALUES (
        gen_random_uuid(),
        chapter_uuid,
        10,
        'Der erhöhte Punkt',
        'Die lange Etappe liegt hinter dir.
Der Boden unter den Füßen wird fester, der Weg breiter. Er trägt dein Gewicht, ohne nachzugeben. Du gehst nicht mehr nur durch die Landschaft – du bewegst dich auf einer Linie, die Bestand hat.

Dann fällt es dir auf.
Nicht direkt vor dir, sondern seitlich, auf einem Hügel. Etwas unterbricht die gleichmäßigen Farben. Kein Lichtstrahl, kein Signal – nur ein kurzes Aufblitzen, wenn sich der Winkel ändert.

Du bleibst stehen.
Der Weg würde weiterführen. Aber das dort oben zieht deine Aufmerksamkeit an.

Manche Abzweigungen verlangen keine Erklärung.',
        'Je näher du kommst, desto klarer wird das Glänzen.
Kein Blendwerk. Kein Zufall. Es ist da – ruhig, beständig, unabhängig von dir.

Als du den Höhenpunkt erreichst, öffnet sich die Sicht. Der Weg unter dir wirkt kleiner, überschaubar. Das Glänzen ist jetzt greifbar nah.

Etwas dort unten reflektiert das Licht anders als Stein oder Wasser.
Kurz nur. Dann verschwindet es wieder aus deinem Blickfeld.

Du weißt nicht, was es ist.
Aber du weißt, dass du hinunter musst.

Der Weg, den du gerade gegangen bist, reicht nicht mehr aus.',
        NULL,
        NULL
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 10 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 10;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 10;
    END;
  END IF;

  -- Insert objective for Quest 10 (only if it doesn't exist)
  IF quest_uuid IS NOT NULL THEN
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Erreiche den Hügel mit freier Sicht'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Erreiche den Hügel mit freier Sicht'
          ) INTO objective_exists;
        END;
      END;
      
      IF NOT objective_exists THEN
        BEGIN
          INSERT INTO quest_objectives (
            quest_id,
            title,
            description,
            target_value,
            unit,
            points_per_unit,
            "order",
            is_binary
          ) VALUES (
            quest_uuid,
            'Erreiche den Hügel mit freier Sicht',
            '500 Höhenmeter im Aufstieg bewältigen',
            500,
            'Höhenmeter',
            NULL,
            0,
            false
          );
        EXCEPTION WHEN undefined_column THEN
          -- Fall back to old structure (without is_binary column)
          BEGIN
            INSERT INTO quest_objectives (
              quest_step_id,
              title,
              description,
              target_value,
              unit,
              points_per_unit,
              "order"
            ) VALUES (
              quest_uuid,
              'Erreiche den Hügel mit freier Sicht',
              '500 Höhenmeter im Aufstieg bewältigen',
              500,
              'Höhenmeter',
              NULL,
              0
            );
          EXCEPTION WHEN undefined_column THEN
            -- Try with is_binary column for old structure
            INSERT INTO quest_objectives (
              quest_step_id,
              title,
              description,
              target_value,
              unit,
              points_per_unit,
              "order",
              is_binary
            ) VALUES (
              quest_uuid,
              'Erreiche den Hügel mit freier Sicht',
              '500 Höhenmeter im Aufstieg bewältigen',
              500,
              'Höhenmeter',
              NULL,
              0,
              false
            );
          END;
        END;
      END IF;
    END;
  END IF;
END $$;
