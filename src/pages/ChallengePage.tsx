import { useEffect, useState, useCallback, useMemo } from "react";
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
import {
  ChevronLeft,
  Trophy,
  Users,
  Target,
  Calendar,
  Award,
  UserRound,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Challenge, UserProgress } from "@/types";
import { useTranslation } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";
import ActivityList from "@/components/challenges/ActivityList";
import BingoAnimation from "@/components/challenges/BingoAnimation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculateTotalPoints } from "@/lib/points";

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const {
    getChallenge,
    joinChallenge,
    getChallengeProgress,
    getParticipantProgress,
    getParticipants,
    getCreatorAvatar,
  } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [progress, setProgress] = useState(0);
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
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("objectives");
  const [creatorAvatar, setCreatorAvatar] = useState<string | undefined>(
    undefined,
  );
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [joiningChallenge, setJoiningChallenge] = useState(false);

  const hasJoined = user && challenge?.participants.includes(user.id);
  const isCreator = user && challenge?.createdById === user.id;

  const handleJoinChallenge = async () => {
    if (!challenge) return;
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

  // Load challenge data
  useEffect(() => {
    const fetchChallenge = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const challengeData = await getChallenge(id);
        if (challengeData) {
          setChallenge(challengeData);
          // Load creator avatar and participants in parallel
          const [avatar, participantsData] = await Promise.all([
            getCreatorAvatar(challengeData.createdById),
            getParticipants(id),
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
        const progressData = await getChallengeProgress(challenge.id);
        setUserProgress(progressData);
        setPreviousProgress(progressData); // Initialize previous progress
      } catch (error) {
        console.error("Error loading user progress:", error);
      }
    };

    loadUserProgress();
  }, [challenge?.id, user?.id]); // Only depend on IDs, not the full objects

  // Refresh progress when user progress changes (e.g., after updates)
  const refreshProgress = useCallback(async () => {
    if (!challenge || !user) return;

    try {
      const progressData = await getChallengeProgress(challenge.id);
      setUserProgress(progressData);
    } catch (error) {
      console.error("Error refreshing progress:", error);
    }
  }, [challenge?.id, user?.id, getChallengeProgress]);

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
        challenge.capedPoints
      );

      setTotalPoints(totalPoints);
      setProgress((totalPoints / challenge.totalPoints) * 100);
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

  // Reset shown wins when switching users
  useEffect(() => {
    setShownBingoWins(new Set());
  }, [selectedUserId]);

  // Function to check for Bingo wins - memoized to prevent recreation
  const checkForBingo = useCallback(
    (progress: UserProgress[], currentShownWins: Set<string>) => {
      if (challenge?.challengeType !== "bingo" && challenge?.objectives?.length !== 25) return false;

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
    [challenge?.id, challenge?.challengeType, challenge?.objectives],
  ); // Remove shownBingoWins dependency

  // Check for new completions and trigger bingo animation
  useEffect(() => {
    if ((challenge?.challengeType !== "bingo" && challenge?.objectives?.length !== 25) || !user) return;

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
    challenge?.challengeType,
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

  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  const today = new Date();

  const isActive = today >= startDate && today <= endDate;
  const isFuture = today < startDate;
  const isPast = today > endDate;

  const daysLeft = Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const locale = language === "de" ? de : enUS;

  return (
    <div className="container py-2">
      <BingoAnimation
        isVisible={showBingoAnimation}
        onComplete={() => setShowBingoAnimation(false)}
      />
      <Link
        to="/challenges"
        className="mb-4 inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        {t("challenges")}
      </Link>

      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold">
                {challenge.title}
              </h1>
              {isActive && (
                <Badge className="bg-green-500">{t("active")}</Badge>
              )}
              {isFuture && (
                <Badge
                  variant="outline"
                  className="border-blue-400 text-blue-500"
                >
                  {t("upcoming")}
                </Badge>
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

            {/* <p className="text-sm sm:text-base text-muted-foreground">{challenge.description}</p> */}

            <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(startDate, t("dateFormatShort"), { locale })} -{" "}
                  {format(endDate, t("dateFormatLong"), { locale })}
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
                  disabled={joiningChallenge}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  {joiningChallenge ? t("joining") : t("joinChallenge")}
                </Button>
              )}
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            defaultValue="objectives"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {isMobile ? (
                <div className="flex flex-row gap-2 w-full">
                  <Select value={activeTab} onValueChange={setActiveTab}>
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
                  {(challenge.challengeType === "bingo" || challenge?.objectives?.length === 25) && (
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
                  <TabsList className="w-full sm:w-auto">
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
                  {(challenge.challengeType === "bingo" || challenge?.objectives?.length === 25) && (
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
                      {Math.round(totalPoints)} / {challenge.totalPoints}{" "}
                      {t("points")}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {(challenge?.challengeType === "bingo" || (challenge?.objectives?.length === 25)) ? (
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
                      challengeType={challenge.challengeType || (challenge?.objectives?.length === 25 ? "bingo" : "standard")}
                      capedPoints={challenge.capedPoints}
                      readOnly={
                        selectedUserId !== null && selectedUserId !== user?.id
                      }
                      onProgressUpdate={refreshProgress}
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
                      challengeType={challenge.challengeType || (challenge?.objectives?.length === 25 ? "bingo" : "standard")}
                      capedPoints={challenge.capedPoints}
                      readOnly={
                        selectedUserId !== null && selectedUserId !== user?.id
                      }
                      onProgressUpdate={refreshProgress}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="leaderboard" className="mt-6">
              <LeaderboardTable
                challengeId={challenge.id}
                capedPoints={challenge.capedPoints}
                onUserClick={(userId) => {
                  setSelectedUserId(userId);
                  setActiveTab("objectives");
                }}
              />
            </TabsContent>

            <TabsContent value="activities" className="mt-6">
              <ActivityList
                challengeId={challenge.id}
                onUserClick={(userId) => {
                  setSelectedUserId(userId);
                  setActiveTab("objectives");
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
