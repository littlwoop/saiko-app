import { createContext, useContext, ReactNode } from "react";
import { Challenge, Objective, UserChallenge, UserProgress, ChallengeType } from "@/types";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { dailyChallengesService } from "@/lib/daily-challenges";
import { useTranslation } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";
import { calculateTotalPoints } from "@/lib/points";
import { getNumberOfWeeks, getWeekIdentifier } from "@/lib/week-utils";
import { v4 as uuidv4, validate as validateUUID } from "uuid";
import { utcTimestampToLocalDateString, localDateToUTCStart, localDateToUTCEnd, getLocalDateFromString } from "@/lib/date-utils";

interface ChallengeContextType {
  createChallenge: (
    challenge: Omit<
      Challenge,
      "id" | "createdById" | "creatorName" | "participants" | "totalPoints"
    >,
  ) => Promise<void>;
  updateChallenge: (
    challengeId: number,
    challenge: Omit<
      Challenge,
      "id" | "createdById" | "creatorName" | "participants" | "totalPoints"
    >,
  ) => Promise<void>;
  joinChallenge: (challengeId: number) => Promise<void>;
  leaveChallenge: (challengeId: number) => Promise<void>;
  updateProgress: (
    challengeId: number,
    objectiveId: string,
    value: number,
    notes?: string,
    completionDate?: string,
  ) => Promise<void>;
  getChallenge: (challengeId: number) => Promise<Challenge | null>;
  getUserChallenges: () => Promise<UserChallenge[]>;
  getChallengeProgress: (challengeId: number, challengeType?: ChallengeType) => Promise<UserProgress[]>;
  createMockBingoChallenge: () => Promise<void>;
  getParticipantProgress: (
    challengeId: number,
    userId: string,
  ) => Promise<UserProgress[]>;
  getParticipants: (
    challengeId: number,
  ) => Promise<Array<{ id: string; name: string; avatar?: string }>>;
  getCreatorAvatar: (userId: string) => Promise<string | undefined>;
  getUserChallengeStartDate: (challengeId: number, userId: string) => Promise<string | null>;
  getUserChallengeEndDate: (challengeId: number, userId: string) => Promise<string | null>;
  getUserActivityDates: (startDate: string, endDate: string) => Promise<string[]>;
  completeDailyChallenge: (dailyChallengeId: string, valueAchieved?: number, notes?: string) => Promise<void>;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(
  undefined,
);

interface Entry {
  id: string;
  user_id: string;
  challenge_id: number;
  objective_id: string;
  value: number;
  created_at: string;
  notes?: string;
}

export const ChallengeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Get a single challenge by ID
  const getChallenge = async (
    challengeId: number,
  ): Promise<Challenge | null> => {
    try {
      // Fetch challenge data
      const { data: challengeData, error: challengeError } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single();

      if (challengeError) {
        toast({
          title: "Error",
          description: challengeError.message,
          variant: "destructive",
        });
        return null;
      }

      if (!challengeData) {
        return null;
      }

      // Fetch objectives from the objectives table
      const { data: objectivesData, error: objectivesError } = await supabase
        .from("objectives")
        .select("*")
        .eq("challenge_id", challengeId)
        .order("order", { ascending: true });

      let objectives: Objective[] = [];

      if (objectivesError) {
        // Fallback to JSON field for backward compatibility
        if (challengeData.objectives && Array.isArray(challengeData.objectives)) {
          objectives = challengeData.objectives;
        }
      } else if (objectivesData && objectivesData.length > 0) {
        // Convert database format to Objective interface
        objectives = objectivesData.map((obj) => ({
          id: obj.id,
          title: obj.title,
          description: obj.description || undefined,
          targetValue: obj.target_value !== null ? Number(obj.target_value) : undefined,
          unit: obj.unit || undefined,
          pointsPerUnit: obj.points_per_unit !== null ? Number(obj.points_per_unit) : undefined,
        }));
      } else {
        // Fallback to JSON field if no objectives in table
        if (challengeData.objectives && Array.isArray(challengeData.objectives)) {
          objectives = challengeData.objectives;
        }
      }

      // Ensure participants is always an array
      const participants = Array.isArray(challengeData.participants) ? challengeData.participants : [];
      
      const result = {
        ...challengeData,
        objectives,
        participants,
        // Supabase automatically maps snake_case to camelCase, so check both
        isRepeating: challengeData.is_repeating !== undefined ? challengeData.is_repeating : (challengeData.isRepeating || false),
        isCollaborative: challengeData.is_collaborative !== undefined ? challengeData.is_collaborative : (challengeData.isCollaborative || false),
        // Map database field names to TypeScript interface (check both formats for compatibility)
        startDate: challengeData.start_date || challengeData.startDate || "",
        endDate: challengeData.end_date || challengeData.endDate || undefined,
      };

      return result;
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load challenge",
        variant: "destructive",
      });
      return null;
    }
  };

  // Get all challenges for the current user
  const getUserChallenges = async (): Promise<UserChallenge[]> => {
    if (!user) return [];

    try {
      // Fetch all challenges and filter for those where user is a participant
      // This is necessary because Supabase's .contains() doesn't work for checking
      // if a JSONB array contains a specific value
      const { data: challengesData, error: challengesError } = await supabase
        .from("challenges")
        .select("*");

      if (challengesError) {
        toast({
          title: "Error",
          description: challengesError.message,
          variant: "destructive",
        });
        return [];
      }

      // Filter challenges where user is in participants array
      const userChallengesData = (challengesData || []).filter((challenge) => {
        const participants = Array.isArray(challenge.participants) ? challenge.participants : [];
        return participants.includes(user.id);
      });

      // Fetch objectives for all challenges
      const challengeIds = userChallengesData.map((c) => c.id);
      const { data: allObjectivesData } = await supabase
        .from("objectives")
        .select("*")
        .in("challenge_id", challengeIds)
        .order("challenge_id", { ascending: true })
        .order("order", { ascending: true });

      // Group objectives by challenge_id
      const objectivesByChallenge: Record<number, Objective[]> = {};
      if (allObjectivesData) {
        allObjectivesData.forEach((obj) => {
          if (!objectivesByChallenge[obj.challenge_id]) {
            objectivesByChallenge[obj.challenge_id] = [];
          }
          objectivesByChallenge[obj.challenge_id].push({
            id: obj.id,
            title: obj.title,
            description: obj.description || undefined,
            targetValue: obj.target_value !== null ? Number(obj.target_value) : undefined,
            unit: obj.unit || undefined,
            pointsPerUnit: obj.points_per_unit !== null ? Number(obj.points_per_unit) : undefined,
          });
        });
      }
      
      // Calculate actual progress for each challenge
      const userChallengesWithProgress = await Promise.all(
        userChallengesData.map(async (challenge) => {
          // Use objectives from table, fallback to JSON field
          const objectives = objectivesByChallenge[challenge.id] || 
                            (Array.isArray(challenge.objectives) ? challenge.objectives : []);
          
          const progress = await getChallengeProgress(challenge.id, challenge.challenge_type);
          const totalScore = calculateTotalPoints(
            objectives,
            progress,
            challenge.capedPoints,
            challenge.challenge_type
          );
          
          return {
            userId: user.id,
            challengeId: challenge.id,
            joinedAt: new Date().toISOString(),
            totalScore,
          };
        })
      );

      return userChallengesWithProgress;
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load user challenges",
        variant: "destructive",
      });
      return [];
    }
  };

  // Get progress for a specific challenge
  const getChallengeProgress = async (
    challengeId: number,
    challengeType?: ChallengeType,
  ): Promise<UserProgress[]> => {
    if (!user) return [];

    try {
      // Get challenge to check if it's collaborative
      const challenge = await getChallenge(challengeId);
      const isCollaborative = challenge?.isCollaborative || false;

      // For collaborative challenges, fetch entries from all participants
      // For non-collaborative, only fetch current user's entries
      let query = supabase
        .from("entries")
        .select("*")
        .eq("challenge_id", challengeId);
      
      if (!isCollaborative) {
        query = query.eq("user_id", user.id);
      }
      
      const { data: entriesData, error: entriesError } = await query
        .order("created_at", { ascending: false })
        .returns<Entry[]>();

      if (entriesError) {
        toast({
          title: "Error",
          description: "Failed to load progress data",
          variant: "destructive",
        });
        return [];
      }

      if (entriesData) {
        // Get challenge data to access objectives and their targetValues
        const challengeData = challenge || await getChallenge(challengeId);
        if (!challengeData) return [];

        // For weekly challenges, we need to count only completed weeks (where target is met)
        if (challengeType === "weekly") {
          // For collaborative challenges, use a special userId to indicate collective progress
          const collectiveUserId = isCollaborative ? "collective" : user.id;

          // Group entries by objective and week, then count only completed weeks
          const progressMap: Record<string, UserProgress> = {};
          const weekProgressMap: Record<string, Record<string, number>> = {}; // objectiveId -> weekId -> total value

          entriesData.forEach((entry) => {
            const key = `${entry.challenge_id}-${entry.objective_id}`;
            if (!progressMap[key]) {
              progressMap[key] = {
                userId: collectiveUserId,
                challengeId: entry.challenge_id,
                objectiveId: entry.objective_id,
                currentValue: 0,
              };
            }

            // Get the week identifier for this entry
            const entryDate = new Date(entry.created_at);
            const weekId = getWeekIdentifier(entryDate);

            // Initialize week progress tracking for this objective
            if (!weekProgressMap[entry.objective_id]) {
              weekProgressMap[entry.objective_id] = {};
            }
            if (!weekProgressMap[entry.objective_id][weekId]) {
              weekProgressMap[entry.objective_id][weekId] = 0;
            }

            // Sum values for this week
            weekProgressMap[entry.objective_id][weekId] += entry.value || 0;
          });

          // Count only weeks where target is met
          // Initialize progress for all objectives, even if they have no entries
          challenge.objectives.forEach((objective) => {
            const key = `${challengeId}-${objective.id}`;
            const targetValue = objective.targetValue || 1;
            const weeksForObjective = weekProgressMap[objective.id] || {};

            // Initialize progress entry if it doesn't exist
            if (!progressMap[key]) {
              progressMap[key] = {
                userId: collectiveUserId,
                challengeId: challengeId,
                objectiveId: objective.id,
                currentValue: 0,
              };
            }

            // Count only weeks where target is met
            let completedWeeks = 0;
            Object.values(weeksForObjective).forEach((weekTotal) => {
              if (weekTotal >= targetValue) {
                completedWeeks++;
              }
            });

            progressMap[key].currentValue = completedWeeks;
          });

          const progress = Object.values(progressMap);
          return progress;
        }

        // For completion challenges, count unique days per objective
        if (challengeType === "completion") {
          const progressMap: Record<string, UserProgress> = {};
          const dayProgressMap: Record<string, Set<string>> = {}; // objectiveId -> Set of day strings
          // For collaborative challenges, use a special userId to indicate collective progress
          const collectiveUserId = isCollaborative ? "collective" : user.id;

          entriesData.forEach((entry) => {
            const key = `${entry.challenge_id}-${entry.objective_id}`;
            if (!progressMap[key]) {
              progressMap[key] = {
                userId: collectiveUserId,
                challengeId: entry.challenge_id,
                objectiveId: entry.objective_id,
                currentValue: 0,
              };
            }

            // Get the date string (YYYY-MM-DD) for this entry (in local timezone)
            const dayString = utcTimestampToLocalDateString(entry.created_at);

            // Initialize day tracking for this objective if needed
            if (!dayProgressMap[entry.objective_id]) {
              dayProgressMap[entry.objective_id] = new Set();
            }

            // Add this day to the set (Set automatically handles duplicates)
            dayProgressMap[entry.objective_id].add(dayString);
          });

          // Initialize progress for all objectives and count unique days
          challengeData.objectives.forEach((objective) => {
            const key = `${challengeId}-${objective.id}`;
            if (!progressMap[key]) {
              progressMap[key] = {
                userId: collectiveUserId,
                challengeId: challengeId,
                objectiveId: objective.id,
                currentValue: 0,
              };
            }

            // Count unique days for this objective
            const uniqueDays = dayProgressMap[objective.id]?.size || 0;
            progressMap[key].currentValue = uniqueDays;
          });

          const progress = Object.values(progressMap);
          return progress;
        }

        // For other challenge types, use the original logic
        const progressMap = entriesData.reduce(
          (acc, entry) => {
            const key = `${entry.challenge_id}-${entry.objective_id}`;
            if (!acc[key]) {
              acc[key] = {
                userId: entry.user_id,
                challengeId: entry.challenge_id,
                objectiveId: entry.objective_id,
                currentValue: 0,
              };
            }
            // Sum values for standard/bingo challenges
            acc[key].currentValue += entry.value || 0;
            return acc;
          },
          {} as Record<string, UserProgress>,
        );

        const progress = Object.values(progressMap);
        return progress;
      }

      return [];
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load challenge progress",
        variant: "destructive",
      });
      return [];
    }
  };

  // Create a new challenge
  const createChallenge = async (
    challengeData: Omit<
      Challenge,
      "id" | "createdById" | "creatorName" | "participants" | "totalPoints"
    >,
  ) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a challenge",
        variant: "destructive",
      });
      return;
    }

    // Calculate total points based on challenge type
    let totalPoints: number;
    if (challengeData.isRepeating) {
      // For repeating challenges, use a default large number since there's no end date
      if (challengeData.challenge_type === "completion") {
        const pointsPerDay = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = 365 * pointsPerDay;
      } else if (challengeData.challenge_type === "weekly") {
        const pointsPerWeek = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = 52 * pointsPerWeek;
      } else if (challengeData.challenge_type === "checklist" || challengeData.challenge_type === "collection") {
        totalPoints = challengeData.objectives.length;
      } else {
        totalPoints = challengeData.objectives.reduce((total, objective) => {
          return total + (objective.targetValue || 0) * (objective.pointsPerUnit || 0);
        }, 0);
      }
    } else if (challengeData.challenge_type === "completion") {
      // For completion challenges, total points = number of days * points per day
      const startDate = challengeData.startDate ? new Date(challengeData.startDate) : null;
      const endDate = challengeData.endDate ? new Date(challengeData.endDate) : null;
      
      if (startDate && endDate) {
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        // Use the first objective's pointsPerUnit as the points per day
        const pointsPerDay = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = daysDiff * pointsPerDay;
      } else {
        // For ongoing completion challenges, use a default large number of days (e.g., 365)
        const pointsPerDay = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = 365 * pointsPerDay;
      }
    } else if (challengeData.challenge_type === "weekly") {
      // For weekly challenges, total points = number of weeks * points per week
      const startDate = challengeData.startDate ? new Date(challengeData.startDate) : null;
      const endDate = challengeData.endDate ? new Date(challengeData.endDate) : null;
      
      if (startDate && endDate) {
        const weeksCount = getNumberOfWeeks(startDate, endDate);
        // Use the first objective's pointsPerUnit as the points per week
        const pointsPerWeek = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = weeksCount * pointsPerWeek;
      } else {
        // For ongoing weekly challenges, use a default large number of weeks (e.g., 52)
        const pointsPerWeek = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = 52 * pointsPerWeek;
      }
    } else if (challengeData.challenge_type === "checklist" || challengeData.challenge_type === "collection") {
      // For checklist challenges, total points = number of objectives (1 point per objective)
      totalPoints = challengeData.objectives.length;
    } else {
      // For standard/bingo challenges, use the existing logic
      totalPoints = challengeData.objectives.reduce((total, objective) => {
        return total + (objective.targetValue || 0) * (objective.pointsPerUnit || 0);
      }, 0);
    }

    const newChallenge = {
      ...challengeData,
      createdById: user.id,
      creatorName: user.name,
      participants: [],
      totalPoints,
      objectives: challengeData.objectives,
      challenge_type: challengeData.challenge_type || "standard",
      isRepeating: challengeData.isRepeating || false,
      isCollaborative: challengeData.isCollaborative || false,
      // For repeating challenges, ensure startDate and endDate are null
      startDate: challengeData.isRepeating ? undefined : challengeData.startDate,
      endDate: challengeData.isRepeating ? undefined : challengeData.endDate,
    };

    // Ensure all objectives have valid UUIDs
    const objectivesWithValidIds = newChallenge.objectives.map((obj) => {
      // If the ID is not a valid UUID, generate a new one
      if (!validateUUID(obj.id)) {
        console.warn(`Invalid UUID for objective "${obj.title}", generating new one`);
        return { ...obj, id: uuidv4() };
      }
      return obj;
    });

    const newChallengeWithValidIds = {
      ...newChallenge,
      objectives: objectivesWithValidIds,
    };

    // Prepare data for database insert (map camelCase to snake_case)
    const challengeDataForInsert: any = {
      title: newChallengeWithValidIds.title,
      description: newChallengeWithValidIds.description,
      objectives: newChallengeWithValidIds.objectives,
      participants: newChallengeWithValidIds.participants,
      challenge_type: newChallengeWithValidIds.challenge_type || "standard",
      is_collaborative: newChallengeWithValidIds.isCollaborative || false,
      is_repeating: newChallengeWithValidIds.isRepeating || false,
      capedPoints: newChallengeWithValidIds.capedPoints || false,
      created_by_id: newChallengeWithValidIds.createdById,
      creator_name: newChallengeWithValidIds.creatorName,
      start_date: newChallengeWithValidIds.startDate || null,
      end_date: newChallengeWithValidIds.endDate || null,
      total_points: newChallengeWithValidIds.totalPoints,
    };

    // Insert challenge (keep objectives in JSON for backward compatibility during migration)
    const { data: insertedChallenge, error } = await supabase
      .from("challenges")
      .insert([challengeDataForInsert])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (!insertedChallenge) {
      toast({
        title: "Error",
        description: "Challenge created but failed to retrieve data",
        variant: "destructive",
      });
      return;
    }

    // Insert objectives into the objectives table
    if (objectivesWithValidIds.length > 0) {
      const objectivesToInsert = objectivesWithValidIds.map((obj, index) => ({
        id: obj.id,
        challenge_id: insertedChallenge.id,
        title: obj.title,
        description: obj.description || null,
        target_value: obj.targetValue !== undefined ? obj.targetValue : null,
        unit: obj.unit || null,
        points_per_unit: obj.pointsPerUnit !== undefined ? obj.pointsPerUnit : null,
        order: index,
      }));

      const { error: objectivesError } = await supabase
        .from("objectives")
        .insert(objectivesToInsert);

      if (objectivesError) {
        toast({
          title: "Warning",
          description: "Challenge created but some objectives may not have been saved correctly",
          variant: "destructive",
        });
      }
    }

    toast({
      title: "Success!",
      description: "Challenge created successfully",
    });
  };

  // Update an existing challenge
  const updateChallenge = async (
    challengeId: number,
    challengeData: Omit<
      Challenge,
      "id" | "createdById" | "creatorName" | "participants" | "totalPoints"
    >,
  ) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to update a challenge",
        variant: "destructive",
      });
      return;
    }

    // Verify user is the creator
    const existingChallenge = await getChallenge(challengeId);
    if (!existingChallenge) {
      toast({
        title: "Error",
        description: "Challenge not found",
        variant: "destructive",
      });
      return;
    }

    if (existingChallenge.createdById !== user.id) {
      toast({
        title: "Error",
        description: "You can only edit challenges you created",
        variant: "destructive",
      });
      return;
    }

    // Calculate total points based on challenge type
    let totalPoints: number;
    if (challengeData.isRepeating) {
      // For repeating challenges, use a default large number since there's no end date
      if (challengeData.challenge_type === "completion") {
        const pointsPerDay = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = 365 * pointsPerDay;
      } else if (challengeData.challenge_type === "weekly") {
        const pointsPerWeek = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = 52 * pointsPerWeek;
      } else if (challengeData.challenge_type === "checklist" || challengeData.challenge_type === "collection") {
        totalPoints = challengeData.objectives.length;
      } else {
        totalPoints = challengeData.objectives.reduce((total, objective) => {
          return total + (objective.targetValue || 0) * (objective.pointsPerUnit || 0);
        }, 0);
      }
    } else if (challengeData.challenge_type === "completion") {
      const startDate = challengeData.startDate ? new Date(challengeData.startDate) : null;
      const endDate = challengeData.endDate ? new Date(challengeData.endDate) : null;
      
      if (startDate && endDate) {
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const pointsPerDay = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = daysDiff * pointsPerDay;
      } else {
        const pointsPerDay = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = 365 * pointsPerDay;
      }
    } else if (challengeData.challenge_type === "weekly") {
      // For weekly challenges, total points = number of weeks * points per week
      const startDate = challengeData.startDate ? new Date(challengeData.startDate) : null;
      const endDate = challengeData.endDate ? new Date(challengeData.endDate) : null;
      
      if (startDate && endDate) {
        const weeksCount = getNumberOfWeeks(startDate, endDate);
        const pointsPerWeek = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = weeksCount * pointsPerWeek;
      } else {
        const pointsPerWeek = challengeData.objectives[0]?.pointsPerUnit || 1;
        totalPoints = 52 * pointsPerWeek;
      }
    } else if (challengeData.challenge_type === "checklist" || challengeData.challenge_type === "collection") {
      totalPoints = challengeData.objectives.length;
    } else {
      totalPoints = challengeData.objectives.reduce((total, objective) => {
        return total + (objective.targetValue || 0) * (objective.pointsPerUnit || 0);
      }, 0);
    }

    // Ensure all objectives have valid UUIDs
    const objectivesWithValidIds = challengeData.objectives.map((obj) => {
      if (!validateUUID(obj.id)) {
        console.warn(`Invalid UUID for objective "${obj.title}", generating new one`);
        return { ...obj, id: uuidv4() };
      }
      return obj;
    });

    // Prepare update data with correct field names (snake_case for database)
    const updateData: any = {
      title: challengeData.title,
      description: challengeData.description,
      start_date: challengeData.isRepeating ? null : challengeData.startDate,
      end_date: challengeData.isRepeating ? null : challengeData.endDate,
      challenge_type: challengeData.challenge_type || "standard",
      capedPoints: challengeData.capedPoints,
      objectives: objectivesWithValidIds,
      total_points: totalPoints,
      is_repeating: challengeData.isRepeating || false,
      is_collaborative: challengeData.isCollaborative || false,
    };

    // Update challenge (keep objectives in JSON for backward compatibility during migration)
    const { error } = await supabase
      .from("challenges")
      .update(updateData)
      .eq("id", challengeId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Update objectives in the objectives table
    // First, delete existing objectives for this challenge
    const { error: deleteError } = await supabase
      .from("objectives")
      .delete()
      .eq("challenge_id", challengeId);

    if (deleteError) {
      // Continue anyway - we'll try to insert new ones
    }

    // Insert updated objectives
    if (objectivesWithValidIds.length > 0) {
      const objectivesToInsert = objectivesWithValidIds.map((obj, index) => ({
        id: obj.id,
        challenge_id: challengeId,
        title: obj.title,
        description: obj.description || null,
        target_value: obj.targetValue !== undefined ? obj.targetValue : null,
        unit: obj.unit || null,
        points_per_unit: obj.pointsPerUnit !== undefined ? obj.pointsPerUnit : null,
        order: index,
      }));

      const { error: objectivesError } = await supabase
        .from("objectives")
        .insert(objectivesToInsert);

      if (objectivesError) {
        toast({
          title: "Warning",
          description: "Challenge updated but some objectives may not have been saved correctly",
          variant: "destructive",
        });
      }
    }

    toast({
      title: "Success!",
      description: "Challenge updated successfully",
    });
  };

  // Join a challenge
  const joinChallenge = async (challengeId: number) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to join a challenge",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: challengeData, error: fetchError } = await supabase
        .from("challenges")
        .select("participants, startDate, endDate, is_repeating")
        .eq("id", challengeId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const isRepeating = challengeData?.is_repeating || false;

      // Check if challenge is completed (only for non-repeating challenges)
      if (!isRepeating && challengeData?.endDate) {
        const endDate = new Date(challengeData.endDate);
        const today = new Date();
        if (today > endDate) {
          toast({
            title: t("error"),
            description: t("cannotJoinCompletedChallenge"),
            variant: "destructive",
          });
          return;
        }
      }

      const currentParticipants = Array.isArray(challengeData?.participants)
        ? challengeData.participants
        : [];

      if (currentParticipants.includes(user.id)) {
        toast({
          title: "Info",
          description: "You've already joined this challenge",
        });
        return;
      }

      // Add user to participants
      const { error: updateError } = await supabase
        .from("challenges")
        .update({
          participants: [...currentParticipants, user.id],
        })
        .eq("id", challengeId);

      if (updateError) {
        throw updateError;
      }

      // For repeating challenges, record the start date and calculate end date for this user
      if (isRepeating) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day
        
        let endDate: Date | null = null;
        
        // Calculate duration from challenge's startDate and endDate
        if (challengeData?.startDate && challengeData?.endDate) {
          const challengeStartDate = new Date(challengeData.startDate);
          const challengeEndDate = new Date(challengeData.endDate);
          
          // Normalize to start of day to avoid timezone issues
          challengeStartDate.setHours(0, 0, 0, 0);
          challengeEndDate.setHours(23, 59, 59, 999); // End of day
          
          // Calculate duration in milliseconds
          const durationMs = challengeEndDate.getTime() - challengeStartDate.getTime();
          
          // Add duration to today to get end date
          endDate = new Date(today.getTime() + durationMs);
          endDate.setHours(23, 59, 59, 999); // Set to end of day
        } else {
          // Fallback: if challenge doesn't have dates, use default 30 days
          endDate = new Date(today);
          endDate.setDate(endDate.getDate() + 30);
          endDate.setHours(23, 59, 59, 999);
        }
        
        // Use upsert to handle case where user has already joined before
        const { error: startDateError } = await supabase
          .from("user_challenge_starts")
          .upsert({
            user_id: user.id,
            challenge_id: challengeId,
            start_date: today.toISOString(),
            end_date: endDate.toISOString(),
          }, {
            onConflict: 'user_id,challenge_id'
          });

        if (startDateError) {
          console.error("Error recording challenge start date:", startDateError);
          // Don't fail the join if this fails, but log it
        }
      }

      // Create activity feed entry for challenge join
      const { activityFeedService } = await import("@/lib/activity-feed");
      activityFeedService.createActivity(user.id, 'challenge_join', {
        challengeId,
      }).catch(err => console.error("Failed to create activity feed entry:", err));

      toast({
        title: "Success!",
        description: "You've joined the challenge successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to join challenge",
        variant: "destructive",
      });
    }
  };

  // Leave a challenge
  const leaveChallenge = async (challengeId: number) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to leave a challenge",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: challengeData, error: fetchError } = await supabase
        .from("challenges")
        .select("participants")
        .eq("id", challengeId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const currentParticipants = Array.isArray(challengeData?.participants)
        ? challengeData.participants
        : [];

      if (!currentParticipants.includes(user.id)) {
        toast({
          title: "Info",
          description: "You're not a participant in this challenge",
        });
        return;
      }

      const { error: updateError } = await supabase
        .from("challenges")
        .update({
          participants: currentParticipants.filter((id) => id !== user.id),
        })
        .eq("id", challengeId);

      if (updateError) {
        throw updateError;
      }

      // Delete all entries (progress) for this user in this challenge
      const { error: entriesError } = await supabase
        .from("entries")
        .delete()
        .eq("user_id", user.id)
        .eq("challenge_id", challengeId);

      if (entriesError) {
        console.error("Error deleting entries:", entriesError);
        // Don't throw - continue with cleanup
      }

      // Delete user challenge start/end dates for repeating challenges
      // (end_date is stored in the same user_challenge_starts table)
      const { error: startDateError } = await supabase
        .from("user_challenge_starts")
        .delete()
        .eq("user_id", user.id)
        .eq("challenge_id", challengeId);

      if (startDateError) {
        console.error("Error deleting user challenge start/end dates:", startDateError);
        // Don't throw - continue with cleanup
      }

      // Delete all activity feed entries for this user in this challenge
      const { activityFeedService } = await import("@/lib/activity-feed");
      activityFeedService.deleteActivitiesForChallenge(user.id, challengeId)
        .catch(err => console.error("Failed to delete activity feed entries:", err));

      toast({
        title: "Success!",
        description: "You've left the challenge successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave challenge",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Update progress for a challenge
  const updateProgress = async (
    challengeId: number,
    objectiveId: string,
    value: number,
    notes?: string,
    completionDate?: string,
  ) => {
    if (!user) return;

    try {
      if (value === 0) {
        const { error: deleteError } = await supabase
          .from("entries")
          .delete()
          .eq("user_id", user.id)
          .eq("challenge_id", challengeId)
          .eq("objective_id", objectiveId);

        if (deleteError) {
          return;
        }

        // Delete corresponding activity feed entries
        const { activityFeedService } = await import("@/lib/activity-feed");
        activityFeedService.deleteActivitiesForObjective(
          user.id,
          challengeId,
          objectiveId
        ).catch(err => console.error("Failed to delete activity feed entries:", err));
      } else {
        // Validate and potentially generate UUID for objective_id
        // If the objective_id is not a valid UUID (e.g., legacy numeric IDs), we can't insert it
        // In this case, we should log an error and inform the user
        if (!validateUUID(objectiveId)) {
          toast({
            title: "Error",
            description: "Invalid objective ID. Please refresh the challenge and try again.",
            variant: "destructive",
          });
          return;
        }
        
        // Prepare entry data
        const entryData: any = {
          user_id: user.id,
          challenge_id: challengeId,
          objective_id: objectiveId,
          value: value,
          notes: notes?.trim() || null,
          username: user.name || `User ${user.id}`,
        };

        // If completionDate is provided, set created_at to that date
        // Format: YYYY-MM-DD, convert to ISO timestamp at noon in local timezone (then to UTC)
        // Using noon ensures the date stays correct when converted back to local timezone
        if (completionDate) {
          // Parse the date string (YYYY-MM-DD) and create a date at noon in local timezone
          const localDate = getLocalDateFromString(completionDate);
          localDate.setHours(12, 0, 0, 0); // Set to noon local time to avoid timezone edge cases
          entryData.created_at = localDate.toISOString();
        }
        
        const { error: insertError } = await supabase.from("entries").insert(entryData);

        if (insertError) {
          return;
        }

        // Create activity feed entry for objective progress
        if (value > 0) {
          const { activityFeedService } = await import("@/lib/activity-feed");
          activityFeedService.createActivity(user.id, 'objective_progress', {
            challengeId,
            objectiveId,
            metadata: { value, notes: notes?.trim() || null },
          }).catch(err => console.error("Failed to create activity feed entry:", err));
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Create a mock bingo challenge
  const createMockBingoChallenge = async () => {
    const objectives = [
      { title: "150 Kniebeugen", description: "Complete 150 squats" },
      { title: "20 km Laufen", description: "Run 20 kilometers" },
      { title: "60 min Rad", description: "Bike for 60 minutes" },
      { title: "8 km Rad", description: "Bike 8 kilometers" },
      { title: "20 Pullups", description: "Complete 20 pullups" },
      { title: "30 min Rad", description: "Bike for 30 minutes" },
    ].map((obj, i) => ({
      id: crypto.randomUUID(),
      title: obj.title,
      description: obj.description,
      targetValue: 1,
      unit: "Abschluss",
      pointsPerUnit: 1,
    }));

    const challengeData = {
      title: "June of Pain - Bingo Edition",
      description:
        "5 Felder in einer Reihe (horizontal, vertikal, diagonal) = BINGO! Pro Tag maximal 2 Felder abhaken! Alle Ziele sind einzeln zu bewerten",
      startDate: new Date("2025-06-01T00:00:00Z").toISOString(),
      endDate: new Date("2025-06-30T23:59:59Z").toISOString(),
      objectives,
      challenge_type: "bingo" as ChallengeType,
    };

    await createChallenge(challengeData);
  };

  // Get progress for a specific participant
  const getParticipantProgress = async (
    challengeId: number,
    userId: string,
  ): Promise<UserProgress[]> => {
    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", userId)
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false })
        .returns<Entry[]>();

      if (entriesError) {
        toast({
          title: "Error",
          description: "Failed to load progress data",
          variant: "destructive",
        });
        return [];
      }

      if (entriesData) {
        // Get challenge to determine challenge type
        const challenge = await getChallenge(challengeId);
        if (!challenge) return [];

        // For weekly challenges, count only completed weeks (where target is met)
        if (challenge.challenge_type === "weekly") {
          // Group entries by objective and week, then count only completed weeks
          const progressMap: Record<string, UserProgress> = {};
          const weekProgressMap: Record<string, Record<string, number>> = {}; // objectiveId -> weekId -> total value

          entriesData.forEach((entry) => {
            const key = `${entry.challenge_id}-${entry.objective_id}`;
            if (!progressMap[key]) {
              progressMap[key] = {
                userId: entry.user_id,
                challengeId: entry.challenge_id,
                objectiveId: entry.objective_id,
                currentValue: 0,
              };
            }

            // Get the week identifier for this entry
            const entryDate = new Date(entry.created_at);
            const weekId = getWeekIdentifier(entryDate);

            // Initialize week progress tracking for this objective
            if (!weekProgressMap[entry.objective_id]) {
              weekProgressMap[entry.objective_id] = {};
            }
            if (!weekProgressMap[entry.objective_id][weekId]) {
              weekProgressMap[entry.objective_id][weekId] = 0;
            }

            // Sum values for this week
            weekProgressMap[entry.objective_id][weekId] += entry.value || 0;
          });

          // Count only weeks where target is met
          // Initialize progress for all objectives, even if they have no entries
          challenge.objectives.forEach((objective) => {
            const key = `${challengeId}-${objective.id}`;
            const targetValue = objective.targetValue || 1;
            const weeksForObjective = weekProgressMap[objective.id] || {};

            // Initialize progress entry if it doesn't exist
            if (!progressMap[key]) {
              progressMap[key] = {
                userId: userId,
                challengeId: challengeId,
                objectiveId: objective.id,
                currentValue: 0,
              };
            }

            // Count only weeks where target is met
            let completedWeeks = 0;
            Object.values(weeksForObjective).forEach((weekTotal) => {
              if (weekTotal >= targetValue) {
                completedWeeks++;
              }
            });

            progressMap[key].currentValue = completedWeeks;
          });

          const progress = Object.values(progressMap);
          return progress;
        }

        // For completion challenges, count unique days per objective
        if (challenge.challenge_type === "completion") {
          const progressMap: Record<string, UserProgress> = {};
          const dayProgressMap: Record<string, Set<string>> = {}; // objectiveId -> Set of day strings

          entriesData.forEach((entry) => {
            const key = `${entry.challenge_id}-${entry.objective_id}`;
            if (!progressMap[key]) {
              progressMap[key] = {
                userId: entry.user_id,
                challengeId: entry.challenge_id,
                objectiveId: entry.objective_id,
                currentValue: 0,
              };
            }

            // Get the date string (YYYY-MM-DD) for this entry (in local timezone)
            const dayString = utcTimestampToLocalDateString(entry.created_at);

            // Initialize day tracking for this objective if needed
            if (!dayProgressMap[entry.objective_id]) {
              dayProgressMap[entry.objective_id] = new Set();
            }

            // Add this day to the set (Set automatically handles duplicates)
            dayProgressMap[entry.objective_id].add(dayString);
          });

          // Initialize progress for all objectives and count unique days
          challenge.objectives.forEach((objective) => {
            const key = `${challengeId}-${objective.id}`;
            if (!progressMap[key]) {
              progressMap[key] = {
                userId: userId,
                challengeId: challengeId,
                objectiveId: objective.id,
                currentValue: 0,
              };
            }

            // Count unique days for this objective
            const uniqueDays = dayProgressMap[objective.id]?.size || 0;
            progressMap[key].currentValue = uniqueDays;
          });

          const progress = Object.values(progressMap);
          return progress;
        }

        // For other challenge types, use the original logic
        const progressMap = entriesData.reduce(
          (acc, entry) => {
            const key = `${entry.challenge_id}-${entry.objective_id}`;
            if (!acc[key]) {
              acc[key] = {
                userId: entry.user_id,
                challengeId: entry.challenge_id,
                objectiveId: entry.objective_id,
                currentValue: 0,
              };
            }
            // Sum values for standard/bingo challenges
            acc[key].currentValue += entry.value || 0;
            return acc;
          },
          {} as Record<string, UserProgress>,
        );

        const progress = Object.values(progressMap);
        return progress;
      }

      return [];
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load challenge progress",
        variant: "destructive",
      });
      return [];
    }
  };

  // Get participants for a challenge
  const getParticipants = async (
    challengeId: number,
  ): Promise<Array<{ id: string; name: string; avatar?: string }>> => {
    try {
      const { data: challengeData, error: challengeError } = await supabase
        .from("challenges")
        .select("participants")
        .eq("id", challengeId)
        .single();

      if (challengeError || !challengeData) {
        return [];
      }

      // Try to fetch from user_profiles table first
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, name, avatar_url")
        .in("id", challengeData.participants);

      if (profilesError) {
        // If user_profiles table doesn't exist or has no data, return basic participant info
        return challengeData.participants.map((id) => ({
          id,
          name: `User ${id.slice(0, 4)}`,
          avatar: undefined,
        }));
      }

      const participants = challengeData.participants.map((id) => {
        const profile = profiles?.find((p) => p.id === id);
        return {
          id,
          name: profile?.name || `User ${id.slice(0, 4)}`,
          avatar: profile?.avatar_url,
        };
      });

      return participants;
    } catch (error) {
      return [];
    }
  };

  // Create or update user profile
  const createOrUpdateUserProfile = async (
    userId: string,
    name: string,
    avatarUrl?: string,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from("user_profiles")
        .upsert({
          id: userId,
          name,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  // Get creator's avatar
  const getCreatorAvatar = async (
    userId: string,
  ): Promise<string | undefined> => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();

      if (error) {
        return undefined;
      }

      return data?.avatar_url;
    } catch (error) {
      return undefined;
    }
  };

  // Get user's start date for a repeating challenge
  const getUserChallengeStartDate = async (
    challengeId: number,
    userId: string,
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from("user_challenge_starts")
        .select("start_date, end_date")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user challenge start date:", error);
        return null;
      }

      return data?.start_date || null;
    } catch (error) {
      console.error("Exception fetching user challenge start date:", error);
      return null;
    }
  };

  // Get user's end date for a repeating challenge
  const getUserChallengeEndDate = async (
    challengeId: number,
    userId: string,
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from("user_challenge_starts")
        .select("start_date, end_date")
        .eq("challenge_id", challengeId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user challenge end date:", error);
        return null;
      }

      return data?.end_date || null;
    } catch (error) {
      console.error("Exception fetching user challenge end date:", error);
      return null;
    }
  };

  // Complete a daily challenge
  const completeDailyChallenge = async (
    dailyChallengeId: string, 
    valueAchieved?: number, 
    notes?: string
  ): Promise<void> => {
    if (!user) return;

    try {
      // Use the daily challenges service to complete the challenge
      await dailyChallengesService.completeDailyChallenge(
        user.id,
        dailyChallengeId,
        valueAchieved,
        notes
      );

      // Create activity feed entry for challenge completion
      const { activityFeedService } = await import("@/lib/activity-feed");
      activityFeedService.createActivity(user.id, 'challenge_complete', {
        metadata: { dailyChallengeId, valueAchieved, notes: notes?.trim() || null, isDaily: true },
      }).catch(err => console.error("Failed to create activity feed entry:", err));

      toast({
        title: "Challenge Completed! 🎉",
        description: "Great job! You've completed today's challenge.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete challenge",
        variant: "destructive",
      });
    }
  };

  // Get user activity dates within a date range
  const getUserActivityDates = async (startDate: string, endDate: string): Promise<string[]> => {
    if (!user) return [];

    try {
      // Convert local date strings to UTC timestamps for query
      const startDateTime = localDateToUTCStart(startDate);
      const endDateTime = localDateToUTCEnd(endDate);
      
      const { data: entriesData, error: entriesError } = await supabase
        .from("entries")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime)
        .order("created_at", { ascending: false });

      if (entriesError) {
        return [];
      }

      // Extract unique dates from entries, converting UTC timestamps to local dates
      const activityDates = entriesData?.map(entry => {
        return utcTimestampToLocalDateString(entry.created_at);
      }) || [];

      // Remove duplicates and return
      return [...new Set(activityDates)];
    } catch (error) {
      return [];
    }
  };

  const value = {
    createChallenge,
    updateChallenge,
    joinChallenge,
    leaveChallenge,
    updateProgress,
    getChallenge,
    getUserChallenges,
    getChallengeProgress,
    createMockBingoChallenge,
    getParticipantProgress,
    getParticipants,
    createOrUpdateUserProfile,
    getCreatorAvatar,
    getUserChallengeStartDate,
    getUserChallengeEndDate,
    getUserActivityDates,
    completeDailyChallenge,
  };

  return (
    <ChallengeContext.Provider value={value}>
      {children}
    </ChallengeContext.Provider>
  );
};
export const useChallenges = () => {
  const context = useContext(ChallengeContext);
  if (context === undefined) {
    throw new Error("useChallenges must be used within a ChallengeProvider");
  }
  return context;
};
