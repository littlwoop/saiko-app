import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
import { ChevronLeft, Trophy, Users, Target, Calendar, Award, UserRound, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Challenge, UserProgress } from "@/types";
import { useTranslation } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";
import ActivityList from "@/components/challenges/ActivityList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const { userChallenges, userProgress, joinChallenge, loading: challengesLoading, refreshProgress } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [progress, setProgress] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [participantProgress, setParticipantProgress] = useState<UserProgress[]>([]);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string; avatar?: string }>>([]);
  
  const hasJoined = user && challenge?.participants.includes(user.id);
  const isCreator = user && challenge?.createdById === user.id;
  
  useEffect(() => {
    const fetchChallenge = async () => {
      if (!id) return;
      
      setLoading(true);
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error('Error fetching challenge:', error);
      } else if (data) {
        setChallenge(data);
      }
      setLoading(false);
    };
    
    fetchChallenge();
  }, [id]);
  
  useEffect(() => {
    if (id && user) {
      refreshProgress(id);
    }
  }, [id, user, refreshProgress]);
  
  useEffect(() => {
    if (user && challenge && !challengesLoading) {
      // Calculate total points from all entries for this challenge
      const challengeProgress = userProgress.filter(
        p => p.userId === user.id && p.challengeId === challenge.id
      );
      
      const totalPoints = challengeProgress.reduce((sum, progress) => {
        const objective = challenge.objectives.find(o => o.id === progress.objectiveId);
        if (objective) {
          return sum + (progress.currentValue * objective.pointsPerUnit);
        }
        return sum;
      }, 0);
      
      setTotalPoints(totalPoints);
      setProgress((totalPoints / challenge.totalPoints) * 100);
    }
  }, [user, challenge, userProgress, challengesLoading]);
  
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!challenge) return;
      
      // Use the participants array from the challenge data
      setParticipants(challenge.participants.map(id => ({
        id,
        name: id === challenge.createdById ? challenge.creatorName : `User ${id.slice(0, 4)}`,
        avatar: id === challenge.createdById ? challenge.creatorAvatar : undefined
      })));
    };
    
    fetchParticipants();
  }, [challenge]);

  useEffect(() => {
    const fetchParticipantProgress = async () => {
      if (!selectedUserId || !challenge) return;
      
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', selectedUserId)
        .eq('challenge_id', challenge.id);
        
      if (error) {
        console.error('Error fetching participant progress:', error);
      } else if (data) {
        // Calculate total progress for each objective
        const progressMap = data.reduce((acc, entry) => {
          const key = entry.objective_id;
          if (!acc[key]) {
            acc[key] = {
              userId: entry.user_id,
              challengeId: entry.challenge_id,
              objectiveId: entry.objective_id,
              currentValue: 0
            };
          }
          acc[key].currentValue += entry.value;
          return acc;
        }, {} as Record<string, UserProgress>);
        
        setParticipantProgress(Object.values(progressMap));
      }
    };
    
    fetchParticipantProgress();
  }, [selectedUserId, challenge]);
  
  if (loading || challengesLoading || !challenge) {
    return (
      <div className="container py-12">
        <div className="flex justify-center">
          <div className="animate-pulse space-y-4">
            <div className="h-12 w-72 rounded bg-muted"></div>
            <div className="h-32 w-full max-w-3xl rounded bg-muted"></div>
            <div className="h-64 w-full max-w-3xl rounded bg-muted"></div>
          </div>
        </div>
      </div>
    );
  }
  
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  const today = new Date();
  
  const isActive = today >= startDate && today <= endDate;
  const isFuture = today < startDate;
  const isPast = today > endDate;
  
  const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  const locale = language === 'de' ? de : enUS;
  
  return (
    <div className="container py-8">
      <Link
        to="/challenges"
        className="mb-4 inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        {t("challenges")}
      </Link>
      
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-3xl font-bold">{challenge.title}</h1>
              {isActive && <Badge className="bg-green-500">{t("active")}</Badge>}
              {isFuture && <Badge variant="outline" className="border-blue-400 text-blue-500">{t("upcoming")}</Badge>}
              {isPast && <Badge variant="outline" className="border-gray-400 text-gray-500">{t("completed")}</Badge>}
            </div>
            
            <p className="text-muted-foreground">{challenge.description}</p>
            
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(startDate, t("dateFormatShort"), { locale })} - {format(endDate, t("dateFormatLong"), { locale })}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{challenge.participants.length} {t("participants")}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-challenge-purple" />
                <span>{challenge.totalPoints} {t("totalPoints")}</span>
              </div>
              
              {isActive && (
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-challenge-teal" />
                  <span>{daysLeft} {t("daysLeft")}</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {challenge.creatorAvatar && (
                    <AvatarImage src={challenge.creatorAvatar} />
                  )}
                  <AvatarFallback>
                    <UserRound className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {t("createdBy")} <span className="font-medium text-foreground">{challenge.creatorName}</span>
                </span>
              </div>
              
              {!hasJoined && (
                <Button
                  className="sm:ml-auto"
                  onClick={() => joinChallenge(challenge.id)}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  {t("joinChallenge")}
                </Button>
              )}
            </div>
          </div>
          
          <Tabs defaultValue="objectives">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="objectives">{t("objectives")}</TabsTrigger>
                <TabsTrigger value="leaderboard">{t("leaderboard")}</TabsTrigger>
                <TabsTrigger value="activities">{t("activities")}</TabsTrigger>
              </TabsList>
              
              {challenge.isBingo && (
                <Select
                  value={selectedUserId || ''}
                  onValueChange={(value) => setSelectedUserId(value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t("participants")} />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((participant) => (
                      <SelectItem key={participant.id} value={participant.id}>
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
            
            <TabsContent value="objectives" className="mt-6">
              {hasJoined && (
                <div className={`mb-6 space-y-2 rounded-lg border p-4 text-card-foreground ${progress >= 100 ? 'border-challenge-teal bg-green-50/30' : 'bg-card'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-challenge-purple" />
                      <span className="font-medium">{t("challengeProgress")}</span>
                      {progress >= 100 && <CheckCircle className="h-4 w-4 text-green-600" />}
                    </div>
                    <span className="text-sm font-medium">
                      {Math.round(totalPoints)} / {challenge.totalPoints} {t("points")}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              
              {challenge.isBingo ? (
                <div className={`grid gap-2 p-2 ${
                  (() => {
                    const gridSize = Math.sqrt(challenge.objectives.length);
                    switch(gridSize) {
                      case 3: return 'grid-cols-3';
                      case 4: return 'grid-cols-4';
                      case 5: return 'grid-cols-5';
                      case 6: return 'grid-cols-6';
                      default: return 'grid-cols-3';
                    }
                  })()
                }`}>
                  {challenge.objectives.map((objective) => (
                    <ObjectiveItem
                      key={objective.id}
                      objective={objective}
                      challengeId={challenge.id}
                      progress={selectedUserId 
                        ? participantProgress.find(p => p.objectiveId === objective.id)
                        : userProgress.find(p => p.objectiveId === objective.id)
                      }
                      isBingo
                      readOnly={selectedUserId !== null && selectedUserId !== user?.id}
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
                      progress={userProgress.find(
                        (p) => p.objectiveId === objective.id
                      )}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="leaderboard" className="mt-6">
              <LeaderboardTable challengeId={challenge.id} />
            </TabsContent>

            <TabsContent value="activities" className="mt-6">
              <ActivityList challengeId={challenge.id} />
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="hidden md:block">
          <div className="sticky top-20 rounded-lg border bg-card p-6 text-card-foreground">
            <h2 className="text-xl font-semibold">{t("challengeStats")}</h2>
            
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("status")}</span>
                  <span className="font-medium">
                    {isActive && t("active")}
                    {isFuture && t("upcoming")}
                    {isPast && t("completed")}
                  </span>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("participants")}</span>
                  <span className="font-medium">{challenge.participants.length}</span>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("totalPoints")}</span>
                  <span className="font-medium">{challenge.totalPoints}</span>
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("objectives")}</span>
                  <span className="font-medium">{challenge.objectives.length}</span>
                </div>
              </div>
              
              {isActive && (
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("daysLeft")}</span>
                    <span className="font-medium">{daysLeft}</span>
                  </div>
                </div>
              )}
              
              {hasJoined && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("yourPoints")}</span>
                    <span className="font-medium">{Math.round(totalPoints)}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>{Math.round(progress)}% {t("complete")}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </div>
              )}
              
              {!hasJoined && (
                <Button
                  className="mt-2 w-full"
                  onClick={() => joinChallenge(challenge.id)}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  {t("joinChallenge")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
