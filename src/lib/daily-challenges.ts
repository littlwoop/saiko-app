import { supabase } from './supabase';
import { DailyChallenge, DailyChallengeEntry } from '@/types';
import { getLocalDateString } from './date-utils';

export const dailyChallengesService = {
  // Get a random daily challenge that the user hasn't completed today
  async getTodaysRandomChallenge(userId: string): Promise<DailyChallenge | null> {
    const today = getLocalDateString();
    
    // First, check if there are any active daily challenges at all
    const { data: totalActiveChallenges, error: totalError } = await supabase
      .from('daily_challenges')
      .select('id')
      .eq('is_active', true);

    if (totalError) throw totalError;
    
    console.log('Total active daily challenges in system:', totalActiveChallenges?.length || 0);
    
    // If no active challenges exist, return null
    if (!totalActiveChallenges || totalActiveChallenges.length === 0) {
      console.log('No active daily challenges found in system');
      return null;
    }
    
    // Check if user has any entries for today
    const { data: todaysEntries, error: entriesError } = await supabase
      .from('daily_challenge_entries')
      .select('daily_challenge_id')
      .eq('user_id', userId)
      .eq('completed_date', today);

    if (entriesError) throw entriesError;
    
    console.log('User entries for today:', todaysEntries?.length || 0);
    
    // If user has entries for today, they've completed challenges - show nothing
    if (todaysEntries && todaysEntries.length > 0) {
      console.log('User has completed challenges today, showing completion message');
      return null;
    }
    
    // If no entries for today, get a random active challenge
    const { data: allActiveChallenges, error: challengeError } = await supabase
      .from('daily_challenges')
      .select('*')
      .eq('is_active', true);

    if (challengeError) throw challengeError;
    
    // If no active challenges available, return null
    if (!allActiveChallenges || allActiveChallenges.length === 0) {
      return null;
    }
    
    // Pick a random challenge from all active challenges
    const randomIndex = Math.floor(Math.random() * allActiveChallenges.length);
    const randomChallenge = allActiveChallenges[randomIndex];

    console.log('Random challenge loaded:', randomChallenge?.title || 'none');
    
    // Return the random challenge
    return randomChallenge;
  },

  // Check if user completed today's challenge
  async checkTodaysCompletion(userId: string, dailyChallengeId: string): Promise<boolean> {
    const today = getLocalDateString();
    
    const { data, error } = await supabase
      .from('daily_challenge_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('daily_challenge_id', dailyChallengeId)
      .eq('completed_date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return !!data;
  },

  // Complete a daily challenge
  async completeDailyChallenge(
    userId: string, 
    dailyChallengeId: string, 
    valueAchieved?: number, 
    notes?: string
  ): Promise<DailyChallengeEntry> {
    // Get the challenge to calculate points
    const { data: challenge, error: challengeError } = await supabase
      .from('daily_challenges')
      .select('points')
      .eq('id', dailyChallengeId)
      .single();

    if (challengeError) throw challengeError;

    const { data, error } = await supabase
      .from('daily_challenge_entries')
      .insert({
        user_id: userId,
        daily_challenge_id: dailyChallengeId,
        value_achieved: valueAchieved,
        points_earned: challenge.points,
        notes: notes,
        completed_date: getLocalDateString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get user's daily challenge history
  async getUserDailyChallengeHistory(userId: string, days: number = 30): Promise<DailyChallengeEntry[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('daily_challenge_entries')
      .select(`
        *,
        daily_challenges (
          title,
          description,
          category
        )
      `)
      .eq('user_id', userId)
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};
