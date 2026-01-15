-- Insert Quest 9: Die lange Etappe
-- This migration inserts quest 9 for Chapter 1

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

  -- Insert Quest 9: Die lange Etappe
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
      9,
      'Die lange Etappe',
      'Du stehst auf, ohne Eile.
Die Stille aus der Meditation ist noch da. Sie geht mit dir.

Du bleibst nicht stehen.
Nicht, weil du musst – sondern weil es jetzt Zeit ist, Strecke zu machen.

Der Weg ist nicht immer klar. Manchmal verliert er sich, taucht später wieder auf. Die Landschaft verändert sich langsam, fast unmerklich. Schritte reihen sich an Schritte. Gedanken kommen und gehen, ohne wichtig zu werden.

Der Atem bleibt ruhig.
Wie im Sitzen. Nur in Bewegung.

Irgendwann fällt dir ein Rhythmus auf.
Nicht bewusst gewählt – eher wiedergefunden.
Als hättest du ihn schon einmal geteilt.

Das Ziel ist nicht ein Ort.
Das Ziel ist die Distanz selbst.',
      'Irgendwann fällt dir auf, dass du die Schritte nicht mehr zählst.
Der Körper bewegt sich von selbst. Der Weg ist kein Widerstand mehr.

Für einen Moment hast du das Gefühl, dass jemand neben dir geht.
Im selben Takt.

Dann ist es wieder still.

Als du stehen bleibst, ist nichts spektakulär anders.
Aber du weißt: Du bist weiter weg vom Anfang – und näher an etwas, das du noch nicht benennen kannst.',
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
        9,
        'Die lange Etappe',
        'Du stehst auf, ohne Eile.
Die Stille aus der Meditation ist noch da. Sie geht mit dir.

Du bleibst nicht stehen.
Nicht, weil du musst – sondern weil es jetzt Zeit ist, Strecke zu machen.

Der Weg ist nicht immer klar. Manchmal verliert er sich, taucht später wieder auf. Die Landschaft verändert sich langsam, fast unmerklich. Schritte reihen sich an Schritte. Gedanken kommen und gehen, ohne wichtig zu werden.

Der Atem bleibt ruhig.
Wie im Sitzen. Nur in Bewegung.

Irgendwann fällt dir ein Rhythmus auf.
Nicht bewusst gewählt – eher wiedergefunden.
Als hättest du ihn schon einmal geteilt.

Das Ziel ist nicht ein Ort.
Das Ziel ist die Distanz selbst.',
        'Irgendwann fällt dir auf, dass du die Schritte nicht mehr zählst.
Der Körper bewegt sich von selbst. Der Weg ist kein Widerstand mehr.

Für einen Moment hast du das Gefühl, dass jemand neben dir geht.
Im selben Takt.

Dann ist es wieder still.

Als du stehen bleibst, ist nichts spektakulär anders.
Aber du weißt: Du bist weiter weg vom Anfang – und näher an etwas, das du noch nicht benennen kannst.',
        NULL,
        NULL
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 9 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 9;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 9;
    END;
  END IF;

  -- Insert objective for Quest 9 (only if it doesn't exist)
  IF quest_uuid IS NOT NULL THEN
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Ausdauer und Beständigkeit'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Ausdauer und Beständigkeit'
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
            'Ausdauer und Beständigkeit',
            'Die Schritte können auf mehrere Tage verteilt werden. Geschwindigkeit spielt keine Rolle. Pausen sind erlaubt, Umwege auch. Gehe, laufe, wandere!',
            50000,
            'Schritte',
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
              'Ausdauer und Beständigkeit',
              'Die Schritte können auf mehrere Tage verteilt werden. Geschwindigkeit spielt keine Rolle. Pausen sind erlaubt, Umwege auch. Gehe, laufe, wandere!',
              50000,
              'Schritte',
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
              'Ausdauer und Beständigkeit',
              'Die Schritte können auf mehrere Tage verteilt werden. Geschwindigkeit spielt keine Rolle. Pausen sind erlaubt, Umwege auch. Gehe, laufe, wandere!',
              50000,
              'Schritte',
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
