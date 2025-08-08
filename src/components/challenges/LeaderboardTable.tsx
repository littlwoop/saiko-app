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

interface LeaderboardTableProps {
  challengeId?: string;
  onUserClick?: (userId: string) => void;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  position: number;
}

interface ChallengeObjective {
  id: string;
  pointsPerUnit: number;
  // plus any other fields in your JSONB
}

interface Challenge {
  id: number;
  objectives: ChallengeObjective[];
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

export default function LeaderboardTable({ challengeId, onUserClick }: LeaderboardTableProps) {
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
      objectives
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
    // Calculate total score for each user
    const userScores = entries.reduce(
      (acc, entry) => {
        // Find the matching objective in the challenge's objectives array
        const matchingObjective = entry.challenge.objectives.find(
          (obj) => obj.id === entry.objective_id
        );

        // Default to 0 if not found
        const pointsPerUnit = matchingObjective?.pointsPerUnit ?? 0;

        // Multiply entry.value by pointsPerUnit
        const totalPoints = entry.value * pointsPerUnit;

        if (!acc[entry.user_id]) {
          acc[entry.user_id] = {
            score: 0,
            username: entry.username,
          };
        }

        acc[entry.user_id].score += totalPoints;

        return acc;
      },
      {} as Record<string, { score: number; username: string }>
    );

    // Create leaderboard entries
    const leaderboardEntries: LeaderboardEntry[] = Object.entries(userScores).map(
      ([userId, data]) => {
        return {
          userId,
          name: data.username,
          score: data.score,
          position: 0, // will be calculated below
        };
      }
    );

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
              <TableRow key={entry.userId} className={isCurrentUser ? 'bg-muted/40' : ''}>
                <TableCell className={`text-center ${getPositionStyle(entry.position)}`}>
                  {entry.position === 1 && '🥇'}
                  {entry.position === 2 && '🥈'}
                  {entry.position === 3 && '🥉'}
                  {entry.position > 3 && entry.position}
                </TableCell>
                <TableCell>
                  <div
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80"
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
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {Math.round(entry.score)} {t('leaderboardPoints')}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
