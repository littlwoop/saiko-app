import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Check for users with incomplete completion challenges and send push notifications
 * This function should be called periodically (e.g., via cron job)
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in local timezone (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];

    // Get all active completion challenges
    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('id, title, challenge_type, startDate, endDate, is_repeating, participants')
      .eq('challenge_type', 'completion');

    if (challengesError) {
      throw challengesError;
    }

    if (!challenges || challenges.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No completion challenges found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get all user challenge starts for repeating challenges
    const { data: userChallengeStarts } = await supabase
      .from('user_challenge_starts')
      .select('user_id, challenge_id, start_date, end_date');

    const userStartDates = new Map<string, string>();
    const userEndDates = new Map<string, string>();
    if (userChallengeStarts) {
      userChallengeStarts.forEach((start) => {
        const key = `${start.user_id}-${start.challenge_id}`;
        userStartDates.set(key, start.start_date);
        if (start.end_date) {
          userEndDates.set(key, start.end_date);
        }
      });
    }

    const notificationsSent: string[] = [];

    // Process each challenge
    for (const challenge of challenges) {
      if (!challenge.participants || !Array.isArray(challenge.participants)) {
        continue;
      }

      // Get all objectives for this challenge
      const { data: objectives } = await supabase
        .from('objectives')
        .select('id')
        .eq('challenge_id', challenge.id);

      if (!objectives || objectives.length === 0) {
        continue;
      }

      const allObjectiveIds = objectives.map((obj) => obj.id);

      // Check each participant
      for (const userId of challenge.participants) {
        // Determine effective start date
        const startKey = `${userId}-${challenge.id}`;
        const effectiveStartDate = challenge.is_repeating && userStartDates.has(startKey)
          ? new Date(userStartDates.get(startKey)!)
          : challenge.startDate
            ? new Date(challenge.startDate)
            : null;

        if (!effectiveStartDate) continue;

        // Check if challenge is active
        const todayDate = new Date(today);
        if (effectiveStartDate > todayDate) continue; // Not started yet

        // For repeating challenges, use user's end date if available
        // For non-repeating challenges, use challenge's end date
        const endDate = challenge.is_repeating
          ? (userEndDates.has(startKey)
              ? new Date(userEndDates.get(startKey)!)
              : null)
          : challenge.endDate
            ? new Date(challenge.endDate)
            : null;

        if (endDate && endDate < todayDate) continue; // Already ended

        // Get entries for today
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: entries } = await supabase
          .from('entries')
          .select('objective_id')
          .eq('user_id', userId)
          .eq('challenge_id', challenge.id)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());

        const completedObjectives = new Set(
          entries?.map((e) => e.objective_id) || []
        );

        // Check if all objectives are completed
        const allCompleted = allObjectiveIds.every((objId) =>
          completedObjectives.has(objId)
        );

        if (!allCompleted) {
          // Send push notification via the send-push-notification function
          const title =
            challenge.title.length > 50
              ? `${challenge.title.substring(0, 47)}...`
              : challenge.title;
          const body = "Don't forget to complete today's objectives!";

          try {
            const { error: notifyError } = await supabase.functions.invoke(
              'send-push-notification',
              {
                body: {
                  userId,
                  notification: {
                    title: `Complete your challenge: ${title}`,
                    body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'incomplete-challenge',
                    requireInteraction: false,
                    data: {
                      challengeId: challenge.id,
                      type: 'incomplete-challenge',
                    },
                  },
                },
              }
            );

            if (!notifyError) {
              notificationsSent.push(`${userId}-${challenge.id}`);
            }
          } catch (error) {
            console.error(
              `Error sending notification to user ${userId} for challenge ${challenge.id}:`,
              error
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${challenges.length} challenges`,
        notificationsSent: notificationsSent.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-incomplete-challenges function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
