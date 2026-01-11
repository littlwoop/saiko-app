// Supabase Edge Function for daily challenge reminders
// This function should be called by a cron job daily at 18:00
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Check if a completion challenge is completed for a specific date
 */
async function isCompletionChallengeCompleted(
  supabaseClient: any,
  userId: string,
  challengeId: number,
  date: string
): Promise<boolean> {
  try {
    // Get the challenge with objectives
    const { data: challenge, error: challengeError } = await supabaseClient
      .from("challenges")
      .select("objectives, start_date, end_date")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) {
      console.error("Error fetching challenge:", challengeError);
      return true; // Assume completed if we can't check
    }

    // Check if challenge is active on this date
    const checkDate = new Date(date + "T00:00:00");
    const startDate = new Date(challenge.start_date + "T00:00:00");
    const endDate = challenge.end_date
      ? new Date(challenge.end_date + "T00:00:00")
      : null;

    if (checkDate < startDate || (endDate && checkDate > endDate)) {
      return true; // Not active on this date, consider "completed"
    }

    // Parse objectives
    let objectives: Array<{ id: string | number }>;
    if (typeof challenge.objectives === "string") {
      objectives = JSON.parse(challenge.objectives);
    } else if (Array.isArray(challenge.objectives)) {
      objectives = challenge.objectives;
    } else {
      return true; // Invalid format, assume completed
    }

    if (!objectives || objectives.length === 0) {
      return true; // No objectives, consider completed
    }

    // Get UTC date range for the specific date
    const dateStartUTC = new Date(date + "T00:00:00").toISOString();
    const dateEndUTC = new Date(date + "T23:59:59").toISOString();

    // Get all entries for this challenge and user on this date
    const { data: entries, error: entriesError } = await supabaseClient
      .from("entries")
      .select("objective_id, created_at")
      .eq("user_id", userId)
      .eq("challenge_id", challengeId)
      .gte("created_at", dateStartUTC)
      .lte("created_at", dateEndUTC);

    if (entriesError) {
      console.error("Error fetching entries:", entriesError);
      return true; // Assume completed if we can't check
    }

    if (!entries || entries.length === 0) {
      return false; // No entries for this date
    }

    // Get objective IDs that have entries for this date
    const objectiveIds = new Set<string>(
      objectives.map((obj) => String(obj.id || obj))
    );
    const objectivesWithEntries = new Set<string>(
      entries.map((entry: any) => String(entry.objective_id))
    );

    // Check if all objectives have entries
    for (const objectiveId of objectiveIds) {
      if (!objectivesWithEntries.has(objectiveId)) {
        return false; // Missing entry for this objective
      }
    }

    return true; // All objectives have entries
  } catch (error) {
    console.error("Error checking completion challenge:", error);
    return true; // Assume completed on error
  }
}

/**
 * Get active completion challenges for a user
 */
async function getActiveCompletionChallenges(
  supabaseClient: any,
  userId: string,
  today: string
): Promise<Array<{ id: number; title: string }>> {
  try {
    const { data: challenges, error } = await supabaseClient
      .from("challenges")
      .select("id, title, challenge_type, start_date, end_date, participants")
      .eq("challenge_type", "completion")
      .contains("participants", JSON.stringify([userId]));

    if (error) {
      console.error("Error fetching completion challenges:", error);
      return [];
    }

    if (!challenges) return [];

    const todayDate = new Date(today + "T00:00:00");

    // Filter for active challenges
    return challenges
      .filter((challenge: any) => {
        const startDate = new Date(challenge.start_date + "T00:00:00");
        const endDate = challenge.end_date
          ? new Date(challenge.end_date + "T00:00:00")
          : null;

        return (
          todayDate >= startDate && (!endDate || todayDate <= endDate)
        );
      })
      .map((challenge: any) => ({
        id: challenge.id,
        title: challenge.title,
      }));
  } catch (error) {
    console.error("Error getting active completion challenges:", error);
    return [];
  }
}

/**
 * Send push notification using the send-push-notification function
 */
async function sendPushNotificationToUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({
          userId,
          title,
          body,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Error sending push notification:", error);
    }
  } catch (error) {
    console.error("Error calling send-push-notification:", error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify cron secret for security
    const cronSecret = req.headers.get("authorization");
    const expectedSecret = Deno.env.get("CRON_SECRET");

    if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Get all users with push subscriptions
    // Get unique user IDs that have push subscriptions
    const { data: subscriptions, error: subsError } = await supabaseClient
      .from("push_subscriptions")
      .select("user_id");

    if (subsError) {
      console.error("Error fetching push subscriptions:", subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push subscriptions found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get unique user IDs
    const userIds = subscriptions
      ? [...new Set(subscriptions.map((sub: any) => sub.user_id))]
      : [];

    let notificationsSent = 0;
    let usersChecked = 0;

    // Check each user for incomplete challenges
    for (const userId of userIds) {
      try {
        // Get active completion challenges
        const activeChallenges = await getActiveCompletionChallenges(
          supabaseClient,
          userId,
          today
        );

        if (activeChallenges.length === 0) {
          continue; // No active challenges, skip
        }

        // Check which challenges are incomplete
        const incompleteChallenges: Array<{ id: number; title: string }> = [];

        for (const challenge of activeChallenges) {
          const isCompleted = await isCompletionChallengeCompleted(
            supabaseClient,
            userId,
            challenge.id,
            today
          );

          if (!isCompleted) {
            incompleteChallenges.push(challenge);
          }
        }

        // Send notification if there are incomplete challenges
        if (incompleteChallenges.length > 0) {
          const challengeCount = incompleteChallenges.length;
          const title =
            challengeCount === 1
              ? "Daily Challenge Reminder"
              : `${challengeCount} Daily Challenge Reminders`;

          const body =
            challengeCount === 1
              ? `Don't forget to complete today's challenge: ${incompleteChallenges[0].title}`
              : `Don't forget to complete your ${challengeCount} daily challenge${challengeCount > 1 ? "s" : ""} today`;

          await sendPushNotificationToUser(
            supabaseUrl,
            serviceRoleKey,
            userId,
            title,
            body
          );

          notificationsSent++;
        }

        usersChecked++;
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        // Continue with next user
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        usersChecked,
        notificationsSent,
        date: today,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in daily-challenge-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
