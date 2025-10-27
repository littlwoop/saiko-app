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
  const navigate = useNavigate();

  const locale = language === "de" ? de : enUS;

  const hasJoined = user && challenge.participants.includes(user.id);

  const startDate = new Date(challenge.startDate);
  const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
  const today = new Date();

  const isActive = today >= startDate && (!endDate || today <= endDate);
  const isFuture = today < startDate;
  const isPast = endDate ? today > endDate : false;

  const totalObjectives = challenge.objectives.length;
  const progressPercentage = (userScore / challenge.totalPoints) * 100;

  // Load progress when the component mounts or when userScore changes
  useEffect(() => {
    const loadProgress = async () => {
      if (hasJoined) {
        setLoading(true);
        try {
          const progressData = await getChallengeProgress(challenge.id, challenge.challenge_type);
          const totalPoints = calculateTotalPoints(
            challenge.objectives,
            progressData,
            challenge.capedPoints,
            challenge.challenge_type
          );
          // For completion challenges, calculate progress based on days completed vs total days
          if (challenge.challenge_type === "completion") {
            const startDate = new Date(challenge.startDate);
            const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
            const totalDays = endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 365;
            
            // Calculate total days completed across all objectives
            const totalDaysCompleted = progressData.reduce((sum, progressItem) => {
              return sum + progressItem.currentValue;
            }, 0);
            
            setProgress((totalDaysCompleted / totalDays) * 100);
            setDisplayValue({ current: totalDaysCompleted, total: totalDays });
          } else if (challenge.challenge_type === "collection" || challenge.challenge_type === "checklist") {
            // For collection/checklist challenges, progress is number of completed objectives
            const completedObjectives = progressData.filter(p => p.currentValue >= 1).length;
            const totalObjectives = challenge.objectives.length;
            
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

  const handleJoinChallenge = async () => {
    setLoading(true);
    try {
      await joinChallenge(challenge.id);
      navigate(`/challenges/${challenge.id}`);
    } catch (error) {
      console.error("Error joining challenge:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="line-clamp-1 text-lg">
            {challenge.title}
          </CardTitle>
          {isActive && (
            <Badge
              variant="outline"
              className="bg-green-50 text-green-700 border-green-200"
            >
              {t("active")}
            </Badge>
          )}
          {isFuture && (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200"
            >
              {t("upcoming")}
            </Badge>
          )}
          {isPast && (
            <Badge
              variant="outline"
              className="bg-gray-50 text-gray-700 border-gray-200"
            >
              {t("completed")}
            </Badge>
          )}
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
              {format(startDate, t("dateFormatShort"), { locale })}
              {endDate ? (
                <> - {format(endDate, t("dateFormatLong"), { locale })}</>
              ) : (
                <> - {t("ongoing")}</>
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
                  {challenge.challenge_type === "completion" ? t("yourProgress") : t("yourPoints")}
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
          hasJoined ? (
            <Button asChild className="w-full" variant="outline">
              <Link to={`/challenges/${challenge.id}`}>
                {t("viewChallenge")}
              </Link>
            </Button>
          ) : (
            showJoin && (
              <Button
                className="w-full"
                onClick={handleJoinChallenge}
                disabled={loading}
              >
                <Trophy className="mr-2 h-4 w-4" />
                {loading ? t("loading") : t("joinChallenge")}
              </Button>
            )
          )
        ) : (
          <Button asChild className="w-full">
            <Link to="/login">{t("login")}</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
