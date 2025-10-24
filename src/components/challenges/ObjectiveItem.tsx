import { useState, useRef, useEffect } from "react";
import { Objective, UserProgress, ChallengeType } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, CheckCircle, Check, RotateCcw } from "lucide-react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useTranslation } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { calculatePoints } from "@/lib/points";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface DailyProgressGridProps {
  startDate?: string;
  endDate?: string;
  completedDays: Set<string>;
  t: (key: string) => string;
}

const DailyProgressGrid = ({ startDate, endDate, completedDays, t }: DailyProgressGridProps) => {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const today = new Date().toISOString().split('T')[0];
  
  
  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateString = date.toISOString().split('T')[0];
    const isCompleted = completedDays.has(dateString);
    const isToday = dateString === today;
    days.push({ date: dateString, isCompleted, isToday });
  }

  return (
    <div className="mt-2">
      <div className="text-xs text-gray-500 mb-2">{t("dailyProgress")}</div>
      <div className="flex flex-wrap gap-1">
        {days.map((day, index) => (
          <div
            key={index}
            className={`w-8 h-8 ${
              day.isCompleted ? 'bg-green-500' : 'bg-gray-200'
            }`}
            title={`${day.date} - ${day.isCompleted ? t("completed") : t("notCompleted")}`}
          />
        ))}
      </div>
    </div>
  );
};

interface ObjectiveItemProps {
  objective: Objective;
  challengeId: number;
  progress?: UserProgress;
  challenge_type: ChallengeType;
  readOnly?: boolean;
  capedPoints?: boolean;
  onProgressUpdate?: () => void;
  challengeStartDate?: string;
  challengeEndDate?: string;
}

