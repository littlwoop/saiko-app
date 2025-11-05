import { useState, useEffect } from 'react';
import { useChallenges } from '@/contexts/ChallengeContext';
import LeaderboardTable from '@/components/challenges/LeaderboardTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trophy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { Challenge } from '@/types';
import { supabase } from '@/lib/supabase';

export default function LeaderboardPage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [selectedChallenge, setSelectedChallenge] = useState<string | undefined>(undefined);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        setLoading(true);
        const { data: challengesData, error } = await supabase
          .from('challenges')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching challenges:', error);
        } else {
          setChallenges(challengesData || []);
          // Set the most recent challenge as default if no challenge is selected
          if (!selectedChallenge && challengesData && challengesData.length > 0) {
            setSelectedChallenge(challengesData[0].id.toString());
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();
  }, []);

  const handleChallengeChange = (value: string) => {
    setSelectedChallenge(value);
  };

  // Convert selectedChallenge to string for the Select component
  const selectValue = selectedChallenge ? selectedChallenge.toString() : undefined;

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-challenge-purple" />
            <h1 className="text-3xl font-bold">{t('leaderboard')}</h1>
          </div>

          <div className="w-full sm:w-64">
            <Select 
              value={selectValue} 
              onValueChange={handleChallengeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('filterByChallenge')} />
              </SelectTrigger>
              <SelectContent>
                {challenges.map((challenge) => (
                  <SelectItem key={challenge.id} value={challenge.id.toString()}>
                    {challenge.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <LeaderboardTable challengeId={selectedChallenge} />
      </div>
    </div>
  );
}
