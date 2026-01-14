-- Insert Quest 2: Errichte einen provisorischen Shelter
-- This migration inserts quest 2 for Chapter 1

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

  -- Insert Quest 2: Errichte einen provisorischen Shelter
  -- Try new structure first (quests table), fall back to old (quest_steps)
  BEGIN
    INSERT INTO quests (
      id,
      chapter_id,
      quest_number,
      title,
      description,
      completion_text,
      completion_image_url
    ) VALUES (
      gen_random_uuid(),
      chapter_uuid,
      2,
      'Errichte einen provisorischen Shelter',
      'Du sammelst Treibholz, dicke Äste, flache Steine. Alles fühlt sich roh an, unverarbeitet. Dieses Land schenkt nichts – es lässt sich nur nutzen, wenn du selbst Arbeit hineinlegst.

Dein Körper ist das erste Werkzeug.
Um den Shelter errichten zu können, musst du deine Kraft einsetzen und unter Beweis stellen, dass du bereit bist, Verantwortung für diesen Ort zu übernehmen.

Aufgabe – Körperarbeit
Führe die folgenden Körpergewichtsübungen aus, um den Shelter fertigzustellen:

🪵 Kniebeugen – X Wiederholungen
(Fundament setzen, Stand finden)

🌿 Liegestütze – X Wiederholungen
(Stützen errichten, Gewicht tragen)

🧗 Plank / Unterarmstütz – X Sekunden
(Stabilität halten, Wind standhalten)

🔥 Optional: Ausfallschritte oder Burpees – X Wiederholungen
(letzte Kraft sammeln, Shelter abschließen)

Jeder saubere Bewegungsablauf ist ein Balken.
Jede Wiederholung macht den Shelter stabiler.',
      'Als du fertig bist, trittst du einen Schritt zurück.
Der Shelter ist einfach – aber er steht. Holz, Stoffreste, Laub. Nichts Überflüssiges. Genau richtig.

Du setzt dich hinein. Der Wind ist gedämpft.
Zum ersten Mal seit deinem Erwachen bist du nicht mehr nur Gast.

Quest 2 abgeschlossen.
Du hast einen Platz in diesem Land.',
      '/Quest/Shelter.png'
    )
    ON CONFLICT (chapter_id, quest_number) DO NOTHING
    RETURNING id INTO quest_uuid;
    EXCEPTION WHEN undefined_table THEN
      -- Fall back to old structure
      INSERT INTO quest_steps (
        id,
        quest_id,
        step_number,
        title,
        description,
        completion_text,
        completion_image_url
      ) VALUES (
        gen_random_uuid(),
        chapter_uuid,
        2,
        'Errichte einen provisorischen Shelter',
        'Du sammelst Treibholz, dicke Äste, flache Steine. Alles fühlt sich roh an, unverarbeitet. Dieses Land schenkt nichts – es lässt sich nur nutzen, wenn du selbst Arbeit hineinlegst.

Dein Körper ist das erste Werkzeug.
Um den Shelter errichten zu können, musst du deine Kraft einsetzen und unter Beweis stellen, dass du bereit bist, Verantwortung für diesen Ort zu übernehmen.

Aufgabe – Körperarbeit
Führe die folgenden Körpergewichtsübungen aus, um den Shelter fertigzustellen:

🪵 Kniebeugen – X Wiederholungen
(Fundament setzen, Stand finden)

🌿 Liegestütze – X Wiederholungen
(Stützen errichten, Gewicht tragen)

🧗 Plank / Unterarmstütz – X Sekunden
(Stabilität halten, Wind standhalten)

🔥 Optional: Ausfallschritte oder Burpees – X Wiederholungen
(letzte Kraft sammeln, Shelter abschließen)

Jeder saubere Bewegungsablauf ist ein Balken.
Jede Wiederholung macht den Shelter stabiler.',
        'Als du fertig bist, trittst du einen Schritt zurück.
Der Shelter ist einfach – aber er steht. Holz, Stoffreste, Laub. Nichts Überflüssiges. Genau richtig.

Du setzt dich hinein. Der Wind ist gedämpft.
Zum ersten Mal seit deinem Erwachen bist du nicht mehr nur Gast.

Quest 2 abgeschlossen.
Du hast einen Platz in diesem Land.',
        '/Quest/Shelter.png'
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 2 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 2;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 2;
    END;
  END IF;

  -- Insert objectives for Quest 2 (only if they don't exist)
  IF quest_uuid IS NOT NULL THEN
    -- Kniebeugen
    BEGIN
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Kniebeugen'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Kniebeugen'
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
          "order"
        ) VALUES (
          quest_uuid,
          'Kniebeugen',
          'Fundament setzen, Stand finden',
          50,
          NULL,
          NULL,
          0
        );
      EXCEPTION WHEN undefined_column THEN
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
          'Kniebeugen',
          'Fundament setzen, Stand finden',
          50,
          NULL,
          NULL,
          0
        );
      END;
      END IF;
    END;

    -- Liegestütze
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Liegestütze'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Liegestütze'
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
          "order"
        ) VALUES (
          quest_uuid,
          'Liegestütze',
          'Stützen errichten, Gewicht tragen',
          30,
          NULL,
          NULL,
          1
        );
      EXCEPTION WHEN undefined_column THEN
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
          'Liegestütze',
          'Stützen errichten, Gewicht tragen',
          30,
          NULL,
          NULL,
          1
        );
      END;
      END IF;
    END;

    -- Plank / Unterarmstütz
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Plank / Unterarmstütz'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Plank / Unterarmstütz'
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
          "order"
        ) VALUES (
          quest_uuid,
          'Plank / Unterarmstütz',
          'Stabilität halten, Wind standhalten',
          60,
          'Sekunden',
          NULL,
          2
        );
      EXCEPTION WHEN undefined_column THEN
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
          'Plank / Unterarmstütz',
          'Stabilität halten, Wind standhalten',
          60,
          'Sekunden',
          NULL,
          2
        );
      END;
      END IF;
    END;

    -- Optional: Ausfallschritte oder Burpees
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Ausfallschritte oder Burpees'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Ausfallschritte oder Burpees'
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
          "order"
        ) VALUES (
          quest_uuid,
          'Ausfallschritte oder Burpees',
          'letzte Kraft sammeln, Shelter abschließen',
          20,
          NULL,
          NULL,
          3
        );
      EXCEPTION WHEN undefined_column THEN
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
          'Ausfallschritte oder Burpees',
          'letzte Kraft sammeln, Shelter abschließen',
          20,
          NULL,
          NULL,
          3
        );
      END;
      END IF;
    END;
  END IF;
END $$;
