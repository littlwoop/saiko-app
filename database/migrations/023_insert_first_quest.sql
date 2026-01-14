-- Insert the first quest: Chapter 1, Quest 1 - "Spuren im Fremden"
-- This migration inserts the quest data that was previously hardcoded in QuestsPage
-- Note: After migration 024 runs, this data will be in the renamed tables

DO $$
DECLARE
  quest_uuid UUID;
  step_uuid UUID;
BEGIN
  -- Get the quest ID (or use existing if it already exists)
  -- Try new structure first (chapters), fall back to old (quests)
  SELECT id INTO quest_uuid FROM chapters WHERE chapter_number = 1 AND quest_number = 1;
  IF quest_uuid IS NULL THEN
    SELECT id INTO quest_uuid FROM quests WHERE chapter_number = 1 AND quest_number = 1;
  END IF;
  
  IF quest_uuid IS NULL THEN
    -- Try to insert into chapters table (new structure after 024)
    BEGIN
      INSERT INTO chapters (
        title,
        description,
        chapter_number,
        quest_number,
        image_url,
        intro_text
      ) VALUES (
        'Kapitel 1 – Spuren im Fremden',
      NULL,
      1,
      1,
      '/Quest/Intro.png',
      'Du wachst mit dem gleichmäßigen Rauschen von Wasser auf.
Salzige Luft liegt schwer in der Nase, kühl und klar zugleich. Unter deinen Händen spürst du feinen, dunklen Sand, noch feucht von den Wellen. Dein Kopf ist leer – keine Erinnerung daran, wie du hierhergekommen bist.

Da ist etwas, das fehlt.
Kein Bild, kein Name, kein Gedanke, den du greifen kannst. Nur ein leiser Druck, als hättest du etwas Wichtiges zurückgelassen. Du weißt nicht was. Und genau das macht es schwerer zu ertragen als eine klare Erinnerung.

Vor dir breitet sich eine Küste aus, die fremd und zugleich merkwürdig ruhig wirkt. Schmale Felsen ragen aus dem Meer, ihre Kanten glattgeschliffen vom ewigen Spiel der Gezeiten. In der Ferne ziehen sich bewaldete Hügel entlang der Küstenlinie, dicht bewachsen, sattgrün, beinahe unberührt. Der Wind trägt den Duft von Algen, Holz und etwas Rauchigem herüber – als hätte irgendwo jemand ein kleines Feuer entfacht.

Kein Wegweiser. Keine Stimmen.
Nur das Meer, der Himmel – und dieses Gefühl, dass dieser Ort mehr weiß als du.

Irgendetwas sagt dir: Wenn du Antworten willst, musst du dich bewegen.
Nicht hetzen – sondern sehen, hören, wahrnehmen. Jeder Schritt bringt dich näher an ein Verständnis dieses Landes… und vielleicht an das, was du vergessen hast.'
    )
    RETURNING id INTO quest_uuid;
  END IF;

  -- Insert the first step
  INSERT INTO quest_steps (
    id,
    quest_id,
    step_number,
    title,
    description,
    completion_text
  ) VALUES (
    gen_random_uuid(),
    quest_uuid,
    1,
    'Erkunde die Umgebung',
    'Bewege dich entlang der Küste, durch Wälder, über schmale Pfade und offene Flächen. Achte auf Details: Geräusche, Gerüche, Formen in der Landschaft. Dieser Ort erzählt seine Geschichte nicht laut – nur denen, die aufmerksam sind.

Jeder Schritt zählt.

Jeder Blick könnte ein Hinweis sein.',
    'Die Landschaft beginnt sich zu verändern, je weiter du gehst.
Der Sand weicht festem Untergrund, Wurzeln durchziehen den Boden wie Adern. Zwischen den Bäumen öffnen sich kleine Lichtungen. Das Meer ist noch hörbar, aber nicht mehr dominant – als würde es dir Raum lassen.

Du merkst:
Dieser Ort ist nicht feindlich. Aber er verlangt Respekt.

Deine Beine sind schwer, dein Atem ruhig. Die Schritte haben dich nicht nur weitergetragen, sondern wacher gemacht. Du hast genug gesehen, um zu wissen: Ohne Schutz wirst du hier nicht lange bleiben können. Wenn die Sonne sinkt, wird es kühl. Der Wind dreht. Und irgendwo in der Ferne klackt etwas Hartes gegen Holz.

Du brauchst einen Ort, der dir gehört.
Einen Platz, der sagt: Ich bin hier. Ich bleibe.'
  )
  ON CONFLICT (quest_id, step_number) DO NOTHING
  RETURNING id INTO step_uuid;

  -- If step was inserted, get its ID
  IF step_uuid IS NULL THEN
    SELECT id INTO step_uuid FROM quest_steps WHERE quest_id = quest_uuid AND step_number = 1;
  END IF;

  -- Insert the objective for the step (only if it doesn't exist)
  IF step_uuid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM quest_objectives 
      WHERE quest_step_id = step_uuid 
      AND title = 'Lege 10.000 Schritte zurück'
    ) THEN
      INSERT INTO quest_objectives (
        quest_step_id,
        title,
        description,
        target_value,
        unit,
        points_per_unit,
        "order"
      ) VALUES (
        step_uuid,
        'Lege 10.000 Schritte zurück',
        NULL,
        10000,
        'Schritte',
        NULL,
        0
      );
    END IF;
  END IF;
END $$;
