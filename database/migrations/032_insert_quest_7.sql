-- Insert Quest 7: Der erste Aufstieg
-- This migration inserts quest 7 for Chapter 1

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

  -- Insert Quest 7: Der erste Aufstieg
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
      7,
      'Der erste Aufstieg',
      'Das Lager liegt still hinter dir.
Nichts hält dich mehr dort – und nichts drängt dich fort. Du spürst nur diese klare Richtung: nach oben.

In der Umgebung ragen mehrere Erhebungen auf. Manche sanft, andere schroff. Jeder wirkt anders, je nach Licht, Wetter und Entfernung. Du weißt: Welcher Berg es wird, entscheidet nicht der Ort – sondern du.

Ein Aufstieg verändert mehr als die Perspektive.
Er trennt das Zurückgelassene vom Kommenden.',
      'Am Gipfel ist es stiller, als du erwartet hast.
Kein Triumph. Kein Lärm. Nur Weite.

Das Lager ist von hier aus nicht mehr sichtbar.
Der Weg, den du gefunden hast, wirkt klein. Aber eindeutig.

Du bleibst einen Moment stehen.
Nicht, um anzukommen – sondern um zu sehen.',
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
        7,
        'Der erste Aufstieg',
        'Das Lager liegt still hinter dir.
Nichts hält dich mehr dort – und nichts drängt dich fort. Du spürst nur diese klare Richtung: nach oben.

In der Umgebung ragen mehrere Erhebungen auf. Manche sanft, andere schroff. Jeder wirkt anders, je nach Licht, Wetter und Entfernung. Du weißt: Welcher Berg es wird, entscheidet nicht der Ort – sondern du.

Ein Aufstieg verändert mehr als die Perspektive.
Er trennt das Zurückgelassene vom Kommenden.',
        'Am Gipfel ist es stiller, als du erwartet hast.
Kein Triumph. Kein Lärm. Nur Weite.

Das Lager ist von hier aus nicht mehr sichtbar.
Der Weg, den du gefunden hast, wirkt klein. Aber eindeutig.

Du bleibst einen Moment stehen.
Nicht, um anzukommen – sondern um zu sehen.',
        NULL,
        NULL
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 7 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 7;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 7;
    END;
  END IF;

  -- Insert objective for Quest 7 (only if it doesn't exist)
  IF quest_uuid IS NOT NULL THEN
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Den eigenen Berg wählen'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Den eigenen Berg wählen'
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
            'Den eigenen Berg wählen',
            'Wähle einen Berg oder Hügel in deiner Umgebung, der sich wie ein echter Aufstieg anfühlt. Kein festgelegter Name, keine vorgeschriebene Route. Wichtig ist nur:

Du gehst aus eigener Entscheidung
Du trägst dich selbst hinauf
Du bleibst bis oben aufmerksam

Während der Wanderung:
Gehe gleichmäßig, nicht hastig
Pausen sind erlaubt, Umkehren nicht
Achte darauf, wie sich Atem, Beine und Fokus verändern

Der Berg passt sich dir nicht an.
Du passt dich ihm an – Schritt für Schritt.

Optionale Spiel-Mechaniken
🧭 Höhenmeter statt Distanz zählen
🫁 Atemkontrolle bei steilen Passagen
🎒 Leichter Rucksack als bewusste Last',
            1,
            NULL,
            NULL,
            0,
            true
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
              'Den eigenen Berg wählen',
              'Wähle einen Berg oder Hügel in deiner Umgebung, der sich wie ein echter Aufstieg anfühlt. Kein festgelegter Name, keine vorgeschriebene Route. Wichtig ist nur:

Du gehst aus eigener Entscheidung
Du trägst dich selbst hinauf
Du bleibst bis oben aufmerksam

Während der Wanderung:
Gehe gleichmäßig, nicht hastig
Pausen sind erlaubt, Umkehren nicht
Achte darauf, wie sich Atem, Beine und Fokus verändern

Der Berg passt sich dir nicht an.
Du passt dich ihm an – Schritt für Schritt.

Optionale Spiel-Mechaniken
🧭 Höhenmeter statt Distanz zählen
🫁 Atemkontrolle bei steilen Passagen
🎒 Leichter Rucksack als bewusste Last',
              1,
              NULL,
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
              'Den eigenen Berg wählen',
              'Wähle einen Berg oder Hügel in deiner Umgebung, der sich wie ein echter Aufstieg anfühlt. Kein festgelegter Name, keine vorgeschriebene Route. Wichtig ist nur:

Du gehst aus eigener Entscheidung
Du trägst dich selbst hinauf
Du bleibst bis oben aufmerksam

Während der Wanderung:
Gehe gleichmäßig, nicht hastig
Pausen sind erlaubt, Umkehren nicht
Achte darauf, wie sich Atem, Beine und Fokus verändern

Der Berg passt sich dir nicht an.
Du passt dich ihm an – Schritt für Schritt.

Optionale Spiel-Mechaniken
🧭 Höhenmeter statt Distanz zählen
🫁 Atemkontrolle bei steilen Passagen
🎒 Leichter Rucksack als bewusste Last',
              1,
              NULL,
              NULL,
              0,
              true
            );
          END;
        END;
      END IF;
    END;
  END IF;
END $$;
