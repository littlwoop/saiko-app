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
import { Trophy, CheckCircle, Check, RotateCcw, Hand, X } from "lucide-react";
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
import { getWeekIdentifier, getWeekStart, getWeekEnd } from "@/lib/week-utils";
import { getLocalDateString, localDateToUTCStart, localDateToUTCEnd, utcTimestampToLocalDateString } from "@/lib/date-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { challenge41CompletionItems } from "@/lib/challenge-41-completion-items";

interface DailyProgressGridProps {
  startDate?: string;
  endDate?: string;
  completedDays: Set<string>;
  t: (key: string) => string;
}

export const DailyProgressGrid = ({ startDate, endDate, completedDays, t }: DailyProgressGridProps) => {
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

interface WeeklyProgressGridProps {
  startDate?: string;
  endDate?: string;
  completedWeeks: Set<string>;
  t: (key: string) => string;
  completionItems?: string[];
  completedItems?: Set<string>;
  onItemClick?: (item: string) => void;
  readOnly?: boolean;
  weekCompleted?: boolean;
  currentWeekEntries?: Array<{ notes?: string; createdAt: string; userId?: string }>;
  onCustomTextSubmit?: (text: string) => void;
  language?: string;
  targetValue?: number;
  currentProgress?: number;
}

export const WeeklyProgressGrid = ({ 
  startDate, 
  endDate, 
  completedWeeks, 
  t,
  completionItems,
  completedItems,
  onItemClick,
  readOnly,
  weekCompleted,
  currentWeekEntries,
  onCustomTextSubmit,
  language,
  targetValue,
  currentProgress,
}: WeeklyProgressGridProps) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customText.trim() && onCustomTextSubmit) {
      onCustomTextSubmit(customText.trim());
      setCustomText("");
      setShowCustomInput(false);
    }
  };

  // Filter completion items based on search query
  const filteredCompletionItems = completionItems?.filter(item =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Normalize challenge dates to start/end of day
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  // Get week start for the challenge start date
  const challengeWeekStart = getWeekStart(start);
  const challengeWeekEnd = getWeekEnd(end);
  
  // Get current week identifier
  const today = new Date();
  const currentWeekId = getWeekIdentifier(today);
  
  // Helper function to format week range for display
  const formatWeekRange = (weekStart: Date): string => {
    const weekEnd = getWeekEnd(weekStart);
    const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  };
  
  // Helper function to check if a week overlaps with the challenge date range
  const weekOverlapsChallenge = (weekStart: Date): boolean => {
    const weekEnd = getWeekEnd(weekStart);
    // Week overlaps if it starts before challenge ends AND ends after challenge starts
    return weekStart <= end && weekEnd >= start;
  };
  
  const weeks = [];
  const current = new Date(challengeWeekStart);
  // Stop when we've gone past the challenge end date
  while (current <= challengeWeekEnd) {
    // Only include weeks that overlap with the challenge date range
    if (weekOverlapsChallenge(current)) {
      const weekId = getWeekIdentifier(current);
      const isCompleted = completedWeeks.has(weekId);
      const isCurrentWeek = weekId === currentWeekId;
      const weekRange = formatWeekRange(current);
      weeks.push({ weekId, isCompleted, isCurrentWeek, weekRange, weekStart: new Date(current) });
    }
    
    // Move to next week (add 7 days)
    current.setDate(current.getDate() + 7);
  }

  return (
    <div className="mt-1.5 space-y-2">
      {/* Weekly progress grid - only show if no completion items (not challenge 41) */}
      {(!completionItems || completionItems.length === 0) && (
        <div>
          <div className="text-xs text-gray-500 mb-1.5">{t("weeklyProgress") || t("dailyProgress")}</div>
          <div className="flex flex-wrap gap-0.5">
            {weeks.map((week, index) => (
              <div
                key={index}
                className={`w-7 h-7 ${
                  week.isCompleted ? 'bg-green-500' : 'bg-gray-200'
                } ${week.isCurrentWeek ? 'ring-2 ring-blue-400' : ''}`}
                title={`${week.weekRange} - ${week.isCompleted ? t("completed") : t("notCompleted")}`}
              />
            ))}
          </div>
        </div>
      )}
      {/* Completion items grid for challenge ID 41 */}
      {completionItems && completionItems.length > 0 && (
        <div>
          {/* Display target value and progress */}
          {targetValue !== undefined && (
            <div className="mb-2 text-sm text-gray-700">
              {t("progress")}: {currentWeekEntries?.filter(entry => entry.notes && entry.notes.trim() !== "").length || 0} / {targetValue} {targetValue === 1 ? t("completion") : t("completions")}
            </div>
          )}
          {/* Search field */}
          <div className="mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search") || "Search..."}
              className="w-full h-9 px-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-0.5 items-center">
            {/* "+" button to add custom text - hide when search is active */}
            {!readOnly && !weekCompleted && !searchQuery.trim() && (
              <>
                {showCustomInput ? (
                  <form onSubmit={handleCustomSubmit} className="flex gap-1 items-center">
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder={language === "de" ? "hinzufügen" : "Add..."}
                      className="h-9 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                      onBlur={() => {
                        if (!customText.trim()) {
                          setShowCustomInput(false);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!customText.trim()}
                      className="h-9 px-2 text-sm bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {t("addCompletion") || "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomText("");
                      }}
                      className="h-9 w-9 flex items-center justify-center bg-gray-200 text-gray-700 rounded-sm hover:bg-gray-300"
                      title={t("cancel") || "Cancel"}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <div
                    onClick={() => setShowCustomInput(true)}
                    className="w-9 h-9 flex items-center justify-center text-lg font-medium bg-blue-500 text-white hover:bg-blue-600 cursor-pointer rounded-sm transition-colors"
                    title={t("addCompletion") || "Add custom entry"}
                  >
                    +
                  </div>
                )}
              </>
            )}
            {/* Show all entries as green, non-clickable squares - hide during search */}
            {!searchQuery.trim() && currentWeekEntries
              ?.filter(entry => entry.notes && entry.notes.trim() !== "")
              .map((entry, index) => (
                <div
                  key={`entry-${index}-${entry.createdAt}`}
                  className="min-w-9 h-9 px-2 flex items-center justify-center text-sm font-medium bg-green-500 text-white rounded-sm"
                  title={`${entry.notes} - ${t("completed")}`}
                >
                  {entry.notes}
                </div>
              ))}
            {/* Show clickable items that haven't been completed yet */}
            {filteredCompletionItems.map((item) => {
              const isCompleted = completedItems?.has(item) || false;
              const canClick = !readOnly && !weekCompleted && !isCompleted;
              // Only show if not completed (completed ones are shown above as entries)
              if (isCompleted) return null;
              return (
                <div
                  key={item}
                  onClick={canClick ? () => onItemClick?.(item) : undefined}
                  className={`min-w-9 h-9 px-2 flex items-center justify-center text-sm font-medium transition-colors rounded-sm ${
                    canClick
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                  title={`${item} - ${t("notCompleted")}`}
                >
                  {item}
                </div>
              );
            })}
            {/* Show option to add search text as completion if no matches found */}
            {searchQuery.trim() && 
             filteredCompletionItems.length === 0 && 
             !completedItems?.has(searchQuery.trim()) &&
             !readOnly && 
             !weekCompleted && (
              <div
                onClick={() => onCustomTextSubmit?.(searchQuery.trim())}
                className="min-w-9 h-9 px-2 flex items-center justify-center text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 cursor-pointer rounded-sm transition-colors"
                title={`${t("addCompletion") || "Add"} "${searchQuery.trim()}"`}
              >
                + {searchQuery.trim()}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Weekly progress grid - only show if no completion items (not challenge 41) */}
      {(!completionItems || completionItems.length === 0) && (
        <div>
          <div className="text-xs text-gray-500 mb-1.5">{t("weeklyProgress") || t("dailyProgress")}</div>
          <div className="flex flex-wrap gap-0.5">
            {weeks.map((week, index) => (
              <div
                key={index}
                className={`w-7 h-7 ${
                  week.isCompleted ? 'bg-green-500' : 'bg-gray-200'
                } ${week.isCurrentWeek ? 'ring-2 ring-blue-400' : ''}`}
                title={`${week.weekRange} - ${week.isCompleted ? t("completed") : t("notCompleted")}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ObjectiveItemProps {
  objective: Objective;
  challengeId: number;
  progress?: UserProgress;
  challengeType: ChallengeType;
  readOnly?: boolean;
  capedPoints?: boolean;
  onProgressUpdate?: () => void;
  challengeStartDate?: string;
  challengeEndDate?: string;
  selectedUserId?: string | null;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export default function ObjectiveItem({
  objective,
  challengeId,
  progress,
  challengeType,
  readOnly,
  capedPoints = false,
  onProgressUpdate,
  challengeStartDate,
  challengeEndDate,
  selectedUserId,
  isExpanded: externalIsExpanded,
  onExpandChange,
}: ObjectiveItemProps) {
  const [value, setValue] = useState(progress?.currentValue?.toString() || "0");
  const [notes, setNotes] = useState("");
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  // Use external state if provided (for bingo cards), otherwise use internal state
  const isOpen = externalIsExpanded !== undefined ? externalIsExpanded : internalIsOpen;
  const setIsOpen = (expanded: boolean) => {
    if (onExpandChange) {
      onExpandChange(expanded);
    } else {
      setInternalIsOpen(expanded);
    }
  };
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [completionsToAdd, setCompletionsToAdd] = useState("1");
  const [hasEntryToday, setHasEntryToday] = useState(false);
  const [dailyEntries, setDailyEntries] = useState<Set<string>>(new Set());
  const [hasEntryThisWeek, setHasEntryThisWeek] = useState(false);
  const [weeklyEntries, setWeeklyEntries] = useState<Set<string>>(new Set());
  const [currentWeekProgress, setCurrentWeekProgress] = useState(0);
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [currentWeekEntries, setCurrentWeekEntries] = useState<Array<{ notes?: string; createdAt: string; userId?: string }>>([]);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const { updateProgress } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const currentValue = progress?.currentValue || 0;
  
  // Determine which user's data to fetch - prioritize selectedUserId, then progress userId, then logged-in user
  const userIdToQuery = selectedUserId || progress?.userId || user?.id;
  // Check if this is a collaborative challenge (indicated by "collective" userId)
  const isCollaborative = userIdToQuery === "collective";
  
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
  
  if (challengeType === "completion" && challengeStartDate) {
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
  } else if (challengeType === "checklist" || challengeType === "collection") {
    // For checklist challenges, completed when currentValue >= 1
    isCompleted = currentValue >= 1;
    progressPercent = isCompleted ? 100 : 0;
  }
  
  const completionCount = challengeType === "bingo" ? Math.floor(currentValue / objective.targetValue) : (isCompleted ? 1 : 0);

  const pointsEarned = calculatePoints(objective, currentValue, capedPoints);
  const targetPoints = objective.targetValue * objective.pointsPerUnit;

  // Check for today's entry on component mount and when user changes
  useEffect(() => {
    if (challengeType === "completion" && userIdToQuery) {
      hasEntryForToday().then(setHasEntryToday);
      getDailyEntries().then((entries) => setDailyEntries(entries));
    } else if (challengeType === "weekly" && (userIdToQuery || isCollaborative)) {
      // For weekly challenges, always fetch current progress first
      const targetValue = objective.targetValue || 1;
      getCurrentWeekProgress().then((progress) => {
        setCurrentWeekProgress(progress);
        // For targetValue === 1, set hasEntryThisWeek based on whether there's any entry
        // For targetValue > 1, set hasEntryThisWeek only when target is reached
        if (targetValue === 1) {
          hasEntryForThisWeek().then(setHasEntryThisWeek);
        } else {
          setHasEntryThisWeek(progress >= targetValue);
        }
      });
      getWeeklyEntries().then((entries) => setWeeklyEntries(entries));
      getCurrentWeekEntries().then((entries) => setCurrentWeekEntries(entries));
    }
  }, [challengeType, userIdToQuery, challengeId, objective.id, challengeStartDate, challengeEndDate]);

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

    // For weekly challenges, require notes (string input)
    if (challengeType === "weekly") {
      if (!notes || notes.trim() === "") {
        toast({
          title: t("error"),
          description: "Please enter a description for this completion.",
          variant: "destructive",
        });
        return;
      }
      // For weekly challenges, always add 1 completion
      await updateProgress(challengeId, objective.id, 1, notes.trim());
      
      // Refresh weekly progress
      const targetValue = objective.targetValue || 1;
      let newProgress = 0;
      if (targetValue === 1) {
        setHasEntryThisWeek(true);
        const today = new Date();
        const weekId = getWeekIdentifier(today);
        setWeeklyEntries(prev => new Set([...prev, weekId]));
        getWeeklyEntries().then((entries) => setWeeklyEntries(entries));
        newProgress = 1;
      } else {
        newProgress = await getCurrentWeekProgress();
        setCurrentWeekProgress(newProgress);
        if (newProgress >= targetValue) {
          setHasEntryThisWeek(true);
          const today = new Date();
          const weekId = getWeekIdentifier(today);
          setWeeklyEntries(prev => new Set([...prev, weekId]));
          getWeeklyEntries().then((entries) => setWeeklyEntries(entries));
        }
        // Refresh current week entries to show the new entry
        getCurrentWeekEntries().then((entries) => setCurrentWeekEntries(entries));
      }
      
      // Clear input
      setNotes("");
      
      // For targetValue > 1, keep the inline input open if target not reached yet
      // For targetValue === 1, hide the inline input after completion
      if (targetValue === 1 || newProgress >= targetValue) {
        setShowInlineInput(false);
      }
      // Otherwise, keep it open for next completion
    } else {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) return;
      await updateProgress(challengeId, objective.id, numericValue, notes);
      setIsOpen(false);
      setValue("0");
      setNotes("");
    }
    
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

  const handleQuickCompletionItem = async (itemName: string) => {
    if (!user || readOnly) return;
    
    if (challengeType === "weekly") {
      const targetValue = objective.targetValue || 1;
      const showProgress = targetValue > 1;
      // Calculate weekCompleted for this check
      const weekCompleted = showProgress 
        ? currentWeekProgress >= targetValue 
        : hasEntryThisWeek;
      
      if (weekCompleted && targetValue === 1) return; // Don't allow adding more if single completion is done
      
      // Add completion with item name as notes
      await updateProgress(challengeId, objective.id, 1, itemName);
      
      // Refresh weekly progress
      let newProgress = 0;
      if (targetValue === 1) {
        setHasEntryThisWeek(true);
        const today = new Date();
        const weekId = getWeekIdentifier(today);
        setWeeklyEntries(prev => new Set([...prev, weekId]));
        getWeeklyEntries().then((entries) => setWeeklyEntries(entries));
        newProgress = 1;
      } else {
        newProgress = await getCurrentWeekProgress();
        setCurrentWeekProgress(newProgress);
        if (newProgress >= targetValue) {
          setHasEntryThisWeek(true);
          const today = new Date();
          const weekId = getWeekIdentifier(today);
          setWeeklyEntries(prev => new Set([...prev, weekId]));
          getWeeklyEntries().then((entries) => setWeeklyEntries(entries));
        }
        // Refresh current week entries to show the new entry
        getCurrentWeekEntries().then((entries) => setCurrentWeekEntries(entries));
      }
      
      if (onProgressUpdate) {
        onProgressUpdate();
      }
    }
  };

  const hasEntryForToday = async () => {
    if (!userIdToQuery && !isCollaborative) return false;

    const today = getLocalDateString(); // Get today's date in YYYY-MM-DD format (local timezone)

    try {
      const startUTC = localDateToUTCStart(today);
      const endUTC = localDateToUTCEnd(today);
      
      let query = supabase
        .from('entries')
        .select('created_at')
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', startUTC)
        .lte('created_at', endUTC);
      
      // For collaborative challenges, don't filter by user_id (get all participants' entries)
      // For non-collaborative, filter by specific user
      if (!isCollaborative && userIdToQuery) {
        query = query.eq('user_id', userIdToQuery);
      }
      
      const { data: entries, error } = await query;

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
      // Parse dates and normalize to local dates first
      const startDate = new Date(challengeStartDate);
      const endDate = challengeEndDate ? new Date(challengeEndDate) : null;
      
      if (isNaN(startDate.getTime()) || (endDate && isNaN(endDate.getTime()))) {
        console.error('Invalid date format:', { challengeStartDate, challengeEndDate });
        return new Set<string>();
      }
      
      // Convert to local date strings (YYYY-MM-DD) then to UTC for query
      const startDateString = getLocalDateString(startDate);
      const startDateTime = localDateToUTCStart(startDateString);
      
      // If no end date, query all entries from start date onwards
      let query = supabase
        .from('entries')
        .select('created_at')
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', startDateTime);
      
      // For collaborative challenges, don't filter by user_id (get all participants' entries)
      // For non-collaborative, filter by specific user
      if (!isCollaborative && userIdToQuery) {
        query = query.eq('user_id', userIdToQuery);
      }
      
      if (endDate) {
        const endDateString = getLocalDateString(endDate);
        const endDateTime = localDateToUTCEnd(endDateString);
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
          // Convert UTC timestamp to local date string
          const date = utcTimestampToLocalDateString(entry.created_at);
          entryDates.add(date);
        });
      }

      return entryDates;
    } catch (error) {
      console.error('Error fetching daily entries:', error);
      return new Set<string>();
    }
  };

  const getWeeklyEntries = async (): Promise<Set<string>> => {
    if ((!userIdToQuery && !isCollaborative) || !challengeStartDate) return new Set<string>();

    try {
      const startDate = new Date(challengeStartDate);
      const endDate = challengeEndDate ? new Date(challengeEndDate) : null;
      
      if (isNaN(startDate.getTime()) || (endDate && isNaN(endDate.getTime()))) {
        return new Set<string>();
      }
      
      const startDateTime = startDate.toISOString();
      let query = supabase
        .from('entries')
        .select('created_at, value')
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', startDateTime);
      
      // For collaborative challenges, don't filter by user_id (get all participants' entries)
      // For non-collaborative, filter by specific user
      if (!isCollaborative && userIdToQuery) {
        query = query.eq('user_id', userIdToQuery);
      }
      
      if (endDate) {
        const endDateTime = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
        query = query.lte('created_at', endDateTime);
      }
      
      const { data: entries, error } = await query;

      if (error) {
        console.error('Error fetching weekly entries:', error);
        return new Set<string>();
      }

      // Group entries by week and check if each week meets the target
      const targetValue = objective.targetValue || 1;
      const weekProgressMap = new Map<string, number>();
      
      if (entries) {
        entries.forEach(entry => {
          const entryDate = new Date(entry.created_at);
          const weekId = getWeekIdentifier(entryDate);
          const currentProgress = weekProgressMap.get(weekId) || 0;
          weekProgressMap.set(weekId, currentProgress + (entry.value || 0));
        });
      }

      // Only include weeks where target is met
      const completedWeeks = new Set<string>();
      weekProgressMap.forEach((progress, weekId) => {
        if (progress >= targetValue) {
          completedWeeks.add(weekId);
        }
      });

      return completedWeeks;
    } catch (error) {
      console.error('Error fetching weekly entries:', error);
      return new Set<string>();
    }
  };

  const hasEntryForThisWeek = async (): Promise<boolean> => {
    if (!userIdToQuery && !isCollaborative) return false;

    const today = new Date();
    const targetValue = objective.targetValue || 1;

    try {
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);
      
      let query = supabase
        .from('entries')
        .select('value')
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());
      
      // For collaborative challenges, don't filter by user_id (get all participants' entries)
      // For non-collaborative, filter by specific user
      if (!isCollaborative && userIdToQuery) {
        query = query.eq('user_id', userIdToQuery);
      }
      
      const { data: entries, error } = await query;

      if (error) {
        console.error('Error checking this week\'s entries:', error);
        return false;
      }

      // Sum all entry values for this week and check if target is met
      const totalProgress = entries ? entries.reduce((sum, entry) => sum + (entry.value || 0), 0) : 0;
      return totalProgress >= targetValue;
    } catch (error) {
      console.error('Error checking this week\'s entries:', error);
      return false;
    }
  };

  const getCurrentWeekProgress = async (): Promise<number> => {
    if (!userIdToQuery && !isCollaborative) return 0;

    const today = new Date();
    try {
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);
      
      let query = supabase
        .from('entries')
        .select('value')
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());
      
      // For collaborative challenges, don't filter by user_id (get all participants' entries)
      // For non-collaborative, filter by specific user
      if (!isCollaborative && userIdToQuery) {
        query = query.eq('user_id', userIdToQuery);
      }
      
      const { data: entries, error } = await query;

      if (error) {
        console.error('Error getting this week\'s progress:', error);
        return 0;
      }

      // Sum all entry values for this week
      return entries ? entries.reduce((sum, entry) => sum + (entry.value || 0), 0) : 0;
    } catch (error) {
      console.error('Error getting this week\'s progress:', error);
      return 0;
    }
  };

  const getCurrentWeekEntries = async (): Promise<Array<{ notes?: string; createdAt: string; userId?: string }>> => {
    if (!userIdToQuery && !isCollaborative) return [];

    const today = new Date();
    try {
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);
      
      let query = supabase
        .from('entries')
        .select('notes, created_at, user_id')
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())
        .order('created_at', { ascending: false });
      
      // For collaborative challenges, don't filter by user_id (get all participants' entries)
      // For non-collaborative, filter by specific user
      if (!isCollaborative && userIdToQuery) {
        query = query.eq('user_id', userIdToQuery);
      }
      
      const { data: entries, error } = await query;

      if (error) {
        console.error('Error getting this week\'s entries:', error);
        return [];
      }

      // Map the entries to match the expected format (created_at -> createdAt, user_id -> userId)
      const mappedEntries = (entries || []).map(entry => ({
        notes: entry.notes,
        createdAt: entry.created_at,
        userId: entry.user_id
      }));
      
      console.log('Current week entries fetched:', mappedEntries.length, mappedEntries);
      return mappedEntries;
    } catch (error) {
      console.error('Error getting this week\'s entries:', error);
      return [];
    }
  };

  const getWeekProgress = async (weekId: string): Promise<number> => {
    if (!userIdToQuery && !isCollaborative) return 0;

    try {
      // Parse week identifier to get week start date
      // Week identifier format: YYYY-MM-DD (Monday of the week)
      const [year, month, day] = weekId.split('-').map(Number);
      const weekStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      const weekEnd = getWeekEnd(weekStart);
      
      let query = supabase
        .from('entries')
        .select('value')
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());
      
      // For collaborative challenges, don't filter by user_id (get all participants' entries)
      // For non-collaborative, filter by specific user
      if (!isCollaborative && userIdToQuery) {
        query = query.eq('user_id', userIdToQuery);
      }
      
      const { data: entries, error } = await query;

      if (error) {
        console.error('Error getting week progress:', error);
        return 0;
      }

      // Sum all entry values for this week
      return entries ? entries.reduce((sum, entry) => sum + (entry.value || 0), 0) : 0;
    } catch (error) {
      console.error('Error getting week progress:', error);
      return 0;
    }
  };

  const hasEntryForWeek = async (weekId: string): Promise<boolean> => {
    if (!userIdToQuery) return false;

    const targetValue = objective.targetValue || 1;
    const progress = await getWeekProgress(weekId);
    return progress >= targetValue;
  };

  const hasEntryForDate = async (date: string): Promise<boolean> => {
    if (!userIdToQuery) return false;

    try {
      // Parse the date string (YYYY-MM-DD) and create date range in local timezone
      const startUTC = localDateToUTCStart(date);
      const endUTC = localDateToUTCEnd(date);
      
      const { data: entries, error } = await supabase
        .from('entries')
        .select('created_at')
        .eq('user_id', userIdToQuery)
        .eq('challenge_id', challengeId)
        .eq('objective_id', objective.id)
        .gte('created_at', startUTC)
        .lte('created_at', endUTC);

      if (error) {
        console.error('Error checking date entries:', error);
        return false;
      }

      // Check if any entry matches the local date
      if (!entries || entries.length === 0) return false;
      
      // Convert entry timestamps to local dates and check if any match
      return entries.some(entry => {
        const entryDateString = utcTimestampToLocalDateString(entry.created_at);
        return entryDateString === date;
      });
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

    if (challengeType === "weekly") {
      // For weekly challenges, check if week is completed
      const weekId = getWeekIdentifier(selectedDate);
      const targetValue = objective.targetValue || 1;
      
      if (targetValue === 1) {
        // For targetValue === 1, check if entry exists for the week
        const hasEntry = await hasEntryForWeek(weekId);
        if (hasEntry) {
          toast({
            title: t("alreadyCompleted"),
            description: t("alreadyCompletedForDate").replace("{date}", weekId),
            variant: "destructive",
          });
          return;
        }
      } else {
        // For targetValue > 1, check if week has reached target
        const weekStart = getWeekStart(selectedDate);
        const weekEnd = getWeekEnd(selectedDate);
        
        const { data: entries, error } = await supabase
          .from('entries')
          .select('value')
          .eq('user_id', userIdToQuery || '')
          .eq('challenge_id', challengeId)
          .eq('objective_id', objective.id)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());
        
        if (error) {
          console.error('Error checking week progress:', error);
        } else {
          const weekProgress = entries ? entries.reduce((sum, entry) => sum + (entry.value || 0), 0) : 0;
          if (weekProgress >= targetValue) {
            toast({
              title: t("alreadyCompleted"),
              description: t("alreadyCompletedForDate").replace("{date}", weekId),
              variant: "destructive",
            });
            return;
          }
        }
      }
    } else {
      // For completion challenges, check if entry exists for the date
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      const hasEntry = await hasEntryForDate(dateString);
      if (hasEntry) {
        toast({
          title: t("alreadyCompleted"),
          description: t("alreadyCompletedForDate").replace("{date}", dateString),
          variant: "destructive",
        });
        return;
      }
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

    if (challengeType === "weekly") {
      // For weekly challenges, require notes (string input)
      if (!notes || notes.trim() === "") {
        toast({
          title: t("error"),
          description: "Please enter a description for this completion.",
          variant: "destructive",
        });
        return;
      }
      
      // For weekly challenges, add completion for the selected week
      const weekId = getWeekIdentifier(selectedDate);
      const targetValue = objective.targetValue || 1;
      
      // Get current progress for this week before adding
      const progressBefore = await getWeekProgress(weekId);
      
      // Add the entry with notes
      await updateProgress(challengeId, objective.id, 1, notes.trim());
      
      // Get progress after adding to check if week is now complete
      const progressAfter = await getWeekProgress(weekId);
      const isWeekComplete = progressAfter >= targetValue;
      
      // Only refresh weekly entries if the week is now complete
      // This ensures we only count weeks that are fully completed
      if (isWeekComplete) {
        getWeeklyEntries().then((entries) => setWeeklyEntries(entries));
      }
      
      // If the selected week is this week, update hasEntryThisWeek and current week progress
      const today = new Date();
      const currentWeekId = getWeekIdentifier(today);
      if (weekId === currentWeekId) {
        if (targetValue > 1) {
          // Refresh current week progress for targetValue > 1
          setCurrentWeekProgress(progressAfter);
          if (isWeekComplete) {
            setHasEntryThisWeek(true);
          }
        } else {
          // For targetValue === 1, if we just completed it, mark as complete
          if (isWeekComplete) {
            setHasEntryThisWeek(true);
          }
        }
      }
      
      // Clear notes after adding
      setNotes("");
    } else {
      // For completion challenges, add completion for the selected date
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      await updateProgress(challengeId, objective.id, 1, undefined, dateString);
      
      // Refresh daily entries
      getDailyEntries().then((entries) => setDailyEntries(entries));
      
      // If the selected date is today, update hasEntryToday
      const today = getLocalDateString();
      if (dateString === today) {
        setHasEntryToday(true);
      }
    }
    
    setIsDatePickerOpen(false);
    setSelectedDate(undefined);
    
    if (onProgressUpdate) {
      onProgressUpdate();
    }
  };

  const handleQuickAdd = async () => {
    // For checklist/collection challenges, allow toggle even with hasEntryToday check
    if ((challengeType === "checklist" || challengeType === "collection") && readOnly) return;
    if (challengeType === "completion" && (!user || readOnly || hasEntryToday)) return;
    // For weekly challenges with targetValue === 1, check if week is completed
    // For weekly challenges with targetValue > 1, allow clicking until target is reached
    if (challengeType === "weekly") {
      if (!user || readOnly) return;
      const targetValue = objective.targetValue || 1;
      if (targetValue === 1 && hasEntryThisWeek) return;
      // For targetValue > 1, only block if progress >= targetValue
      if (targetValue > 1 && currentWeekProgress >= targetValue) return;
    }
    if (challengeType !== "checklist" && challengeType !== "collection" && challengeType !== "completion" && challengeType !== "weekly" && (!user || readOnly)) return;
    if ((challengeType === "checklist" || challengeType === "collection") && !user) return;
    
    if (!challengeActive) {
      toast({
        title: t("challengeInactive"),
        description: t("challengeInactiveDescription"),
        variant: "destructive",
      });
      return;
    }
    
    // For bingo challenges, add 1 completion
    if (challengeType === "bingo") {
      await updateProgress(challengeId, objective.id, 1);
    } else if (challengeType === "completion") {
      // For completion challenges, add 1 day of progress
      // Always use value 1 since each entry represents 1 day (progress is counted by entry count)
      await updateProgress(challengeId, objective.id, 1);
      setHasEntryToday(true); // Mark as completed for today
      
      // Update daily entries with today's date
      const today = getLocalDateString();
      setDailyEntries(prev => new Set([...prev, today]));
      
      // Also refresh from database to ensure consistency
      getDailyEntries().then((entries) => setDailyEntries(entries));
    } else if (challengeType === "weekly") {
      // For weekly challenges, show inline input field
      setShowInlineInput(true);
      return; // Don't add progress here, let the inline form handle it
    } else if (challengeType === "checklist" || challengeType === "collection") {
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

  if (challengeType === "bingo") {
    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <Card
            className={`relative select-none mb-3 transition-all duration-200 ${
              isCompleted ? "border-challenge-teal bg-green-50/30" : ""
            } ${!readOnly && challengeActive ? "cursor-pointer hover:shadow-md" : ""} ${
              !challengeActive ? "opacity-60 cursor-not-allowed" : ""
            } ${isMobile && isOpen ? "shadow-lg w-full" : ""}`}
              onClick={(e) => {
                // Only handle click on left-click, not right-click
                if (e.button === 0 && !readOnly && challengeActive) {
                  if (isMobile) {
                    // On mobile, toggle expansion inline
                    setIsOpen(!isOpen);
                  } else {
                    // On desktop, quick add on single click, dialog on double click
                    if (e.detail === 1) {
                      handleQuickAdd();
                    } else if (e.detail === 2) {
                      setIsOpen(true);
                    }
                  }
                }
              }}
              onTouchStart={(e) => {
                // On mobile, don't use long press for context menu - use click to expand instead
                if (!isMobile && isTouchDevice && !readOnly && challengeActive) {
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
                <CardTitle className={`text-xs sm:text-sm leading-tight ${isMobile && isOpen ? 'line-clamp-1' : 'line-clamp-2'} overflow-hidden text-ellipsis w-full font-medium`}>
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
              
              {/* Expanded content for mobile */}
              {isMobile && isOpen && !readOnly && (
                <CardContent className="pt-2 pb-3 px-3 border-t">
                  <div className="space-y-3">
                    {objective.description && (
                      <p className="text-xs text-muted-foreground text-center">
                        {objective.description}
                      </p>
                    )}
                    {completionCount > 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        {t("currentCompletions")}: {completionCount}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs sm:text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                        }}
                      >
                        {t("cancel") || "Dismiss"}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs sm:text-sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (user) {
                            if (!challengeActive) {
                              toast({
                                title: t("challengeInactive"),
                                description: t("challengeInactiveDescription"),
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            await updateProgress(challengeId, objective.id, 1);
                            if (onProgressUpdate) {
                              onProgressUpdate();
                            }
                            setIsOpen(false);
                          }
                        }}
                      >
                        {t("complete")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
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
        {!readOnly && !isMobile && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{objective.title}</DialogTitle>
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
                      
                      await updateProgress(challengeId, objective.id, 1);
                      if (onProgressUpdate) {
                        onProgressUpdate();
                      }
                      setIsOpen(false);
                    }
                  }}
                >
                  {t("complete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </ContextMenu>
    );
  }

  if (challengeType === "collection") {
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
                    challengeType 
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

  if (challengeType === "completion") {
    const today = new Date();
    const formattedDate = today.toLocaleDateString(language === "de" ? "de-DE" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const isClickable = !readOnly && !hasEntryToday;
    const isCompletedState = isCompleted || hasEntryToday;

    return (
      <>
        <Card 
          className={`select-none mb-3 transition-all duration-200 ${
            isCompletedState 
              ? "border-green-200 bg-green-50/50" 
              : ""
          } ${isClickable ? "cursor-pointer hover:shadow-md" : ""}`}
          onClick={isClickable ? (e) => {
            if (e.detail === 1) {
              handleQuickAdd();
            }
          } : undefined}
        >
          <CardHeader className="pb-3 pt-4 px-4 text-center">
            <CardTitle className="text-sm font-medium leading-tight flex items-center justify-center gap-1.5 mb-1">
              {isCompletedState && (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
              <span className={isCompletedState ? "line-through text-gray-600" : "text-gray-900"}>
                {objective.title}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 mb-2">
              {formattedDate}
            </CardDescription>
            {isCompletedState ? (
              <div className="mt-1">
                <div className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full inline-block">
                  {hasEntryToday ? t("completedToday") : t("complete")}
                </div>
              </div>
            ) : isClickable ? (
              <div className="mt-2 flex flex-col items-center gap-2">
                <div className="bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-2 shadow-md">
                  <Hand className="h-4 w-4" />
                  <span>{t("tapToComplete")}</span>
                </div>
              </div>
            ) : null}
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
        {/* Hide grid for completion challenges - shown at challenge level instead */}
        {challengeType !== "completion" && challengeType !== "weekly" && (
          <DailyProgressGrid 
            startDate={challengeStartDate}
            endDate={challengeEndDate}
            completedDays={dailyEntries}
            t={t}
          />
        )}
        {/* Show weekly grid for weekly challenges (but not for challenge 41, which is handled separately) */}
        {challengeType === "weekly" && challengeId !== 41 && (
          <>
            <WeeklyProgressGrid 
              startDate={challengeStartDate}
              endDate={challengeEndDate}
              completedWeeks={weeklyEntries}
              t={t}
            />
          </>
        )}
      </>
    );
  }

  if (challengeType === "weekly") {
    const today = new Date();
    const weekStart = getWeekStart(today);
    const weekEnd = getWeekEnd(today);
    const formattedWeekRange = `${weekStart.toLocaleDateString(language === "de" ? "de-DE" : "en-US", { day: "numeric", month: "short" })} - ${weekEnd.toLocaleDateString(language === "de" ? "de-DE" : "en-US", { day: "numeric", month: "short", year: "numeric" })}`;
    
    const targetValue = objective.targetValue || 1;
    const showProgress = targetValue > 1;
    // For targetValue > 1, only mark as completed when progress reaches target
    // For targetValue === 1, mark as completed when hasEntryThisWeek is true
    // IMPORTANT: For targetValue > 1, completely ignore hasEntryThisWeek
    const weekCompleted = showProgress 
      ? currentWeekProgress >= targetValue 
      : hasEntryThisWeek;
    // Allow clicking if not completed
    // For targetValue > 1, allow clicking even when inline input is shown (to add multiple completions)
    const canClick = !readOnly && !weekCompleted;

    // Special handling for challenge 41: show Quick Completion grid instead of card
    if (challengeId === 41) {
      return (
        <>
          {/* Weekly progress grid - show above completion items */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1.5">{t("weeklyProgress") || t("dailyProgress")}</div>
            <div className="flex flex-wrap gap-0.5">
              {(() => {
                const start = challengeStartDate ? new Date(challengeStartDate) : new Date();
                const end = challengeEndDate ? new Date(challengeEndDate) : new Date();
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                const challengeWeekStart = getWeekStart(start);
                const challengeWeekEnd = getWeekEnd(end);
                const today = new Date();
                const currentWeekId = getWeekIdentifier(today);
                const weeks = [];
                const current = new Date(challengeWeekStart);
                while (current <= challengeWeekEnd) {
                  const weekEnd = getWeekEnd(current);
                  if (current <= end && weekEnd >= start) {
                    const weekId = getWeekIdentifier(current);
                    const isCompleted = weeklyEntries.has(weekId);
                    const isCurrentWeek = weekId === currentWeekId;
                    weeks.push({ weekId, isCompleted, isCurrentWeek });
                  }
                  current.setDate(current.getDate() + 7);
                }
                return weeks.map((week, index) => (
                  <div
                    key={index}
                    className={`w-7 h-7 ${
                      week.isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    } ${week.isCurrentWeek ? 'ring-2 ring-blue-400' : ''}`}
                  />
                ));
              })()}
            </div>
          </div>
          {/* Show Quick Completion grid instead of objective card */}
          <WeeklyProgressGrid 
            startDate={challengeStartDate}
            endDate={challengeEndDate}
            completedWeeks={weeklyEntries}
            t={t}
            completionItems={challenge41CompletionItems}
            completedItems={new Set(
              currentWeekEntries
                .filter(entry => entry.notes && challenge41CompletionItems.includes(entry.notes.trim()))
                .map(entry => entry.notes!.trim())
            )}
            onItemClick={handleQuickCompletionItem}
            readOnly={readOnly}
            weekCompleted={weekCompleted}
            currentWeekEntries={currentWeekEntries}
            onCustomTextSubmit={handleQuickCompletionItem}
            language={language}
            targetValue={objective.targetValue || 1}
            currentProgress={currentWeekProgress}
          />
          {/* Move "Add Past Completion" to the bottom */}
          {!readOnly && (
            <div className="mt-3 flex justify-center">
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
                          // For weekly challenges with targetValue > 1, don't disable weeks
                          // For weekly challenges with targetValue === 1, disable completed weeks
                          const targetValue = objective.targetValue || 1;
                          if (targetValue === 1) {
                            const weekId = getWeekIdentifier(date);
                            return weeklyEntries.has(weekId);
                          }
                          return false;
                        }}
                        className="rounded-md border"
                      />
                      {selectedDate && (
                        <>
                          <div className="text-sm text-muted-foreground">
                            {t("selectedDate")}: {selectedDate.toLocaleDateString(language === "de" ? "de-DE" : "en-US")}
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="past-completion-notes">
                              {t("description")} <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              id="past-completion-notes"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder={t("addNotesAboutProgress")}
                              required
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setIsDatePickerOpen(false);
                        setSelectedDate(undefined);
                        setNotes("");
                      }}>
                        {t("cancel")}
                      </Button>
                      <Button 
                        onClick={handleAddPastCompletion}
                        disabled={!selectedDate || !notes || notes.trim() === ""}
                      >
                        {t("addCompletion")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </div>
          )}
        </>
      );
    }

    // Normal rendering for other weekly challenges
    return (
      <>
        <Card 
          className={`select-none mb-3 transition-colors ${
            isCompleted || weekCompleted ? "border-green-200 bg-green-50/50" : "border-gray-200 hover:border-gray-300"
          } ${canClick ? "cursor-pointer hover:shadow-md" : ""}`}
          onClick={canClick ? (e) => {
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
              {formattedWeekRange}
            </CardDescription>
            {showProgress && (
              <div className="mt-2">
                <div className="text-xs text-gray-600">
                  {currentWeekProgress} / {targetValue} {targetValue === 1 ? t("completion") : t("completions")}
                </div>
                <Progress 
                  value={Math.min(100, (currentWeekProgress / targetValue) * 100)} 
                  className="h-1.5 mt-1"
                />
              </div>
            )}
            {(isCompleted || weekCompleted) && !showProgress && (
              <div className="mt-1">
                <div className="bg-green-100 text-green-800 text-xs font-medium px-1.5 py-0.5 rounded-full inline-block">
                  {hasEntryThisWeek ? t("completedThisWeek") : t("complete")}
                </div>
              </div>
            )}
            {weekCompleted && showProgress && (
              <div className="mt-1">
                <div className="bg-green-100 text-green-800 text-xs font-medium px-1.5 py-0.5 rounded-full inline-block">
                  {t("completedThisWeek")}
                </div>
              </div>
            )}
          </CardHeader>
        </Card>
        {!readOnly && showInlineInput && !weekCompleted && (
          <Card className="mt-2 border-gray-200">
            <CardContent className="pt-4 pb-3 px-3">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="weekly-completion-notes" className="text-sm">
                    {t("description")} <span className="text-red-500">*</span>
                    {showProgress && (
                      <span className="text-xs text-gray-500 ml-2 font-normal">
                        ({currentWeekProgress} / {targetValue} {t("completions")})
                      </span>
                    )}
                  </Label>
                  <Textarea
                    id="weekly-completion-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("addNotesAboutProgress")}
                    required
                    className="min-h-[80px]"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowInlineInput(false);
                      setNotes("");
                    }}
                  >
                    {t("cancel")}
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm"
                    disabled={!notes || notes.trim() === ""}
                  >
                    {t("addCompletion")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
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
                        // For weekly challenges with targetValue > 1, don't disable weeks
                        // For weekly challenges with targetValue === 1, disable completed weeks
                        const targetValue = objective.targetValue || 1;
                        if (targetValue === 1) {
                          const weekId = getWeekIdentifier(date);
                          return weeklyEntries.has(weekId);
                        }
                        return false;
                      }}
                      className="rounded-md border"
                    />
                    {selectedDate && (
                      <>
                        <div className="text-sm text-muted-foreground">
                          {t("selectedDate")}: {selectedDate.toLocaleDateString(language === "de" ? "de-DE" : "en-US")}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="past-completion-notes">
                            {t("description")} <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            id="past-completion-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t("addNotesAboutProgress")}
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setIsDatePickerOpen(false);
                      setSelectedDate(undefined);
                      setNotes("");
                    }}>
                      {t("cancel")}
                    </Button>
                    <Button 
                      onClick={handleAddPastCompletion}
                      disabled={!selectedDate || !notes || notes.trim() === ""}
                    >
                      {t("addCompletion")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
          </div>
        )}
      </>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card
          className={`select-none mb-3 ${isCompleted ? "border-challenge-teal bg-green-50/30" : ""} ${!readOnly && challengeActive && challengeType !== "standard" ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${!challengeActive ? "opacity-60 cursor-not-allowed" : ""}`}
          onClick={!readOnly && challengeActive && challengeType !== "standard" ? (e) => {
            // Quick add on single click, dialog on double click
            if (e.detail === 1) {
              handleQuickAdd();
            } else if (e.detail === 2) {
              setIsOpen(true);
            }
          } : undefined}
          onTouchStart={!readOnly && challengeActive && challengeType !== "standard" ? handleLongPress : undefined}
          onTouchEnd={!readOnly && challengeActive && challengeType !== "standard" ? handleTouchEnd : undefined}
          onTouchCancel={!readOnly && challengeActive && challengeType !== "standard" ? handleTouchEnd : undefined}
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
                      <DialogTitle>
                        {challengeType === "weekly" ? t("addCompletion") : t("addProgress")}
                      </DialogTitle>
                      <DialogDescription>
                        {challengeType === "weekly" 
                          ? `${t("addCompletion")} ${t("forObjective")} ${objective.title}. ${t("progress")}: ${currentWeekProgress} / ${objective.targetValue || 1} ${t("completions")}`
                          : `${t("enterProgressFor")} ${objective.title}`
                        }
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {challengeType !== "weekly" && (
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
                      )}
                      <div className="grid gap-2">
                        <Label htmlFor="notes">
                          {challengeType === "weekly" ? t("description") : t("notes")}
                          {challengeType === "weekly" && <span className="text-red-500">*</span>}
                        </Label>
                        <Textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={challengeType === "weekly" 
                            ? t("addNotesAboutProgress")
                            : t("addNotesAboutProgress")
                          }
                          required={challengeType === "weekly"}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={challengeType === "weekly" && (!notes || notes.trim() === "")}>
                        {challengeType === "weekly" ? t("addCompletion") : t("saveProgress")}
                      </Button>
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
