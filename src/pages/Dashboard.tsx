import { useEffect, useState } from "react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, Target, Check, Minus } from "lucide-react";
import { Challenge, UserChallenge } from "@/types";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";

interface DashboardChallenge extends Challenge {
  userProgress: UserChallenge;
}

export default function Dashboard() {
  const { getUserChallenges, getChallenge, getUserActivityDates } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const isMobile = useIsMobile();
  
  const [activeChallenges, setActiveChallenges] = useState<DashboardChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
            new Date(challenge.endDate) > new Date()
          )
          .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

        setActiveChallenges(active);
      } catch (error) {
        console.error("Error loading active challenges:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveChallenges();
  }, [user, getUserChallenges, getChallenge]);

  const calculateProgress = (challenge: DashboardChallenge) => {
    const totalPossible = challenge.totalPoints;
    const currentScore = challenge.userProgress.totalScore;
    
    if (totalPossible === 0) return 0;
    return Math.min((currentScore / totalPossible) * 100, 100);
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
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' })
      });
    }
    
    return streakData;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-center">
            <div className="h-12 w-12 mx-auto rounded-full bg-primary/20"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
                     <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {t("welcomeBack").replace("{name}", user?.name || "")}
          </h1>
        </div>

               {/* Streak History */}
        <div className="mb-8">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {getStreakData().map((day, index) => (
              <div
                key={index}
                className={`flex flex-col items-center p-2 sm:p-3 rounded-lg border ${
                  day.hasActivity 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                } ${day.isToday ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              >
                <span className="text-xs font-medium mb-1 hidden sm:block">{day.dayName}</span>
                <span className="text-xs font-medium mb-1 sm:hidden">{day.dayName.charAt(0)}</span>
                <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                  {day.hasActivity ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  ) : (
                    <Minus className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                  )}
                </div>
                {/* <span className="text-xs mt-1">
                  {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span> */}
              </div>
            ))}
          </div>
        </div>

      {activeChallenges.length === 0 ? (
                 <div className="text-center py-16">
           <Trophy className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
           <h3 className="text-xl font-semibold mb-2">{t("noActiveChallenges")}</h3>
           <p className="text-muted-foreground mb-6">
             {t("noActiveChallengesDescription")}
           </p>
           <a
             href="/challenges"
             className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
           >
             {t("browseChallenges")}
           </a>
         </div>
      ) : (
        <div className={`grid gap-6 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {activeChallenges.map((challenge) => {
            const progress = calculateProgress(challenge);
            const daysRemaining = getDaysRemaining(challenge.endDate);
            
                         return (
               <Link to={`/challenges/${challenge.id}`} key={challenge.id}>
                 <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                                       <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <CardTitle className="text-lg leading-tight line-clamp-2">
                          {challenge.title}
                        </CardTitle>
                        <Badge 
                          variant={daysRemaining <= 3 ? "destructive" : daysRemaining <= 7 ? "secondary" : "default"}
                          className="self-start sm:self-auto"
                        >
                          {daysRemaining} {t("daysLeft")}
                        </Badge>
                      </div>
                    </CardHeader>
                   
                   <CardContent className="space-y-4">
                     <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                       <span className="text-muted-foreground">{t("progress")}</span>
                       <span className="font-medium">{Math.round(progress)}%</span>
                     </div>
                       <Progress value={progress} className="h-2" />
                     </div>
                     
                     {/* <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center text-muted-foreground">
                       <Target className="h-4 w-4 mr-1" />
                       <span>{challenge.objectives.length} {t("objectives")}</span>
                     </div>
                                            <div className="flex items-center text-muted-foreground">
                       <Trophy className="h-4 w-4 mr-1" />
                       <span>{challenge.userProgress.totalScore} {t("points")}</span>
                     </div>
                     </div>
                     
                                        <div className="flex items-center text-sm text-muted-foreground">
                     <Calendar className="h-4 w-4 mr-1" />
                     <span>{t("ends")} {new Date(challenge.endDate).toLocaleDateString()}</span> */}
                   {/* </div> */}
                   </CardContent>
                 </Card>
               </Link>
             );
          })}
        </div>
      )}
    </div>
  );
}
