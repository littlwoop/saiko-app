-- Insert Quest 4: Zwischen Schatten und Atem
-- This migration inserts quest 4 for Chapter 1

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

  -- Insert Quest 4: Zwischen Schatten und Atem
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
      4,
      'Zwischen Schatten und Atem',
      'Der Hunger ist nicht verschwunden.
Aber er hat seine Form geändert.
Er treibt dich nicht mehr an – er begleitet dich.
Du verlässt den Schutz deines Shelters und folgst einem schmalen Übergang zwischen Küste und Wald. Der Boden wird weicher und federnd. Moos dämpft deine Schritte. Hohe Bäume stehen dicht beieinander, ihre Kronen filtern das Licht zu einem ruhigen, grünen Schimmer.
Hier ist alles langsamer.
Und alles sieht dich.
Ein Rascheln. Dann Stille.
Du erkennst schmale Pfade im Unterholz, niedergetretene Halme, Spuren im feuchten Boden. Dieses Land lebt – aber es zeigt sich nur denen, die lernen, sich leise zu bewegen.
Du verstehst:
Jagen heißt hier nicht hetzen.
Jagen heißt lesen.',
      'Du findest mehr, als du erwartet hast.
Nicht an einem Ort, sondern verteilt. Kleine Beeren zwischen den Sträuchern. Frisches Wasser, das leise zwischen Steinen hervortritt. Spuren, die zeigen, dass dieser Wald versorgt – wenn man ihn liest.
Du nimmst nur, was nötig ist.
Isst langsam. Trinkst. Wartest.
Der Hunger verliert seine Schärfe.
Und mit ihm verschwindet etwas anderes: das Gefühl, ausgeliefert zu sein.
Zum ersten Mal denkst du nicht daran, wie lange du hier noch bleibst.
Sondern daran, dass du es kannst.
Der Wald wirkt nicht mehr wie etwas, das dich beobachtet.
Er wirkt wie etwas, das dich akzeptiert.
Du gehst zurück mit Wasser, mit Nahrung –
und mit dem ruhigen Wissen, dass Überleben hier möglich ist.',
      NULL,
      '/Quest/Wald.png'
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
        4,
        'Zwischen Schatten und Atem',
        'Der Hunger ist nicht verschwunden.
Aber er hat seine Form geändert.
Er treibt dich nicht mehr an – er begleitet dich.
Du verlässt den Schutz deines Shelters und folgst einem schmalen Übergang zwischen Küste und Wald. Der Boden wird weicher und federnd. Moos dämpft deine Schritte. Hohe Bäume stehen dicht beieinander, ihre Kronen filtern das Licht zu einem ruhigen, grünen Schimmer.
Hier ist alles langsamer.
Und alles sieht dich.
Ein Rascheln. Dann Stille.
Du erkennst schmale Pfade im Unterholz, niedergetretene Halme, Spuren im feuchten Boden. Dieses Land lebt – aber es zeigt sich nur denen, die lernen, sich leise zu bewegen.
Du verstehst:
Jagen heißt hier nicht hetzen.
Jagen heißt lesen.',
        'Du findest mehr, als du erwartet hast.
Nicht an einem Ort, sondern verteilt. Kleine Beeren zwischen den Sträuchern. Frisches Wasser, das leise zwischen Steinen hervortritt. Spuren, die zeigen, dass dieser Wald versorgt – wenn man ihn liest.
Du nimmst nur, was nötig ist.
Isst langsam. Trinkst. Wartest.
Der Hunger verliert seine Schärfe.
Und mit ihm verschwindet etwas anderes: das Gefühl, ausgeliefert zu sein.
Zum ersten Mal denkst du nicht daran, wie lange du hier noch bleibst.
Sondern daran, dass du es kannst.
Der Wald wirkt nicht mehr wie etwas, das dich beobachtet.
Er wirkt wie etwas, das dich akzeptiert.
Du gehst zurück mit Wasser, mit Nahrung –
und mit dem ruhigen Wissen, dass Überleben hier möglich ist.',
        NULL,
        '/Quest/Wald.png'
      )
      ON CONFLICT (quest_id, step_number) DO NOTHING
      RETURNING id INTO quest_uuid;
    END;

  -- If quest 4 was inserted, get its ID
  IF quest_uuid IS NULL THEN
    BEGIN
      SELECT id INTO quest_uuid FROM quests WHERE chapter_id = chapter_uuid AND quest_number = 4;
      EXCEPTION WHEN undefined_table THEN
        SELECT id INTO quest_uuid FROM quest_steps WHERE quest_id = chapter_uuid AND step_number = 4;
    END;
  END IF;

  -- Insert objective for Quest 4 (only if it doesn't exist)
  IF quest_uuid IS NOT NULL THEN
    BEGIN
      objective_exists := FALSE;
      -- Try new structure first
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM quest_objectives 
          WHERE quest_id = quest_uuid
          AND title = 'Erkunde den Wald auf der Suche nach Nahrung'
        ) INTO objective_exists;
      EXCEPTION WHEN undefined_column THEN
        -- Fall back to old structure
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM quest_objectives 
            WHERE quest_step_id = quest_uuid
            AND title = 'Erkunde den Wald auf der Suche nach Nahrung'
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
            'Erkunde den Wald auf der Suche nach Nahrung',
            'Du begibst dich tiefer zwischen die Bäume. Jeder Schritt ist gesetzt, jeder Atemzug ruhig. Du lernst, stehen zu bleiben. Zu hören. Zu warten.',
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
              'Erkunde den Wald auf der Suche nach Nahrung',
              'Du begibst dich tiefer zwischen die Bäume. Jeder Schritt ist gesetzt, jeder Atemzug ruhig. Du lernst, stehen zu bleiben. Zu hören. Zu warten.',
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
              'Erkunde den Wald auf der Suche nach Nahrung',
              'Du begibst dich tiefer zwischen die Bäume. Jeder Schritt ist gesetzt, jeder Atemzug ruhig. Du lernst, stehen zu bleiben. Zu hören. Zu warten.',
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
