import { useMemo, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useChallenges } from '@/contexts/ChallengeContext';
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
import { getNumberOfWeeks, getWeekIdentifier } from '@/lib/week-utils';

interface LeaderboardTableProps {
  challengeId?: number;
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
  challenge_type: string;
  startDate: string;
  endDate: string;
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
  const { getParticipants } = useChallenges();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string; avatar?: string }>>([]);
  const [challengeData, setChallengeData] = useState<{ objectives: ChallengeObjective[]; totalPoints: number; challenge_type: string; startDate: string; endDate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all participants for the challenge
        if (challengeId) {
          const participantsData = await getParticipants(challengeId);
          setParticipants(participantsData);
          
          // Create avatar map from participants data (which already includes avatars)
          const avatarMap = participantsData.reduce(
            (acc, participant) => ({
              ...acc,
              [participant.id]: participant.avatar,
            }),
            {}
          );
          setUserAvatars(avatarMap);
          
          // Also fetch challenge data to get objectives, total points, and challenge type
          const { data: challengeDataResult, error: challengeError } = await supabase
            .from('challenges')
            .select('objectives, totalPoints, challenge_type, startDate, endDate')
            .eq('id', challengeId)
            .single();
            
          if (!challengeError && challengeDataResult) {
            setChallengeData(challengeDataResult);
          }
        }

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
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [challengeId, getParticipants]);

  const leaderboard = useMemo(() => {
    // Group entries by user and objective to get total progress per objective
    const userProgressMap = new Map<string, Map<string, number>>();
    const isCompletionChallenge = challengeData?.challenge_type === "completion";
    const isWeeklyChallenge = challengeData?.challenge_type === "weekly";
    
    // For weekly challenges, we need to track progress per week per objective
    const weeklyProgressMap = new Map<string, Map<string, Map<string, number>>>(); // userId -> objectiveId -> weekId -> total value
    
    entries.forEach(entry => {
      if (!userProgressMap.has(entry.user_id)) {
        userProgressMap.set(entry.user_id, new Map());
      }
      
      const userObjectives = userProgressMap.get(entry.user_id)!;
      const currentValue = userObjectives.get(entry.objective_id) || 0;
      
      if (isWeeklyChallenge) {
        // For weekly challenges, track progress per week
        if (!weeklyProgressMap.has(entry.user_id)) {
          weeklyProgressMap.set(entry.user_id, new Map());
        }
        const userWeekMap = weeklyProgressMap.get(entry.user_id)!;
        if (!userWeekMap.has(entry.objective_id)) {
          userWeekMap.set(entry.objective_id, new Map());
        }
        const objectiveWeekMap = userWeekMap.get(entry.objective_id)!;
        
        const entryDate = new Date(entry.created_at);
        const weekId = getWeekIdentifier(entryDate);
        const weekTotal = objectiveWeekMap.get(weekId) || 0;
        objectiveWeekMap.set(weekId, weekTotal + (entry.value || 0));
      } else if (isCompletionChallenge) {
        // For completion challenges, count entries (each entry = 1)
        userObjectives.set(entry.objective_id, currentValue + 1);
      } else {
        // For other challenges, sum the values
        userObjectives.set(entry.objective_id, currentValue + entry.value);
      }
    });
    
    // For weekly challenges, calculate completed weeks per objective
    if (isWeeklyChallenge && challengeData) {
      challengeData.objectives.forEach(objective => {
        weeklyProgressMap.forEach((userWeekMap, userId) => {
          const objectiveWeekMap = userWeekMap.get(objective.id);
          if (objectiveWeekMap) {
            const targetValue = objective.targetValue || 1;
            let completedWeeks = 0;
            objectiveWeekMap.forEach((weekTotal) => {
              if (weekTotal >= targetValue) {
                completedWeeks++;
              }
            });
            
            const userObjectives = userProgressMap.get(userId)!;
            userObjectives.set(objective.id, completedWeeks);
          }
        });
      });
    }

    // Create leaderboard entries for ALL participants, including those with 0 points
    const userScores = participants.map(participant => {
      const objectivesMap = userProgressMap.get(participant.id);
      
      if (!objectivesMap) {
        // User has no entries, return 0 points
        return {
          userId: participant.id,
          username: participant.name,
          score: 0,
          uncappedScore: 0
        };
      }

      const progress = Array.from(objectivesMap.entries()).map(([objectiveId, currentValue]) => ({
        objectiveId,
        currentValue
      }));

      // Use the challenge data we fetched separately
      const objectives = challengeData?.objectives || [];
      const challengeType = challengeData?.challenge_type as "standard" | "bingo" | "completion" | "checklist" | "collection" | undefined;

      // Calculate both capped and uncapped points using the same function
      const cappedScore = calculateTotalPoints(objectives, progress, true, challengeType);
      const uncappedScore = calculateTotalPoints(objectives, progress, false, challengeType);

      return {
        userId: participant.id,
        username: participant.name,
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
      const totalPoints = challengeData?.totalPoints || 0;
      const challengeObjectives = challengeData?.objectives || [];
      
      if (challengeObjectives.length > 0) {
        // Get completion times for all users
        const userCompletionTimes = new Map<string, string | null>();
        
        leaderboardEntries.forEach(entry => {
          const userEntries = entries.filter(e => e.user_id === entry.userId);
          
          if (userEntries.length === 0) {
            // User has no entries, so no completion time
            userCompletionTimes.set(entry.userId, null);
            return;
          }
          
          const objectiveProgress = new Map<string, number>();
          let completionTime: string | null = null;
          
          // Sort entries by timestamp to track progress chronologically
          const sortedEntries = userEntries.sort((e1, e2) => 
            new Date(e1.created_at).getTime() - new Date(e2.created_at).getTime()
          );
          
          // Track when this user first reached 100% completion
          // For weekly challenges, track progress per week
          const weeklyProgressByObjective = new Map<string, Map<string, number>>(); // objectiveId -> weekId -> total value
          
          for (const entry of sortedEntries) {
            if (challengeData?.challenge_type === "weekly") {
              // For weekly challenges, track progress per week per objective
              if (!weeklyProgressByObjective.has(entry.objective_id)) {
                weeklyProgressByObjective.set(entry.objective_id, new Map());
              }
              const weekMap = weeklyProgressByObjective.get(entry.objective_id)!;
              
              const entryDate = new Date(entry.created_at);
              const weekId = getWeekIdentifier(entryDate);
              const weekTotal = weekMap.get(weekId) || 0;
              weekMap.set(weekId, weekTotal + (entry.value || 0));
              
              // Calculate completed weeks for this objective
              const objective = challengeObjectives.find(obj => obj.id === entry.objective_id);
              const targetValue = objective?.targetValue || 1;
              let completedWeeks = 0;
              weekMap.forEach((weekTotal) => {
                if (weekTotal >= targetValue) {
                  completedWeeks++;
                }
              });
              objectiveProgress.set(entry.objective_id, completedWeeks);
            } else if (challengeData?.challenge_type === "completion") {
              // For completion challenges, count entries (each entry = 1)
              const currentValue = objectiveProgress.get(entry.objective_id) || 0;
              objectiveProgress.set(entry.objective_id, currentValue + 1);
            } else {
              // For other challenges, sum the values
              const currentValue = objectiveProgress.get(entry.objective_id) || 0;
              objectiveProgress.set(entry.objective_id, currentValue + entry.value);
            }
            
            // Check if all objectives are now complete
            let allObjectivesComplete: boolean;
            if (challengeData?.challenge_type === "completion") {
              // For completion challenges, check if user has completed as many days as the challenge has total days
              // Normalize dates to local timezone start of day
              const startDateRaw = new Date(challengeData.startDate);
              const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
              const endDateRaw = new Date(challengeData.endDate);
              const endDate = new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate());
              // Calculate total days inclusive: floor the difference and add 1 for inclusive count
              const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              
              // Calculate total days completed across all objectives
              const totalDaysCompleted = Array.from(objectiveProgress.values()).reduce((sum, value) => sum + value, 0);
              allObjectivesComplete = totalDaysCompleted >= totalDays;
            } else if (challengeData?.challenge_type === "weekly") {
              // For weekly challenges, check if user has completed as many weeks as the challenge has total weeks
              const startDate = new Date(challengeData.startDate);
              const endDate = new Date(challengeData.endDate);
              const totalWeeks = getNumberOfWeeks(startDate, endDate);
              
              // Calculate total weeks completed across all objectives
              const totalWeeksCompleted = Array.from(objectiveProgress.values()).reduce((sum, value) => sum + value, 0);
              allObjectivesComplete = totalWeeksCompleted >= totalWeeks;
            } else {
              // For standard/bingo challenges, use the existing logic
              allObjectivesComplete = challengeObjectives.every(objective => {
                const currentProgress = objectiveProgress.get(objective.id) || 0;
                return currentProgress >= objective.targetValue;
              });
            }
            
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
  }, [entries, participants, capedPoints, challengeData]);

  // Calculate completion order for users who reached 100%
  const completionOrder = useMemo(() => {
    if (!capedPoints || !challengeData) return new Map();
    
    const totalPoints = challengeData.totalPoints || 0;
    const challengeObjectives = challengeData.objectives || [];
    
    if (challengeObjectives.length === 0) return new Map();
    
    // Since the leaderboard is now sorted by completion time, we can derive completion order from position
    const orderMap = new Map();
    
    leaderboard.forEach((entry, index) => {
      // For completion and weekly challenges, check if user has completed as many days/weeks as the challenge has total
      let isCompleted: boolean;
      if (challengeData.challenge_type === "completion") {
        // Normalize dates to local timezone start of day
        const startDateRaw = new Date(challengeData.startDate);
        const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
        const endDateRaw = new Date(challengeData.endDate);
        const endDate = new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate());
        // Calculate total days inclusive: floor the difference and add 1 for inclusive count
        const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        isCompleted = entry.score >= totalDays;
      } else if (challengeData.challenge_type === "weekly") {
        const startDate = new Date(challengeData.startDate);
        const endDate = new Date(challengeData.endDate);
        const totalWeeks = getNumberOfWeeks(startDate, endDate);
        isCompleted = entry.score >= totalWeeks;
      } else {
        isCompleted = entry.score >= totalPoints;
      }
      
      if (isCompleted) {
        // Calculate the actual completion time for this user
        const userEntries = entries.filter(e => e.user_id === entry.userId);
        
        if (userEntries.length === 0) {
          // User has no entries, so no completion time
          return;
        }
        
        const objectiveProgress = new Map<string, number>();
        let completionTime: string | null = null;
        
        // Sort entries by timestamp to track progress chronologically
        const sortedEntries = userEntries.sort((e1, e2) => 
          new Date(e1.created_at).getTime() - new Date(e2.created_at).getTime()
        );
        
        // Track when this user first reached 100% completion
        // For weekly challenges, track progress per week
        const weeklyProgressByObjective = new Map<string, Map<string, number>>(); // objectiveId -> weekId -> total value
        
        for (const entry of sortedEntries) {
          if (challengeData.challenge_type === "weekly") {
            // For weekly challenges, track progress per week per objective
            if (!weeklyProgressByObjective.has(entry.objective_id)) {
              weeklyProgressByObjective.set(entry.objective_id, new Map());
            }
            const weekMap = weeklyProgressByObjective.get(entry.objective_id)!;
            
            const entryDate = new Date(entry.created_at);
            const weekId = getWeekIdentifier(entryDate);
            const weekTotal = weekMap.get(weekId) || 0;
            weekMap.set(weekId, weekTotal + (entry.value || 0));
            
            // Calculate completed weeks for this objective
            const objective = challengeObjectives.find(obj => obj.id === entry.objective_id);
            const targetValue = objective?.targetValue || 1;
            let completedWeeks = 0;
            weekMap.forEach((weekTotal) => {
              if (weekTotal >= targetValue) {
                completedWeeks++;
              }
            });
            objectiveProgress.set(entry.objective_id, completedWeeks);
          } else if (challengeData.challenge_type === "completion") {
            // For completion challenges, count entries (each entry = 1)
            const currentValue = objectiveProgress.get(entry.objective_id) || 0;
            objectiveProgress.set(entry.objective_id, currentValue + 1);
          } else {
            // For other challenges, sum the values
            const currentValue = objectiveProgress.get(entry.objective_id) || 0;
            objectiveProgress.set(entry.objective_id, currentValue + entry.value);
          }
          
          // Check if all objectives are now complete
          let allObjectivesComplete: boolean;
          if (challengeData.challenge_type === "completion") {
            // For completion challenges, check if user has completed as many days as the challenge has total days
            // Normalize dates to local timezone start of day
            const startDateRaw = new Date(challengeData.startDate);
            const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
            const endDateRaw = new Date(challengeData.endDate);
            const endDate = new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate());
            // Calculate total days inclusive: floor the difference and add 1 for inclusive count
            const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            // Calculate total days completed across all objectives
            const totalDaysCompleted = Array.from(objectiveProgress.values()).reduce((sum, value) => sum + value, 0);
            allObjectivesComplete = totalDaysCompleted >= totalDays;
          } else if (challengeData.challenge_type === "weekly") {
            // For weekly challenges, check if user has completed as many weeks as the challenge has total weeks
            const startDate = new Date(challengeData.startDate);
            const endDate = new Date(challengeData.endDate);
            const totalWeeks = getNumberOfWeeks(startDate, endDate);
            
            // Calculate total weeks completed across all objectives
            const totalWeeksCompleted = Array.from(objectiveProgress.values()).reduce((sum, value) => sum + value, 0);
            allObjectivesComplete = totalWeeksCompleted >= totalWeeks;
          } else {
            // For standard/bingo challenges, use the existing logic
            allObjectivesComplete = challengeObjectives.every(objective => {
              const currentProgress = objectiveProgress.get(objective.id) || 0;
              return currentProgress >= objective.targetValue;
            });
          }
          
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
  }, [leaderboard, entries, capedPoints, challengeData]);

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
                     ) : entry.score >= (challengeData?.totalPoints || 0) ? (
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
                        {capedPoints && (() => {
                          // For completion and weekly challenges, check if user has completed as many days/weeks as the challenge has total
                          if (challengeData?.challenge_type === "completion") {
                            // Normalize dates to local timezone start of day
                            const startDateRaw = new Date(challengeData.startDate);
                            const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
                            const endDateRaw = new Date(challengeData.endDate);
                            const endDate = new Date(endDateRaw.getFullYear(), endDateRaw.getMonth(), endDateRaw.getDate());
                            // Calculate total days inclusive: floor the difference and add 1 for inclusive count
                            const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            return entry.score >= totalDays;
                          } else if (challengeData?.challenge_type === "weekly") {
                            const startDate = new Date(challengeData.startDate);
                            const endDate = new Date(challengeData.endDate);
                            const totalWeeks = getNumberOfWeeks(startDate, endDate);
                            return entry.score >= totalWeeks;
                          } else {
                            return entry.score >= (challengeData?.totalPoints || 0);
                          }
                        })() && (!completionInfo || completionInfo.order > 3) && (
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

