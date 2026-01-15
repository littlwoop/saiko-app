-- Insert Quest 5: Der Weg, der bleibt
-- This migration inserts quest 5 for Chapter 1

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

  -- Insert Quest 5: Der Weg, der bleibt
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
      5,
      'Der Weg, der bleibt',
      'Du hast gegessen.
Dein Lager steht ruhig da, als hätte es sich in die Landschaft eingefügt. Nichts drängt. Nichts fehlt.

Als du den Rand des Waldes erneut erreichst, fällt dir etwas auf, das dir vorher entgangen ist:
Der Boden ist hier fester. Die Vegetation tritt leicht zurück. Kein klarer Pfad – aber eine Linie. Eine Richtung. Als hätten viele Schritte über lange Zeit denselben Entschluss gefasst.

Der Weg ist nicht gemacht.
Er ist entstanden.

Du folgst ihm eine Weile, nur aus Neugier. Dann bleibst du stehen. Der Wald wird dichter. Das Licht verändert sich. Du spürst: Weiterzugehen wäre leichtsinnig.

Noch nicht.

Ein Weg, der länger besteht, verlangt Vorbereitung.
Und ein guter Jäger verlässt seinen sicheren Ort nicht unbedacht.',
      'Du entscheidest dich, nicht weiterzugehen.
Du kehrst um – nicht aus Angst, sondern aus Klarheit.

Am Lager angekommen, prüfst du alles:
Shelter
Nahrung
Wasser
deinen eigenen Zustand

Der Weg läuft nicht davon.
Er wartet.',
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
        5,
        'Der Weg, der bleibt',
        'Du hast gegessen.
Dein Lager steht ruhig da, als hätte es sich in die Landschaft eingefügt. Nichts drängt. Nichts fehlt.

Als du den Rand des Waldes erneut erreichst, fällt dir etwas auf, das dir vorher entgangen ist:
Der Boden ist hier fester. Die Vegetation tritt leicht zurück. Kein klarer Pfad – aber eine Linie. Eine Richtung. Als hätten viele Schritte über lange Zeit denselben Entschluss gefasst.

Der Weg ist nicht gemacht.
Er ist entstanden.

Du folgst ihm eine Weile, nur aus Neugier. Dann bleibst du stehen. Der Wald wird dichter. Das Licht verändert sich. Du spürst: Weiterzugehen wäre leichtsinnig.

Noch nicht.

Ein Weg, der länger besteht, verlangt Vorbereitung.
Und ein guter Jäger verlässt seinen sicheren Ort nicht unbedacht.',
        'Du entscheidest dich, nicht weiterzugehen.
Du kehrst um – nicht aus Angst, sondern aus Klarheit.

Am Lager angekommen, prüfst du alles:
Shelter
Nahrung
Wasser
deinen eigenen Zustand

Der Weg läuft nicht davon.
Er wartet.',
        NULL,
        NULL
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 5 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 5;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 5;
    END;
  END IF;

  -- Insert objective for Quest 5 (only if it doesn't exist)
  IF quest_uuid IS NOT NULL THEN
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Den Weg finden'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Den Weg finden'
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
            'Den Weg finden',
            'Bewege dich durch Wald und Übergangszonen. Achte nicht auf Geschwindigkeit, sondern auf Wiederholung: festgetretener Boden, ausgerichtete Steine, gleichmäßige Linien im Unterholz.

Der Weg zeigt sich nicht auf einmal.
Er ergibt sich.

Manche Pfade führen dich voran.
Andere sagen dir, wann es Zeit ist umzukehren.',
            7,
            'km',
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
              'Den Weg finden',
              'Bewege dich durch Wald und Übergangszonen. Achte nicht auf Geschwindigkeit, sondern auf Wiederholung: festgetretener Boden, ausgerichtete Steine, gleichmäßige Linien im Unterholz.

Der Weg zeigt sich nicht auf einmal.
Er ergibt sich.

Manche Pfade führen dich voran.
Andere sagen dir, wann es Zeit ist umzukehren.',
              7,
              'km',
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
              'Den Weg finden',
              'Bewege dich durch Wald und Übergangszonen. Achte nicht auf Geschwindigkeit, sondern auf Wiederholung: festgetretener Boden, ausgerichtete Steine, gleichmäßige Linien im Unterholz.

Der Weg zeigt sich nicht auf einmal.
Er ergibt sich.

Manche Pfade führen dich voran.
Andere sagen dir, wann es Zeit ist umzukehren.',
              7,
              'km',
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
