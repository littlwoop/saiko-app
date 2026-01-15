-- Insert Quest 6: Last aufnehmen
-- This migration inserts quest 6 for Chapter 1

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

  -- Insert Quest 6: Last aufnehmen
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
      6,
      'Last aufnehmen',
      'Der Weg ist da.
Nicht laut, nicht dringend – aber eindeutig.

Bevor du ihn gehst, kehrst du ein letztes Mal ins Lager zurück. Du ordnest, was bleibt. Du lässt zurück, was dich aufhalten würde. Was du mitnimmst, trägst du nicht im Rucksack, sondern im Körper.

Wenn du diesen Ort verlässt, gibt es kein Zurück in denselben Zustand.

Der Körper muss bereit sein, Last zu tragen. Wiederholt. Kontrolliert. Ohne Eile.',
      NULL,
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
        6,
        'Last aufnehmen',
        'Der Weg ist da.
Nicht laut, nicht dringend – aber eindeutig.

Bevor du ihn gehst, kehrst du ein letztes Mal ins Lager zurück. Du ordnest, was bleibt. Du lässt zurück, was dich aufhalten würde. Was du mitnimmst, trägst du nicht im Rucksack, sondern im Körper.

Wenn du diesen Ort verlässt, gibt es kein Zurück in denselben Zustand.

Der Körper muss bereit sein, Last zu tragen. Wiederholt. Kontrolliert. Ohne Eile.',
        NULL,
        NULL,
        NULL
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 6 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 6;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 6;
    END;
  END IF;

  -- Insert objective for Quest 6 (only if it doesn't exist)
  IF quest_uuid IS NOT NULL THEN
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Den Körper auf längere Wege vorbereiten'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Den Körper auf längere Wege vorbereiten'
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
            'Den Körper auf längere Wege vorbereiten',
            'Du trainierst nicht für Stärke allein, sondern für Verlässlichkeit. Jede Wiederholung ist ein Test: Kannst du Gewicht sauber bewegen, auch wenn es monoton wird?

Das Trainingsvolumen setzt sich aus allen Wiederholungen × Gewicht zusammen.

Beispiel:
10 Wiederholungen × 50 kg = 500 kg

Alles zählt. Langsam oder schwer – beides ist erlaubt.

Tracking:
Das Gesamtvolumen wird am zuverlässigsten über die App Liftosaur erfasst.

Gewicht, das du kontrollierst, kontrolliert dich nicht.
Erst wenn der Körper ruhig bleibt, ist er bereit zu gehen.

Empfohlene Bewegungsmuster (frei kombinierbar)
🪨 Heben – Deadlifts, Kettlebell Swings
🧱 Drücken – Bankdrücken, Schulterdrücken, Liegestütze (gewichtet)
🧗 Ziehen – Rudern, Klimmzüge (mit Zusatzgewicht)
🧍 Tragen – Farmer''s Walks, statische Holds

Alles, was sauber bewegt wird, zählt.',
            4000,
            'kg',
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
              'Den Körper auf längere Wege vorbereiten',
              'Du trainierst nicht für Stärke allein, sondern für Verlässlichkeit. Jede Wiederholung ist ein Test: Kannst du Gewicht sauber bewegen, auch wenn es monoton wird?

Das Trainingsvolumen setzt sich aus allen Wiederholungen × Gewicht zusammen.

Beispiel:
10 Wiederholungen × 50 kg = 500 kg

Alles zählt. Langsam oder schwer – beides ist erlaubt.

Tracking:
Das Gesamtvolumen wird am zuverlässigsten über die App Liftosaur erfasst.

Gewicht, das du kontrollierst, kontrolliert dich nicht.
Erst wenn der Körper ruhig bleibt, ist er bereit zu gehen.

Empfohlene Bewegungsmuster (frei kombinierbar)
🪨 Heben – Deadlifts, Kettlebell Swings
🧱 Drücken – Bankdrücken, Schulterdrücken, Liegestütze (gewichtet)
🧗 Ziehen – Rudern, Klimmzüge (mit Zusatzgewicht)
🧍 Tragen – Farmer''s Walks, statische Holds

Alles, was sauber bewegt wird, zählt.',
              4000,
              'kg',
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
              'Den Körper auf längere Wege vorbereiten',
              'Du trainierst nicht für Stärke allein, sondern für Verlässlichkeit. Jede Wiederholung ist ein Test: Kannst du Gewicht sauber bewegen, auch wenn es monoton wird?

Das Trainingsvolumen setzt sich aus allen Wiederholungen × Gewicht zusammen.

Beispiel:
10 Wiederholungen × 50 kg = 500 kg

Alles zählt. Langsam oder schwer – beides ist erlaubt.

Tracking:
Das Gesamtvolumen wird am zuverlässigsten über die App Liftosaur erfasst.

Gewicht, das du kontrollierst, kontrolliert dich nicht.
Erst wenn der Körper ruhig bleibt, ist er bereit zu gehen.

Empfohlene Bewegungsmuster (frei kombinierbar)
🪨 Heben – Deadlifts, Kettlebell Swings
🧱 Drücken – Bankdrücken, Schulterdrücken, Liegestütze (gewichtet)
🧗 Ziehen – Rudern, Klimmzüge (mit Zusatzgewicht)
🧍 Tragen – Farmer''s Walks, statische Holds

Alles, was sauber bewegt wird, zählt.',
              4000,
              'kg',
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
