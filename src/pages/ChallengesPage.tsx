import { useState, useEffect, useMemo } from 'react';
import { useChallenges } from '@/contexts/ChallengeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import ChallengeCard from '@/components/challenges/ChallengeCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Challenge, UserChallenge } from '@/types';
import { supabase } from '@/lib/supabase';

const CHALLENGES_PER_PAGE = 9;

export default function ChallengesPage() {
  const { getChallenge, getUserChallenges } = useChallenges();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const activeTab = user ? 'all' : 'browse';

  const loadChallenges = async (pageNum: number, isNewSearch = false) => {
    try {
      setLoadingMore(true);

      let query = supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false })
        .range((pageNum - 1) * CHALLENGES_PER_PAGE, pageNum * CHALLENGES_PER_PAGE - 1);

      // Apply search filter if there's a search query
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data: challengesData, error: challengesError, count } = await query;

      if (challengesError) {
        console.error('Error fetching challenges:', challengesError);
        return;
      }

      if (isNewSearch) {
        setChallenges(challengesData || []);
      } else {
        setChallenges((prev) => [...prev, ...(challengesData || [])]);
      }

      // Check if we have more challenges to load
      setHasMore((challengesData?.length || 0) === CHALLENGES_PER_PAGE);

      // Get user's challenges if logged in
      if (user) {
        const userChallengesData = await getUserChallenges();
        setUserChallenges(userChallengesData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial load
  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadChallenges(1, true);
  }, [user, searchQuery]);

  // Load more when scrolling
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadChallenges(nextPage);
    }
  };

  // Filter challenges based on search query
  const filteredChallenges = challenges.filter(
    (challenge) =>
      challenge.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      challenge.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get user's joined challenges
  const userJoinedChallenges = user
    ? filteredChallenges.filter((challenge) => challenge.participants.includes(user.id))
    : [];

  // Get other available challenges
  const availableChallenges = user
    ? filteredChallenges.filter((challenge) => !challenge.participants.includes(user.id))
    : filteredChallenges;

  const sortedAllChallenges = useMemo(() => {
    if (!user) {
      return filteredChallenges;
    }
    const today = new Date();
    
    const sorted = [...filteredChallenges].sort((a, b) => {
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
  }, [filteredChallenges, user, userChallenges]);

  const sortedJoinedChallenges = useMemo(() => {
    if (!user) {
      return [];
    }
    const joined = filteredChallenges.filter((challenge) =>
      challenge.participants.includes(user.id)
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
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-2">
            <TabsTrigger value="all">{t('allChallenges')}</TabsTrigger>
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

                {hasMore && (
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                      {loadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('loading')}
                        </>
                      ) : (
                        t('loadMore')
                      )}
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
