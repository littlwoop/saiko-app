import { useEffect, useState } from "react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Check, Minus } from "lucide-react";
import { Challenge, UserChallenge, DailyChallenge } from "@/types";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { dailyChallengesService } from "@/lib/daily-challenges";

interface DashboardChallenge extends Challenge {
  userProgress: UserChallenge;
}

export default function Dashboard() {
  const { getUserChallenges, getChallenge, getUserActivityDates, completeDailyChallenge } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const isMobile = useIsMobile();
  
  const [activeChallenges, setActiveChallenges] = useState<DashboardChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todaysChallenge, setTodaysChallenge] = useState<DailyChallenge | null>(null);
  const [isChallengeLoading, setIsChallengeLoading] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isFlyingOut, setIsFlyingOut] = useState(false);

  useEffect(() => {
    const loadActiveChallenges = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const userChallenges = await getUserChallenges();
        
        // Get full challenge details for each user challenge
        const challengesWithDetails = await Promise.all(
          userChallenges.map(async (userChallenge) => {
            const challenge = await getChallenge(userChallenge.challengeId);
            if (challenge) {
              return {
                ...challenge,
                userProgress: userChallenge,
              };
            }
            return null;
          })
        );

        // Filter out null values and only show active challenges (started but not ended)
        const active = challengesWithDetails
          .filter((challenge): challenge is DashboardChallenge => 
            challenge !== null && 
            challenge.userProgress && 
            new Date(challenge.startDate) <= new Date() && 
            (!challenge.endDate || new Date(challenge.endDate) > new Date())
          )
          .sort((a, b) => {
            // Sort ongoing challenges (no end date) to the end
            if (!a.endDate && !b.endDate) return 0;
            if (!a.endDate) return 1;
            if (!b.endDate) return -1;
            return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          });

        setActiveChallenges(active);
      } catch (error) {
        console.error("Error loading active challenges:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveChallenges();
  }, [user, getUserChallenges, getChallenge]);

  // Load today's random challenge
  useEffect(() => {
    const loadTodaysChallenge = async () => {
      if (!user) return;
      
      try {
        setIsChallengeLoading(true);
        
        // Check if we already have a challenge for today stored in localStorage
        const today = new Date().toISOString().split('T')[0];
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

  const calculateProgress = (challenge: DashboardChallenge) => {
    // For completion challenges, calculate progress based on days completed vs total days
    if (challenge.challenge_type === "completion") {
      const startDate = new Date(challenge.startDate);
      const endDate = new Date(challenge.endDate);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // For completion challenges, totalScore represents days completed
      const daysCompleted = challenge.userProgress.totalScore;
      return Math.min((daysCompleted / totalDays) * 100, 100);
    } else if (challenge.challenge_type === "collection" || challenge.challenge_type === "checklist") {
      // For collection/checklist challenges, progress is based on number of completed objectives
      const completedObjectives = challenge.objectives.filter(obj => {
        const progressItem = challenge.userProgress.objectives.find(p => p.objectiveId === obj.id);
        return progressItem && progressItem.currentValue >= 1;
      }).length;
      const totalObjectives = challenge.objectives.length;
      
      if (totalObjectives === 0) return 0;
      return Math.min((completedObjectives / totalObjectives) * 100, 100);
    } else {
      // For standard/bingo challenges, use points-based progress
      const totalPossible = challenge.totalPoints;
      const currentScore = challenge.userProgress.totalScore;
      
      if (totalPossible === 0) return 0;
      return Math.min((currentScore / totalPossible) * 100, 100);
    }
  };

  const getDisplayValue = (challenge: DashboardChallenge) => {
    if (challenge.challenge_type === "completion") {
      const startDate = new Date(challenge.startDate);
      const endDate = new Date(challenge.endDate);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysCompleted = challenge.userProgress.totalScore;
      return `${daysCompleted}/${totalDays}`;
    } else if (challenge.challenge_type === "collection" || challenge.challenge_type === "checklist") {
      const completedObjectives = challenge.objectives.filter(obj => {
        const progressItem = challenge.userProgress.objectives.find(p => p.objectiveId === obj.id);
        return progressItem && progressItem.currentValue >= 1;
      }).length;
      const totalObjectives = challenge.objectives.length;
      return `${completedObjectives}/${totalObjectives}`;
    } else {
      return `${Math.floor(challenge.userProgress.totalScore)}/${Math.floor(challenge.totalPoints)}`;
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const [userActivityDates, setUserActivityDates] = useState<Set<string>>(new Set());

  // Load user activity data to determine which days have actual entries
  useEffect(() => {
    const loadUserActivity = async () => {
      if (!user) return;
      
      try {
        // Get the date range for the last 7 days
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6);
        
        const startDate = sevenDaysAgo.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];
        
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
      
      // Check if the user actually made an entry on this specific date
      const dateKey = date.toISOString().split('T')[0];
      const hasActivity = userActivityDates.has(dateKey);
      
      streakData.push({
        date,
        hasActivity,
        isToday: i === 0,
        dayName: date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { weekday: 'short' })
      });
    }
    
    return streakData;
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

  const handleCompleteChallenge = async () => {
    if (!todaysChallenge) return;
    
    setIsCompleting(true);
    try {
      await completeDailyChallenge(todaysChallenge.id);
      setShowCompletionDialog(false);
      
      // Start the fly-out animation
      setIsFlyingOut(true);
      
      // Clear the stored challenge for today
      const today = new Date().toISOString().split('T')[0];
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

      {/* Streak History */}
      <div className="mb-6 sm:mb-8">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {getStreakData().map((day, index) => (
            <div
              key={index}
              className={`flex flex-col items-center p-1.5 sm:p-2 lg:p-3 rounded-lg border ${
                day.hasActivity 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              } ${day.isToday ? 'ring-2 ring-primary ring-offset-1 sm:ring-offset-2' : ''}`}
            >
              <span className="text-xs font-medium mb-1 hidden sm:block">{day.dayName}</span>
              <span className="text-xs font-medium mb-1 sm:hidden">{day.dayName.charAt(0)}</span>
              <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 flex items-center justify-center">
                {day.hasActivity ? (
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-green-600" />
                ) : (
                  <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4 text-gray-400" />
                )}
              </div>
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
          {activeChallenges.map((challenge) => {
            const progress = calculateProgress(challenge);
            const daysRemaining = getDaysRemaining(challenge.endDate);
            
            return (
              <Link to={`/challenges/${challenge.id}`} key={challenge.id}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg leading-tight line-clamp-2">
                        {challenge.title}
                      </CardTitle>
                      <Badge 
                        variant={daysRemaining <= 3 ? "destructive" : daysRemaining <= 7 ? "secondary" : "default"}
                        className="self-start sm:self-auto text-xs sm:text-sm"
                      >
                        {daysRemaining} {t("daysLeft")}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-muted-foreground">
                          {challenge.challenge_type === "completion" ? t("progress") : t("points")}
                        </span>
                        <span className="font-medium">{getDisplayValue(challenge)}</span>
                      </div>
                      <Progress value={progress} className="h-1.5 sm:h-2" />
                    </div>
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
