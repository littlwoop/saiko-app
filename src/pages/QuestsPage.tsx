import { useState, useEffect } from "react";
import { BookOpen, Play, CheckCircle2, Loader2, ArrowRight, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { questService } from "@/lib/quests";
import { Chapter, UserChapterProgress } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import QuestObjectiveItem from "@/components/quests/QuestObjectiveItem";

export default function QuestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [userProgress, setUserProgress] = useState<UserChapterProgress | null>(null);
  const [currentQuest, setCurrentQuest] = useState<number>(0);
  const [objectiveProgress, setObjectiveProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questLoaded, setQuestLoaded] = useState(false);

  // Load chapter data (Chapter 1)
  useEffect(() => {
    const loadChapter = async () => {
      try {
        setLoading(true);
        const chapterData = await questService.getChapterByNumber(1);
        if (!chapterData) {
          toast({
            title: "Fehler",
            description: "Kapitel konnte nicht geladen werden.",
            variant: "destructive",
          });
          return;
        }
        setChapter(chapterData);

        // Load user progress if logged in
        if (user) {
          const progress = await questService.getUserChapterProgress(user.id, chapterData.id);
          if (progress) {
            setUserProgress(progress);
            // Find current quest index
            const questIndex = chapterData.quests.findIndex((q) => q.id === progress.currentQuestId);
            const activeQuestIndex = questIndex >= 0 ? questIndex : 0;
            setCurrentQuest(activeQuestIndex);

            // Load progress for current quest objectives
            if (chapterData.quests.length > 0) {
              const activeQuest = chapterData.quests[activeQuestIndex];
              const questProgress = await questService.getQuestProgress(user.id, activeQuest.id);
              setObjectiveProgress(questProgress);
            }
          } else {
            // No progress found - ensure we start from the beginning
            setUserProgress(null);
            setCurrentQuest(0);
            setObjectiveProgress({});
          }
        } else {
          // No user - start from beginning
          setCurrentQuest(0);
          setObjectiveProgress({});
        }
        
        // Mark quest as loaded BEFORE setting loading to false
        setQuestLoaded(true);
      } catch (error) {
        console.error("Error loading chapter:", error);
        toast({
          title: "Fehler",
          description: "Fehler beim Laden des Kapitels.",
          variant: "destructive",
        });
        // Even on error, mark as loaded to prevent infinite loading
        setQuestLoaded(true);
      } finally {
        // Only set loading to false after quest is determined
        setLoading(false);
      }
    };

    loadChapter();
  }, [user, toast]);

  // Scroll to top when quest changes
  useEffect(() => {
    if (questLoaded && !loading) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentQuest, questLoaded, loading]);

  const chapterStarted = userProgress !== null;
  const activeQuestData = chapter?.quests[currentQuest];
  const chapterCompleted = userProgress?.completedAt !== undefined;
  
  // Check if current quest is completed
  // Only check if chapter is started and we have progress data
  // Binary objectives: value >= 1 means completed
  // Incremental objectives: value >= targetValue means completed
  const isCurrentQuestCompleted = chapterStarted && activeQuestData
    ? activeQuestData.objectives.every(
        (obj) => {
          const progress = objectiveProgress[obj.id] || 0;
          if (obj.isBinary) {
            return progress >= 1;
          }
          return progress >= (obj.targetValue || 1);
        }
      )
    : false;
  
  const hasNextQuest = chapter && currentQuest < chapter.quests.length - 1;
  const hasPreviousQuest = currentQuest > 0;

  const handleStartChapter = async () => {
    if (!user || !chapter || chapter.quests.length === 0) return;

    try {
      setSaving(true);
      const firstQuest = chapter.quests[0];
      const progress = await questService.startChapter(user.id, chapter.id, firstQuest.id);
      setUserProgress(progress);
      setCurrentQuest(0);
      setObjectiveProgress({});
    } catch (error) {
      console.error("Error starting chapter:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Starten des Kapitels.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const refreshProgress = async () => {
    if (!user || !chapter || !activeQuestData) return;

    try {
      const questProgress = await questService.getQuestProgress(user.id, activeQuestData.id);
      setObjectiveProgress(questProgress);
    } catch (error) {
      console.error("Error refreshing progress:", error);
    }
  };

  const handleComplete = async () => {
    if (!user || !chapter || !activeQuestData) return;

    // Check if all objectives are completed
    // Binary objectives: value >= 1 means completed
    // Incremental objectives: value >= targetValue means completed
    const allObjectivesComplete = activeQuestData.objectives.every(
      (obj) => {
        const progress = objectiveProgress[obj.id] || 0;
        if (obj.isBinary) {
          return progress >= 1;
        }
        return progress >= (obj.targetValue || 1);
      }
    );

    if (!allObjectivesComplete) {
      toast({
        title: "Aufgaben nicht erfüllt",
        description: "Bitte vervollständige alle Aufgaben, bevor du die Quest abschließt.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      // Mark quest as completed but don't move to next quest yet
      // User will click button to move to next quest
      const nextQuestIndex = currentQuest + 1;
      const nextQuest = chapter.quests[nextQuestIndex];

      await questService.completeQuest(
        user.id,
        chapter.id,
        activeQuestData.id,
        nextQuest?.id || null // Set to null if no next quest (chapter completed)
      );

      // If no next quest, mark chapter as completed
      if (!nextQuest) {
        setUserProgress((prev) => prev ? { ...prev, completedAt: new Date().toISOString() } : null);
      }
    } catch (error) {
      console.error("Error completing quest:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Abschließen der Quest.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNextQuest = async () => {
    if (!user || !chapter || !hasNextQuest) return;

    try {
      setSaving(true);
      setQuestLoaded(false);
      const nextQuestIndex = currentQuest + 1;
      const nextQuest = chapter.quests[nextQuestIndex];
      
      // Update current quest in database
      if (userProgress) {
        await questService.updateCurrentQuest(user.id, chapter.id, nextQuest.id);
      }
      
      setCurrentQuest(nextQuestIndex);
      const questProgress = await questService.getQuestProgress(user.id, nextQuest.id);
      setObjectiveProgress(questProgress);
      setUserProgress((prev) => prev ? { ...prev, currentQuestId: nextQuest.id } : null);
      setQuestLoaded(true);
    } catch (error) {
      console.error("Error moving to next quest:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Wechseln zur nächsten Quest.",
        variant: "destructive",
      });
      setQuestLoaded(true);
    } finally {
      setSaving(false);
    }
  };

  const handleQuestNavigation = async (questIndex: number) => {
    if (!user || !chapter || questIndex < 0 || questIndex >= chapter.quests.length) return;
    if (questIndex === currentQuest) return;

    try {
      setSaving(true);
      setQuestLoaded(false);
      const targetQuest = chapter.quests[questIndex];
      
      // Update current quest in database if chapter is started
      if (userProgress) {
        await questService.updateCurrentQuest(user.id, chapter.id, targetQuest.id);
      }
      
      setCurrentQuest(questIndex);
      const questProgress = await questService.getQuestProgress(user.id, targetQuest.id);
      setObjectiveProgress(questProgress);
      
      // Update local user progress state
      if (userProgress) {
        setUserProgress((prev) => prev ? { ...prev, currentQuestId: targetQuest.id } : null);
      }
      
      setQuestLoaded(true);
    } catch (error) {
      console.error("Error navigating to quest:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Wechseln zur Quest.",
        variant: "destructive",
      });
      setQuestLoaded(true);
    } finally {
      setSaving(false);
    }
  };

  // TODO: Remove this function and button later
  const handleResetChapter = async () => {
    if (!user || !chapter) return;

    if (!confirm("Möchtest du wirklich den gesamten Kapitel-Fortschritt zurücksetzen?")) {
      return;
    }

    try {
      setSaving(true);
      await questService.resetChapterProgress(user.id, chapter.id);
      
      // Clear all local state
      setUserProgress(null);
      setCurrentQuest(0);
      setObjectiveProgress({});
      
      // Reload the chapter to ensure fresh state
      const chapterData = await questService.getChapterByNumber(1);
      if (chapterData) {
        setChapter(chapterData);
      }
      
      toast({
        title: "Erfolg",
        description: "Kapitel-Fortschritt wurde zurückgesetzt.",
      });
    } catch (error) {
      console.error("Error resetting chapter progress:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Zurücksetzen des Kapitel-Fortschritts.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !questLoaded || !chapter) {
    return (
      <div className="container py-8 max-w-3xl">
        {/* Chapter Header Skeleton */}
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
          <p className="text-sm text-muted-foreground">Kapitel wird geladen...</p>
        </div>
      </div>
    );
  }

  const chapterLabel = chapter.chapterNumber
    ? `Kapitel ${chapter.chapterNumber === 1 ? "I" : chapter.chapterNumber === 2 ? "II" : chapter.chapterNumber}`
    : "Kapitel";

  return (
    <div className="container py-8 max-w-3xl">
      {/* Quest Header */}
      <div className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-muted">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                {chapter.chapterNumber ? `Kapitel ${chapter.chapterNumber}` : 'Kapitel'} - {chapter.title}
              </div>
              {chapterStarted && activeQuestData && (
                <div className="text-sm text-muted-foreground mt-1">
                  Quest {activeQuestData.questNumber} - {activeQuestData.title}
                </div>
              )}
            </div>
          </div>
          {/* TODO: Remove this reset button later */}
          {user && chapterStarted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetChapter}
              disabled={saving}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              title="Kapitel-Fortschritt zurücksetzen"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Quest Navigation */}
        {chapterStarted && chapter.quests.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQuestNavigation(currentQuest - 1)}
              disabled={!hasPreviousQuest || saving}
              className="h-8 w-8 p-0"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex items-center gap-2 flex-1 justify-center">
              {chapter.quests.map((quest, index) => {
                const isActive = index === currentQuest;
                // Only check completion for the current quest (we have its progress loaded)
                const questCompleted = isActive && isCurrentQuestCompleted;

                return (
                  <button
                    key={quest.id}
                    onClick={() => handleQuestNavigation(index)}
                    disabled={saving}
                    className={`
                      flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-md text-sm font-medium
                      transition-colors
                      ${isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : questCompleted
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }
                      ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    title={quest.title}
                  >
                    {saving && isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : questCompleted ? (
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
              onClick={() => handleQuestNavigation(currentQuest + 1)}
              disabled={!hasNextQuest || saving}
              className="h-8 w-8 p-0"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {!chapterStarted && questLoaded && !userProgress ? (
        <>
          {/* Intro Image - only show when chapter hasn't started and no progress exists */}
          {chapter.imageUrl && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <img 
                src={chapter.imageUrl} 
                alt={chapter.title} 
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Chapter Content */}
          {chapter.introText && (
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <div className="relative pl-4 border-l-2 border-muted/50 mb-6">
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {chapter.introText}
                </p>
              </div>
            </div>
          )}

          {chapter.description && (
            <div className="prose prose-lg dark:prose-invert max-w-none mb-8">
              <p className="text-foreground leading-relaxed">{chapter.description}</p>
            </div>
          )}

          {/* Chapter Start Button */}
          <div className="flex justify-center mt-8 pt-6 border-t border-border/50">
            <Button 
              size="lg" 
              className="gap-2" 
              onClick={handleStartChapter}
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
          {activeQuestData && (
            <>
              {/* Quest Details and Image Side by Side */}
              <div className={`grid gap-6 mb-6 md:items-stretch ${(chapter.imageUrl && currentQuest === 0) || activeQuestData?.imageUrl ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Quest Image - Show chapter image for quest 1, or quest image if available */}
                {(chapter.imageUrl && currentQuest === 0) || activeQuestData?.imageUrl ? (
                  <div className="flex items-center justify-center rounded-lg overflow-hidden md:order-2">
                    <img 
                      src={activeQuestData?.imageUrl || chapter.imageUrl} 
                      alt={activeQuestData?.title || chapter.title} 
                      className="w-full h-auto object-cover rounded-lg"
                    />
                  </div>
                ) : null}

                 {/* Quest Card - Second on mobile, first on desktop */}
                 <Card className="flex flex-col border-0 md:order-1">
                   <CardContent className="space-y-4 pt-6">
                    {/* Show completion message if quest is completed */}
                    {isCurrentQuestCompleted ? (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              Quest abgeschlossen!
                            </p>
                          </div>
                        </div>
                        {/* Completion content with image on right if available */}
                        {activeQuestData.completionText && (
                          <div className={`grid gap-6 mb-4 ${activeQuestData.completionImageUrl ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                            <div className="space-y-4">
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <p className="text-foreground leading-relaxed whitespace-pre-line">
                                  {activeQuestData.completionText}
                                </p>
                              </div>
                              {hasNextQuest && (
                                <div className="pt-2">
                                  <Button
                                    onClick={handleNextQuest}
                                    disabled={saving}
                                    className="w-full gap-2"
                                    size="lg"
                                  >
                                    {saving ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        Weiter zur nächsten Quest
                                        <ArrowRight className="h-4 w-4" />
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                            {activeQuestData.completionImageUrl && (
                              <div className="flex items-center justify-center rounded-lg overflow-hidden md:order-2">
                                <img 
                                  src={activeQuestData.completionImageUrl} 
                                  alt="Completion" 
                                  className="w-full h-auto object-cover rounded-lg"
                                />
                              </div>
                            )}
                          </div>
                        )}
                        {/* Show next quest button even if no completion text */}
                        {!activeQuestData.completionText && hasNextQuest && (
                          <div className="pt-2">
                            <Button
                              onClick={handleNextQuest}
                              disabled={saving}
                              className="w-full gap-2"
                              size="lg"
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  Weiter zur nächsten Quest
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                     ) : (
                       <>
                         {activeQuestData.description && (
                           <div className="space-y-2 pt-2">
                             <div className="prose prose-sm dark:prose-invert max-w-none">
                               <p className="text-foreground leading-relaxed whitespace-pre-line">
                                 {activeQuestData.description}
                               </p>
                             </div>
                           </div>
                         )}

                        {/* Objectives - only show when quest is NOT completed */}
                        {activeQuestData.objectives.length > 0 && !isCurrentQuestCompleted && (
                          <div className="space-y-4 pt-2 border-t border-border/50">
                            <p className="text-sm text-muted-foreground font-medium">Aufgaben:</p>
                            <div className="space-y-3">
                              {activeQuestData.objectives.map((objective) => {
                                const currentValue = objectiveProgress[objective.id] || 0;

                                return (
                                  <QuestObjectiveItem
                                    key={objective.id}
                                    objective={objective}
                                    questId={chapter.id}
                                    questStepId={activeQuestData.id}
                                    currentValue={currentValue}
                                    onProgressUpdate={refreshProgress}
                                    disabled={chapterCompleted}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Show completion message and button when all objectives are done but quest not completed */}
                        {!isCurrentQuestCompleted && activeQuestData.objectives.length > 0 && activeQuestData.objectives.every(
                          (obj) => {
                            const progress = objectiveProgress[obj.id] || 0;
                            if (obj.isBinary) {
                              return progress >= 1;
                            }
                            return progress >= (obj.targetValue || 1);
                          }
                        ) && (
                          <div className="pt-4 space-y-4 border-t border-border/50">
                            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <div>
                                <p className="font-semibold text-green-600 dark:text-green-400">
                                  Quest abgeschlossen!
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
                              Quest abschließen
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Show chapter completed message if entire chapter is done */}
                    {chapterCompleted && !hasNextQuest && (
                      <div className="pt-4 space-y-4 border-t border-border/50">
                        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              Kapitel abgeschlossen!
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Du hast das Kapitel erfolgreich abgeschlossen.
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

