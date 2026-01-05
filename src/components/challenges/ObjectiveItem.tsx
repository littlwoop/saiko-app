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
import { Calendar } from "@/components/ui/calendar";
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

  // Normalize dates to local timezone start of day
  const startRaw = new Date(startDate);
  const start = new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate());
  const endRaw = new Date(endDate);
  const end = new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate());
  // Calculate total days inclusive: floor the difference and add 1 for inclusive count
  const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Get today's date in local timezone (not UTC)
  const todayLocal = new Date();
  const today = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
  
  // Helper function to format date in local timezone (YYYY-MM-DD)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateString = formatLocalDate(date);
    const isCompleted = completedDays.has(dateString);
    const isToday = dateString === today;
    days.push({ date: dateString, isCompleted, isToday });
  }

  return (
    <div className="mt-1.5">
      <div className="text-xs text-gray-500 mb-1.5">{t("dailyProgress")}</div>
      <div className="flex flex-wrap gap-0.5">
        {days.map((day, index) => (
          <div
            key={index}
            className={`w-7 h-7 ${
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
  selectedUserId?: string | null;
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
  selectedUserId,
}: ObjectiveItemProps) {
  const [value, setValue] = useState(progress?.currentValue?.toString() || "0");
  const [notes, setNotes] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
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
  
  // Determine which user's data to fetch - prioritize selectedUserId, then progress userId, then logged-in user
  const userIdToQuery = selectedUserId || progress?.userId || user?.id;
  
  // Check if challenge is currently active
  const isChallengeActive = () => {
    if (!challengeStartDate) return true; // Allow if dates not provided (fallback)
    
    const now = new Date();
    const startDate = new Date(challengeStartDate);
    
    // If no end date, challenge is active after start date
    if (!challengeEndDate) {
      return now >= startDate;
    }
    
    const endDate = new Date(challengeEndDate);
    return now >= startDate && now <= endDate;
  };
  
  const challengeActive = isChallengeActive();
  
  // For completion challenges, calculate total days and progress differently
  let totalDays = objective.targetValue;
  let progressPercent = Math.min(100, (currentValue / objective.targetValue) * 100);
  let isCompleted = currentValue >= objective.targetValue;
  
  if (challenge_type === "completion" && challengeStartDate) {
    if (challengeEndDate) {
      // Normalize dates to local timezone start of day
      const startDateRaw = new Date(challengeStartDate);
      const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
      const endDateRaw = new Date(challengeEndDate);
      const endDate = new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate());
      // Calculate total days inclusive: floor the difference and add 1 for inclusive count
      totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      progressPercent = Math.min(100, (currentValue / totalDays) * 100);
      isCompleted = currentValue >= totalDays;
    } else {
      // For ongoing completion challenges, use a default total days (e.g., 365)
      totalDays = 365;
      progressPercent = Math.min(100, (currentValue / totalDays) * 100);
      isCompleted = false; // Never fully complete for ongoing challenges
    }
  } else if (challenge_type === "checklist" || challenge_type === "collection") {
    // For checklist challenges, completed when currentValue >= 1
    isCompleted = currentValue >= 1;
    progressPercent = isCompleted ? 100 : 0;
  }
  
  const completionCount = challenge_type === "bingo" ? Math.floor(currentValue / objective.targetValue) : (isCompleted ? 1 : 0);

  const pointsEarned = calculatePoints(objective, currentValue, capedPoints);
  const targetPoints = objective.targetValue * objective.pointsPerUnit;

  // Check for today's entry on component mount and when user changes
  useEffect(() => {
    if (challenge_type === "completion" && userIdToQuery) {
      hasEntryForToday().then(setHasEntryToday);
      getDailyEntries().then((entries) => setDailyEntries(entries));
    }
  }, [challenge_type, userIdToQuery, challengeId, objective.id, challengeStartDate, challengeEndDate]);

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
    
    if (!challengeActive) {
      toast({
        title: t("challengeInactive"),
        description: t("challengeInactiveDescription"),
        variant: "destructive",
      });
      return;
    }

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
    if (!userIdToQuery) return false;

    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    try {
      const { data: entries, error } = await supabase
        .from('entries')
        .select('created_at')
        .eq('user_id', userIdToQuery)
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
    if (!userIdToQuery || !challengeStartDate) return new Set<string>();

    console.log('getDailyEntries called with:', { challengeStartDate, challengeEndDate, userIdToQuery });

    try {
      // Validate and format dates properly
      const startDate = new Date(challengeStartDate);
      const endDate = challengeEndDate ? new Date(challengeEndDate) : null;
      
      if (isNaN(startDate.getTime()) || (endDate && isNaN(endDate.getTime()))) {
        console.error('Invalid date format:', { challengeStartDate, challengeEndDate });
        return new Set<string>();
      }
      
      const startDateTime = startDate.toISOString();
      
      // If no end date, query all entries from start date onwards
      const query = supabase
        .from('entries')
        .select('created_at')
        .eq('user_id', userIdToQuery)
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', startDateTime);
      
      if (endDate) {
        const endDateTime = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
        query.lte('created_at', endDateTime);
      }
      
      const { data: entries, error } = await query;

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

  const hasEntryForDate = async (date: string): Promise<boolean> => {
    if (!userIdToQuery) return false;

    try {
      const { data: entries, error } = await supabase
        .from('entries')
        .select('created_at')
        .eq('user_id', userIdToQuery)
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', `${date}T00:00:00.000Z`)
        .lt('created_at', `${date}T23:59:59.999Z`);

      if (error) {
        console.error('Error checking date entries:', error);
        return false;
      }

      return entries && entries.length > 0;
    } catch (error) {
      console.error('Error checking date entries:', error);
      return false;
    }
  };

  const handleAddPastCompletion = async () => {
    if (!selectedDate || !user) return;
    
    if (!challengeActive) {
      toast({
        title: t("challengeInactive"),
        description: t("challengeInactiveDescription"),
        variant: "destructive",
      });
      return;
    }

    // Format date as YYYY-MM-DD in local timezone
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    // Check if entry already exists for this date
    const hasEntry = await hasEntryForDate(dateString);
    if (hasEntry) {
      toast({
        title: t("alreadyCompleted"),
        description: t("alreadyCompletedForDate").replace("{date}", dateString),
        variant: "destructive",
      });
      return;
    }

    // Validate date is within challenge range
    if (challengeStartDate) {
      const startDate = new Date(challengeStartDate);
      startDate.setHours(0, 0, 0, 0);
      const selectedDateStart = new Date(selectedDate);
      selectedDateStart.setHours(0, 0, 0, 0);
      
      if (selectedDateStart < startDate) {
        toast({
          title: t("invalidDate"),
          description: t("dateBeforeChallengeStart"),
          variant: "destructive",
        });
        return;
      }
    }

    if (challengeEndDate) {
      const endDate = new Date(challengeEndDate);
      endDate.setHours(23, 59, 59, 999);
      const selectedDateEnd = new Date(selectedDate);
      selectedDateEnd.setHours(23, 59, 59, 999);
      
      if (selectedDateEnd > endDate) {
        toast({
          title: t("invalidDate"),
          description: t("dateAfterChallengeEnd"),
          variant: "destructive",
        });
        return;
      }
    }

    // Add completion for the selected date
    await updateProgress(challengeId, objective.id, 1, undefined, dateString);
    
    // Refresh daily entries
    getDailyEntries().then((entries) => setDailyEntries(entries));
    
    // If the selected date is today, update hasEntryToday
    const today = new Date().toISOString().split('T')[0];
    if (dateString === today) {
      setHasEntryToday(true);
    }
    
    setIsDatePickerOpen(false);
    setSelectedDate(undefined);
    
    if (onProgressUpdate) {
      onProgressUpdate();
    }
  };

  const handleQuickAdd = async () => {
    // For checklist/collection challenges, allow toggle even with hasEntryToday check
    if ((challenge_type === "checklist" || challenge_type === "collection") && readOnly) return;
    if (challenge_type !== "checklist" && challenge_type !== "collection" && (!user || readOnly || hasEntryToday)) return;
    if ((challenge_type === "checklist" || challenge_type === "collection") && !user) return;
    
    if (!challengeActive) {
      toast({
        title: t("challengeInactive"),
        description: t("challengeInactiveDescription"),
        variant: "destructive",
      });
      return;
    }
    
    // For bingo challenges, add 1 completion
    if (challenge_type === "bingo") {
      await updateProgress(challengeId, objective.id, 1);
    } else if (challenge_type === "completion") {
      // For completion challenges, add 1 day of progress
      // Always use value 1 since each entry represents 1 day (progress is counted by entry count)
      await updateProgress(challengeId, objective.id, 1);
      setHasEntryToday(true); // Mark as completed for today
      
      // Update daily entries with today's date
      const today = new Date().toISOString().split('T')[0];
      setDailyEntries(prev => new Set([...prev, today]));
      
      // Also refresh from database to ensure consistency
      getDailyEntries().then((entries) => setDailyEntries(entries));
    } else if (challenge_type === "checklist" || challenge_type === "collection") {
      // For checklist challenges, toggle completion (0 or 1)
      const newValue = currentValue >= 1 ? 0 : 1;
      await updateProgress(challengeId, objective.id, newValue);
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
            className={`relative select-none mb-3 ${isCompleted ? "border-challenge-teal bg-green-50/30" : ""} ${!readOnly && challengeActive ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${!challengeActive ? "opacity-60 cursor-not-allowed" : ""}`}
            onClick={(e) => {
              // Only open dialog on left-click, not right-click
              if (e.button === 0 && !readOnly && challengeActive) {
                // Quick add on single click, dialog on double click
                if (e.detail === 1) {
                  handleQuickAdd();
                } else if (e.detail === 2) {
                  setIsOpen(true);
                }
              }
            }}
            onTouchStart={(e) => {
              if (isTouchDevice && !readOnly && challengeActive) {
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
            <CardHeader className="flex flex-col items-center justify-center p-2 py-3 text-center">
              <CardTitle className="text-xs leading-tight line-clamp-2 overflow-hidden text-ellipsis w-full">
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
                      if (!challengeActive) {
                        toast({
                          title: t("challengeInactive"),
                          description: t("challengeInactiveDescription"),
                          variant: "destructive",
                        });
                        return;
                      }
                      
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

  if (challenge_type === "collection") {
    return (
      <>
        <Card 
          className={`select-none mb-3 transition-colors ${
            isCompleted ? "border-green-200 bg-green-50/50" : "border-gray-200 hover:border-gray-300"
          } ${!readOnly && challengeActive && !isCompleted ? "cursor-pointer hover:shadow-md" : ""} ${!challengeActive ? "opacity-60 cursor-not-allowed" : ""}`}
          onClick={!readOnly && challengeActive && !isCompleted ? () => setIsConfirmDialogOpen(true) : undefined}
        >
          <CardHeader className="pb-2 pt-3 px-3">
            <div>
              <CardTitle className={`text-sm ${isCompleted ? "line-through text-gray-500" : "text-gray-900"}`}>
                {objective.title}
              </CardTitle>
              {objective.description && (
                <CardDescription className="mt-0.5 text-xs">
                  {objective.description}
                </CardDescription>
              )}
            </div>
          </CardHeader>
        </Card>

        {!readOnly && (
          <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t("completeObjective")}</DialogTitle>
                <DialogDescription>
                  {t("confirmCompleteObjective").replace("{objective}", objective.title)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button onClick={async () => {
                  if (!user) {
                    console.error("No user logged in");
                    toast({
                      title: t("error"),
                      description: "You must be logged in to complete objectives",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  console.log("Completing objective:", { 
                    challengeId, 
                    objectiveId: objective.id, 
                    objective,
                    challenge_type 
                  });
                  
                  if (!challengeActive) {
                    toast({
                      title: t("challengeInactive"),
                      description: t("challengeInactiveDescription"),
                      variant: "destructive",
                    });
                    setIsConfirmDialogOpen(false);
                    return;
                  }
                  
                  try {
                    // Validate objective ID is a UUID, if not generate a new one
                    // This is a workaround for legacy challenges with numeric IDs
                    let validObjectiveId = objective.id;
                    if (objective.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(objective.id)) {
                      console.warn("Invalid objective ID format (not a UUID):", objective.id);
                      // Generate a UUID to use as the objective_id for this entry
                      // This is a temporary workaround - ideally the challenge should be fixed in the database
                      validObjectiveId = crypto.randomUUID();
                      console.log("Generated temporary UUID:", validObjectiveId);
                    }
                    
                    console.log("Calling updateProgress with:", {
                      challengeId,
                      objectiveId: validObjectiveId,
                      value: 1
                    });
                    await updateProgress(challengeId, validObjectiveId, 1);
                    
                    console.log("Successfully completed objective");
                    setIsConfirmDialogOpen(false);
                    if (onProgressUpdate) {
                      onProgressUpdate();
                    }
                  } catch (error) {
                    console.error("Error completing objective:", error);
                    toast({
                      title: t("error"),
                      description: "Failed to complete objective",
                      variant: "destructive",
                    });
                  }
                }}>
                  {t("complete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </>
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
          className={`select-none mb-3 transition-colors ${
            isCompleted || hasEntryToday ? "border-green-200 bg-green-50/50" : "border-gray-200 hover:border-gray-300"
          } ${!readOnly && !hasEntryToday ? "cursor-pointer hover:shadow-md" : ""}`}
          onClick={!readOnly && !hasEntryToday ? (e) => {
            if (e.detail === 1) {
              handleQuickAdd();
            }
          } : undefined}
        >
          <CardHeader className="pb-2 pt-3 px-3 text-center">
            <CardTitle className="text-sm font-medium leading-tight flex items-center justify-center gap-1.5">
              {isCompleted && (
                <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              )}
              <span className={isCompleted ? "line-through text-gray-600" : "text-gray-900"}>
                {objective.title}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 mt-0.5">
              {formattedDate}
            </CardDescription>
            {(isCompleted || hasEntryToday) && (
              <div className="mt-1">
                <div className="bg-green-100 text-green-800 text-xs font-medium px-1.5 py-0.5 rounded-full inline-block">
                  {hasEntryToday ? t("completedToday") : t("complete")}
                </div>
              </div>
            )}
          </CardHeader>
        </Card>
        {!readOnly && (
          <div className="mt-1.5 flex justify-center">
            <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  {t("addPastCompletion")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t("addPastCompletion")}</DialogTitle>
                  <DialogDescription>
                    {t("selectDateToAddCompletion")}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => {
                      // Disable dates outside challenge range
                      if (challengeStartDate) {
                        const startDate = new Date(challengeStartDate);
                        startDate.setHours(0, 0, 0, 0);
                        if (date < startDate) return true;
                      }
                      if (challengeEndDate) {
                        const endDate = new Date(challengeEndDate);
                        endDate.setHours(23, 59, 59, 999);
                        if (date > endDate) return true;
                      }
                      // Disable future dates
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);
                      if (date > today) return true;
                      // Disable dates that already have entries
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const dateString = `${year}-${month}-${day}`;
                      return dailyEntries.has(dateString);
                    }}
                    className="rounded-md border"
                  />
                  {selectedDate && (
                    <div className="text-sm text-muted-foreground">
                      {t("selectedDate")}: {selectedDate.toLocaleDateString(language === "de" ? "de-DE" : "en-US")}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsDatePickerOpen(false);
                    setSelectedDate(undefined);
                  }}>
                    {t("cancel")}
                  </Button>
                  <Button 
                    onClick={handleAddPastCompletion}
                    disabled={!selectedDate}
                  >
                    {t("addCompletion")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
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
          className={`select-none mb-3 ${isCompleted ? "border-challenge-teal bg-green-50/30" : ""} ${!readOnly && challengeActive ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${!challengeActive ? "opacity-60 cursor-not-allowed" : ""}`}
          onClick={!readOnly && challengeActive ? (e) => {
            // Quick add on single click, dialog on double click
            if (e.detail === 1) {
              handleQuickAdd();
            } else if (e.detail === 2) {
              setIsOpen(true);
            }
          } : undefined}
          onTouchStart={!readOnly && challengeActive ? handleLongPress : undefined}
          onTouchEnd={!readOnly && challengeActive ? handleTouchEnd : undefined}
          onTouchCancel={!readOnly && challengeActive ? handleTouchEnd : undefined}
        >
          <CardHeader className="pb-1.5 pt-3 px-3">
            <div className="flex justify-between items-center gap-2">
              <CardTitle className="text-sm flex items-center gap-1.5 flex-1 min-w-0">
                {isCompleted && (
                  <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                )}
                <span className="truncate">{objective.title}</span>
                {!challengeActive && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {t("challengeInactive")}
                  </span>
                )}
              </CardTitle>
              <div className="text-xs font-medium flex-shrink-0">
                {objective.pointsPerUnit} {t("points")}/{objective.unit}
              </div>
            </div>
            {objective.description && (
              <CardDescription className="line-clamp-1 text-xs mt-0.5">
                {objective.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pb-2 pt-0 px-3">
            <div className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-challenge-purple flex-shrink-0" />
              <span className="text-xs font-medium">
                {Math.floor(pointsEarned)} / {Math.floor(targetPoints)}{" "}
                {t("points")}
              </span>
            </div>
          </CardContent>
          <CardFooter className="pt-2 pb-3 px-3">
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
