-- Insert Quest 3: Die Leere
-- This migration inserts quest 3 for Chapter 1

DO $$
DECLARE
  chapter_uuid UUID;
  quest_uuid UUID;
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

  -- Insert Quest 3: Die Leere
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
      3,
      'Die Leere',
      'Die Nacht vergeht unruhig.
Der Wind streicht durch die Äste über deinem Shelter, manchmal klingt es fast wie Stimmen – doch es sind nur Blätter und Holz, die aneinander reiben. Als der Morgen kommt, ist der Himmel klar. Kühl. Wach.

Dein Magen meldet sich. Erst leise, dann deutlicher.
Du suchst die Umgebung ab: zwischen Steinen, an der Küste, im Unterholz. Du findest Spuren von Leben – Muschelschalen, Pflanzen, die du nicht kennst, Insekten, die sofort verschwinden. Doch nichts, was du ohne Wissen oder Risiko essen könntest.

Dieses Land prüft dich erneut.
Nicht mit Gefahr, sondern mit Entzug.

Du hast zwei Möglichkeiten: unüberlegt handeln – oder warten, beobachten, aushalten.
Du entscheidest dich fürs Zweite.


Ziel: Überstehen ohne Nahrung
Aufgabe: 18 Stunden fasten

Ohne Essen verlangsamt sich alles. Geräusche werden schärfer. Gedanken lauter – und dann klarer. Dein Körper greift auf Reserven zurück, dein Geist beginnt, Unwichtiges loszulassen.

Das ist keine Strafe.
Es ist ein Übergang.

Während des Fastens:
Trink Wasser, wenn verfügbar

Bewege dich ruhig und bewusst

Beobachte, wie sich Wahrnehmung und Fokus verändern

Hunger schärft nicht nur den Körper.
Er zeigt dir, was wirklich zählt.',
      NULL,
      NULL
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
        3,
        'Die Leere',
        'Die Nacht vergeht unruhig.
Der Wind streicht durch die Äste über deinem Shelter, manchmal klingt es fast wie Stimmen – doch es sind nur Blätter und Holz, die aneinander reiben. Als der Morgen kommt, ist der Himmel klar. Kühl. Wach.

Dein Magen meldet sich. Erst leise, dann deutlicher.
Du suchst die Umgebung ab: zwischen Steinen, an der Küste, im Unterholz. Du findest Spuren von Leben – Muschelschalen, Pflanzen, die du nicht kennst, Insekten, die sofort verschwinden. Doch nichts, was du ohne Wissen oder Risiko essen könntest.

Dieses Land prüft dich erneut.
Nicht mit Gefahr, sondern mit Entzug.

Du hast zwei Möglichkeiten: unüberlegt handeln – oder warten, beobachten, aushalten.
Du entscheidest dich fürs Zweite.


Ziel: Überstehen ohne Nahrung
Aufgabe: 18 Stunden fasten

Ohne Essen verlangsamt sich alles. Geräusche werden schärfer. Gedanken lauter – und dann klarer. Dein Körper greift auf Reserven zurück, dein Geist beginnt, Unwichtiges loszulassen.

Das ist keine Strafe.
Es ist ein Übergang.

Während des Fastens:
Trink Wasser, wenn verfügbar

Bewege dich ruhig und bewusst

Beobachte, wie sich Wahrnehmung und Fokus verändern

Hunger schärft nicht nur den Körper.
Er zeigt dir, was wirklich zählt.',
        NULL,
        NULL
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 3 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 3;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 3;
    END;
  END IF;

  -- Insert objective for Quest 3 (only if it doesn't exist)
  IF quest_uuid IS NOT NULL THEN
    -- Check if objective exists (handle both old and new column names)
    BEGIN
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = '18 Stunden fasten'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = '18 Stunden fasten'
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
          '18 Stunden fasten',
          'Ohne Essen verlangsamt sich alles. Geräusche werden schärfer. Gedanken lauter – und dann klarer. Dein Körper greift auf Reserven zurück, dein Geist beginnt, Unwichtiges loszulassen.',
          18,
          'Stunden',
          NULL,
          0
        );
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
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
          '18 Stunden fasten',
          'Ohne Essen verlangsamt sich alles. Geräusche werden schärfer. Gedanken lauter – und dann klarer. Dein Körper greift auf Reserven zurück, dein Geist beginnt, Unwichtiges loszulassen.',
          18,
          'Stunden',
          NULL,
          0
        );
      END;
      END IF;
    END;
  END IF;
END $$;
