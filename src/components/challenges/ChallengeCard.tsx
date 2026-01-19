import { Challenge } from "@/types";
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
import { Award, Calendar, Trophy } from "lucide-react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { calculateTotalPoints } from "@/lib/points";
import { Badge } from "@/components/ui/badge";
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
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { useState, useEffect } from "react";

interface ChallengeCardProps {
  challenge: Challenge;
  userScore?: number;
  showJoin?: boolean;
}

export default function ChallengeCard({
  challenge,
  userScore = 0,
  showJoin = true,
}: ChallengeCardProps) {
  const { joinChallenge, getChallengeProgress } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [displayValue, setDisplayValue] = useState({ current: 0, total: 0 });
  const [showJoinConfirmDialog, setShowJoinConfirmDialog] = useState(false);
  const navigate = useNavigate();

  const locale = language === "de" ? de : enUS;

  const hasJoined = user && challenge.participants && challenge.participants.includes(user.id);
  const { getUserChallengeStartDate, getUserChallengeEndDate } = useChallenges();
  const [userStartDate, setUserStartDate] = useState<string | null>(null);
  const [userEndDate, setUserEndDate] = useState<string | null>(null);

  // For repeating challenges or individual challenges where user has joined, get user-specific start date and end date
  useEffect(() => {
    // For repeating challenges, always fetch user dates if joined
    // For non-repeating individual challenges, also fetch user dates if they exist (for challenges without global dates)
    if (user && hasJoined) {
      Promise.all([
        getUserChallengeStartDate(challenge.id, user.id),
        getUserChallengeEndDate(challenge.id, user.id)
      ]).then(([startDate, endDate]) => {
        setUserStartDate(startDate);
        setUserEndDate(endDate);
      });
    } else {
      setUserStartDate(null);
      setUserEndDate(null);
    }
  }, [challenge.isRepeating, challenge.id, user, hasJoined, getUserChallengeStartDate, getUserChallengeEndDate]);

  // Determine dates to display
  // Priority: user-specific dates (if available) > challenge dates
  const displayStartDate = userStartDate 
    ? new Date(userStartDate)
    : challenge.startDate ? new Date(challenge.startDate) : null;
  const endDate = userEndDate
    ? new Date(userEndDate)
    : challenge.isRepeating 
      ? null 
      : (challenge.endDate ? new Date(challenge.endDate) : null);
  const today = new Date();

  const isActive = displayStartDate ? (today >= displayStartDate && (!endDate || today <= endDate)) : false;
  const isFuture = displayStartDate ? today < displayStartDate : false;
  const isPast = endDate ? today > endDate : false;

  const totalObjectives = challenge.objectives?.length || 0;
  const progressPercentage = (userScore / challenge.totalPoints) * 100;

  // Load progress when the component mounts or when userScore changes
  useEffect(() => {
    const loadProgress = async () => {
      if (hasJoined) {
        setLoading(true);
        try {
          const progressData = await getChallengeProgress(challenge.id, challenge.challengeType);
          const totalPoints = calculateTotalPoints(
            challenge.objectives || [],
            progressData,
            challenge.capedPoints,
            challenge.challengeType
          );
          // For completion challenges, calculate progress based on days completed vs total days
          if (challenge.challengeType === "completion") {
            // Normalize dates to local timezone start of day
            const startDateRaw = new Date(challenge.startDate);
            const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
            const endDateRaw = challenge.endDate ? new Date(challenge.endDate) : null;
            const endDate = endDateRaw ? new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate()) : null;
            // Calculate total days inclusive: floor the difference and add 1 for inclusive count
            const totalDays = endDate ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 365;
            
            // Calculate total days completed across all objectives
            const totalDaysCompleted = progressData.reduce((sum, progressItem) => {
              return sum + progressItem.currentValue;
            }, 0);
            
            setProgress((totalDaysCompleted / totalDays) * 100);
            setDisplayValue({ current: totalDaysCompleted, total: totalDays });
          } else if (challenge.challengeType === "collection" || challenge.challengeType === "checklist") {
            // For collection/checklist challenges, progress is number of completed objectives
            const completedObjectives = progressData.filter(p => p.currentValue >= 1).length;
            const totalObjectives = challenge.objectives?.length || 0;
            
            setProgress((completedObjectives / totalObjectives) * 100);
            setDisplayValue({ current: completedObjectives, total: totalObjectives });
          } else {
            // For standard/bingo challenges, use points-based progress
            setProgress((totalPoints / challenge.totalPoints) * 100);
            setDisplayValue({ current: totalPoints, total: challenge.totalPoints });
          }
        } catch (error) {
          console.error("Error loading progress:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadProgress();
  }, [
    hasJoined,
    challenge.id,
    challenge.objectives,
    challenge.totalPoints,
    getChallengeProgress,
  ]);

  const handleJoinChallenge = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    // Check if it's a repeating challenge - if so, show confirmation dialog
    const isRepeating = challenge.isRepeating || false;
    if (isRepeating) {
      setShowJoinConfirmDialog(true);
      return;
    }
    
    // For non-repeating challenges, join directly
    await performJoinChallenge();
  };

  const performJoinChallenge = async () => {
    setLoading(true);
    try {
      await joinChallenge(challenge.id);
      navigate(`/challenges/${challenge.id}`);
    } catch (error) {
      console.error("Error joining challenge:", error);
    } finally {
      setLoading(false);
      setShowJoinConfirmDialog(false);
    }
  };

  const handleCardClick = () => {
    if (hasJoined) {
      navigate(`/challenges/${challenge.id}`);
    }
  };

  return (
    <Card 
      className={`overflow-hidden flex flex-col h-full transition-all hover:shadow-md ${hasJoined ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="line-clamp-1 text-lg">
            {challenge.title}
          </CardTitle>
          <div className="flex flex-col gap-1 items-end flex-shrink-0">
            {challenge.isRepeating && (
              <Badge
                variant="outline"
                className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
              >
                {t("repeatingChallenge") || "Individual start date"}
              </Badge>
            )}
            {isActive && (
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 text-xs"
              >
                {t("active")}
              </Badge>
            )}
            {isFuture && (
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
              >
                {t("upcoming")}
              </Badge>
            )}
            {isPast && (
              <Badge
                variant="outline"
                className="bg-gray-50 text-gray-700 border-gray-200 text-xs"
              >
                {t("completed")}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="line-clamp-2">
          {challenge.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {displayStartDate ? (
                <>
                  {format(displayStartDate, t("dateFormatShort"), { locale })}
                  {endDate ? (
                    <> - {format(endDate, t("dateFormatLong"), { locale })}</>
                  ) : (
                    <> - {t("ongoing")}</>
                  )}
                </>
              ) : challenge.isRepeating && hasJoined ? (
                t("repeatingChallengeAvailable") || "Available - Start when you join"
              ) : (
                t("noDatesSet") || "No dates set"
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-challenge-purple" />
            <span className="text-sm">
              {totalObjectives}{" "}
              {totalObjectives === 1 ? t("objective") : t("objectives")}
            </span>
            <span className="ml-auto text-sm font-semibold">
              {challenge.totalPoints} {t("totalPoints")}
            </span>
          </div>

          {hasJoined && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {challenge.challengeType === "completion" ? t("yourProgress") : t("yourPoints")}
                </span>
                <span className="font-medium">
                  {displayValue.current} / {displayValue.total}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("progress")}</span>
                <span className="text-sm font-medium">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        {user ? (
          !hasJoined && showJoin && (
            <Button
              className="w-full"
              onClick={handleJoinChallenge}
              disabled={loading || isPast}
            >
              <Trophy className="mr-2 h-4 w-4" />
              {loading ? t("loading") : t("joinChallenge")}
            </Button>
          )
        ) : (
          <Button asChild className="w-full">
            <Link to="/login">{t("login")}</Link>
          </Button>
        )}
      </CardFooter>

      {/* Confirmation dialog for repeating challenges */}
      <AlertDialog open={showJoinConfirmDialog} onOpenChange={setShowJoinConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("joinRepeatingChallenge") || "Start Challenge Today?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("joinRepeatingChallengeDescription") || "This challenge will start today. Are you sure you want to join and start the challenge now?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performJoinChallenge}
              disabled={loading}
            >
              {loading ? t("joining") : (t("startToday") || "Yes, start today")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
