import { supabase } from './supabase';
import { Challenge } from '@/types';
import { getLocalDateString, normalizeToLocalDate, localDateToUTCStart, localDateToUTCEnd, utcTimestampToLocalDateString, getDateRangeUTC } from './date-utils';

export interface IncompleteChallenge {
  challengeId: number;
  challengeTitle: string;
  incompleteDate: string; // YYYY-MM-DD
}

/**
 * Check if a user has incomplete days in their active completion challenges
 * Returns an array of challenges with incomplete days
 */
export async function checkIncompleteCompletionChallenges(
  userId: string
): Promise<IncompleteChallenge[]> {
  try {
    // Get all active completion challenges the user is part of
    const { data: challengesData, error: challengesError } = await supabase
      .from('challenges')
      .select('id, title, challengeType, startDate, endDate, isRepeating, participants')
      .eq('challengeType', 'completion');

    if (challengesError) {
      console.error('Error fetching completion challenges:', challengesError);
      return [];
    }

    if (!challengesData) return [];

    // Filter to challenges where user is a participant
    const userChallenges = challengesData.filter((challenge) => {
      if (!challenge.participants || !Array.isArray(challenge.participants)) {
        return false;
      }
      return challenge.participants.includes(userId);
    });

    // Get user's start date and end date for repeating challenges
    const { data: userChallengeStarts } = await supabase
      .from('user_challenge_starts')
      .select('challenge_id, start_date, end_date')
      .eq('user_id', userId);

    const userStartDates = new Map<number, string>();
    const userEndDates = new Map<number, string>();
    if (userChallengeStarts) {
      userChallengeStarts.forEach((start) => {
        userStartDates.set(start.challenge_id, start.start_date);
        if (start.end_date) {
          userEndDates.set(start.challenge_id, start.end_date);
        }
      });
    }

    const incompleteChallenges: IncompleteChallenge[] = [];
    const today = getLocalDateString();
    const todayDate = normalizeToLocalDate(new Date(today));

    // Check each challenge
    for (const challenge of userChallenges) {
      // Determine the effective start date
      const effectiveStartDate = challenge.isRepeating && userStartDates.has(challenge.id)
        ? normalizeToLocalDate(new Date(userStartDates.get(challenge.id)!))
        : challenge.startDate ? normalizeToLocalDate(new Date(challenge.startDate)) : null;

      if (!effectiveStartDate) continue;

      // For repeating challenges, use user's end date if available
      // For non-repeating challenges, use challenge's end date
      const endDate = challenge.isRepeating 
        ? (userEndDates.has(challenge.id) 
            ? normalizeToLocalDate(new Date(userEndDates.get(challenge.id)!))
            : null)
        : challenge.endDate 
          ? normalizeToLocalDate(new Date(challenge.endDate))
          : null;

      // Only check challenges that are currently active
      // Active means: started and (no end date or end date is in the future)
      if (effectiveStartDate > todayDate) {
        continue; // Challenge hasn't started yet
      }

      if (endDate && endDate < todayDate) {
        continue; // Challenge has ended
      }

      // Only check dates up to today
      const checkEndDate = endDate && endDate < todayDate
        ? endDate
        : todayDate;

      if (effectiveStartDate > checkEndDate) continue;

      // Get all objectives for this challenge
      const { data: objectives, error: objectivesError } = await supabase
        .from('objectives')
        .select('id')
        .eq('challenge_id', challenge.id);

      if (objectivesError || !objectives || objectives.length === 0) {
        continue;
      }

      const allObjectiveIds = new Set(objectives.map((obj) => obj.id));

      // Get all entries for this challenge and user within the date range
      const { startUTC, endUTC } = getDateRangeUTC(effectiveStartDate, checkEndDate);

      const { data: entries, error: entriesError } = await supabase
        .from('entries')
        .select('created_at, objective_id')
        .eq('user_id', userId)
        .eq('challenge_id', challenge.id)
        .gte('created_at', startUTC)
        .lte('created_at', endUTC);

      if (entriesError) {
        console.error(`Error fetching entries for challenge ${challenge.id}:`, entriesError);
        continue;
      }

      // Group entries by date (YYYY-MM-DD) - convert UTC timestamp to local date
      const entriesByDate = new Map<string, Set<string>>();
      if (entries) {
        entries.forEach((entry) => {
          const date = utcTimestampToLocalDateString(entry.created_at);
          if (!entriesByDate.has(date)) {
            entriesByDate.set(date, new Set());
          }
          entriesByDate.get(date)!.add(entry.objective_id);
        });
      }

      // Generate all dates in the range
      const datesToCheck: string[] = [];
      const currentDate = new Date(effectiveStartDate);
      const checkEnd = new Date(checkEndDate);

      while (currentDate <= checkEnd) {
        datesToCheck.push(getLocalDateString(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Check each date to see if all objectives are completed
      for (const date of datesToCheck) {
        const objectiveIdsForDate = entriesByDate.get(date) || new Set();
        
        // Check if all objectives have entries for this date
        const allCompleted = Array.from(allObjectiveIds).every((objId) =>
          objectiveIdsForDate.has(objId)
        );

        if (!allCompleted) {
          // Only include today's incomplete days (or maybe we want all incomplete days?)
          // For now, let's only notify about today to avoid spam
          if (date === today) {
            incompleteChallenges.push({
              challengeId: challenge.id,
              challengeTitle: challenge.title,
              incompleteDate: date,
            });
          }
        }
      }
    }

    return incompleteChallenges;
  } catch (error) {
    console.error('Error checking incomplete completion challenges:', error);
    return [];
  }
}
