import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ObjectiveItem from "@/components/challenges/ObjectiveItem";
import LeaderboardTable from "@/components/challenges/LeaderboardTable";
import {
  ChevronLeft,
  Trophy,
  Users,
  Target,
  Calendar,
  Award,
  UserRound,
  CheckCircle,
  LogOut,
  Info,
  Edit,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Challenge, UserProgress } from "@/types";
import { getNumberOfWeeks } from "@/lib/week-utils";
import { useTranslation } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";
import ActivityList from "@/components/challenges/ActivityList";
import BingoAnimation from "@/components/challenges/BingoAnimation";
import { stravaService } from "@/lib/strava";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculateTotalPoints } from "@/lib/points";

// Strava Logo Component
const StravaLogo = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7.13 14.828h4.169" />
  </svg>
);

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    getChallenge,
    joinChallenge,
    leaveChallenge,
    getChallengeProgress,
    getParticipantProgress,
    getParticipants,
    getCreatorAvatar,
  } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [progress, setProgress] = useState(0);
  const [displayValue, setDisplayValue] = useState({ current: 0, total: 0 });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [participantProgress, setParticipantProgress] = useState<
    UserProgress[]
  >([]);
  const [participants, setParticipants] = useState<
    Array<{ id: string; name: string; avatar?: string }>
  >([]);
  const [showBingoAnimation, setShowBingoAnimation] = useState(false);
  const [shownBingoWins, setShownBingoWins] = useState<Set<string>>(new Set());
  const [previousProgress, setPreviousProgress] = useState<UserProgress[]>([]);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leavingChallenge, setLeavingChallenge] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const isMobile = useIsMobile();
  
  // Get active tab from URL or default to "objectives"
  const validTabs = ["objectives", "leaderboard", "activities"];
  const tabFromUrl = searchParams.get("tab");
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "objectives";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Update URL when tab changes
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    const newSearchParams = new URLSearchParams(searchParams);
    if (value === "objectives") {
      // Remove tab param if it's the default
      newSearchParams.delete("tab");
    } else {
      newSearchParams.set("tab", value);
    }
    setSearchParams(newSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);
  
  // Sync activeTab with URL on mount or when URL changes externally (e.g., refresh, browser back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const newTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "objectives";
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchParams, activeTab]);
  const [creatorAvatar, setCreatorAvatar] = useState<string | undefined>(
    undefined,
  );
  const [isImportingStrava, setIsImportingStrava] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [joiningChallenge, setJoiningChallenge] = useState(false);
  const [completionDaysCompleted, setCompletionDaysCompleted] = useState<Set<string>>(new Set());

  const hasJoined = user && challenge?.participants.includes(user.id);
  const isCreator = user && challenge?.createdById === user.id;
  
  // Check if challenge is completed
  const isCompleted = challenge?.endDate ? new Date() > new Date(challenge.endDate) : false;

  const handleJoinChallenge = async () => {
    if (!challenge) return;
    if (isCompleted) {
      toast({
        title: t("error"),
        description: t("cannotJoinCompletedChallenge"),
        variant: "destructive",
      });
      return;
    }
    setJoiningChallenge(true);
    try {
      await joinChallenge(challenge.id);
      // Refresh challenge data
      const challengeData = await getChallenge(challenge.id);
      if (challengeData) {
        setChallenge(challengeData);
        // Load participants
        const participantsData = await getParticipants(challenge.id);
        setParticipants(participantsData);
      }
    } catch (error) {
      console.error("Error joining challenge:", error);
    } finally {
      setJoiningChallenge(false);
    }
  };

  const handleLeaveChallenge = async () => {
    if (!challenge) return;
    setLeavingChallenge(true);
    try {
      await leaveChallenge(challenge.id);
      // Navigate to dashboard after leaving
      navigate("/dashboard");
    } catch (error) {
      console.error("Error leaving challenge:", error);
      setLeavingChallenge(false);
    }
  };

  // Load challenge data
  useEffect(() => {
    const fetchChallenge = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const challengeData = await getChallenge(parseInt(id));
        if (challengeData) {
          setChallenge(challengeData);
          // Load creator avatar and participants in parallel
          const [avatar, participantsData] = await Promise.all([
            getCreatorAvatar(challengeData.createdById),
            getParticipants(parseInt(id)),
          ]);
          setCreatorAvatar(avatar);
          setParticipants(participantsData);
        }
      } catch (error) {
        console.error("Error fetching challenge:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenge();
  }, [id]); // Remove function dependencies to prevent unnecessary re-renders

  // Load user progress when challenge is loaded
  useEffect(() => {
    const loadUserProgress = async () => {
      if (!challenge || !user) return;

      try {
        const progressData = await getChallengeProgress(challenge.id, challenge.challenge_type);
        setUserProgress(progressData);
        setPreviousProgress(progressData); // Initialize previous progress
      } catch (error) {
        console.error("Error loading user progress:", error);
      }
    };

    loadUserProgress();
  }, [challenge?.id, user?.id]); // Only depend on IDs, not the full objects

  // Load completion days for completion challenges
  const loadCompletionDays = useCallback(async () => {
    if (!challenge || challenge.challenge_type !== "completion" || !challenge.objectives) return;
    if (!user && !selectedUserId) return;

    const userIdToQuery = selectedUserId || user?.id;
    if (!userIdToQuery) return;

    try {
      // Get all entries for all objectives in this challenge
      // Use a wider date range to ensure we catch all entries regardless of timezone
      const startDateRaw = new Date(challenge.startDate);
      const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
      // Start from beginning of start date in local time, converted to UTC
      const startDateTime = new Date(startDate.getTime() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours before to account for timezone differences
      
      const endDateRaw = challenge.endDate ? new Date(challenge.endDate) : null;
      const endDate = endDateRaw ? new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate()) : null;
      
      const query = supabase
        .from('entries')
        .select('created_at, objective_id')
        .eq('user_id', userIdToQuery)
        .eq('challenge_id', challenge.id)
        .gte('created_at', startDateTime);

      if (endDate) {
        // End at end of end date in local time, converted to UTC, plus buffer
        const endDateTime = new Date(endDate.getTime() + 36 * 60 * 60 * 1000).toISOString(); // 36 hours after to account for timezone differences
        query.lte('created_at', endDateTime);
      }

      const { data: entries, error } = await query;

      if (error) {
        console.error('Error fetching completion entries:', error);
        return;
      }

      if (!entries) return;

      // Group entries by date (YYYY-MM-DD) - convert UTC timestamp to local date
      const entriesByDate = new Map<string, Set<string>>();
      entries.forEach(entry => {
        // Convert UTC timestamp to local date
        const entryDate = new Date(entry.created_at);
        const year = entryDate.getFullYear();
        const month = String(entryDate.getMonth() + 1).padStart(2, '0');
        const day = String(entryDate.getDate()).padStart(2, '0');
        const date = `${year}-${month}-${day}`;
        
        if (!entriesByDate.has(date)) {
          entriesByDate.set(date, new Set());
        }
        entriesByDate.get(date)!.add(entry.objective_id);
      });

      // Find dates where all objectives have entries
      const allObjectiveIds = new Set(challenge.objectives.map(obj => obj.id));
      const completedDays = new Set<string>();

      entriesByDate.forEach((objectiveIds, date) => {
        // Check if all objectives have entries for this date
        const allCompleted = Array.from(allObjectiveIds).every(objId => objectiveIds.has(objId));
        if (allCompleted) {
          completedDays.add(date);
        }
      });

      setCompletionDaysCompleted(completedDays);
    } catch (error) {
      console.error('Error loading completion days:', error);
    }
  }, [challenge?.id, challenge?.challenge_type, challenge?.objectives, challenge?.startDate, challenge?.endDate, user?.id, selectedUserId]);

  // Refresh progress when user progress changes (e.g., after updates)
  const refreshProgress = useCallback(async () => {
    if (!challenge || !user) return;

    try {
      const progressData = await getChallengeProgress(challenge.id, challenge.challenge_type);
      setUserProgress(progressData);
      // Refresh completion days for completion challenges
      if (challenge.challenge_type === "completion") {
        await loadCompletionDays();
      }
    } catch (error) {
      console.error("Error refreshing progress:", error);
    }
  }, [challenge?.id, challenge?.challenge_type, user?.id, getChallengeProgress, loadCompletionDays]);

  const handleImportStravaActivities = async () => {
    if (!user || !challenge) return;

    try {
      setIsImportingStrava(true);
      
      // Calculate challenge date range
      const challengeStartDate = new Date(challenge.startDate);
      const challengeEndDate = challenge.endDate ? new Date(challenge.endDate) : new Date(); // Use current date if no end date
      
      // Import activities from Strava within challenge timeframe
      const activities = await stravaService.getRecentActivities(user.id, {
        after: challengeStartDate,
        before: challengeEndDate,
      });
      
      // TODO: Process activities and add them to challenge objectives
      // This would need to be implemented based on how activities map to objectives
      
      toast({
        title: t("success"),
        description: `Imported ${activities.length} activities from Strava`,
      });
      
      // Refresh progress after import
      await refreshProgress();
      
    } catch (error) {
      console.error("Error importing Strava activities:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : "Failed to import Strava activities",
        variant: "destructive",
      });
    } finally {
      setIsImportingStrava(false);
    }
  };

  // Load participant progress when selected user changes
  useEffect(() => {
    const loadParticipantProgress = async () => {
      if (!selectedUserId || !challenge) return;

      try {
        const progressData = await getParticipantProgress(
          challenge.id,
          selectedUserId,
        );
        setParticipantProgress(progressData);
      } catch (error) {
        console.error("Error loading participant progress:", error);
      }
    };

    loadParticipantProgress();
  }, [selectedUserId, challenge?.id]); // Only depend on IDs

  // Calculate total points and progress
  useEffect(() => {
    if (user && challenge) {
      const progressToUse = selectedUserId ? participantProgress : userProgress;

      const totalPoints = calculateTotalPoints(
        challenge.objectives,
        progressToUse,
        challenge.capedPoints,
        challenge.challenge_type
      );

      setTotalPoints(totalPoints);
      
      // For completion challenges, calculate progress based on days completed vs total days
      if (challenge.challenge_type === "completion") {
        // Normalize dates to local timezone start of day
        const startDateRaw = new Date(challenge.startDate);
        const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
        const endDateRaw = challenge.endDate ? new Date(challenge.endDate) : null;
        const endDate = endDateRaw ? new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate()) : null;
        // Calculate total days inclusive: floor the difference and add 1 for inclusive count
        const totalDays = endDate ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 365;
        
        // Calculate total days completed across all objectives
        const totalDaysCompleted = progressToUse.reduce((sum, progressItem) => {
          return sum + progressItem.currentValue;
        }, 0);
        
        setProgress((totalDaysCompleted / totalDays) * 100);
        setDisplayValue({ current: totalDaysCompleted, total: totalDays });
      } else if (challenge.challenge_type === "weekly") {
        // For weekly challenges, calculate progress based on weeks completed vs total weeks
        const startDate = new Date(challenge.startDate);
        const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
        const totalWeeks = endDate ? getNumberOfWeeks(startDate, endDate) : 52;
        
        // Calculate total weeks completed across all objectives
        const totalWeeksCompleted = progressToUse.reduce((sum, progressItem) => {
          return sum + progressItem.currentValue;
        }, 0);
        
        setProgress((totalWeeksCompleted / totalWeeks) * 100);
        setDisplayValue({ current: totalWeeksCompleted, total: totalWeeks });
      } else if (challenge.challenge_type === "collection" || challenge.challenge_type === "checklist") {
        // For collection/checklist challenges, progress is number of completed objectives
        const completedObjectives = progressToUse.filter(p => p.currentValue >= 1).length;
        const totalObjectives = challenge.objectives.length;
        
        setProgress((completedObjectives / totalObjectives) * 100);
        setDisplayValue({ current: completedObjectives, total: totalObjectives });
      } else {
        // For standard/bingo challenges, use points-based progress
        setProgress((totalPoints / challenge.totalPoints) * 100);
        setDisplayValue({ current: totalPoints, total: challenge.totalPoints });
      }
    }
  }, [
    user?.id,
    challenge?.id,
    challenge?.objectives,
    challenge?.capedPoints,
    userProgress,
    participantProgress,
    selectedUserId,
  ]);

  useEffect(() => {
    loadCompletionDays();
  }, [loadCompletionDays]);

  // Reset shown wins when switching users
  useEffect(() => {
    setShownBingoWins(new Set());
  }, [selectedUserId]);

  // Function to check for Bingo wins - memoized to prevent recreation
  const checkForBingo = useCallback(
    (progress: UserProgress[], currentShownWins: Set<string>) => {
      if (challenge?.challenge_type !== "bingo" && challenge?.objectives?.length !== 25) return false;

      const gridSize = Math.sqrt(challenge.objectives.length);
      const completedObjectives = new Set(
        progress
          .filter((p) => (p.currentValue || 0) >= 1)
          .map((p) => p.objectiveId),
      );

      // Check rows
      for (let i = 0; i < gridSize; i++) {
        let rowComplete = true;
        for (let j = 0; j < gridSize; j++) {
          const index = i * gridSize + j;
          if (!completedObjectives.has(challenge.objectives[index].id)) {
            rowComplete = false;
            break;
          }
        }
        if (rowComplete) {
          const winKey = `row-${i}`;
          if (!currentShownWins.has(winKey)) {
            setShownBingoWins((prev) => new Set([...prev, winKey]));
            return true;
          }
        }
      }

      // Check columns
      for (let j = 0; j < gridSize; j++) {
        let colComplete = true;
        for (let i = 0; i < gridSize; i++) {
          const index = i * gridSize + j;
          if (!completedObjectives.has(challenge.objectives[index].id)) {
            colComplete = false;
            break;
          }
        }
        if (colComplete) {
          const winKey = `col-${j}`;
          if (!currentShownWins.has(winKey)) {
            setShownBingoWins((prev) => new Set([...prev, winKey]));
            return true;
          }
        }
      }

      // Check main diagonal
      let mainDiagComplete = true;
      for (let i = 0; i < gridSize; i++) {
        const index = i * gridSize + i;
        if (!completedObjectives.has(challenge.objectives[index].id)) {
          mainDiagComplete = false;
          break;
        }
      }
      if (mainDiagComplete) {
        const winKey = "diag-main";
        if (!currentShownWins.has(winKey)) {
          setShownBingoWins((prev) => new Set([...prev, winKey]));
          return true;
        }
      }

      // Check anti-diagonal
      let antiDiagComplete = true;
      for (let i = 0; i < gridSize; i++) {
        const index = i * gridSize + (gridSize - 1 - i);
        if (!completedObjectives.has(challenge.objectives[index].id)) {
          antiDiagComplete = false;
          break;
        }
      }
      if (antiDiagComplete) {
        const winKey = "diag-anti";
        if (!currentShownWins.has(winKey)) {
          setShownBingoWins((prev) => new Set([...prev, winKey]));
          return true;
        }
      }
      return false;
    },
    [challenge?.id, challenge?.challenge_type, challenge?.objectives],
  ); // Remove shownBingoWins dependency

  // Check for new completions and trigger bingo animation
  useEffect(() => {
    if ((challenge?.challenge_type !== "bingo" && challenge?.objectives?.length !== 25) || !user) return;

    const progressToCheck = selectedUserId ? participantProgress : userProgress;
    const prevProgress = selectedUserId ? [] : previousProgress;

    // Check if any new objectives were completed
    const hasNewCompletion = progressToCheck.some((current) => {
      const prev = prevProgress.find(
        (p) => p.objectiveId === current.objectiveId,
      );
      return current.currentValue >= 1 && (!prev || prev.currentValue < 1);
    });

    if (hasNewCompletion) {
      const hasBingo = checkForBingo(progressToCheck, shownBingoWins);
      if (hasBingo) {
        setShowBingoAnimation(true);
      }
    }

    // Update previous progress
    if (!selectedUserId) {
      setPreviousProgress(progressToCheck);
    }
  }, [
    challenge?.challenge_type,
    selectedUserId,
    participantProgress,
    userProgress,
    checkForBingo,
    previousProgress,
    user?.id,
    shownBingoWins,
  ]);

  if (loading || !challenge) {
    return (
      <div className="container py-2">
        <div className="animate-pulse space-y-4 mb-4">
          <div className="h-8 w-64 rounded bg-muted"></div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="h-8 w-64 rounded bg-muted"></div>
                <div className="h-6 w-20 rounded bg-muted"></div>
              </div>

              <div className="flex flex-wrap gap-4 sm:gap-6">
                <div className="h-5 w-48 rounded bg-muted"></div>
                <div className="h-5 w-32 rounded bg-muted"></div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-muted"></div>
                <div className="h-5 w-40 rounded bg-muted"></div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="h-10 w-full rounded bg-muted"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded bg-muted"></div>
                ))}
              </div>
            </div>
          </div>


        </div>
      </div>
    );
  }

  // Normalize dates to local timezone start of day to avoid timezone issues
  const startDateRaw = new Date(challenge.startDate);
  const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
  const endDateRaw = challenge.endDate ? new Date(challenge.endDate) : null;
  const endDate = endDateRaw ? new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate()) : null;
  const today = new Date();

  const isActive = today >= startDate && (!endDate || today <= endDate);
  const isFuture = today < startDate;
  const isPast = endDate ? today > endDate : false;

  const daysLeft = endDate ? Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  ) : null;

  const locale = language === "de" ? de : enUS;

  return (
    <div className="container py-2">
      <BingoAnimation
        isVisible={showBingoAnimation}
        onComplete={() => setShowBingoAnimation(false)}
      />

      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {challenge.title}
                </h1>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowInfoDialog(true)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("challengeInfo")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isFuture && (
                    <Badge
                      variant="outline"
                      className="border-blue-400 text-blue-500"
                    >
                      {t("upcoming")}
                    </Badge>
                  )}
                  {isActive && !endDate && (
                    <Badge className="bg-blue-500">
                      {t("ongoing")}
                    </Badge>
                  )}
                  {isActive && endDate && (
                    <Badge className="bg-green-500">{t("active")}</Badge>
                  )}
                  {isPast && (
                    <Badge
                      variant="outline"
                      className="border-gray-400 text-gray-500"
                    >
                      {t("completed")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isCreator && (
                    <Button
                      variant="ghost"
                      onClick={() => navigate(`/challenges/${challenge.id}/edit`)}
                      size="icon"
                      title={t("editChallenge") || "Edit Challenge"}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {hasJoined && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowLeaveDialog(true)}
                      disabled={leavingChallenge}
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title={t("leaveChallenge")}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* <p className="text-sm sm:text-base text-muted-foreground">{challenge.description}</p> */}

            <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(startDate, t("dateFormatShort"), { locale })}
                  {endDate && (
                    <> - {format(endDate, t("dateFormatLong"), { locale })}</>
                  )}
                  {!endDate && (
                    <> - {t("ongoing")}</>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>
                  {challenge.participants.length} {t("participants")}
                </span>
              </div>

              {/* <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-challenge-purple" />
                <span>{challenge.totalPoints} {t("totalPoints")}</span>
              </div> */}

              {/* {isActive && (
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-challenge-teal" />
                  <span>{daysLeft} {t("daysLeft")}</span>
                </div>
              )} */}
            </div>

            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {creatorAvatar && (
                    <AvatarImage
                      src={creatorAvatar}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <AvatarFallback>
                    <UserRound className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {t("createdBy")}{" "}
                  <span className="font-medium text-foreground">
                    {challenge.creatorName}
                  </span>
                </span>
              </div>

              {!hasJoined && (
                <Button
                  className="sm:ml-auto"
                  onClick={handleJoinChallenge}
                  disabled={joiningChallenge || isCompleted}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  {joiningChallenge ? t("joining") : t("joinChallenge")}
                </Button>
              )}
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            defaultValue="objectives"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {isMobile ? (
                <div className="flex flex-row gap-2 w-full">
                  <Select value={activeTab} onValueChange={handleTabChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="objectives">
                        {t("objectives")}
                      </SelectItem>
                      <SelectItem value="leaderboard">
                        {t("leaderboard")}
                      </SelectItem>
                      <SelectItem value="activities">
                        {t("activities")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Strava Sync Button - Mobile */}
                  {/* Hidden for now */}
                  {false && challenge?.strava && hasJoined && !selectedUserId && (
                    <Button
                      onClick={handleImportStravaActivities}
                      disabled={isImportingStrava || isFuture}
                      size="sm"
                      className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white border-0 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isFuture ? `${t("upcoming")} - ${t("challengeNotStartedYet")}` : undefined}
                    >
                      {isImportingStrava ? (
                        <StravaLogo className="h-4 w-4 animate-spin" />
                      ) : (
                        <StravaLogo className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  
                  {(challenge.challenge_type === "bingo" || challenge?.objectives?.length === 25) && (
                    <Select
                      value={selectedUserId || ""}
                      onValueChange={(value) => setSelectedUserId(value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("participants")} />
                      </SelectTrigger>
                      <SelectContent>
                        {participants.map((participant) => (
                          <SelectItem
                            key={participant.id}
                            value={participant.id}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {participant.avatar && (
                                  <AvatarImage src={participant.avatar} />
                                )}
                                <AvatarFallback>
                                  <UserRound className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                              <span>{participant.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4 w-full">
                    <TabsList className="w-auto">
                      <TabsTrigger value="objectives">
                        {t("objectives")}
                      </TabsTrigger>
                      <TabsTrigger value="leaderboard">
                        {t("leaderboard")}
                      </TabsTrigger>
                      <TabsTrigger value="activities">
                        {t("activities")}
                      </TabsTrigger>
                    </TabsList>
                    
                    {/* Strava Sync Button */}
                    {/* Hidden for now */}
                    {false && challenge?.strava && hasJoined && !selectedUserId && (
                      <Button
                        onClick={handleImportStravaActivities}
                        disabled={isImportingStrava || isFuture}
                        size="sm"
                        className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isFuture ? `${t("upcoming")} - ${t("challengeNotStartedYet")}` : undefined}
                      >
                        {isImportingStrava ? (
                          <>
                            <StravaLogo className="mr-2 h-4 w-4 animate-spin" />
                            <span className="hidden sm:inline">{t("loading")}</span>
                          </>
                        ) : (
                          <>
                            <StravaLogo className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">{t("importStravaActivities")}</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {(challenge.challenge_type === "bingo" || challenge?.objectives?.length === 25) && (
                    <Select
                      value={selectedUserId || ""}
                      onValueChange={(value) => setSelectedUserId(value)}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder={t("participants")} />
                      </SelectTrigger>
                      <SelectContent>
                        {participants.map((participant) => (
                          <SelectItem
                            key={participant.id}
                            value={participant.id}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {participant.avatar && (
                                  <AvatarImage src={participant.avatar} />
                                )}
                                <AvatarFallback>
                                  <UserRound className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                              <span>{participant.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
            </div>

            <TabsContent value="objectives" className="mt-6">
              {(hasJoined || selectedUserId) && (
                <div
                  className={`mb-6 space-y-2 rounded-lg border p-4 text-card-foreground ${progress >= 100 ? "border-challenge-teal bg-green-50/30" : "bg-card"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-challenge-purple" />
                      <span className="font-medium">
                        {selectedUserId 
                          ? participants.find(p => p.id === selectedUserId)?.name + "'s " + t("challengeProgress").toLowerCase()
                          : t("challengeProgress")
                        }
                      </span>
                      {progress >= 100 && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {displayValue.current} / {displayValue.total}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {(challenge?.challenge_type === "bingo" || (challenge?.objectives?.length === 25)) ? (
                <div className="grid grid-cols-5 gap-1 p-0.5">
                  {challenge.objectives.map((objective) => (
                    <ObjectiveItem
                      key={objective.id}
                      objective={objective}
                      challengeId={challenge.id}
                      progress={
                        selectedUserId
                          ? participantProgress.find(
                              (p) => p.objectiveId === objective.id,
                            )
                          : userProgress.find(
                              (p) => p.objectiveId === objective.id,
                            )
                      }
                      challenge_type={challenge.challenge_type}
                      capedPoints={challenge.capedPoints}
                      readOnly={
                        selectedUserId !== null && selectedUserId !== user?.id
                      }
                      onProgressUpdate={refreshProgress}
                      challengeStartDate={challenge.startDate}
                      challengeEndDate={challenge.endDate}
                      selectedUserId={selectedUserId}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {challenge.objectives.map((objective) => (
                    <ObjectiveItem
                      key={objective.id}
                      objective={objective}
                      challengeId={challenge.id}
                      progress={
                        selectedUserId
                          ? participantProgress.find(
                              (p) => p.objectiveId === objective.id,
                            )
                          : userProgress.find(
                              (p) => p.objectiveId === objective.id,
                            )
                      }
                      challenge_type={challenge.challenge_type}
                      capedPoints={challenge.capedPoints}
                      readOnly={
                        selectedUserId !== null && selectedUserId !== user?.id
                      }
                      onProgressUpdate={refreshProgress}
                      challengeStartDate={challenge.startDate}
                      challengeEndDate={challenge.endDate}
                      selectedUserId={selectedUserId}
                    />
                  ))}
                  {/* Show single grid for completion challenges */}
                  {challenge.challenge_type === "completion" && challenge.endDate && (
                    <div className="mt-6 rounded-lg border p-4">
                      <div className="text-sm font-medium mb-3">{t("dailyProgress")}</div>
                      <div className="mt-1.5">
                        <div className="flex flex-wrap gap-0.5">
                          {(() => {
                            // Calculate days
                            const startRaw = new Date(challenge.startDate);
                            const start = new Date(startRaw.getFullYear(), startRaw.getMonth(), startRaw.getDate());
                            const endRaw = new Date(challenge.endDate!);
                            const end = new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate());
                            const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            
                            const todayLocal = new Date();
                            const today = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
                            
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
                              const isCompleted = completionDaysCompleted.has(dateString);
                              const isToday = dateString === today;
                              days.push({ date: dateString, isCompleted, isToday });
                            }
                            
                            return days.map((day, index) => (
                              <div
                                key={index}
                                className={`w-7 h-7 ${
                                  day.isCompleted ? 'bg-green-500' : 'bg-gray-200'
                                } ${day.isToday ? 'ring-2 ring-blue-500' : ''}`}
                                title={`${day.date} - ${day.isCompleted ? t("completed") : t("notCompleted")}`}
                              />
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="leaderboard" className="mt-6">
              <LeaderboardTable
                challengeId={challenge.id}
                capedPoints={challenge.capedPoints}
                onUserClick={(userId) => {
                  setSelectedUserId(userId);
                  handleTabChange("objectives");
                }}
              />
            </TabsContent>

            <TabsContent value="activities" className="mt-6">
              <ActivityList
                challengeId={challenge.id}
                onUserClick={(userId) => {
                  setSelectedUserId(userId);
                  handleTabChange("objectives");
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("leaveChallengeConfirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("leaveChallengeConfirmationDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leavingChallenge}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveChallenge}
              disabled={leavingChallenge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leavingChallenge ? t("leaving") : t("leaveChallenge")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{challenge.title}</DialogTitle>
            {challenge.description && (
              <DialogDescription className="text-base pt-2">
                {challenge.description}
              </DialogDescription>
            )}
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">{t("startDate") || "Start Date"}</span>
                  <span className="font-medium">
                    {format(startDate, t("dateFormatLong"), { locale })}
                  </span>
                </div>
              </div>
              
              {endDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">{t("endDate") || "End Date"}</span>
                    <span className="font-medium">
                      {format(endDate, t("dateFormatLong"), { locale })}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">{t("participants")}</span>
                  <span className="font-medium">
                    {challenge.participants.length}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">{t("totalPoints") || "Total Points"}</span>
                  <span className="font-medium">
                    {challenge.totalPoints}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <Avatar className="h-6 w-6">
                {creatorAvatar && (
                  <AvatarImage
                    src={creatorAvatar}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <AvatarFallback>
                  <UserRound className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{t("createdBy")}</span>
                <span className="font-medium">
                  {challenge.creatorName}
                </span>
              </div>
            </div>

            {challenge.objectives && challenge.objectives.length > 0 && (
              <div className="pt-2 border-t">
                <h3 className="font-semibold mb-3">{t("objectives")}</h3>
                <div className="space-y-2">
                  {challenge.objectives.map((objective, index) => (
                    <div key={objective.id} className="flex items-start gap-2">
                      <span className="text-muted-foreground min-w-[24px]">{index + 1}.</span>
                      <div className="flex-1">
                        <p className="font-medium">{objective.title}</p>
                        {objective.description && (
                          <p className="text-sm text-muted-foreground">{objective.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Target className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {objective.targetValue && `${objective.targetValue} ${objective.unit || ""}`}
                            {objective.pointsPerUnit && objective.unit && ` • ${objective.pointsPerUnit} ${t("points") || "points"}/${objective.unit}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
