import { Challenge } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Award, Calendar, Trophy } from "lucide-react";
import { useChallenges } from "@/contexts/ChallengeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
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
  showJoin = true 
}: ChallengeCardProps) {
  const { joinChallenge, getChallengeProgress } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const locale = language === 'de' ? de : enUS;
  
  const hasJoined = user && challenge.participants.includes(user.id);
  
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  const today = new Date();
  
  const isActive = today >= startDate && today <= endDate;
  const isFuture = today < startDate;
  const isPast = today > endDate;
  
  const totalObjectives = challenge.objectives.length;
  const progressPercentage = userScore / challenge.totalPoints * 100;

  // Load progress when the component mounts or when userScore changes
  useEffect(() => {
    const loadProgress = async () => {
      if (hasJoined) {
        setLoading(true);
        try {
          const progressData = await getChallengeProgress(challenge.id);
          const totalPoints = progressData.reduce((sum, progress) => {
            const objective = challenge.objectives.find(o => o.id === progress.objectiveId);
            if (objective) {
              return sum + (progress.currentValue * objective.pointsPerUnit);
            }
            return sum;
          }, 0);
          setProgress((totalPoints / challenge.totalPoints) * 100);
        } catch (error) {
          console.error('Error loading progress:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadProgress();
  }, [hasJoined, challenge.id, challenge.objectives, challenge.totalPoints, getChallengeProgress]);

  const handleJoinChallenge = async () => {
    setLoading(true);
    try {
      await joinChallenge(challenge.id);
      navigate(`/challenges/${challenge.id}`);
    } catch (error) {
      console.error('Error joining challenge:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="line-clamp-1 text-lg">{challenge.title}</CardTitle>
          {isActive && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{t('active')}</Badge>}
          {isFuture && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{t('upcoming')}</Badge>}
          {isPast && <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">{t('completed')}</Badge>}
        </div>
        <CardDescription className="line-clamp-2">{challenge.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(startDate, t('dateFormatShort'), { locale })} - {format(endDate, t('dateFormatLong'), { locale })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-challenge-purple" />
            <span className="text-sm">
              {totalObjectives} {totalObjectives === 1 ? t('objective') : t('objectives')}
            </span>
            <span className="ml-auto text-sm font-semibold">
              {challenge.totalPoints} {t('totalPoints')}
            </span>
          </div>
          
          {hasJoined && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('yourPoints')}</span>
                <span className="font-medium">{userScore} / {challenge.totalPoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('progress')}</span>
                <span className="text-sm font-medium">{Math.round(progress)}%</span>
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
              <Link to={`/challenges/${challenge.id}`}>{t('viewChallenge')}</Link>
            </Button>
          ) : (
            showJoin && (
              <Button 
                className="w-full" 
                onClick={handleJoinChallenge}
                disabled={loading}
              >
                <Trophy className="mr-2 h-4 w-4" />
                {loading ? t('loading') : t('joinChallenge')}
              </Button>
            )
          )
        ) : (
          <Button asChild className="w-full">
            <Link to="/login">{t('login')}</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
