import { supabase } from "./supabase";

export type ActivityType = 
  | 'objective_progress'
  | 'challenge_join'
  | 'challenge_complete'
  | 'quest_join'
  | 'quest_complete';

export interface ActivityFeedEntry {
  id: string;
  userId: string;
  activityType: ActivityType;
  challengeId?: number;
  objectiveId?: string;
  chapterId?: string;
  questId?: string;
  questObjectiveId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  // Joined data
  userName?: string;
  challengeTitle?: string;
  objectiveTitle?: string;
  chapterTitle?: string;
  questTitle?: string;
  questObjectiveTitle?: string;
}

export const activityFeedService = {
  /**
   * Create an activity feed entry
   */
  async createActivity(
    userId: string,
    activityType: ActivityType,
    options: {
      challengeId?: number;
      objectiveId?: string;
      chapterId?: string;
      questId?: string;
      questObjectiveId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("activity_feed")
        .insert({
          user_id: userId,
          activity_type: activityType,
          challenge_id: options.challengeId || null,
          objective_id: options.objectiveId || null,
          chapter_id: options.chapterId || null,
          quest_id: options.questId || null,
          quest_objective_id: options.questObjectiveId || null,
          metadata: options.metadata || null,
        });

      if (error) {
        console.error("Error creating activity feed entry:", error);
        // Don't throw - feed entries are non-critical
      }
    } catch (error) {
      console.error("Error creating activity feed entry:", error);
      // Don't throw - feed entries are non-critical
    }
  },

  /**
   * Get activity feed entries
   */
  async getActivityFeed(limit: number = 50, offset: number = 0): Promise<ActivityFeedEntry[]> {
    const { data, error } = await supabase
      .from("activity_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching activity feed:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Fetch related data in parallel
    const userIds = [...new Set(data.map((e: any) => e.user_id))];
    const challengeIds = [...new Set(data.map((e: any) => e.challenge_id).filter(Boolean))];
    const objectiveIds = [...new Set(data.map((e: any) => e.objective_id).filter(Boolean))];
    const chapterIds = [...new Set(data.map((e: any) => e.chapter_id).filter(Boolean))];
    const questIds = [...new Set(data.map((e: any) => e.quest_id).filter(Boolean))];
    const questObjectiveIds = [...new Set(data.map((e: any) => e.quest_objective_id).filter(Boolean))];

    const [users, challenges, objectives, chapters, quests, questObjectives] = await Promise.all([
      userIds.length > 0 ? supabase.from("user_profiles").select("id, name").in("id", userIds) : { data: [] },
      challengeIds.length > 0 ? supabase.from("challenges").select("id, title").in("id", challengeIds) : { data: [] },
      objectiveIds.length > 0 ? supabase.from("objectives").select("id, title").in("id", objectiveIds) : { data: [] },
      chapterIds.length > 0 ? supabase.from("chapters").select("id, title").in("id", chapterIds) : { data: [] },
      questIds.length > 0 ? supabase.from("quests").select("id, title").in("id", questIds) : { data: [] },
      questObjectiveIds.length > 0 ? supabase.from("quest_objectives").select("id, title").in("id", questObjectiveIds) : { data: [] },
    ]);

    const userMap = new Map((users.data || []).map((u: any) => [u.id, u.name]));
    const challengeMap = new Map((challenges.data || []).map((c: any) => [c.id, c.title]));
    const objectiveMap = new Map((objectives.data || []).map((o: any) => [o.id, o.title]));
    const chapterMap = new Map((chapters.data || []).map((ch: any) => [ch.id, ch.title]));
    const questMap = new Map((quests.data || []).map((q: any) => [q.id, q.title]));
    const questObjectiveMap = new Map((questObjectives.data || []).map((qo: any) => [qo.id, qo.title]));

    return data.map((entry: any) => ({
      id: entry.id,
      userId: entry.user_id,
      activityType: entry.activity_type,
      challengeId: entry.challenge_id,
      objectiveId: entry.objective_id,
      chapterId: entry.chapter_id,
      questId: entry.quest_id,
      questObjectiveId: entry.quest_objective_id,
      metadata: entry.metadata,
      createdAt: entry.created_at,
      userName: userMap.get(entry.user_id),
      challengeTitle: entry.challenge_id ? challengeMap.get(entry.challenge_id) : undefined,
      objectiveTitle: entry.objective_id ? objectiveMap.get(entry.objective_id) : undefined,
      chapterTitle: entry.chapter_id ? chapterMap.get(entry.chapter_id) : undefined,
      questTitle: entry.quest_id ? questMap.get(entry.quest_id) : undefined,
      questObjectiveTitle: entry.quest_objective_id ? questObjectiveMap.get(entry.quest_objective_id) : undefined,
    }));
  },

  /**
   * Delete activity feed entry for a deleted challenge entry
   */
  async deleteActivityForEntry(
    userId: string,
    challengeId: number,
    objectiveId: string,
    value: number,
    notes?: string | null
  ): Promise<void> {
    try {
      // First, find matching feed entries
      const { data: feedEntries, error: fetchError } = await supabase
        .from("activity_feed")
        .select("id, metadata")
        .eq("user_id", userId)
        .eq("challenge_id", challengeId)
        .eq("objective_id", objectiveId)
        .eq("activity_type", "objective_progress")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching activity feed entries:", fetchError);
        return;
      }

      if (!feedEntries || feedEntries.length === 0) {
        return;
      }

      // Find the entry that matches the value and notes
      const matchingEntry = feedEntries.find((entry: any) => {
        const metadata = entry.metadata || {};
        const metadataValue = metadata.value;
        const metadataNotes = metadata.notes || null;
        
        // Compare value (handle numeric comparison)
        const valueMatches = Number(metadataValue) === Number(value);
        
        // Compare notes (both null or both match)
        const notesMatch = (metadataNotes === null && (notes === null || notes === undefined)) ||
                          (metadataNotes === (notes || null));

        return valueMatches && notesMatch;
      });

      if (matchingEntry) {
        // Delete the matching feed entry
        const { error: deleteError } = await supabase
          .from("activity_feed")
          .delete()
          .eq("id", matchingEntry.id);

        if (deleteError) {
          console.error("Error deleting activity feed entry:", deleteError);
        }
      }
    } catch (error) {
      console.error("Error deleting activity feed entry:", error);
      // Don't throw - feed entries are non-critical
    }
  },

  /**
   * Delete all activity feed entries for a challenge objective (when resetting progress)
   */
  async deleteActivitiesForObjective(
    userId: string,
    challengeId: number,
    objectiveId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("activity_feed")
        .delete()
        .eq("user_id", userId)
        .eq("challenge_id", challengeId)
        .eq("objective_id", objectiveId)
        .eq("activity_type", "objective_progress");

      if (error) {
        console.error("Error deleting activity feed entries:", error);
        // Don't throw - feed entries are non-critical
      }
    } catch (error) {
      console.error("Error deleting activity feed entries:", error);
      // Don't throw - feed entries are non-critical
    }
  },

  /**
   * Delete activity feed entry for a deleted quest progress entry
   */
  async deleteActivityForQuestEntry(
    userId: string,
    chapterId: string,
    questId: string,
    questObjectiveId: string,
    value: number,
    notes?: string | null
  ): Promise<void> {
    try {
      // First, find matching feed entries
      const { data: feedEntries, error: fetchError } = await supabase
        .from("activity_feed")
        .select("id, metadata")
        .eq("user_id", userId)
        .eq("chapter_id", chapterId)
        .eq("quest_id", questId)
        .eq("quest_objective_id", questObjectiveId)
        .eq("activity_type", "objective_progress")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching activity feed entries:", fetchError);
        return;
      }

      if (!feedEntries || feedEntries.length === 0) {
        return;
      }

      // Find the entry that matches the value and notes
      const matchingEntry = feedEntries.find((entry: any) => {
        const metadata = entry.metadata || {};
        const metadataValue = metadata.value;
        const metadataNotes = metadata.notes || null;
        
        // Compare value (handle numeric comparison)
        const valueMatches = Number(metadataValue) === Number(value);
        
        // Compare notes (both null or both match)
        const notesMatch = (metadataNotes === null && (notes === null || notes === undefined)) ||
                          (metadataNotes === (notes || null));

        return valueMatches && notesMatch;
      });

      if (matchingEntry) {
        // Delete the matching feed entry
        const { error: deleteError } = await supabase
          .from("activity_feed")
          .delete()
          .eq("id", matchingEntry.id);

        if (deleteError) {
          console.error("Error deleting activity feed entry:", deleteError);
        }
      }
    } catch (error) {
      console.error("Error deleting activity feed entry:", error);
      // Don't throw - feed entries are non-critical
    }
  },

  /**
   * Delete all activity feed entries for a user in a specific challenge (when leaving a challenge)
   */
  async deleteActivitiesForChallenge(
    userId: string,
    challengeId: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("activity_feed")
        .delete()
        .eq("user_id", userId)
        .eq("challenge_id", challengeId);

      if (error) {
        console.error("Error deleting activity feed entries for challenge:", error);
        // Don't throw - feed entries are non-critical
      }
    } catch (error) {
      console.error("Error deleting activity feed entries for challenge:", error);
      // Don't throw - feed entries are non-critical
    }
  },

  /**
   * Get activity feed for a specific user
   */
  async getUserActivityFeed(userId: string, limit: number = 50, offset: number = 0): Promise<ActivityFeedEntry[]> {
    const { data, error } = await supabase
      .from("activity_feed")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching user activity feed:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Fetch related data in parallel
    const challengeIds = [...new Set(data.map((e: any) => e.challenge_id).filter(Boolean))];
    const objectiveIds = [...new Set(data.map((e: any) => e.objective_id).filter(Boolean))];
    const chapterIds = [...new Set(data.map((e: any) => e.chapter_id).filter(Boolean))];
    const questIds = [...new Set(data.map((e: any) => e.quest_id).filter(Boolean))];
    const questObjectiveIds = [...new Set(data.map((e: any) => e.quest_objective_id).filter(Boolean))];

    const [user, challenges, objectives, chapters, quests, questObjectives] = await Promise.all([
      supabase.from("user_profiles").select("id, name").eq("id", userId).single(),
      challengeIds.length > 0 ? supabase.from("challenges").select("id, title").in("id", challengeIds) : { data: [] },
      objectiveIds.length > 0 ? supabase.from("objectives").select("id, title").in("id", objectiveIds) : { data: [] },
      chapterIds.length > 0 ? supabase.from("chapters").select("id, title").in("id", chapterIds) : { data: [] },
      questIds.length > 0 ? supabase.from("quests").select("id, title").in("id", questIds) : { data: [] },
      questObjectiveIds.length > 0 ? supabase.from("quest_objectives").select("id, title").in("id", questObjectiveIds) : { data: [] },
    ]);

    const userName = user.data?.name;
    const challengeMap = new Map((challenges.data || []).map((c: any) => [c.id, c.title]));
    const objectiveMap = new Map((objectives.data || []).map((o: any) => [o.id, o.title]));
    const chapterMap = new Map((chapters.data || []).map((ch: any) => [ch.id, ch.title]));
    const questMap = new Map((quests.data || []).map((q: any) => [q.id, q.title]));
    const questObjectiveMap = new Map((questObjectives.data || []).map((qo: any) => [qo.id, qo.title]));

    return data.map((entry: any) => ({
      id: entry.id,
      userId: entry.user_id,
      activityType: entry.activity_type,
      challengeId: entry.challenge_id,
      objectiveId: entry.objective_id,
      chapterId: entry.chapter_id,
      questId: entry.quest_id,
      questObjectiveId: entry.quest_objective_id,
      metadata: entry.metadata,
      createdAt: entry.created_at,
      userName,
      challengeTitle: entry.challenge_id ? challengeMap.get(entry.challenge_id) : undefined,
      objectiveTitle: entry.objective_id ? objectiveMap.get(entry.objective_id) : undefined,
      chapterTitle: entry.chapter_id ? chapterMap.get(entry.chapter_id) : undefined,
      questTitle: entry.quest_id ? questMap.get(entry.quest_id) : undefined,
      questObjectiveTitle: entry.quest_objective_id ? questObjectiveMap.get(entry.quest_objective_id) : undefined,
    }));
  },
};
