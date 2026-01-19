import { useEffect, useState } from "react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCompletionNotifications } from "@/hooks/use-completion-notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trophy, Check, Minus, X, MessageCircle, Instagram } from "lucide-react";
import { Challenge, UserChallenge, DailyChallenge, UserProgress } from "@/types";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { dailyChallengesService } from "@/lib/daily-challenges";
import { getNumberOfWeeks } from "@/lib/week-utils";
import { getLocalDateString, normalizeToLocalDate, formatLocalDate, localDateToUTCStart, localDateToUTCEnd } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase";

interface DashboardChallengeData {
  challenge: Challenge;
  userChallenge: UserChallenge;
  userProgress: UserProgress[];
}

export default function Dashboard() {
  const { getUserChallenges, getChallenge, getUserActivityDates, completeDailyChallenge, getChallengeProgress, getUserChallengeStartDate, getUserChallengeEndDate } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const isMobile = useIsMobile();
  
  // Enable completion challenge notifications
  // Checks once on mount, then every 30 minutes
  // Only sends one notification per day about incomplete challenges
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  useCompletionNotifications(true, 30 * 60 * 1000, vapidPublicKey); // Check every 30 minutes
  
  const [activeChallenges, setActiveChallenges] = useState<DashboardChallengeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todaysChallenge, setTodaysChallenge] = useState<DailyChallenge | null>(null);
  const [isChallengeLoading, setIsChallengeLoading] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isFlyingOut, setIsFlyingOut] = useState(false);
  const [showWelcomeInfo, setShowWelcomeInfo] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<Map<number, boolean>>(new Map());

  // Check if this is first login and show welcome info
  useEffect(() => {
    if (!user) return;
    
    const welcomeDismissedKey = `welcomeInfoDismissed_${user.id}`;
    const isDismissed = localStorage.getItem(welcomeDismissedKey) === 'true';
    
    if (!isDismissed) {
      // Check if user has any challenges - if not, it's likely first login
      getUserChallenges().then(challenges => {
        if (challenges.length === 0) {
          setShowWelcomeInfo(true);
        } else {
          // Still show it once even if they have challenges (maybe they joined before this feature)
          setShowWelcomeInfo(true);
        }
      });
    }
  }, [user, getUserChallenges]);

  // Check completion status for completion challenges
  useEffect(() => {
    const checkCompletionStatus = async () => {
      if (!user || activeChallenges.length === 0) return;

      const completionChallenges = activeChallenges.filter(
        item => item.challenge.challengeType === "completion" && !isFutureChallenge(item.challenge.startDate)
      );

      if (completionChallenges.length === 0) return;

      const today = getLocalDateString();
      const startUTC = localDateToUTCStart(today);
      const endUTC = localDateToUTCEnd(today);

      const statusMap = new Map<number, boolean>();

      await Promise.all(
        completionChallenges.map(async (item) => {
          try {
            const { data: entries, error } = await supabase
              .from('entries')
              .select('id')
              .eq('user_id', user.id)
              .eq('challenge_id', item.challenge.id)
              .gte('created_at', startUTC)
              .lte('created_at', endUTC)
              .limit(1);

            if (error) {
              console.error('Error checking completion status:', error);
              statusMap.set(item.challenge.id, false);
            } else {
              statusMap.set(item.challenge.id, (entries?.length || 0) > 0);
            }
          } catch (error) {
            console.error('Error checking completion status:', error);
            statusMap.set(item.challenge.id, false);
          }
        })
      );

      setCompletionStatus(statusMap);
    };

    checkCompletionStatus();
  }, [activeChallenges, user]);

  useEffect(() => {
    const loadActiveChallenges = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const userChallenges = await getUserChallenges();
        console.log("Dashboard: getUserChallenges returned", userChallenges.length, "challenges");
        
        // Get full challenge details for each user challenge
        const challengesWithDetails = await Promise.all(
          userChallenges.map(async (userChallenge) => {
            const challenge = await getChallenge(userChallenge.challengeId);
            if (challenge) {
              const userProgress = await getChallengeProgress(challenge.id, challenge.challengeType);
              
              // For repeating challenges or individual challenges, get user-specific start and end dates
              let userStartDate: string | null = null;
              let userEndDate: string | null = null;
              // Try to fetch user dates (works for repeating challenges, and for individual challenges that have user-specific dates)
              try {
                userStartDate = await getUserChallengeStartDate(challenge.id, user.id);
                userEndDate = await getUserChallengeEndDate(challenge.id, user.id);
              } catch (error) {
                // If fetching fails, continue without user dates
                console.warn("Failed to fetch user challenge dates:", error);
              }
              
              return {
                challenge,
                userChallenge,
                userProgress,
                userStartDate,
                userEndDate,
              };
            }
            return null;
          })
        );

        // Filter out null values and show active challenges (started but not ended) 
        // and future challenges (not started yet but user has joined)
        const now = new Date();
        const challenges = challengesWithDetails
          .filter((item): item is DashboardChallengeData & { userStartDate?: string | null; userEndDate?: string | null } => 
            item !== null && 
            item.challenge && 
            (() => {
              // For repeating challenges, use user-specific dates
              if (item.challenge.isRepeating) {
                const startDate = item.userStartDate ? new Date(item.userStartDate) : null;
                const endDate = item.userEndDate ? new Date(item.userEndDate) : null;
                
                // Show if user has started (has a start date) and hasn't ended yet
                if (startDate) {
                  return startDate <= now && (!endDate || endDate > now);
                }
                // If no start date yet, don't show (user hasn't actually started)
                return false;
              }
              
              // For non-repeating challenges, use challenge dates
              const startDate = item.challenge.startDate ? new Date(item.challenge.startDate) : null;
              const endDate = item.challenge.endDate ? new Date(item.challenge.endDate) : null;
              
              // If no start date, still show the challenge (user has joined, so it's relevant)
              if (!startDate) return true;
              
              // Show if: active (started but not ended) OR future (not started yet)
              return (startDate <= now && (!endDate || endDate > now)) || startDate > now;
            })()
          )
          .sort((a, b) => {
            // Get effective start/end dates (user-specific for repeating, challenge for non-repeating)
            const aStartDate = a.challenge.isRepeating && (a as any).userStartDate
              ? new Date((a as any).userStartDate)
              : a.challenge.startDate ? new Date(a.challenge.startDate) : null;
            const bStartDate = b.challenge.isRepeating && (b as any).userStartDate
              ? new Date((b as any).userStartDate)
              : b.challenge.startDate ? new Date(b.challenge.startDate) : null;
            const aEndDate = a.challenge.isRepeating && (a as any).userEndDate
              ? new Date((a as any).userEndDate)
              : a.challenge.endDate ? new Date(a.challenge.endDate) : null;
            const bEndDate = b.challenge.isRepeating && (b as any).userEndDate
              ? new Date((b as any).userEndDate)
              : b.challenge.endDate ? new Date(b.challenge.endDate) : null;
            
            // Handle null dates
            if (!aStartDate && !bStartDate) return 0;
            if (!aStartDate) return 1;
            if (!bStartDate) return -1;
            
            // Determine status: active (started, not ended) or future (not started)
            const aIsActive = aStartDate <= now && (!aEndDate || aEndDate > now);
            const bIsActive = bStartDate <= now && (!bEndDate || bEndDate > now);
            const aIsFuture = aStartDate > now;
            const bIsFuture = bStartDate > now;
            
            // Sort: active challenges first, then future challenges
            if (aIsActive && !bIsActive) return -1;
            if (!aIsActive && bIsActive) return 1;
            
            // Within same status, sort by date (active: by end date, future: by start date)
            if (aIsActive && bIsActive) {
              // Sort active challenges by end date (sooner ending first)
              if (!aEndDate && !bEndDate) return 0;
              if (!aEndDate) return 1;
              if (!bEndDate) return -1;
              return aEndDate.getTime() - bEndDate.getTime();
            } else if (aIsFuture && bIsFuture) {
              // Sort future challenges by start date (starting soon first)
              return aStartDate.getTime() - bStartDate.getTime();
            }
            
            return 0;
          });

        console.log("Dashboard: Filtered to", challenges.length, "active challenges");
        setActiveChallenges(challenges);
      } catch (error) {
        console.error("Error loading active challenges:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveChallenges();
  }, [user, getUserChallenges, getChallenge, getChallengeProgress]);

  // Load today's random challenge
  useEffect(() => {
    const loadTodaysChallenge = async () => {
      if (!user) return;
      
      try {
        setIsChallengeLoading(true);
        
        // Check if we already have a challenge for today stored in localStorage
        const today = getLocalDateString();
        const storedChallengeKey = `dailyChallenge_${user.id}_${today}`;
        const storedChallenge = localStorage.getItem(storedChallengeKey);
        
        if (storedChallenge) {
          // We have a stored challenge for today, use it
          const parsedChallenge = JSON.parse(storedChallenge);
          console.log('Using stored daily challenge for today:', parsedChallenge.title);
          setTodaysChallenge(parsedChallenge);
        } else {
          // No stored challenge for today, get a new one
          const challenge = await dailyChallengesService.getTodaysRandomChallenge(user.id);
          console.log('New daily challenge loaded for today:', challenge?.title || 'none');
          
          if (challenge) {
            // Store the new challenge for today
            localStorage.setItem(storedChallengeKey, JSON.stringify(challenge));
            setTodaysChallenge(challenge);
          } else {
            // No challenge available, set to null
            setTodaysChallenge(null);
          }
        }
      } catch (error) {
        console.error("Error loading today's challenge:", error);
      } finally {
        setIsChallengeLoading(false);
      }
    };

    loadTodaysChallenge();
  }, [user]);

  const calculateProgress = (item: DashboardChallengeData) => {
    const { challenge, userProgress, userChallenge } = item;
    
    // For completion challenges, calculate progress based on days completed vs total days
    if (challenge.challengeType === "completion") {
      if (!challenge.endDate) return 0; // Ongoing completion challenge, can't calculate progress
      
      // Normalize dates to local timezone start of day
      const startDate = normalizeToLocalDate(challenge.startDate);
      const endDate = normalizeToLocalDate(challenge.endDate);
      // Calculate total days inclusive: floor the difference and add 1 for inclusive count
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // For completion challenges, totalScore represents days completed
      const daysCompleted = userChallenge.totalScore;
      return Math.min((daysCompleted / totalDays) * 100, 100);
    } else if (challenge.challengeType === "weekly") {
      if (!challenge.endDate) return 0; // Ongoing weekly challenge, can't calculate progress
      
      const startDate = new Date(challenge.startDate);
      const endDate = new Date(challenge.endDate);
      const totalWeeks = getNumberOfWeeks(startDate, endDate);
      
      // For weekly challenges, totalScore represents weeks completed
      const weeksCompleted = userChallenge.totalScore;
      return Math.min((weeksCompleted / totalWeeks) * 100, 100);
    } else if (challenge.challengeType === "collection" || challenge.challengeType === "checklist") {
      // For collection/checklist challenges, progress is based on number of completed objectives
      const completedObjectives = challenge.objectives.filter(obj => {
        const progressItem = userProgress.find(p => p.objectiveId === obj.id);
        return progressItem && progressItem.currentValue >= 1;
      }).length;
      const totalObjectives = challenge.objectives.length;
      
      if (totalObjectives === 0) return 0;
      return Math.min((completedObjectives / totalObjectives) * 100, 100);
    } else {
      // For standard/bingo challenges, use points-based progress
      const totalPossible = challenge.totalPoints;
      const currentScore = userChallenge.totalScore;
      
      if (totalPossible === 0) return 0;
      return Math.min((currentScore / totalPossible) * 100, 100);
    }
  };

  const getDisplayValue = (item: DashboardChallengeData) => {
    const { challenge, userProgress, userChallenge } = item;
    
    if (challenge.challengeType === "completion") {
      if (!challenge.endDate) return `${userChallenge.totalScore}/∞`;
      
      // Normalize dates to local timezone start of day
      const startDate = normalizeToLocalDate(challenge.startDate);
      const endDate = normalizeToLocalDate(challenge.endDate);
      // Calculate total days inclusive: floor the difference and add 1 for inclusive count
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysCompleted = userChallenge.totalScore;
      return `${daysCompleted}/${totalDays}`;
    } else if (challenge.challengeType === "weekly") {
      if (!challenge.endDate) return `${userChallenge.totalScore}/∞`;
      
      const startDate = new Date(challenge.startDate);
      const endDate = new Date(challenge.endDate);
      const totalWeeks = getNumberOfWeeks(startDate, endDate);
      const weeksCompleted = userChallenge.totalScore;
      return `${weeksCompleted}/${totalWeeks}`;
    } else if (challenge.challengeType === "collection" || challenge.challengeType === "checklist") {
      const completedObjectives = challenge.objectives.filter(obj => {
        const progressItem = userProgress.find(p => p.objectiveId === obj.id);
        return progressItem && progressItem.currentValue >= 1;
      }).length;
      const totalObjectives = challenge.objectives.length;
      return `${completedObjectives}/${totalObjectives}`;
    } else {
      return `${Math.floor(userChallenge.totalScore)}/${Math.floor(challenge.totalPoints)}`;
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getDaysUntilStart = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const isFutureChallenge = (startDate: string) => {
    return new Date(startDate) > new Date();
  };

  const [userActivityDates, setUserActivityDates] = useState<Set<string>>(new Set());

  // Load user activity data to determine which days have actual entries
  useEffect(() => {
    const loadUserActivity = async () => {
      if (!user) return;
      
      try {
        // Get the date range for the last 90 days using local timezone (for accurate streak calculation)
        const today = new Date();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(today.getDate() - 89);
        
        // Normalize to start of day in local timezone
        const startDateLocal = normalizeToLocalDate(ninetyDaysAgo);
        const endDateLocal = normalizeToLocalDate(today);
        
        // Format dates in local timezone for query
        const startDate = formatLocalDate(startDateLocal);
        const endDate = formatLocalDate(endDateLocal);
        
        // Get actual user activity dates from the database
        const activityDates = await getUserActivityDates(startDate, endDate);
        setUserActivityDates(new Set(activityDates));
      } catch (error) {
        console.error("Error loading user activity:", error);
      }
    };

    if (activeChallenges.length > 0) {
      loadUserActivity();
    }
  }, [activeChallenges, user, getUserActivityDates]);

  const getStreakData = () => {
    const today = new Date();
    const streakData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      // Normalize to start of day in local timezone
      const dateNormalized = normalizeToLocalDate(date);
      
      // Format date in local timezone for comparison
      const dateKey = formatLocalDate(dateNormalized);
      const hasActivity = userActivityDates.has(dateKey);
      
      streakData.push({
        date: dateNormalized,
        hasActivity,
        isToday: i === 0,
        dayName: date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { weekday: 'short' })
      });
    }
    
    return streakData;
  };

  const calculateStreak = (): number => {
    if (userActivityDates.size === 0) return 0;
    
    const today = new Date();
    let streak = 0;
    let currentDate = new Date(today);
    
    // Normalize to start of day
    currentDate = normalizeToLocalDate(currentDate);
    
    // Check up to 90 days back to find the streak (matching the data we load)
    for (let i = 0; i < 90; i++) {
      const dateKey = formatLocalDate(currentDate);
      
      if (userActivityDates.has(dateKey)) {
        streak++;
        // Move to previous day
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // Streak broken
        break;
      }
    }
    
    return streak;
  };

  const getDailyChallenge = () => {
    if (!todaysChallenge) {
      return {
        title: t("challengeCompleted"),
        target: t("notApplicable"),
        points: 0
      };
    }

    return {
      title: todaysChallenge.title,
      description: todaysChallenge.description,
      target: `${todaysChallenge.targetValue} ${todaysChallenge.unit}`,
      points: todaysChallenge.points
    };
  };

  const handleChallengeClick = () => {
    if (todaysChallenge) {
      setShowCompletionDialog(true);
    }
  };


  const handleDismissWelcomeInfo = () => {
    if (!user) return;
    const welcomeDismissedKey = `welcomeInfoDismissed_${user.id}`;
    localStorage.setItem(welcomeDismissedKey, 'true');
    setShowWelcomeInfo(false);
  };

  const handleCompleteChallenge = async () => {
    if (!todaysChallenge) return;
    
    setIsCompleting(true);
    try {
      await completeDailyChallenge(todaysChallenge.id);
      setShowCompletionDialog(false);
      
      // Start the fly-out animation
      setIsFlyingOut(true);
      
      // Clear the stored challenge for today
      const today = getLocalDateString();
      const storedChallengeKey = `dailyChallenge_${user!.id}_${today}`;
      localStorage.removeItem(storedChallengeKey);
      
      // After animation, check if there are any more challenges available for today
      setTimeout(async () => {
        try {
          // Check if there are any more challenges available for today
          const newChallenge = await dailyChallengesService.getTodaysRandomChallenge(user!.id);
          console.log('New challenge after completion:', newChallenge); // Debug log
          
          if (newChallenge) {
            // Store the new challenge for today
            localStorage.setItem(storedChallengeKey, JSON.stringify(newChallenge));
            setTodaysChallenge(newChallenge);
          } else {
            // No more challenges available for today
            console.log('No more challenges available for today');
            setTodaysChallenge(null);
          }
          
          setIsFlyingOut(false);
        } catch (error) {
          console.error("Error loading new daily challenge:", error);
          setIsFlyingOut(false);
        }
      }, 1000); // Match the CSS animation duration
      
    } catch (error) {
      console.error("Error completing challenge:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-center">
            <div className="h-12 w-12 mx-auto rounded-full bg-primary/20"></div>
            <p className="mt-4 text-sm text-muted-foreground">{t("loadingDashboard")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight mb-2">
          {t("welcomeBack").replace("{name}", user?.name || "")}
        </h1>
      </div>

      {/* Welcome Info Box - First Time Login */}
      {showWelcomeInfo && (
        <Alert className="mb-4 sm:mb-6 relative">
          <button
            onClick={handleDismissWelcomeInfo}
            className="absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Schließen</span>
          </button>
          <AlertTitle className="pr-6">Willkommen bei Saiko!</AlertTitle>
          <AlertDescription className="pr-6">
            <p className="mb-3">
              Tritt unserer Community bei, um dich mit anderen Challengern zu vernetzen, deinen Fortschritt zu teilen und inspiriert zu werden!
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="https://chat.whatsapp.com/L00uRWF2FhKF45358lit3i"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors text-sm font-medium"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Community beitreten
              </a>
              <a
                href="https://www.instagram.com/saikochallenges/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md transition-colors text-sm font-medium"
              >
                <Instagram className="h-4 w-4" />
                Auf Instagram folgen
              </a>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Streak History */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            {t("dailyProgress")}
          </h2>
          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-sm sm:text-base font-semibold">
            {calculateStreak()} {calculateStreak() === 1 ? t("streakDay") : t("streakDays")} {t("streak")}
          </Badge>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {getStreakData().map((day, index) => (
            <div
              key={index}
              className={`flex flex-col items-center p-1 sm:p-1.5 rounded-md ${
                day.hasActivity 
                  ? 'bg-green-400' 
                  : 'bg-gray-200'
              } ${day.isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
            >
              <span className={`text-[10px] sm:text-xs font-medium mb-0.5 hidden sm:block ${
                day.hasActivity ? 'text-white' : 'text-gray-600'
              }`}>{day.dayName}</span>
              <span className={`text-[10px] sm:text-xs font-medium mb-0.5 sm:hidden ${
                day.hasActivity ? 'text-white' : 'text-gray-600'
              }`}>{day.dayName.charAt(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Challenge */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        {/* <div className="mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
            {t("dailyChallengeTitle")}
          </h2>
        </div> */}
        <Card 
          className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 transition-all duration-300 ${
            todaysChallenge 
              ? 'cursor-pointer hover:shadow-lg' 
              : 'cursor-default'
          } ${isFlyingOut ? 'animate-fly-out' : ''}`}
          onClick={todaysChallenge ? handleChallengeClick : undefined}
        >
          <CardContent className="p-3 sm:p-4 lg:p-6">
            {isChallengeLoading ? (
              <div className="flex items-center justify-center py-6 sm:py-8">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2 sm:gap-3 lg:gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                    {getDailyChallenge().title}
                  </h3>
                  <p className="text-gray-600 mb-2 sm:mb-3 lg:mb-4 text-xs sm:text-sm leading-relaxed">
                    {getDailyChallenge().description}
                  </p>
                  {todaysChallenge && (
                    <p className="text-xs sm:text-sm text-blue-600 font-medium">
                      {t("tapToComplete")}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-xs sm:text-sm">
                    {t("dailyChallenge")}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeChallenges.length === 0 ? (
        <div className="text-center py-12 sm:py-16">
          <Trophy className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/50 mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-2">{t("noActiveChallenges")}</h3>
          <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">
            {t("noActiveChallengesDescription")}
          </p>
          <a
            href="/challenges"
            className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm sm:text-base"
          >
            {t("browseChallenges")}
          </a>
        </div>
      ) : (
        <div className={`grid gap-4 sm:gap-6 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {activeChallenges.map((item) => {
            const isFuture = isFutureChallenge(item.challenge.startDate);
            const progress = isFuture ? 0 : calculateProgress(item);
            const daysRemaining = item.challenge.endDate ? getDaysRemaining(item.challenge.endDate) : 999;
            const daysUntilStart = getDaysUntilStart(item.challenge.startDate);
            
            const isCompletionChallenge = item.challenge.challengeType === "completion";
            const isTodayCompleted = completionStatus.get(item.challenge.id) || false;
            const canShowCompletionStatus = isCompletionChallenge && !isFuture;
            
            return (
              <Link to={`/challenges/${item.challenge.id}`} key={item.challenge.id}>
                <Card className={`hover:shadow-lg transition-shadow cursor-pointer relative ${
                  canShowCompletionStatus && isTodayCompleted 
                    ? 'bg-green-50/50' 
                    : ''
                }`}>
                  {canShowCompletionStatus && (
                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                      isTodayCompleted ? 'bg-green-500' : 'bg-red-300'
                    }`} />
                  )}
                  <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg leading-tight line-clamp-2">
                        {item.challenge.title}
                      </CardTitle>
                      {isFuture ? (
                        <Badge 
                          variant="outline"
                          className="self-start sm:self-auto text-xs sm:text-sm"
                        >
                          {t("upcoming")}
                        </Badge>
                      ) : item.challenge.endDate && daysRemaining < 10 && (
                        <Badge 
                          variant={daysRemaining <= 3 ? "destructive" : daysRemaining <= 7 ? "secondary" : "default"}
                          className="self-start sm:self-auto text-xs sm:text-sm"
                        >
                          {daysRemaining} {t("daysLeft")}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3 sm:space-y-4">
                    {isFuture ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">{t("startsOn")}</span>
                          <span className="font-medium">
                            {new Date(item.challenge.startDate).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">{t("challengeNotStartedYet")}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">
                            {(item.challenge.challengeType === "completion" || item.challenge.challengeType === "weekly") ? t("progress") : t("points")}
                          </span>
                          <span className="font-medium">{getDisplayValue(item)}</span>
                        </div>
                        <Progress value={progress} className="h-1.5 sm:h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Completion Confirmation Dialog */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{todaysChallenge?.title}</DialogTitle>
            <DialogDescription>{todaysChallenge?.description}</DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              onClick={handleCompleteChallenge}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t("completing")}
                </>
              ) : (
                t("completeChallenge")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
