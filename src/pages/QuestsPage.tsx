import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Play, CheckCircle2, Loader2, ArrowRight, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { questService } from "@/lib/quests";
import { Chapter, UserChapterProgress } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import QuestObjectiveItem from "@/components/quests/QuestObjectiveItem";

export default function QuestsPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect to start page if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return null;
  }
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [userProgress, setUserProgress] = useState<UserChapterProgress | null>(null);
  const [currentQuest, setCurrentQuest] = useState<number>(0);
  const [objectiveProgress, setObjectiveProgress] = useState<Record<string, number>>({});
  const [allQuestProgress, setAllQuestProgress] = useState<Record<string, Record<string, number>>>({});
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
              
              // Load progress for all quests to determine accessibility
              const allProgress: Record<string, Record<string, number>> = {};
              for (const quest of chapterData.quests) {
                const progress = await questService.getQuestProgress(user.id, quest.id);
                allProgress[quest.id] = progress;
              }
              setAllQuestProgress(allProgress);
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
  // Quests with no objectives are never automatically completed
  const isCurrentQuestCompleted = chapterStarted && activeQuestData && activeQuestData.objectives.length > 0
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
  
  // Scroll to top when quest completion is revealed
  useEffect(() => {
    if (isCurrentQuestCompleted && questLoaded && !loading) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isCurrentQuestCompleted, questLoaded, loading]);
  
  const hasNextQuest = chapter && currentQuest < chapter.quests.length - 1;
  const hasPreviousQuest = currentQuest > 0;

  // Check if a quest is completed based on all objectives
  const isQuestCompleted = (questIndex: number): boolean => {
    if (!chapter || questIndex < 0 || questIndex >= chapter.quests.length) return false;
    const quest = chapter.quests[questIndex];
    if (quest.objectives.length === 0) return false;
    
    const questProgress = allQuestProgress[quest.id] || {};
    return quest.objectives.every((obj) => {
      const progress = questProgress[obj.id] || 0;
      if (obj.isBinary) {
        return progress >= 1;
      }
      return progress >= (obj.targetValue || 1);
    });
  };

  // Check if a quest is accessible (all previous quests are completed)
  const isQuestAccessible = (questIndex: number): boolean => {
    if (questIndex === 0) return true; // First quest is always accessible
    if (!chapter) return false;
    
    // Check if all previous quests are completed
    for (let i = 0; i < questIndex; i++) {
      if (!isQuestCompleted(i)) {
        return false;
      }
    }
    return true;
  };

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
      
      // Update all quest progress for navigation
      setAllQuestProgress((prev) => ({
        ...prev,
        [activeQuestData.id]: questProgress,
      }));
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
    
    // Prevent navigation to inaccessible quests
    if (!isQuestAccessible(questIndex)) {
      toast({
        title: "Quest nicht verfügbar",
        description: "Du musst die vorherigen Quests abschließen, um diese Quest zu öffnen.",
        variant: "destructive",
      });
      return;
    }

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
  const handleResetQuest = async () => {
    if (!user || !chapter || !activeQuestData) return;

    if (!confirm("Möchtest du wirklich den Fortschritt dieser Quest zurücksetzen? Alle Fortschritte werden gelöscht.")) {
      return;
    }

    try {
      setSaving(true);
      await questService.resetQuestProgress(user.id, chapter.id, activeQuestData.id);
      
      // Reload progress for current quest
      const questProgress = await questService.getQuestProgress(user.id, activeQuestData.id);
      setObjectiveProgress(questProgress);
      
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
      <div className="container py-8 max-w-5xl">
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
    <div className="container py-8 max-w-5xl">
      {/* Quest Header */}
      <div className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-1.5 rounded-md bg-muted flex-shrink-0">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground break-words">
                {chapter.chapterNumber ? `Kapitel ${chapter.chapterNumber}` : 'Kapitel'} - {chapter.title}
              </div>
              {chapterStarted && activeQuestData && (
                <div className="text-sm text-muted-foreground mt-1 break-words">
                  Quest {activeQuestData.questNumber} - {activeQuestData.title}
                </div>
              )}
            </div>
          </div>
          {user && chapterStarted && (
            <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
              {activeQuestData && (
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
              {/* TODO: Remove this reset button later */}
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
            </div>
          )}
        </div>

        {/* Quest Navigation */}
        {chapterStarted && chapter.quests.length > 1 && (
          <div className="flex items-center gap-2 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleQuestNavigation(currentQuest - 1)}
              disabled={!hasPreviousQuest || saving}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            
            <div className="flex items-center gap-2 flex-1 justify-center overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {chapter.quests.map((quest, index) => {
                const isActive = index === currentQuest;
                const questCompleted = isQuestCompleted(index);
                const questAccessible = isQuestAccessible(index);

                return (
                  <button
                    key={quest.id}
                    onClick={() => handleQuestNavigation(index)}
                    disabled={saving || !questAccessible}
                    className={`
                      flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-md text-sm font-medium flex-shrink-0
                      transition-colors
                      ${isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : questCompleted
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30'
                        : questAccessible
                        ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                        : 'bg-muted/50 text-muted-foreground/50 opacity-50 cursor-not-allowed'
                      }
                      ${saving ? 'opacity-50 cursor-not-allowed' : questAccessible ? 'cursor-pointer' : 'cursor-not-allowed'}
                    `}
                    title={questAccessible ? quest.title : `${quest.title} (Nicht verfügbar - schließe zuerst die vorherigen Quests ab)`}
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
              className="h-8 w-8 p-0 flex-shrink-0"
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
                  <div className="order-1 md:order-2">
                    <div className="flex items-center justify-center rounded-lg overflow-hidden">
                      <img 
                        src={activeQuestData?.imageUrl || chapter.imageUrl} 
                        alt={activeQuestData?.title || chapter.title} 
                        className="w-full h-auto object-cover rounded-lg"
                      />
                    </div>
                    {/* Show completion message below image if quest is completed */}
                    {isCurrentQuestCompleted && (
                      <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 mt-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            Quest abgeschlossen!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                 {/* Quest Card - Second on mobile, first on desktop */}
                 <Card className="flex flex-col border-0 order-2 md:order-1">
                   <CardContent className="space-y-4 p-3 md:p-6 pt-3 md:pt-6">
                    {/* Show completion content if quest is completed */}
                    {isCurrentQuestCompleted ? (
                      <div className="space-y-2 pt-2">
                        {/* Show completion message if no quest image */}
                        {!activeQuestData?.imageUrl && !(chapter.imageUrl && currentQuest === 0) && !activeQuestData.completionImageUrl && (
                          <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 mb-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-green-600 dark:text-green-400">
                                Quest abgeschlossen!
                              </p>
                            </div>
                          </div>
                        )}
                        {/* Completion content with image on right if available */}
                        {activeQuestData.completionText && (
                          <div className={`grid gap-3 mb-4 ${activeQuestData.completionImageUrl ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                            {activeQuestData.completionImageUrl && (
                              <div className="order-1 md:order-2">
                                <div className="flex items-center justify-center rounded-lg overflow-hidden">
                                  <img 
                                    src={activeQuestData.completionImageUrl} 
                                    alt="Completion" 
                                    className="w-full h-auto object-cover rounded-lg"
                                  />
                                </div>
                                {/* Show completion message below completion image if no quest image */}
                                {!activeQuestData?.imageUrl && !(chapter.imageUrl && currentQuest === 0) && (
                                  <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 mt-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                    <div>
                                      <p className="font-semibold text-green-600 dark:text-green-400">
                                        Quest abgeschlossen!
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="space-y-4 order-2 md:order-1">
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
                              {!hasNextQuest && activeQuestData.questNumber === 10 && (
                                <div className="pt-4 mt-4 border-t border-border/50">
                                  <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <BookOpen className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="font-semibold text-blue-600 dark:text-blue-400 mb-1">
                                        Kapitel abgeschlossen!
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Neue Kapitel werden in Zukunft hinzugefügt. Bleib dran – du wirst etwas Wichtiges entdecken...
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
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
                          <div className="space-y-4 pt-2">
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