export default function ObjectiveItem({
  objective,
  challengeId,
  progress,
  challenge_type,
  readOnly,
  capedPoints = false,
  onProgressUpdate,
  challengeStartDate,
  challengeEndDate,
}: ObjectiveItemProps) {
  const [value, setValue] = useState(progress?.currentValue?.toString() || "0");
  const [notes, setNotes] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [completionsToAdd, setCompletionsToAdd] = useState("1");
  const [hasEntryToday, setHasEntryToday] = useState(false);
  const [dailyEntries, setDailyEntries] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<NodeJS.Timeout>();
  const { updateProgress } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();

  const currentValue = progress?.currentValue || 0;
  
  // For completion challenges, calculate total days and progress differently
  let totalDays = objective.targetValue;
  let progressPercent = Math.min(100, (currentValue / objective.targetValue) * 100);
  let isCompleted = currentValue >= objective.targetValue;
  
  if (challenge_type === "completion" && challengeStartDate && challengeEndDate) {
    const startDate = new Date(challengeStartDate);
    const endDate = new Date(challengeEndDate);
    totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    progressPercent = Math.min(100, (currentValue / totalDays) * 100);
    isCompleted = currentValue >= totalDays;
    
  }
  const completionCount = challenge_type === "bingo" ? Math.floor(currentValue / objective.targetValue) : (isCompleted ? 1 : 0);

  const pointsEarned = calculatePoints(objective, currentValue, capedPoints);
  const targetPoints = objective.targetValue * objective.pointsPerUnit;

  // Check for today's entry on component mount
  useEffect(() => {
    if (challenge_type === "completion" && user) {
      hasEntryForToday().then(setHasEntryToday);
      getDailyEntries().then((entries) => setDailyEntries(entries));
    }
  }, [challenge_type, user, challengeId, objective.id, challengeStartDate, challengeEndDate]);

  const handleLongPress = () => {
    if (isTouchDevice && !readOnly) {
      longPressTimer.current = setTimeout(() => {
        setIsOpen(true);
      }, 500);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return;

    await updateProgress(challengeId, objective.id, numericValue, notes);
    setIsOpen(false);
    setValue("0");
    setNotes("");
    if (onProgressUpdate) {
      onProgressUpdate();
    }
  };

  const handleReset = async () => {
    if (!user) return;
    await updateProgress(challengeId, objective.id, 0);
    if (onProgressUpdate) {
      onProgressUpdate();
    }
  };

  const hasEntryForToday = async () => {
    if (!user) return false;

    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    try {
      const { data: entries, error } = await supabase
        .from('entries')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      if (error) {
        console.error('Error checking today\'s entries:', error);
        return false;
      }

      return entries && entries.length > 0;
    } catch (error) {
      console.error('Error checking today\'s entries:', error);
      return false;
    }
  };

  const getDailyEntries = async (): Promise<Set<string>> => {
    if (!user || !challengeStartDate || !challengeEndDate) return new Set<string>();

    console.log('getDailyEntries called with:', { challengeStartDate, challengeEndDate });

    try {
      // Validate and format dates properly
      const startDate = new Date(challengeStartDate);
      const endDate = new Date(challengeEndDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Invalid date format:', { challengeStartDate, challengeEndDate });
        return new Set<string>();
      }
      
      const startDateTime = startDate.toISOString();
      const endDateTime = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(); // End of day
      
      const { data: entries, error } = await supabase
        .from('entries')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime);

      if (error) {
        console.error('Error fetching daily entries:', error);
        return new Set<string>();
      }

      const entryDates = new Set<string>();
      if (entries) {
        entries.forEach(entry => {
          const date = entry.created_at.split('T')[0];
          entryDates.add(date);
        });
      }

      return entryDates;
    } catch (error) {
      console.error('Error fetching daily entries:', error);
      return new Set<string>();
    }
  };

  const handleQuickAdd = async () => {
    if (!user || readOnly || hasEntryToday) return;
    
    // For bingo challenges, add 1 completion
    if (challenge_type === "bingo") {
      await updateProgress(challengeId, objective.id, 1);
    } else if (challenge_type === "completion") {
      // For completion challenges, add 1 day of progress
      const newValue = currentValue + 1;
      await updateProgress(challengeId, objective.id, newValue);
      setHasEntryToday(true); // Mark as completed for today
      
      // Update daily entries with today's date
      const today = new Date().toISOString().split('T')[0];
      setDailyEntries(prev => new Set([...prev, today]));
      
      // Also refresh from database to ensure consistency
      getDailyEntries().then((entries) => setDailyEntries(entries));
    } else {
      // For standard challenges, add 1 unit of progress
      const newValue = currentValue + 1;
      await updateProgress(challengeId, objective.id, newValue);
    }
    
    if (onProgressUpdate) {
      onProgressUpdate();
    }
  };

  if (challenge_type === "bingo") {
    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <Card
            className={`relative select-none ${isCompleted ? "border-challenge-teal bg-green-50/30" : ""} ${!readOnly ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
            onClick={(e) => {
              // Only open dialog on left-click, not right-click
              if (e.button === 0 && !readOnly) {
                // Quick add on single click, dialog on double click
                if (e.detail === 1) {
                  handleQuickAdd();
                } else if (e.detail === 2) {
                  setIsOpen(true);
                }
              }
            }}
            onTouchStart={(e) => {
              if (isTouchDevice && !readOnly) {
                longPressTimer.current = setTimeout(() => {
                  const contextMenuEvent = new MouseEvent("contextmenu", {
                    bubbles: true,
                    cancelable: true,
                    clientX: e.touches[0].clientX,
                    clientY: e.touches[0].clientY,
                  });
                  e.currentTarget.dispatchEvent(contextMenuEvent);
                }, 500);
              }
            }}
            onTouchEnd={(e) => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = undefined;
              }
            }}
            onTouchCancel={(e) => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = undefined;
              }
            }}
          >
            <CardHeader className="flex flex-col items-center justify-center p-2 py-4 text-center">
              <CardTitle className="text-sm leading-tight line-clamp-2 overflow-hidden text-ellipsis w-full">
                {objective.title}
              </CardTitle>
            </CardHeader>
            {completionCount > 0 && (
              <div className="absolute top-1 right-1">
                {completionCount === 1 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {completionCount}
                  </div>
                )}
              </div>
            )}
          </Card>
        </ContextMenuTrigger>
        {!readOnly && (
          <ContextMenuContent>
            <ContextMenuItem onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("resetObjective")}
            </ContextMenuItem>
          </ContextMenuContent>
        )}
        {!readOnly && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t("completeObjective")}</DialogTitle>
                <DialogDescription>
                  {t("confirmCompleteObjective").replace(
                    "{objective}",
                    objective.title,
                  )}
                  {completionCount > 0 && (
                    <span className="block mt-2 text-sm text-muted-foreground">
                      {t("currentCompletions")}: {completionCount}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="completions-to-add">
                    {t("addCompletions")}:
                  </Label>
                  <Input
                    id="completions-to-add"
                    type="number"
                    min="1"
                    max="10"
                    value={completionsToAdd}
                    onChange={(e) => setCompletionsToAdd(e.target.value)}
                    className="w-20"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    if (user) {
                      const completions = parseInt(completionsToAdd);
                      if (completions > 0) {
                        await updateProgress(challengeId, objective.id, completions);
                        if (onProgressUpdate) {
                          onProgressUpdate();
                        }
                        setIsOpen(false);
                        setCompletionsToAdd("1"); // Reset to default
                      }
                    }
                  }}
                >
                  {t("addCompletions")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </ContextMenu>
    );
  }

  if (challenge_type === "completion") {
    const today = new Date();
    const formattedDate = today.toLocaleDateString(language === "de" ? "de-DE" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    return (
      <>
        <Card 
          className={`select-none mb-4 transition-colors ${
            isCompleted || hasEntryToday ? "border-green-200 bg-green-50/50" : "border-gray-200 hover:border-gray-300"
          } ${!readOnly && !hasEntryToday ? "cursor-pointer hover:shadow-md" : ""}`}
          onClick={!readOnly && !hasEntryToday ? (e) => {
            if (e.detail === 1) {
              handleQuickAdd();
            }
          } : undefined}
        >
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-base font-medium leading-tight flex items-center justify-center gap-2">
              {isCompleted && (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
              <span className={isCompleted ? "line-through text-gray-600" : "text-gray-900"}>
                {objective.title}
              </span>
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1">
              {formattedDate}
            </CardDescription>
            {(isCompleted || hasEntryToday) && (
              <div className="mt-2">
                <div className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full inline-block">
                  {hasEntryToday ? "Completed today" : t("complete")}
                </div>
              </div>
            )}
          </CardHeader>
        </Card>
        <DailyProgressGrid 
          startDate={challengeStartDate}
          endDate={challengeEndDate}
          completedDays={dailyEntries}
          t={t}
        />
      </>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card
          className={`select-none mb-4 ${isCompleted ? "border-challenge-teal bg-green-50/30" : ""} ${!readOnly ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
          onClick={!readOnly ? (e) => {
            // Quick add on single click, dialog on double click
            if (e.detail === 1) {
              handleQuickAdd();
            } else if (e.detail === 2) {
              setIsOpen(true);
            }
          } : undefined}
          onTouchStart={!readOnly ? handleLongPress : undefined}
          onTouchEnd={!readOnly ? handleTouchEnd : undefined}
          onTouchCancel={!readOnly ? handleTouchEnd : undefined}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                {isCompleted && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                {objective.title}
              </CardTitle>
              <div className="text-sm font-medium">
                {objective.pointsPerUnit} {t("points")}/{objective.unit}
              </div>
            </div>
            <CardDescription className="line-clamp-2 text-xs">
              {objective.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-challenge-purple" />
                  <span className="text-sm font-medium">
                    {Math.floor(pointsEarned)} / {Math.floor(targetPoints)}{" "}
                    {t("points")}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            {!readOnly && (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    {t("addProgress")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>{t("addProgress")}</DialogTitle>
                      <DialogDescription>
                        {t("enterProgressFor")} {objective.title}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="progress-value">
                          {t("progress")}: {currentValue} /{" "}
                          {objective.targetValue} {objective.unit}
                        </Label>
                        <Input
                          id="progress-value"
                          type="number"
                          min="0"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={t("enterUnit").replace(
                            "{unit}",
                            objective.unit,
                          )}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="notes">{t("notes")}</Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={t("addNotesAboutProgress")}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">{t("saveProgress")}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardFooter>
        </Card>
      </ContextMenuTrigger>
      {!readOnly && (
        <ContextMenuContent>
          <ContextMenuItem onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("resetObjective")}
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
