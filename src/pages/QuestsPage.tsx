import { useState } from "react";
import { BookOpen, Play, CheckCircle2, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function QuestsPage() {
  const [questStarted, setQuestStarted] = useState(false);
  const [steps, setSteps] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const targetSteps = 10000;

  const handleStartQuest = () => {
    setQuestStarted(true);
  };

  const handleStepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setSteps(Math.max(0, Math.min(value, targetSteps)));
  };

  const handleComplete = () => {
    if (steps >= targetSteps) {
      setIsCompleted(true);
    }
  };

  const progressPercentage = (steps / targetSteps) * 100;

  return (
    <div className="container py-8 max-w-3xl">
      {/* Quest Header */}
      <div className="mb-8 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-1.5 rounded-md bg-muted">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Kapitel I, Aufgabe 1
            </div>
            <div className="text-sm font-medium text-foreground">
              Quest 1 – Spuren im Fremden
            </div>
          </div>
        </div>
      </div>

      {!questStarted ? (
        <>
          {/* Intro Image */}
          <div className="mb-8 rounded-lg overflow-hidden border border-border/50 shadow-sm">
            <img 
              src="/Quest/Intro.png" 
              alt="Der Strand" 
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Quest Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <div className="relative pl-4 border-l-2 border-muted/50 mb-6">
              <p className="text-foreground leading-relaxed">
                Du wachst mit dem gleichmäßigen Rauschen von Wasser auf.
                Salzige Luft liegt schwer in der Nase, kühl und klar zugleich. Unter deinen Händen spürst du feinen, dunklen Sand, noch feucht von den Wellen. Dein Kopf ist leer – keine Erinnerung daran, wie du hierhergekommen bist.
              </p>
            </div>

            <div className="relative pl-4 border-l-2 border-muted/50 mb-6">
              <p className="text-foreground leading-relaxed">
                Da ist etwas, das fehlt.
                Kein Bild, kein Name, kein Gedanke, den du greifen kannst. Nur ein leiser Druck, als hättest du etwas Wichtiges zurückgelassen. Du weißt nicht was. Und genau das macht es schwerer zu ertragen als eine klare Erinnerung.
              </p>
            </div>

            <div className="relative pl-4 border-l-2 border-muted/50 mb-6">
              <p className="text-foreground leading-relaxed">
                Vor dir breitet sich eine Küste aus, die fremd und zugleich merkwürdig ruhig wirkt. Schmale Felsen ragen aus dem Meer, ihre Kanten glattgeschliffen vom ewigen Spiel der Gezeiten. In der Ferne ziehen sich bewaldete Hügel entlang der Küstenlinie, dicht bewachsen, sattgrün, beinahe unberührt. Der Wind trägt den Duft von Algen, Holz und etwas Rauchigem herüber – als hätte irgendwo jemand ein kleines Feuer entfacht.
              </p>
            </div>

            <div className="relative pl-4 border-l-2 border-muted/50 mb-6">
              <p className="text-foreground leading-relaxed italic text-center">
                Kein Wegweiser. Keine Stimmen.
                <br />
                Nur das Meer, der Himmel – und dieses Gefühl, dass dieser Ort mehr weiß als du.
              </p>
            </div>

            <div className="relative pl-4 border-l-2 border-primary/30 mb-8">
              <p className="text-foreground leading-relaxed font-medium">
                Irgendetwas sagt dir: Wenn du Antworten willst, musst du dich bewegen.
                Nicht hetzen – sondern sehen, hören, wahrnehmen. Jeder Schritt bringt dich näher an ein Verständnis dieses Landes… und vielleicht an das, was du vergessen hast.
              </p>
            </div>
          </div>

          {/* Quest Start Button */}
          <div className="flex justify-center mt-8 pt-6 border-t border-border/50">
            <Button size="lg" className="gap-2" onClick={handleStartQuest}>
              <Play className="h-4 w-4" />
              Geh los!
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Quest Details and Image Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 md:items-stretch">
            {/* Intro Image - First on mobile, second on desktop */}
            <div className="flex items-center justify-center rounded-lg overflow-hidden shadow-sm md:order-2">
              <img 
                src="/Quest/Intro.png" 
                alt="Der Strand" 
                className="w-full h-auto object-cover rounded-lg"
              />
            </div>

            {/* Quest Card - Second on mobile, first on desktop */}
            <Card className="flex flex-col border-0 md:order-1">
              <CardHeader>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold text-foreground mb-1">Ziel: Erkunde die Umgebung</p>
                  <p className="text-foreground mb-2">Aufgabe: Lege 10.000 Schritte zurück</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <p className="text-sm text-muted-foreground font-medium">Beschreibung:</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-foreground leading-relaxed">
                      Bewege dich entlang der Küste, durch Wälder, über schmale Pfade und offene Flächen. Achte auf Details: Geräusche, Gerüche, Formen in der Landschaft. Dieser Ort erzählt seine Geschichte nicht laut – nur denen, die aufmerksam sind.
                    </p>
                    <p className="text-foreground leading-relaxed mt-2">
                      Jeder Schritt zählt.
                    </p>
                    <p className="text-foreground leading-relaxed">
                      Jeder Blick könnte ein Hinweis sein.
                    </p>
                  </div>
                </div>

                {!isCompleted && (
                  <div className="pt-4 space-y-4 border-t border-border/50">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="steps" className="flex items-center gap-2">
                          <Footprints className="h-4 w-4" />
                          Schritte
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {steps.toLocaleString()} / {targetSteps.toLocaleString()}
                        </span>
                      </div>
                      <Input
                        id="steps"
                        type="number"
                        min="0"
                        max={targetSteps}
                        value={steps}
                        onChange={handleStepsChange}
                        placeholder="Schritte eingeben"
                        className="w-full"
                      />
                      <Progress value={progressPercentage} className="h-2" />
                    </div>

                    <Button
                      onClick={handleComplete}
                      disabled={steps < targetSteps}
                      className="w-full gap-2"
                      size="lg"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {steps >= targetSteps ? "Quest abschließen" : `Noch ${(targetSteps - steps).toLocaleString()} Schritte`}
                    </Button>
                  </div>
                )}

                {isCompleted && (
                  <div className="pt-4 space-y-4 border-t border-border/50">
                    <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-semibold text-green-600 dark:text-green-400">
                          Quest abgeschlossen!
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Du hast die Umgebung erfolgreich erkundet.
                        </p>
                      </div>
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                      <div className="relative pl-4 border-l-2 border-muted/50">
                        <p className="text-foreground leading-relaxed">
                          Die Landschaft beginnt sich zu verändern, je weiter du gehst.
                          Der Sand weicht festem Untergrund, Wurzeln durchziehen den Boden wie Adern. Zwischen den Bäumen öffnen sich kleine Lichtungen. Das Meer ist noch hörbar, aber nicht mehr dominant – als würde es dir Raum lassen.
                        </p>
                      </div>

                      <div className="relative pl-4 border-l-2 border-primary/30">
                        <p className="text-foreground leading-relaxed font-medium">
                          Du merkst:
                          Dieser Ort ist nicht feindlich. Aber er verlangt Respekt.
                        </p>
                      </div>

                      <div className="relative pl-4 border-l-2 border-muted/50">
                        <p className="text-foreground leading-relaxed">
                          Deine Beine sind schwer, dein Atem ruhig. Die Schritte haben dich nicht nur weitergetragen, sondern wacher gemacht. Du hast genug gesehen, um zu wissen: Ohne Schutz wirst du hier nicht lange bleiben können. Wenn die Sonne sinkt, wird es kühl. Der Wind dreht. Und irgendwo in der Ferne klackt etwas Hartes gegen Holz.
                        </p>
                      </div>

                      <div className="relative pl-4 border-l-2 border-primary/30">
                        <p className="text-foreground leading-relaxed font-medium">
                          Du brauchst einen Ort, der dir gehört.
                          Einen Platz, der sagt: Ich bin hier. Ich bleibe.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

