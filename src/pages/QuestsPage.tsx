import { useState, useEffect } from "react";
import { BookOpen, Play, CheckCircle2, Loader2, ArrowRight, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { questService } from "@/lib/quests";
import { Quest, UserQuestProgress } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import QuestObjectiveItem from "@/components/quests/QuestObjectiveItem";

export default function QuestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [userProgress, setUserProgress] = useState<UserQuestProgress | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [objectiveProgress, setObjectiveProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepLoaded, setStepLoaded] = useState(false);

  // Load quest data (Chapter 1, Quest 1)
  useEffect(() => {
    const loadQuest = async () => {
      try {
        setLoading(true);
        const questData = await questService.getQuestByChapterAndNumber(1, 1);
        if (!questData) {
          toast({
            title: "Fehler",
            description: "Quest konnte nicht geladen werden.",
            variant: "destructive",
          });
          return;
        }
        setQuest(questData);

        // Load user progress if logged in
        if (user) {
          const progress = await questService.getUserQuestProgress(user.id, questData.id);
          if (progress) {
            setUserProgress(progress);
            // Find current step index
            const stepIndex = questData.steps.findIndex((s) => s.id === progress.currentStepId);
            const activeStepIndex = stepIndex >= 0 ? stepIndex : 0;
            setCurrentStep(activeStepIndex);

            // Load progress for current step objectives
            if (questData.steps.length > 0) {
              const activeStep = questData.steps[activeStepIndex];
              const stepProgress = await questService.getStepProgress(user.id, activeStep.id);
              setObjectiveProgress(stepProgress);
            }
          } else {
            // No progress found - ensure we start from the beginning
            setUserProgress(null);
            setCurrentStep(0);
            setObjectiveProgress({});
          }
        } else {
          // No user - start from beginning
          setCurrentStep(0);
          setObjectiveProgress({});
        }
        
        // Mark step as loaded BEFORE setting loading to false
        setStepLoaded(true);
      } catch (error) {
        console.error("Error loading quest:", error);
        toast({
          title: "Fehler",
          description: "Fehler beim Laden der Quest.",
          variant: "destructive",
        });
        // Even on error, mark as loaded to prevent infinite loading
        setStepLoaded(true);
      } finally {
        // Only set loading to false after step is determined
        setLoading(false);
      }
    };

    loadQuest();
  }, [user, toast]);

  const questStarted = userProgress !== null;
  const activeStepData = quest?.steps[currentStep];
  const questCompleted = userProgress?.completedAt !== undefined;
  
  // Check if current step is completed
  // Only check if quest is started and we have progress data
  const isCurrentStepCompleted = questStarted && activeStepData
    ? activeStepData.objectives.every(
        (obj) => (objectiveProgress[obj.id] || 0) >= (obj.targetValue || 1)
      )
    : false;
  
  const hasNextStep = quest && currentStep < quest.steps.length - 1;
  const hasPreviousStep = currentStep > 0;

  const handleStartQuest = async () => {
    if (!user || !quest || quest.steps.length === 0) return;

    try {
      setSaving(true);
      const firstStep = quest.steps[0];
      const progress = await questService.startQuest(user.id, quest.id, firstStep.id);
      setUserProgress(progress);
      setCurrentStep(0);
      setObjectiveProgress({});
    } catch (error) {
      console.error("Error starting quest:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Starten der Quest.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const refreshProgress = async () => {
    if (!user || !quest || !activeStepData) return;

    try {
      const stepProgress = await questService.getStepProgress(user.id, activeStepData.id);
      setObjectiveProgress(stepProgress);
    } catch (error) {
      console.error("Error refreshing progress:", error);
    }
  };

  const handleComplete = async () => {
    if (!user || !quest || !activeStepData) return;

    // Check if all objectives are completed
    const allObjectivesComplete = activeStepData.objectives.every(
      (obj) => (objectiveProgress[obj.id] || 0) >= (obj.targetValue || 1)
    );

    if (!allObjectivesComplete) {
      toast({
        title: "Aufgaben nicht erfüllt",
        description: "Bitte vervollständige alle Aufgaben, bevor du den Schritt abschließt.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      // Mark step as completed but don't move to next step yet
      // User will click button to move to next step
      const nextStepIndex = currentStep + 1;
      const nextStep = quest.steps[nextStepIndex];

      await questService.completeStep(
        user.id,
        quest.id,
        activeStepData.id,
        nextStep?.id || null // Set to null if no next step (quest completed)
      );

      // If no next step, mark quest as completed
      if (!nextStep) {
        setUserProgress((prev) => prev ? { ...prev, completedAt: new Date().toISOString() } : null);
      }
    } catch (error) {
      console.error("Error completing step:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Abschließen der Quest.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNextStep = async () => {
    if (!user || !quest || !hasNextStep) return;

    try {
      setSaving(true);
      const nextStepIndex = currentStep + 1;
      const nextStep = quest.steps[nextStepIndex];
      
      // Update current step in database
      if (userProgress) {
        await questService.updateCurrentStep(user.id, quest.id, nextStep.id);
      }
      
      setCurrentStep(nextStepIndex);
      const stepProgress = await questService.getStepProgress(user.id, nextStep.id);
      setObjectiveProgress(stepProgress);
      setUserProgress((prev) => prev ? { ...prev, currentStepId: nextStep.id } : null);
    } catch (error) {
      console.error("Error moving to next step:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Wechseln zum nächsten Schritt.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStepNavigation = async (stepIndex: number) => {
    if (!user || !quest || stepIndex < 0 || stepIndex >= quest.steps.length) return;
    if (stepIndex === currentStep) return;

    try {
      setSaving(true);
      const targetStep = quest.steps[stepIndex];
      
      // Update current step in database if quest is started
      if (userProgress) {
        await questService.updateCurrentStep(user.id, quest.id, targetStep.id);
      }
      
      setCurrentStep(stepIndex);
      const stepProgress = await questService.getStepProgress(user.id, targetStep.id);
      setObjectiveProgress(stepProgress);
      
      // Update local user progress state
      if (userProgress) {
        setUserProgress((prev) => prev ? { ...prev, currentStepId: targetStep.id } : null);
      }
    } catch (error) {
      console.error("Error navigating to step:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Wechseln zum Schritt.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // TODO: Remove this function and button later
  const handleResetQuest = async () => {
    if (!user || !quest) return;

    if (!confirm("Möchtest du wirklich den gesamten Quest-Fortschritt zurücksetzen?")) {
      return;
    }

    try {
      setSaving(true);
      await questService.resetQuestProgress(user.id, quest.id);
      
      // Clear all local state
      setUserProgress(null);
      setCurrentStep(0);
      setObjectiveProgress({});
      
      // Reload the quest to ensure fresh state
      const questData = await questService.getQuestByChapterAndNumber(1, 1);
      if (questData) {
        setQuest(questData);
      }
      
      toast({
        title: "Erfolg",
        description: "Quest-Fortschritt wurde zurückgesetzt.",
      });
    } catch (error) {
      console.error("Error resetting quest progress:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Zurücksetzen des Quest-Fortschritts.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !stepLoaded || !quest) {
    return (
      <div className="container py-8 max-w-3xl">
        {/* Quest Header Skeleton */}
        <div className="mb-8 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-1.5 rounded-md bg-muted animate-pulse">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-32 bg-muted rounded animate-pulse"></div>
              <div className="h-4 w-48 bg-muted rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Loading Content */}
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Quest wird geladen...</p>
        </div>
      </div>
    );
  }

  const chapterLabel = quest.chapterNumber
    ? `Kapitel ${quest.chapterNumber === 1 ? "I" : quest.chapterNumber === 2 ? "II" : quest.chapterNumber}, Aufgabe ${quest.questNumber || 1}`
    : "Quest";

  return (
    <div className="container py-8 max-w-3xl">
      {/* Quest Header */}
      <div className="mb-8 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-muted">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {chapterLabel}
              </div>
              <div className="text-sm font-medium text-foreground">
                {quest.title}
              </div>
            </div>
          </div>
          {/* TODO: Remove this reset button later */}
          {user && questStarted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetQuest}
              disabled={saving}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              title="Quest-Fortschritt zurücksetzen"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Step Navigation */}
        {questStarted && quest.steps.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStepNavigation(currentStep - 1)}
              disabled={!hasPreviousStep || saving}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2 flex-1 justify-center">
              {quest.steps.map((step, index) => {
                const isActive = index === currentStep;
                // Only check completion for the current step (we have its progress loaded)
                const stepCompleted = isActive && isCurrentStepCompleted;

                return (
                  <button
                    key={step.id}
                    onClick={() => handleStepNavigation(index)}
                    disabled={saving}
                    className={`
                      flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-md text-sm font-medium
                      transition-colors
                      ${isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : stepCompleted
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }
                      ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    title={step.title}
                  >
                    {stepCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStepNavigation(currentStep + 1)}
              disabled={!hasNextStep || saving}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {!questStarted && stepLoaded && !userProgress ? (
        <>
          {/* Intro Image - only show when quest hasn't started and no progress exists */}
          {quest.imageUrl && (
            <div className="mb-8 rounded-lg overflow-hidden border border-border/50 shadow-sm">
              <img 
                src={quest.imageUrl} 
                alt={quest.title} 
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Quest Content */}
          {quest.introText && (
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <div className="relative pl-4 border-l-2 border-muted/50 mb-6">
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {quest.introText}
                </p>
              </div>
            </div>
          )}

          {quest.description && (
            <div className="prose prose-lg dark:prose-invert max-w-none mb-8">
              <p className="text-foreground leading-relaxed">{quest.description}</p>
            </div>
          )}

          {/* Quest Start Button */}
          <div className="flex justify-center mt-8 pt-6 border-t border-border/50">
            <Button 
              size="lg" 
              className="gap-2" 
              onClick={handleStartQuest}
              disabled={!user || saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Geh los!
            </Button>
          </div>
        </>
      ) : (
        <>
          {activeStepData && (
            <>
              {/* Quest Details and Image Side by Side */}
              <div className={`grid gap-6 mb-6 md:items-stretch ${quest.imageUrl && currentStep === 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Intro Image - First on mobile, second on desktop - Only show on step 1 */}
                {quest.imageUrl && currentStep === 0 && (
                  <div className="flex items-center justify-center rounded-lg overflow-hidden shadow-sm md:order-2">
                    <img 
                      src={quest.imageUrl} 
                      alt={quest.title} 
                      className="w-full h-auto object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Quest Card - Second on mobile, first on desktop */}
                <Card className="flex flex-col border-0 md:order-1">
                  <CardHeader>
                    <CardTitle>{activeStepData.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Show completion text if step is completed */}
                    {isCurrentStepCompleted && activeStepData.completionText ? (
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              Schritt abgeschlossen!
                            </p>
                          </div>
                        </div>
                        {/* Completion image if available */}
                        {activeStepData.completionImageUrl && (
                          <div className="mb-4 rounded-lg overflow-hidden border border-border/50 shadow-sm">
                            <img 
                              src={activeStepData.completionImageUrl} 
                              alt="Completion" 
                              className="w-full h-auto object-cover"
                            />
                          </div>
                        )}
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="text-foreground leading-relaxed whitespace-pre-line">
                            {activeStepData.completionText}
                          </p>
                        </div>
                        {hasNextStep && (
                          <div className="pt-4">
                            <Button
                              onClick={handleNextStep}
                              disabled={saving}
                              className="w-full gap-2"
                              size="lg"
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  Weiter zum nächsten Schritt
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {activeStepData.description && (
                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <p className="text-sm text-muted-foreground font-medium">Beschreibung:</p>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <p className="text-foreground leading-relaxed whitespace-pre-line">
                                {activeStepData.description}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Objectives - only show when step is NOT completed */}
                        {activeStepData.objectives.length > 0 && !isCurrentStepCompleted && (
                          <div className="space-y-4 pt-2 border-t border-border/50">
                            <p className="text-sm text-muted-foreground font-medium">Aufgaben:</p>
                            <div className="space-y-3">
                              {activeStepData.objectives.map((objective) => {
                                const currentValue = objectiveProgress[objective.id] || 0;

                                return (
                                  <QuestObjectiveItem
                                    key={objective.id}
                                    objective={objective}
                                    questId={quest.id}
                                    questStepId={activeStepData.id}
                                    currentValue={currentValue}
                                    onProgressUpdate={refreshProgress}
                                    disabled={questCompleted}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Show completion message and button when all objectives are done but step not completed */}
                        {!isCurrentStepCompleted && activeStepData.objectives.length > 0 && activeStepData.objectives.every(
                          (obj) => (objectiveProgress[obj.id] || 0) >= (obj.targetValue || 1)
                        ) && (
                          <div className="pt-4 space-y-4 border-t border-border/50">
                            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <div>
                                <p className="font-semibold text-green-600 dark:text-green-400">
                                  Schritt abgeschlossen!
                                </p>
                              </div>
                            </div>
                            <Button
                              onClick={handleComplete}
                              disabled={saving}
                              className="w-full gap-2"
                              size="lg"
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Schritt abschließen
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Show quest completed message if entire quest is done */}
                    {questCompleted && !hasNextStep && (
                      <div className="pt-4 space-y-4 border-t border-border/50">
                        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              Quest abgeschlossen!
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Du hast die Quest erfolgreich abgeschlossen.
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
        </>
      )}
    </div>
  );
}

