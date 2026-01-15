-- Insert Quest 8: In der Stille bleiben
-- This migration inserts quest 8 for Chapter 1

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

  -- Insert Quest 8: In der Stille bleiben
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
      8,
      'In der Stille bleiben',
      'Nach dem Aufstieg brauchst du nichts weiter zu tun.
Kein Sammeln. Kein Planen. Kein Weitergehen.

Der Körper ist müde, aber stabil.
Der Atem hat seinen Rhythmus gefunden. Jetzt ist der Moment, nicht zu reagieren.

Du setzt dich.
Nicht um etwas zu erreichen – sondern um da zu sein.

In der Stille taucht etwas auf.
Kein Bild. Kein Name.
Nur das Gefühl, dass diese Ruhe früher nicht allein war.

Du folgst dem Atem.
Gedanken kommen, gehen.

Zwischen zwei Atemzügen entsteht ein kurzer Moment von Vertrautheit.
Als hättest du schon einmal so gesessen.
Nicht allein.',
      'Wenn du die Augen öffnest, ist alles unverändert.
Wald. Licht. Wind.

Doch etwas ist klarer als zuvor:
Was du verloren hast, war kein Ort.',
      NULL,
      '/Quest/Meditation.png'
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
        8,
        'In der Stille bleiben',
        'Nach dem Aufstieg brauchst du nichts weiter zu tun.
Kein Sammeln. Kein Planen. Kein Weitergehen.

Der Körper ist müde, aber stabil.
Der Atem hat seinen Rhythmus gefunden. Jetzt ist der Moment, nicht zu reagieren.

Du setzt dich.
Nicht um etwas zu erreichen – sondern um da zu sein.

In der Stille taucht etwas auf.
Kein Bild. Kein Name.
Nur das Gefühl, dass diese Ruhe früher nicht allein war.

Du folgst dem Atem.
Gedanken kommen, gehen.

Zwischen zwei Atemzügen entsteht ein kurzer Moment von Vertrautheit.
Als hättest du schon einmal so gesessen.
Nicht allein.',
        'Wenn du die Augen öffnest, ist alles unverändert.
Wald. Licht. Wind.

Doch etwas ist klarer als zuvor:
Was du verloren hast, war kein Ort.',
        NULL,
        '/Quest/Meditation.png'
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 8 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 8;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 8;
    END;
  END IF;

  -- Insert objective for Quest 8 (only if it doesn't exist)
  IF quest_uuid IS NOT NULL THEN
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Meditation'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Meditation'
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
            'Meditation',
            'Ruhe und Klarheit finden',
            20,
            'Minuten',
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
              'Meditation',
              'Ruhe und Klarheit finden',
              20,
              'Minuten',
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
              'Meditation',
              'Ruhe und Klarheit finden',
              20,
              'Minuten',
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
