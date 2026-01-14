import { supabase } from "./supabase";
import { Chapter, Quest, QuestObjective, UserChapterProgress, QuestProgressEntry } from "@/types";

/**
 * Chapter service for managing chapter data and quest progress
 */
export const questService = {
  /**
   * Get a chapter by ID with all quests and objectives
   */
  async getChapter(chapterId: string): Promise<Chapter | null> {
    // Fetch chapter
    const { data: chapterData, error: chapterError } = await supabase
      .from("chapters")
      .select("*")
      .eq("id", chapterId)
      .single();

    if (chapterError || !chapterData) {
      console.error("Error fetching chapter:", chapterError);
      return null;
    }

    // Fetch quests (formerly quest_steps)
    const { data: questsData, error: questsError } = await supabase
      .from("quests")
      .select("*")
      .eq("chapter_id", chapterId)
      .order("quest_number", { ascending: true });

    if (questsError) {
      console.error("Error fetching quests:", questsError);
      return null;
    }

    // Fetch objectives for all quests
    const questIds = questsData?.map((q) => q.id) || [];
    const { data: objectivesData, error: objectivesError } = await supabase
      .from("quest_objectives")
      .select("*")
      .in("quest_id", questIds)
      .order("order", { ascending: true });

    if (objectivesError) {
      console.error("Error fetching quest objectives:", objectivesError);
      return null;
    }

    // Group objectives by quest
    const objectivesByQuest: Record<string, QuestObjective[]> = {};
    objectivesData?.forEach((obj) => {
      if (!objectivesByQuest[obj.quest_id]) {
        objectivesByQuest[obj.quest_id] = [];
      }
      objectivesByQuest[obj.quest_id].push({
        id: obj.id,
        questId: obj.quest_id,
        title: obj.title,
        description: obj.description || undefined,
        targetValue: obj.target_value !== null ? Number(obj.target_value) : undefined,
        unit: obj.unit || undefined,
        pointsPerUnit: obj.points_per_unit !== null ? Number(obj.points_per_unit) : undefined,
        order: obj.order,
        isBinary: obj.is_binary || false,
      });
    });

    // Build chapter object
    const quests: Quest[] = (questsData || []).map((quest) => ({
      id: quest.id,
      chapterId: quest.chapter_id,
      questNumber: quest.quest_number,
      title: quest.title,
      description: quest.description || undefined,
      completionText: quest.completion_text || undefined,
      completionImageUrl: quest.completion_image_url || undefined,
      imageUrl: quest.image_url || undefined,
      objectives: objectivesByQuest[quest.id] || [],
    }));

    return {
      id: chapterData.id,
      title: chapterData.title,
      description: chapterData.description || undefined,
      chapterNumber: chapterData.chapter_number || undefined,
      questNumber: chapterData.quest_number || undefined, // Legacy field
      imageUrl: chapterData.image_url || undefined,
      introText: chapterData.intro_text || undefined,
      quests,
      createdAt: chapterData.created_at,
      updatedAt: chapterData.updated_at,
    };
  },

  /**
   * Get chapter by chapter number
   */
  async getChapterByNumber(chapterNumber: number): Promise<Chapter | null> {
    const { data: chapterData, error } = await supabase
      .from("chapters")
      .select("id")
      .eq("chapter_number", chapterNumber)
      .single();

    if (error || !chapterData) {
      console.error("Error fetching chapter:", error);
      return null;
    }

    return this.getChapter(chapterData.id);
  },

  /**
   * Get user's progress for a chapter
   */
  async getUserChapterProgress(userId: string, chapterId: string): Promise<UserChapterProgress | null> {
    const { data, error } = await supabase
      .from("user_quest_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("chapter_id", chapterId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No progress found
        return null;
      }
      console.error("Error fetching user chapter progress:", error);
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      chapterId: data.chapter_id,
      currentQuestId: data.current_quest_id || undefined,
      startedAt: data.started_at,
      completedAt: data.completed_at || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Start a chapter for a user
   */
  async startChapter(userId: string, chapterId: string, firstQuestId: string): Promise<UserChapterProgress> {
    // First, ensure any existing progress is deleted (in case of conflicts)
    await supabase
      .from("quest_progress_entries")
      .delete()
      .eq("user_id", userId)
      .eq("chapter_id", chapterId);

    await supabase
      .from("user_quest_progress")
      .delete()
      .eq("user_id", userId)
      .eq("chapter_id", chapterId);

    // Now insert the new progress
    const { data, error } = await supabase
      .from("user_quest_progress")
      .insert({
        user_id: userId,
        chapter_id: chapterId,
        current_quest_id: firstQuestId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error starting chapter:", error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      chapterId: data.chapter_id,
      currentQuestId: data.current_quest_id || undefined,
      startedAt: data.started_at,
      completedAt: data.completed_at || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Update progress for a quest objective
   */
  async updateObjectiveProgress(
    userId: string,
    chapterId: string,
    questId: string,
    questObjectiveId: string,
    value: number,
    notes?: string,
    username?: string
  ): Promise<void> {
    if (value === 0) {
      // Delete entry if value is 0
      const { error } = await supabase
        .from("quest_progress_entries")
        .delete()
        .eq("user_id", userId)
        .eq("chapter_id", chapterId)
        .eq("quest_id", questId)
        .eq("quest_objective_id", questObjectiveId);

      if (error) {
        console.error("Error deleting quest progress entry:", error);
        throw error;
      }
      return;
    }

    // Use upsert to insert or update entry (unique constraint ensures one entry per user/objective)
    const entryData: any = {
      user_id: userId,
      chapter_id: chapterId,
      quest_id: questId,
      quest_objective_id: questObjectiveId,
      value: value,
      notes: notes?.trim() || null,
      username: username || null,
    };

    const { error } = await supabase
      .from("quest_progress_entries")
      .upsert(entryData, {
        onConflict: "user_id,chapter_id,quest_id,quest_objective_id",
      });

    if (error) {
      console.error("Error upserting quest progress entry:", error);
      throw error;
    }
  },

  /**
   * Get progress for a quest objective
   */
  async getObjectiveProgress(
    userId: string,
    questObjectiveId: string
  ): Promise<number> {
    const { data, error } = await supabase
      .from("quest_progress_entries")
      .select("value")
      .eq("user_id", userId)
      .eq("quest_objective_id", questObjectiveId);

    if (error) {
      console.error("Error fetching objective progress:", error);
      return 0;
    }

    // Sum all entry values
    return data?.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0) || 0;
  },

  /**
   * Get all progress entries for a quest
   */
  async getQuestProgress(userId: string, questId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from("quest_progress_entries")
      .select("quest_objective_id, value")
      .eq("user_id", userId)
      .eq("quest_id", questId);

    if (error) {
      console.error("Error fetching quest progress:", error);
      return {};
    }

    // Group by objective ID and sum values
    const progress: Record<string, number> = {};
    data?.forEach((entry) => {
      const objectiveId = entry.quest_objective_id;
      progress[objectiveId] = (progress[objectiveId] || 0) + (Number(entry.value) || 0);
    });

    return progress;
  },

  /**
   * Update the current quest for a user's chapter progress
   */
  async updateCurrentQuest(userId: string, chapterId: string, questId: string): Promise<void> {
    const { error } = await supabase
      .from("user_quest_progress")
      .update({
        current_quest_id: questId,
      })
      .eq("user_id", userId)
      .eq("chapter_id", chapterId);

    if (error) {
      console.error("Error updating current quest:", error);
      throw error;
    }
  },

  /**
   * Complete a quest and move to next quest
   */
  async completeQuest(userId: string, chapterId: string, currentQuestId: string, nextQuestId?: string): Promise<void> {
    const updateData: any = {
      current_quest_id: nextQuestId || null,
    };

    // If no next quest, mark chapter as completed
    if (!nextQuestId) {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("user_quest_progress")
      .update(updateData)
      .eq("user_id", userId)
      .eq("chapter_id", chapterId);

    if (error) {
      console.error("Error completing quest:", error);
      throw error;
    }
  },

  /**
   * Reset chapter progress for a user (delete all progress entries and user progress)
   * TODO: Remove this function and button later
   */
  async resetChapterProgress(userId: string, chapterId: string): Promise<void> {
    // First, check if record exists
    const { data: existingProgress } = await supabase
      .from("user_quest_progress")
      .select("id, user_id, chapter_id")
      .eq("user_id", userId)
      .eq("chapter_id", chapterId)
      .maybeSingle();

    if (!existingProgress) {
      console.log("No user_quest_progress record found to delete");
    } else {
      console.log("Found user_quest_progress record to delete:", existingProgress);
    }

    // Delete user chapter progress FIRST (this is critical)
    const { data: deletedProgress, error: progressError } = await supabase
      .from("user_quest_progress")
      .delete()
      .eq("user_id", userId)
      .eq("chapter_id", chapterId)
      .select();

    if (progressError) {
      console.error("Error deleting user chapter progress:", progressError);
      console.error("Error details:", {
        code: progressError.code,
        message: progressError.message,
        details: progressError.details,
        hint: progressError.hint,
      });
      throw new Error(`Failed to delete user_quest_progress: ${progressError.message} (Code: ${progressError.code})`);
    }

    console.log(`Deleted ${deletedProgress?.length || 0} user_quest_progress record(s)`, deletedProgress);

    // Now delete all progress entries for this chapter
    const { data: deletedEntries, error: entriesError } = await supabase
      .from("quest_progress_entries")
      .delete()
      .eq("user_id", userId)
      .eq("chapter_id", chapterId)
      .select();

    if (entriesError) {
      console.error("Error deleting quest progress entries:", entriesError);
      // Don't throw - entries might not exist, which is fine
    } else {
      console.log(`Deleted ${deletedEntries?.length || 0} quest_progress_entries record(s)`);
    }

    // Verify deletion - check user_quest_progress
    const { data: remainingProgress, error: checkProgressError } = await supabase
      .from("user_quest_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("chapter_id", chapterId)
      .maybeSingle();

    if (checkProgressError && checkProgressError.code !== "PGRST116") {
      console.error("Error checking remaining progress:", checkProgressError);
    }

    if (remainingProgress) {
      console.error("ERROR: User chapter progress still exists after deletion!", remainingProgress);
      throw new Error("Failed to delete user_quest_progress entry");
    }

    // Verify entries deletion
    const { data: remainingEntries, error: checkEntriesError } = await supabase
      .from("quest_progress_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("chapter_id", chapterId)
      .limit(1);

    if (checkEntriesError && checkEntriesError.code !== "PGRST116") {
      console.error("Error checking remaining entries:", checkEntriesError);
    }

    if (remainingEntries && remainingEntries.length > 0) {
      console.warn("Warning: Some progress entries still exist after deletion:", remainingEntries.length);
    }

    console.log("Chapter progress reset completed successfully");
  },
};
