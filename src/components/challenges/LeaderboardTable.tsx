import { useMemo, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateTotalPoints } from '@/lib/points';

interface LeaderboardTableProps {
  challengeId?: string;
  capedPoints?: boolean;
  onUserClick?: (userId: string) => void;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  uncappedScore: number;
  position: number;
}

interface ChallengeObjective {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  unit: string;
  pointsPerUnit: number;
}

interface Challenge {
  id: number;
  objectives: ChallengeObjective[];
  totalPoints: number;
}

interface Entry {
  id: string;
  user_id: string;
  challenge_id: number;
  objective_id: string;
  value: number;
  created_at: string;
  notes?: string;
  username: string;
  challenge: Challenge;
}

export default function LeaderboardTable({ challengeId, capedPoints = false, onUserClick }: LeaderboardTableProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        let query = supabase.from('entries').select(`
    *,
    challenge:challenges (
      id,
      objectives,
      totalPoints
    )
  `);

        if (challengeId) {
          query = query.eq('challenge_id', challengeId);
        }

        const { data: entriesData, error: entriesError } = await query;

        if (entriesError) {
          console.error('Error fetching entries:', entriesError);
        } else {
          setEntries(entriesData || []);

          // Fetch user profiles for all unique users
          const uniqueUserIds = [...new Set(entriesData?.map((entry) => entry.user_id) || [])];
          const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, avatar_url')
            .in('id', uniqueUserIds);

          if (profilesError) {
            console.error('Error fetching user profiles:', profilesError);
          } else {
            const avatarMap = (profiles || []).reduce(
              (acc, profile) => ({
                ...acc,
                [profile.id]: profile.avatar_url,
              }),
              {}
            );
            setUserAvatars(avatarMap);
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [challengeId]);

  const leaderboard = useMemo(() => {
    // Group entries by user and objective to get total progress per objective
    const userProgressMap = new Map<string, Map<string, number>>();
    
    entries.forEach(entry => {
      if (!userProgressMap.has(entry.user_id)) {
        userProgressMap.set(entry.user_id, new Map());
      }
      
      const userObjectives = userProgressMap.get(entry.user_id)!;
      const currentValue = userObjectives.get(entry.objective_id) || 0;
      userObjectives.set(entry.objective_id, currentValue + entry.value);
    });

    // Calculate scores for each user using the same logic as the individual page
    const userScores = Array.from(userProgressMap.entries()).map(([userId, objectivesMap]) => {
      const progress = Array.from(objectivesMap.entries()).map(([objectiveId, currentValue]) => ({
        objectiveId,
        currentValue
      }));

      // Get the first entry's challenge data (all entries have the same challenge data)
      const firstEntry = entries.find(e => e.user_id === userId);
      const objectives = firstEntry?.challenge.objectives || [];

      // Calculate both capped and uncapped points using the same function
      const cappedScore = calculateTotalPoints(objectives, progress, true);
      const uncappedScore = calculateTotalPoints(objectives, progress, false);

      return {
        userId,
        username: firstEntry?.username || 'Unknown',
        score: cappedScore,
        uncappedScore: uncappedScore
      };
    });

    // Create leaderboard entries
    const leaderboardEntries: LeaderboardEntry[] = userScores.map((data, index) => ({
      userId: data.userId,
      name: data.username,
      score: data.score,
      uncappedScore: data.uncappedScore,
      position: 0, // will be calculated below
    }));

    // Sort by score (descending)
    leaderboardEntries.sort((a, b) => b.score - a.score);

    // Assign positions (handling ties)
    let currentPosition = 1;
    let currentScore = Number.MAX_SAFE_INTEGER;

    return leaderboardEntries.map((entry, index) => {
      if (entry.score < currentScore) {
        currentPosition = index + 1;
        currentScore = entry.score;
      }

      return {
        ...entry,
        position: currentPosition,
      };
    });
  }, [entries]);

  // Calculate completion order for users who reached 100%
  const completionOrder = useMemo(() => {
    if (!capedPoints || entries.length === 0) return new Map();
    
    const totalPoints = entries[0]?.challenge?.totalPoints || 0;
    const completedUsers = leaderboard
      .filter(entry => entry.score >= totalPoints)
      .sort((a, b) => {
        // Find the earliest entry for each user to determine completion time
        const aEarliestEntry = entries
          .filter(e => e.user_id === a.userId)
          .sort((e1, e2) => new Date(e1.created_at).getTime() - new Date(e2.created_at).getTime())[0];
        const bEarliestEntry = entries
          .filter(e => e.user_id === b.userId)
          .sort((e1, e2) => new Date(e1.created_at).getTime() - new Date(e2.created_at).getTime())[0];
        
        return new Date(aEarliestEntry.created_at).getTime() - new Date(bEarliestEntry.created_at).getTime();
      })
      .slice(0, 3); // Only track top 3
    
    const orderMap = new Map();
    completedUsers.forEach((user, index) => {
      orderMap.set(user.userId, index + 1);
    });
    
    return orderMap;
  }, [leaderboard, entries, capedPoints]);

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return 'text-yellow-500 font-bold';
      case 2:
        return 'text-gray-400 font-bold';
      case 3:
        return 'text-amber-700 font-bold';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-10">
        <Trophy className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
        <h3 className="mt-4 text-lg font-medium">{t('noParticipants')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('noParticipantsDescription')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">{t('leaderboardRank')}</TableHead>
            <TableHead>{t('leaderboardPlayer')}</TableHead>
            <TableHead className="text-right">{t('leaderboardPoints')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboard.map((entry) => {
            const isCurrentUser = user && entry.userId === user.id;

            return (
              <TableRow key={entry.userId} className={`select-none ${isCurrentUser ? 'bg-muted/40' : ''}`}>
                <TableCell className={`text-center ${getPositionStyle(entry.position)}`}>
                  {entry.position === 1 && '🥇'}
                  {entry.position === 2 && '🥈'}
                  {entry.position === 3 && '🥉'}
                  {entry.position > 3 && entry.position}
                </TableCell>
                <TableCell>
                  <div
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 select-none"
                    onClick={() => onUserClick?.(entry.userId)}
                  >
                    <Avatar className="h-8 w-8">
                      {userAvatars[entry.userId] && (
                        <AvatarImage
                          src={userAvatars[entry.userId]}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <AvatarFallback>
                        <UserRound className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className={isCurrentUser ? 'font-medium' : ''}>
                      {entry.name} {isCurrentUser && '(You)'}
                      {/* Show checkmark for 100% completion */}
                      {capedPoints && entry.score >= (entries[0]?.challenge?.totalPoints || 0) && (
                        <span className="ml-2 inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full text-sm font-bold" title="100% Complete">
                          ✓
                        </span>
                      )}
                      
                      {/* Show completion order for top 3 finishers */}
                      {capedPoints && completionOrder.has(entry.userId) && (
                        <span 
                          className={`ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
                            completionOrder.get(entry.userId) === 1 
                              ? 'bg-yellow-100 text-yellow-700' 
                              : completionOrder.get(entry.userId) === 2 
                              ? 'bg-gray-100 text-gray-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}
                          title={`${completionOrder.get(entry.userId) === 1 ? '1st' : completionOrder.get(entry.userId) === 2 ? '2nd' : '3rd'} to complete`}
                        >
                          {completionOrder.get(entry.userId) === 1 ? '🥇' : completionOrder.get(entry.userId) === 2 ? '🥈' : '🥉'}
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {Math.round(entry.score)} {t('leaderboardPoints')}
                  {capedPoints && entry.uncappedScore !== entry.score && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ({Math.round(entry.uncappedScore)})
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
