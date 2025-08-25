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
import { Trophy, UserRound, Clock } from 'lucide-react';
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
  completionOrder?: number;
  completionTime?: string;
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

    // If capedPoints is true, sort by completion order first, then by score
    if (capedPoints) {
      // Calculate completion order first
      const totalPoints = entries[0]?.challenge?.totalPoints || 0;
      const challengeObjectives = entries[0]?.challenge?.objectives || [];
      
      if (challengeObjectives.length > 0) {
        // Get completion times for all users
        const userCompletionTimes = new Map<string, string | null>();
        
        leaderboardEntries.forEach(entry => {
          const userEntries = entries.filter(e => e.user_id === entry.userId);
          const objectiveProgress = new Map<string, number>();
          let completionTime: string | null = null;
          
          // Sort entries by timestamp to track progress chronologically
          const sortedEntries = userEntries.sort((e1, e2) => 
            new Date(e1.created_at).getTime() - new Date(e2.created_at).getTime()
          );
          
          // Track when this user first reached 100% completion
          for (const entry of sortedEntries) {
            const currentValue = objectiveProgress.get(entry.objective_id) || 0;
            objectiveProgress.set(entry.objective_id, currentValue + entry.value);
            
            // Check if all objectives are now complete
            const allObjectivesComplete = challengeObjectives.every(objective => {
              const currentProgress = objectiveProgress.get(objective.id) || 0;
              return currentProgress >= objective.targetValue;
            });
            
            // If this is the first time all objectives are complete, record the completion time
            if (allObjectivesComplete && !completionTime) {
              completionTime = entry.created_at;
            }
          }
          
          userCompletionTimes.set(entry.userId, completionTime);
        });
        
        // Sort by completion time first (earliest first), then by score (highest first)
        leaderboardEntries.sort((a, b) => {
          const aCompletionTime = userCompletionTimes.get(a.userId);
          const bCompletionTime = userCompletionTimes.get(b.userId);
          
          // If both users completed, sort by completion time
          if (aCompletionTime && bCompletionTime) {
            const timeDiff = new Date(aCompletionTime).getTime() - new Date(bCompletionTime).getTime();
            if (timeDiff !== 0) return timeDiff;
          }
          
          // If only one completed, completed users come first
          if (aCompletionTime && !bCompletionTime) return -1;
          if (!aCompletionTime && bCompletionTime) return 1;
          
          // If neither completed or both completed at same time, sort by score
          return b.score - a.score;
        });
      } else {
        // Fallback to score sorting if no objectives
        leaderboardEntries.sort((a, b) => b.score - a.score);
      }
    } else {
      // Sort by score (descending) when not using capped points
      leaderboardEntries.sort((a, b) => b.score - a.score);
    }

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
  }, [entries, capedPoints]);

  // Calculate completion order for users who reached 100%
  const completionOrder = useMemo(() => {
    if (!capedPoints || entries.length === 0) return new Map();
    
    const totalPoints = entries[0]?.challenge?.totalPoints || 0;
    const challengeObjectives = entries[0]?.challenge?.objectives || [];
    
    if (challengeObjectives.length === 0) return new Map();
    
    // Since the leaderboard is now sorted by completion time, we can derive completion order from position
    const orderMap = new Map();
    
    leaderboard.forEach((entry, index) => {
      if (entry.score >= totalPoints) {
        // Calculate the actual completion time for this user
        const userEntries = entries.filter(e => e.user_id === entry.userId);
        const objectiveProgress = new Map<string, number>();
        let completionTime: string | null = null;
        
        // Sort entries by timestamp to track progress chronologically
        const sortedEntries = userEntries.sort((e1, e2) => 
          new Date(e1.created_at).getTime() - new Date(e2.created_at).getTime()
        );
        
        // Track when this user first reached 100% completion
        for (const entry of sortedEntries) {
          const currentValue = objectiveProgress.get(entry.objective_id) || 0;
          objectiveProgress.set(entry.objective_id, currentValue + entry.value);
          
          // Check if all objectives are now complete
          const allObjectivesComplete = challengeObjectives.every(objective => {
            const currentProgress = objectiveProgress.get(objective.id) || 0;
            return currentProgress >= objective.targetValue;
          });
          
          // If this is the first time all objectives are complete, record the completion time
          if (allObjectivesComplete && !completionTime) {
            completionTime = entry.created_at;
          }
        }
        
        if (completionTime) {
          orderMap.set(entry.userId, {
            order: index + 1, // Position in leaderboard (sorted by completion time)
            time: completionTime
          });
        }
      }
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

  const getCompletionOrderStyle = (order: number) => {
    switch (order) {
      case 1:
        return 'bg-yellow-100 text-yellow-700 border-yellow-300 shadow-sm';
      case 2:
        return 'bg-gray-100 text-gray-700 border-gray-300 shadow-sm';
      case 3:
        return 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-300 shadow-sm';
    }
  };

  const getCompletionOrderIcon = (order: number) => {
    switch (order) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `${order}`;
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
     <div className="rounded-md border overflow-x-auto">
       <Table className="min-w-full">
         <TableHeader>
           <TableRow>
             <TableHead className="w-12 md:w-16 text-center px-2 md:px-4">
               {capedPoints ? '' : t('leaderboardRank')}
             </TableHead>
             <TableHead className="px-2 md:px-4">Player</TableHead>
             
             <TableHead className="w-16 md:w-20 text-right px-2 md:px-4">Pts</TableHead>
           </TableRow>
         </TableHeader>
        <TableBody>
          {leaderboard.map((entry) => {
            const isCurrentUser = user && entry.userId === user.id;
            const completionInfo = completionOrder.get(entry.userId);
            
            

                         return (
               <TableRow key={entry.userId} className={`select-none ${isCurrentUser ? 'bg-muted/40' : ''}`}>
                 <TableCell className="text-center px-2 md:px-4">
                   {capedPoints ? (
                     // Show completion order when capedPoints is true
                     completionInfo ? (
                       <div 
                         className={`inline-flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm font-bold border-2 ${getCompletionOrderStyle(completionInfo.order)} cursor-help`}
                         title={`${getCompletionOrderIcon(completionInfo.order)} ${completionInfo.order === 1 ? '1st' : completionInfo.order === 2 ? '2nd' : '3rd'} to finish - ${new Date(completionInfo.time).toLocaleString()}`}
                       >
                         {getCompletionOrderIcon(completionInfo.order)}
                       </div>
                     ) : entry.score >= (entries[0]?.challenge?.totalPoints || 0) ? (
                       <span className="text-muted-foreground text-xs">-</span>
                     ) : (
                       <span className="text-muted-foreground text-xs">-</span>
                     )
                   ) : (
                     // Show regular rank when capedPoints is false
                     <>
                       {entry.position === 1 && '🥇'}
                       {entry.position === 2 && '🥈'}
                       {entry.position === 3 && '🥉'}
                       {entry.position > 3 && entry.position}
                     </>
                   )}
                 </TableCell>
                 <TableCell className="px-2 md:px-4">
                   <div
                     className="flex items-center gap-2 md:gap-3 cursor-pointer hover:opacity-80 select-none"
                     onClick={() => onUserClick?.(entry.userId)}
                   >
                     <Avatar className="h-6 w-6 md:h-8 md:w-8">
                       {userAvatars[entry.userId] && (
                         <AvatarImage
                           src={userAvatars[entry.userId]}
                           onError={(e) => {
                             (e.target as HTMLImageElement).style.display = 'none';
                           }}
                         />
                       )}
                       <AvatarFallback>
                         <UserRound className="h-3 w-3 md:h-4 md:w-4" />
                       </AvatarFallback>
                     </Avatar>
                                           <span className={`text-sm md:text-base ${isCurrentUser ? 'font-medium' : ''} break-words`}>
                        {entry.name}
                        {isCurrentUser && <span className="ml-1">(You)</span>}
                        {/* Show checkmark for 100% completion (but not for top 3 finishers who already have completion badges) */}
                        {capedPoints && entry.score >= (entries[0]?.challenge?.totalPoints || 0) && (!completionInfo || completionInfo.order > 3) && (
                          <span className="ml-1 md:ml-2 inline-flex items-center justify-center w-4 h-4 md:w-6 md:h-6 bg-green-100 text-green-700 rounded-full text-xs font-bold" title={`100% ${t('complete')}`}>
                            ✓
                          </span>
                        )}
                      </span>
                   </div>
                 </TableCell>
                 
                 <TableCell className="text-right font-medium px-2 md:px-4">
                   <span className="text-sm md:text-base">{Math.round(entry.score)}</span>
                   {capedPoints && entry.uncappedScore !== entry.score && (
                     <span className="text-xs md:text-sm text-muted-foreground ml-1 md:ml-2">
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

