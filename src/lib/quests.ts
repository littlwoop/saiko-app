import { supabase } from "./supabase";
import { Quest, QuestStep, QuestObjective, UserQuestProgress, QuestProgressEntry } from "@/types";

/**
 * Quest service for managing quest data and progress
 */
export const questService = {
  /**
   * Get a quest by ID with all steps and objectives
   */
  async getQuest(questId: string): Promise<Quest | null> {
    // Fetch quest
    const { data: questData, error: questError } = await supabase
      .from("quests")
      .select("*")
      .eq("id", questId)
      .single();

    if (questError || !questData) {
      console.error("Error fetching quest:", questError);
      return null;
    }

    // Fetch quest steps
    const { data: stepsData, error: stepsError } = await supabase
      .from("quest_steps")
      .select("*")
      .eq("quest_id", questId)
      .order("step_number", { ascending: true });

    if (stepsError) {
      console.error("Error fetching quest steps:", stepsError);
      return null;
    }

    // Fetch objectives for all steps
    const stepIds = stepsData?.map((s) => s.id) || [];
    const { data: objectivesData, error: objectivesError } = await supabase
      .from("quest_objectives")
      .select("*")
      .in("quest_step_id", stepIds)
      .order("order", { ascending: true });

    if (objectivesError) {
      console.error("Error fetching quest objectives:", objectivesError);
      return null;
    }

    // Group objectives by step
    const objectivesByStep: Record<string, QuestObjective[]> = {};
    objectivesData?.forEach((obj) => {
      if (!objectivesByStep[obj.quest_step_id]) {
        objectivesByStep[obj.quest_step_id] = [];
      }
      objectivesByStep[obj.quest_step_id].push({
        id: obj.id,
        questStepId: obj.quest_step_id,
        title: obj.title,
        description: obj.description || undefined,
        targetValue: obj.target_value !== null ? Number(obj.target_value) : undefined,
        unit: obj.unit || undefined,
        pointsPerUnit: obj.points_per_unit !== null ? Number(obj.points_per_unit) : undefined,
        order: obj.order,
      });
    });

    // Build quest object
    const steps: QuestStep[] = (stepsData || []).map((step) => ({
      id: step.id,
      questId: step.quest_id,
      stepNumber: step.step_number,
      title: step.title,
      description: step.description || undefined,
      completionText: step.completion_text || undefined,
      completionImageUrl: step.completion_image_url || undefined,
      objectives: objectivesByStep[step.id] || [],
    }));

    return {
      id: questData.id,
      title: questData.title,
      description: questData.description || undefined,
      chapterNumber: questData.chapter_number || undefined,
      questNumber: questData.quest_number || undefined,
      imageUrl: questData.image_url || undefined,
      introText: questData.intro_text || undefined,
      steps,
      createdAt: questData.created_at,
      updatedAt: questData.updated_at,
    };
  },

  /**
   * Get quest by chapter and quest number
   */
  async getQuestByChapterAndNumber(chapterNumber: number, questNumber: number): Promise<Quest | null> {
    const { data: questData, error } = await supabase
      .from("quests")
      .select("id")
      .eq("chapter_number", chapterNumber)
      .eq("quest_number", questNumber)
      .single();

    if (error || !questData) {
      console.error("Error fetching quest:", error);
      return null;
    }

    return this.getQuest(questData.id);
  },

  /**
   * Get user's progress for a quest
   */
  async getUserQuestProgress(userId: string, questId: string): Promise<UserQuestProgress | null> {
    const { data, error } = await supabase
      .from("user_quest_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("quest_id", questId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No progress found
        return null;
      }
      console.error("Error fetching user quest progress:", error);
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      questId: data.quest_id,
      currentStepId: data.current_step_id || undefined,
      startedAt: data.started_at,
      completedAt: data.completed_at || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Start a quest for a user
   */
  async startQuest(userId: string, questId: string, firstStepId: string): Promise<UserQuestProgress> {
    // First, ensure any existing progress is deleted (in case of conflicts)
    await supabase
      .from("quest_progress_entries")
      .delete()
      .eq("user_id", userId)
      .eq("quest_id", questId);

    await supabase
      .from("user_quest_progress")
      .delete()
      .eq("user_id", userId)
      .eq("quest_id", questId);

    // Now insert the new progress
    const { data, error } = await supabase
      .from("user_quest_progress")
      .insert({
        user_id: userId,
        quest_id: questId,
        current_step_id: firstStepId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error starting quest:", error);
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      questId: data.quest_id,
      currentStepId: data.current_step_id || undefined,
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
    questId: string,
    questStepId: string,
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
        .eq("quest_id", questId)
        .eq("quest_step_id", questStepId)
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
      quest_id: questId,
      quest_step_id: questStepId,
      quest_objective_id: questObjectiveId,
      value: value,
      notes: notes?.trim() || null,
      username: username || null,
    };

    const { error } = await supabase
      .from("quest_progress_entries")
      .upsert(entryData, {
        onConflict: "user_id,quest_id,quest_step_id,quest_objective_id",
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
   * Get all progress entries for a quest step
   */
  async getStepProgress(userId: string, questStepId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from("quest_progress_entries")
      .select("quest_objective_id, value")
      .eq("user_id", userId)
      .eq("quest_step_id", questStepId);

    if (error) {
      console.error("Error fetching step progress:", error);
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
   * Update the current step for a user's quest progress
   */
  async updateCurrentStep(userId: string, questId: string, stepId: string): Promise<void> {
    const { error } = await supabase
      .from("user_quest_progress")
      .update({
        current_step_id: stepId,
      })
      .eq("user_id", userId)
      .eq("quest_id", questId);

    if (error) {
      console.error("Error updating current step:", error);
      throw error;
    }
  },

  /**
   * Complete a quest step and move to next step
   */
  async completeStep(userId: string, questId: string, currentStepId: string, nextStepId?: string): Promise<void> {
    const updateData: any = {
      current_step_id: nextStepId || null,
    };

    // If no next step, mark quest as completed
    if (!nextStepId) {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("user_quest_progress")
      .update(updateData)
      .eq("user_id", userId)
      .eq("quest_id", questId);

    if (error) {
      console.error("Error completing quest step:", error);
      throw error;
    }
  },

  /**
   * Reset quest progress for a user (delete all progress entries and user progress)
   * TODO: Remove this function and button later
   */
  async resetQuestProgress(userId: string, questId: string): Promise<void> {
    // First, check if record exists
    const { data: existingProgress } = await supabase
      .from("user_quest_progress")
      .select("id, user_id, quest_id")
      .eq("user_id", userId)
      .eq("quest_id", questId)
      .maybeSingle();

    if (!existingProgress) {
      console.log("No user_quest_progress record found to delete");
    } else {
      console.log("Found user_quest_progress record to delete:", existingProgress);
    }

    // Delete user quest progress FIRST (this is critical)
    const { data: deletedProgress, error: progressError } = await supabase
      .from("user_quest_progress")
      .delete()
      .eq("user_id", userId)
      .eq("quest_id", questId)
      .select();

    if (progressError) {
      console.error("Error deleting user quest progress:", progressError);
      console.error("Error details:", {
        code: progressError.code,
        message: progressError.message,
        details: progressError.details,
        hint: progressError.hint,
      });
      throw new Error(`Failed to delete user_quest_progress: ${progressError.message} (Code: ${progressError.code})`);
    }

    console.log(`Deleted ${deletedProgress?.length || 0} user_quest_progress record(s)`, deletedProgress);

    // Now delete all progress entries for this quest
    const { data: deletedEntries, error: entriesError } = await supabase
      .from("quest_progress_entries")
      .delete()
      .eq("user_id", userId)
      .eq("quest_id", questId)
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
      .eq("quest_id", questId)
      .maybeSingle();

    if (checkProgressError && checkProgressError.code !== "PGRST116") {
      console.error("Error checking remaining progress:", checkProgressError);
    }

    if (remainingProgress) {
      console.error("ERROR: User quest progress still exists after deletion!", remainingProgress);
      throw new Error("Failed to delete user_quest_progress entry");
    }

    // Verify entries deletion
    const { data: remainingEntries, error: checkEntriesError } = await supabase
      .from("quest_progress_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("quest_id", questId)
      .limit(1);

    if (checkEntriesError && checkEntriesError.code !== "PGRST116") {
      console.error("Error checking remaining entries:", checkEntriesError);
    }

    if (remainingEntries && remainingEntries.length > 0) {
      console.warn("Warning: Some progress entries still exist after deletion:", remainingEntries.length);
    }

    console.log("Quest progress reset completed successfully");
  },
};
