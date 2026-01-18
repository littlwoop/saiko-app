import { useState, useEffect, useMemo } from 'react';
import { useChallenges } from '@/contexts/ChallengeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import ChallengeCard from '@/components/challenges/ChallengeCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Challenge, UserChallenge } from '@/types';
import { supabase } from '@/lib/supabase';

export default function ChallengesPage() {
  const { getChallenge, getUserChallenges } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  const activeTab = user ? 'all' : 'browse';

  const loadChallenges = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply search filter if there's a search query
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data: challengesData, error: challengesError } = await query;

      if (challengesError) {
        console.error('Error fetching challenges:', challengesError);
        return;
      }

      if (!challengesData) {
        setChallenges([]);
        return;
      }

      // Fetch objectives for all challenges
      const challengeIds = challengesData.map((c) => c.id);
      const { data: allObjectivesData } = await supabase
        .from('objectives')
        .select('*')
        .in('challenge_id', challengeIds)
        .order('challenge_id', { ascending: true })
        .order('order', { ascending: true });

      // Group objectives by challenge_id
      const objectivesByChallenge: Record<number, any[]> = {};
      if (allObjectivesData) {
        allObjectivesData.forEach((obj) => {
          if (!objectivesByChallenge[obj.challenge_id]) {
            objectivesByChallenge[obj.challenge_id] = [];
          }
          objectivesByChallenge[obj.challenge_id].push({
            id: obj.id,
            title: obj.title,
            description: obj.description || undefined,
            targetValue: obj.target_value !== null ? Number(obj.target_value) : undefined,
            unit: obj.unit || undefined,
            pointsPerUnit: obj.points_per_unit !== null ? Number(obj.points_per_unit) : undefined,
          });
        });
      }

      // Merge objectives into challenges (with fallback to JSON field for backward compatibility)
      const challengesWithObjectives = challengesData.map((challenge) => {
        const objectives = objectivesByChallenge[challenge.id] || 
                          (Array.isArray(challenge.objectives) ? challenge.objectives : []);
        // Ensure participants is always an array
        const participants = Array.isArray(challenge.participants) ? challenge.participants : [];
        return {
          ...challenge,
          objectives,
          participants,
        };
      });

      setChallenges(challengesWithObjectives);

      // Get user's challenges if logged in
      if (user) {
        const userChallengesData = await getUserChallenges();
        setUserChallenges(userChallengesData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadChallenges();
  }, [user, searchQuery]);

  // Filter challenges based on search query
  const filteredChallenges = challenges.filter(
    (challenge) =>
      challenge.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      challenge.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if there are any completed challenges
  const hasCompletedChallenges = useMemo(() => {
    const today = new Date();
    return filteredChallenges.some((challenge) => {
      const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
      return endDate ? today > endDate : false;
    });
  }, [filteredChallenges]);

  // Get user's joined challenges
  const userJoinedChallenges = user
    ? filteredChallenges.filter((challenge) => Array.isArray(challenge.participants) && challenge.participants.includes(user.id))
    : [];

  // Get other available challenges
  const availableChallenges = user
    ? filteredChallenges.filter((challenge) => !Array.isArray(challenge.participants) || !challenge.participants.includes(user.id))
    : filteredChallenges;

  const sortedAllChallenges = useMemo(() => {
    if (!user) {
      return filteredChallenges;
    }
    const today = new Date();
    
    // Filter out completed challenges if showCompleted is false
    let challengesToShow = filteredChallenges;
    if (!showCompleted) {
      challengesToShow = filteredChallenges.filter((challenge) => {
        const startDate = new Date(challenge.startDate);
        const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
        const isActive = today >= startDate && (!endDate || today <= endDate);
        const isFuture = today < startDate;
        // Only show active and future challenges, hide completed ones
        return isActive || isFuture;
      });
    }
    
    const sorted = [...challengesToShow].sort((a, b) => {
      // First, determine the status of each challenge
      const aStartDate = new Date(a.startDate);
      const aEndDate = a.endDate ? new Date(a.endDate) : null;
      const bStartDate = new Date(b.startDate);
      const bEndDate = b.endDate ? new Date(b.endDate) : null;
      
      const aIsActive = today >= aStartDate && (!aEndDate || today <= aEndDate);
      const aIsFuture = today < aStartDate;
      const aIsPast = aEndDate ? today > aEndDate : false;
      
      const bIsActive = today >= bStartDate && (!bEndDate || today <= bEndDate);
      const bIsFuture = today < bStartDate;
      const bIsPast = bEndDate ? today > bEndDate : false;
      
      // Priority order: Active > Upcoming > Completed
      const getStatusPriority = (isActive: boolean, isFuture: boolean, isPast: boolean) => {
        if (isActive) return 3;
        if (isFuture) return 2;
        if (isPast) return 1;
        return 0;
      };
      
      const aPriority = getStatusPriority(aIsActive, aIsFuture, aIsPast);
      const bPriority = getStatusPriority(bIsActive, bIsFuture, bIsPast);
      
      // If status is different, sort by status priority
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // If status is the same, sort by progress
      const aUser = userChallenges.find(
        (uc) => uc.userId === user.id && uc.challengeId === a.id
      );
      const bUser = userChallenges.find(
        (uc) => uc.userId === user.id && uc.challengeId === b.id
      );
      const aProgress = aUser ? aUser.totalScore / a.totalPoints : 0;
      const bProgress = bUser ? bUser.totalScore / b.totalPoints : 0;
      return bProgress - aProgress;
    });
    return sorted;
  }, [filteredChallenges, user, userChallenges, showCompleted]);

  const sortedJoinedChallenges = useMemo(() => {
    if (!user) {
      return [];
    }
    const joined = filteredChallenges.filter((challenge) =>
      Array.isArray(challenge.participants) && challenge.participants.includes(user.id)
    );
    const today = new Date();
    
    const sorted = [...joined].sort((a, b) => {
      // First, determine the status of each challenge
      const aStartDate = new Date(a.startDate);
      const aEndDate = new Date(a.endDate);
      const bStartDate = new Date(b.startDate);
      const bEndDate = new Date(b.endDate);
      
      const aIsActive = today >= aStartDate && today <= aEndDate;
      const aIsFuture = today < aStartDate;
      const aIsPast = today > aEndDate;
      
      const bIsActive = today >= bStartDate && today <= bEndDate;
      const bIsFuture = today < bStartDate;
      const bIsPast = today > bEndDate;
      
      // Priority order: Active > Upcoming > Completed
      const getStatusPriority = (isActive: boolean, isFuture: boolean, isPast: boolean) => {
        if (isActive) return 3;
        if (isFuture) return 2;
        if (isPast) return 1;
        return 0;
      };
      
      const aPriority = getStatusPriority(aIsActive, aIsFuture, aIsPast);
      const bPriority = getStatusPriority(bIsActive, bIsFuture, bIsPast);
      
      // If status is different, sort by status priority
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // If status is the same, sort by progress
      const aUser = userChallenges.find(
        (uc) => uc.userId === user.id && uc.challengeId === a.id
      );
      const bUser = userChallenges.find(
        (uc) => uc.userId === user.id && uc.challengeId === b.id
      );
      const aProgress = aUser ? aUser.totalScore / a.totalPoints : 0;
      const bProgress = bUser ? bUser.totalScore / b.totalPoints : 0;
      return bProgress - aProgress;
    });
    return sorted;
  }, [filteredChallenges, user, userChallenges]);

  if (loading) {
    return (
      <div className="container py-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight">{t('challenges')}</h1>
            {user && (
              <Button asChild className="w-full sm:w-auto">
                <Link to="/challenges/create">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createChallenge')}
                </Link>
              </Button>
            )}
          </div>

          {/* <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchChallenges")}
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div> */}
        </div>

        <Tabs defaultValue={activeTab}>
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-3">
            <TabsTrigger value="all">{t('allChallenges')}</TabsTrigger>
            <TabsTrigger value="upcoming">{t('upcoming')}</TabsTrigger>
            {user && <TabsTrigger value="joined">{t('myJoinedChallenges')}</TabsTrigger>}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {sortedAllChallenges.length > 0 ? (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {sortedAllChallenges.map((challenge) => {
                    const userChallenge = userChallenges.find(
                      (uc) => user && uc.userId === user.id && uc.challengeId === challenge.id
                    );

                    return (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        userScore={userChallenge?.totalScore || 0}
                      />
                    );
                  })}
                </div>

                {hasCompletedChallenges && !showCompleted && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={() => setShowCompleted(true)}>
                      {t('showCompleted')}
                    </Button>
                  </div>
                )}

                {showCompleted && hasCompletedChallenges && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={() => setShowCompleted(false)}>
                      {t('hideCompleted')}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-10 text-center">
                <h3 className="text-lg font-medium">{t('noChallengesFound')}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('noChallengesFoundDescription')}
                </p>
                <Button asChild className="mt-4">
                  <Link to="/challenges/create">{t('createChallenge')}</Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-6">
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0); // Normalize to start of day
              
              const upcomingChallenges = filteredChallenges
                .filter((challenge) => {
                  // For repeating challenges, they're always available but show them if they haven't started
                  // For non-repeating challenges, check if start date is in the future
                  if (challenge.isRepeating) {
                    // Repeating challenges are always "upcoming" if not joined yet
                    // or if they don't have a fixed start date
                    return true;
                  }
                  
                  if (!challenge.startDate) {
                    return false; // No start date means not upcoming
                  }
                  
                  const startDate = new Date(challenge.startDate);
                  startDate.setHours(0, 0, 0, 0); // Normalize to start of day
                  
                  return today < startDate;
                })
                .sort((a, b) => {
                  // Sort by start date (soonest first)
                  const aStartDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
                  const bStartDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
                  
                  // Repeating challenges without start dates go to the end
                  if (a.isRepeating && !a.startDate) return 1;
                  if (b.isRepeating && !b.startDate) return -1;
                  
                  return aStartDate - bStartDate;
                });

              return upcomingChallenges.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingChallenges.map((challenge) => {
                    const userChallenge = userChallenges.find(
                      (uc) => user && uc.userId === user.id && uc.challengeId === challenge.id
                    );

                    return (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        userScore={userChallenge?.totalScore || 0}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="mt-10 text-center">
                  <h3 className="text-lg font-medium">{t('noUpcomingChallenges') || 'No Upcoming Challenges'}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('noUpcomingChallengesDescription') || 'There are no upcoming challenges at the moment.'}
                  </p>
                </div>
              );
            })()}
          </TabsContent>

          {user && (
            <TabsContent value="joined" className="mt-6">
              {sortedJoinedChallenges.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {sortedJoinedChallenges.map((challenge) => {
                    const userChallenge = userChallenges.find(
                      (uc) => uc.userId === user.id && uc.challengeId === challenge.id
                    );

                    return (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        userScore={userChallenge?.totalScore || 0}
                        showJoin={false}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="mt-10 text-center">
                  <h3 className="text-lg font-medium">{t('noJoinedChallenges')}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('noJoinedChallengesDescription')}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-4">
                    <Button asChild variant="outline">
                      <Link to="/challenges">{t('browseChallenges')}</Link>
                    </Button>
                    <Button asChild>
                      <Link to="/challenges/create">{t('createChallenge')}</Link>
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
