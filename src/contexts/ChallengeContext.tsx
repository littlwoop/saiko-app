import { createContext, useContext, ReactNode } from "react";
import { Challenge, Objective, UserChallenge, UserProgress } from "@/types";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { dailyChallengesService } from "@/lib/daily-challenges";
import { useTranslation } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";
import { calculateTotalPoints } from "@/lib/points";

// Debug logging utility
const debug = {
  log: (...args: unknown[]): void => {
    if (process.env.NODE_ENV === "development") {
      console.log("[ChallengeContext]", ...args);
    }
  },
  error: (...args: unknown[]): void => {
    if (process.env.NODE_ENV === "development") {
      console.error("[ChallengeContext]", ...args);
    }
  },
};

interface ChallengeContextType {
  createChallenge: (
    challenge: Omit<
      Challenge,
      "id" | "createdById" | "creatorName" | "participants" | "totalPoints"
    >,
  ) => Promise<void>;
  joinChallenge: (challengeId: string) => Promise<void>;
  updateProgress: (
    challengeId: string,
    objectiveId: string,
    value: number,
    notes?: string,
  ) => Promise<void>;
  getChallenge: (challengeId: string) => Promise<Challenge | null>;
  getUserChallenges: () => Promise<UserChallenge[]>;
  getChallengeProgress: (challengeId: string) => Promise<UserProgress[]>;
  createMockBingoChallenge: () => Promise<void>;
  getParticipantProgress: (
    challengeId: string,
    userId: string,
  ) => Promise<UserProgress[]>;
  getParticipants: (
    challengeId: string,
  ) => Promise<Array<{ id: string; name: string; avatar?: string }>>;
  getCreatorAvatar: (userId: string) => Promise<string | undefined>;
  getUserActivityDates: (startDate: string, endDate: string) => Promise<string[]>;
  completeDailyChallenge: (dailyChallengeId: string, valueAchieved?: number, notes?: string) => Promise<void>;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(
  undefined,
);

interface Entry {
  id: string;
  user_id: string;
  challenge_id: string;
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
    challengeId: string,
  ): Promise<Challenge | null> => {
    debug.log(`Getting challenge with ID: ${challengeId}`);
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challengeId)
        .single();

      if (error) {
        debug.error("Error fetching challenge:", error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return null;
      }

      debug.log("Successfully fetched challenge:", data);
      return data;
    } catch (err) {
      debug.error("Unexpected error:", err);
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
    debug.log("Getting challenges for user:", user?.id);
    if (!user) return [];

    try {
      const { data: challengesData, error: challengesError } = await supabase
        .from("challenges")
        .select("*")
        .contains("participants", JSON.stringify([user.id]));

      if (challengesError) {
        debug.error("Error fetching user challenges:", challengesError);
        toast({
          title: "Error",
          description: challengesError.message,
          variant: "destructive",
        });
        return [];
      }

      debug.log("Successfully fetched user challenges:", challengesData);
      
      // Calculate actual progress for each challenge
      const userChallengesWithProgress = await Promise.all(
        (challengesData || []).map(async (challenge) => {
          const progress = await getChallengeProgress(challenge.id);
          const totalScore = calculateTotalPoints(
            challenge.objectives,
            progress,
            challenge.capedPoints
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
      debug.error("Unexpected error:", err);
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
    challengeId: string,
  ): Promise<UserProgress[]> => {
    debug.log(
      `Getting progress for challenge: ${challengeId}, user: ${user?.id}`,
    );
    if (!user) return [];

    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false })
        .returns<Entry[]>();

      if (entriesError) {
        debug.error("Error fetching entries:", entriesError);
        toast({
          title: "Error",
          description: "Failed to load progress data",
          variant: "destructive",
        });
        return [];
      }

      debug.log("Successfully fetched entries:", entriesData);

      if (entriesData) {
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
            acc[key].currentValue += entry.value;
            return acc;
          },
          {} as Record<string, UserProgress>,
        );

        const progress = Object.values(progressMap);
        debug.log("Calculated progress:", progress);
        return progress;
      }

      return [];
    } catch (error) {
      debug.error("Error loading entries:", error);
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
    debug.log("Creating new challenge:", challengeData);
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a challenge",
        variant: "destructive",
      });
      return;
    }

    const totalPoints = challengeData.objectives.reduce((total, objective) => {
      return total + objective.targetValue * objective.pointsPerUnit;
    }, 0);

    const newChallenge = {
      ...challengeData,
      createdById: user.id,
      creatorName: user.name,
      participants: [],
      totalPoints,
      objectives: challengeData.objectives,
      challengeType: challengeData.challengeType || "standard",
    };

    debug.log("Prepared challenge data:", newChallenge);

    const { error } = await supabase.from("challenges").insert([newChallenge]);

    if (error) {
      debug.error("Error creating challenge:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      debug.log("Successfully created challenge");
      toast({
        title: "Success!",
        description: "Challenge created successfully",
      });
    }
  };

  // Join a challenge
  const joinChallenge = async (challengeId: string) => {
    debug.log(`Joining challenge: ${challengeId}, user: ${user?.id}`);
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
        .select("participants")
        .eq("id", challengeId)
        .single();

      if (fetchError) {
        debug.error("Error fetching challenge:", fetchError);
        throw fetchError;
      }

      debug.log("Current challenge data:", challengeData);

      const currentParticipants = Array.isArray(challengeData?.participants)
        ? challengeData.participants
        : [];

      if (currentParticipants.includes(user.id)) {
        debug.log("User already joined this challenge");
        toast({
          title: "Info",
          description: "You've already joined this challenge",
        });
        return;
      }

      const { error: updateError } = await supabase
        .from("challenges")
        .update({
          participants: [...currentParticipants, user.id],
        })
        .eq("id", challengeId);

      if (updateError) {
        debug.error("Error updating participants:", updateError);
        throw updateError;
      }

      debug.log("Successfully joined challenge");
      toast({
        title: "Success!",
        description: "You've joined the challenge successfully",
      });
    } catch (error) {
      debug.error("Error joining challenge:", error);
      toast({
        title: "Error",
        description: "Failed to join challenge",
        variant: "destructive",
      });
    }
  };

  // Update progress for a challenge
  const updateProgress = async (
    challengeId: string,
    objectiveId: string,
    value: number,
    notes?: string,
  ) => {
    debug.log(
      `Updating progress - Challenge: ${challengeId}, Objective: ${objectiveId}, Value: ${value}, Notes: ${notes}`,
    );
    if (!user) return;

    try {
      if (value === 0) {
        debug.log("Resetting objective progress");
        const { error: deleteError } = await supabase
          .from("entries")
          .delete()
          .eq("user_id", user.id)
          .eq("challenge_id", challengeId)
          .eq("objective_id", objectiveId);

        if (deleteError) {
          debug.error("Error deleting entries:", deleteError);
          return;
        }
      } else {
        debug.log("Creating new progress entry");
        const { error: insertError } = await supabase.from("entries").insert({
          user_id: user.id,
          challenge_id: challengeId,
          objective_id: objectiveId,
          value: value,
          notes: notes?.trim() || null,
          username: user.name || `User ${user.id}`,
        });

        if (insertError) {
          debug.error("Error creating entry:", insertError);
          return;
        }
      }

      debug.log("Successfully updated progress");
      toast({
        title: value === 0 ? t("objectiveReset") : t("progressUpdated"),
        description:
          value === 0
            ? t("objectiveResetDescription")
            : t("progressUpdatedDescription"),
      });
    } catch (error) {
      debug.error("Error updating progress:", error);
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
      challengeType: "bingo",
    };

    await createChallenge(challengeData);
  };

  // Get progress for a specific participant
  const getParticipantProgress = async (
    challengeId: string,
    userId: string,
  ): Promise<UserProgress[]> => {
    debug.log(
      `Getting progress for participant - Challenge: ${challengeId}, User: ${userId}`,
    );
    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", userId)
        .eq("challenge_id", challengeId)
        .order("created_at", { ascending: false })
        .returns<Entry[]>();

      if (entriesError) {
        debug.error("Error fetching entries:", entriesError);
        toast({
          title: "Error",
          description: "Failed to load progress data",
          variant: "destructive",
        });
        return [];
      }

      debug.log("Successfully fetched participant entries:", entriesData);

      if (entriesData) {
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
            acc[key].currentValue += entry.value;
            return acc;
          },
          {} as Record<string, UserProgress>,
        );

        const progress = Object.values(progressMap);
        debug.log("Calculated participant progress:", progress);
        return progress;
      }

      return [];
    } catch (error) {
      debug.error("Error loading entries:", error);
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
    challengeId: string,
  ): Promise<Array<{ id: string; name: string; avatar?: string }>> => {
    debug.log(`Getting participants for challenge: ${challengeId}`);
    try {
      const { data: challengeData, error: challengeError } = await supabase
        .from("challenges")
        .select("participants")
        .eq("id", challengeId)
        .single();

      if (challengeError || !challengeData) {
        debug.error("Error fetching challenge:", challengeError);
        return [];
      }

      debug.log("Challenge participants:", challengeData.participants);

      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, name, avatar_url")
        .in("id", challengeData.participants);

      if (profilesError) {
        debug.error("Error fetching participant profiles:", profilesError);
        return [];
      }

      debug.log("Participant profiles:", profiles);

      const participants = challengeData.participants.map((id) => {
        const profile = profiles?.find((p) => p.id === id);
        return {
          id,
          name: profile?.name || `User ${id.slice(0, 4)}`,
          avatar: profile?.avatar_url,
        };
      });

      debug.log("Processed participants:", participants);
      return participants;
    } catch (error) {
      debug.error("Error loading participants:", error);
      return [];
    }
  };

  // Get creator's avatar
  const getCreatorAvatar = async (
    userId: string,
  ): Promise<string | undefined> => {
    debug.log(`Getting creator avatar for user: ${userId}`);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();

      if (error) {
        debug.error("Error fetching creator avatar:", error);
        return undefined;
      }

      debug.log("Creator avatar URL:", data?.avatar_url);
      return data?.avatar_url;
    } catch (error) {
      debug.error("Error loading creator avatar:", error);
      return undefined;
    }
  };

  // Complete a daily challenge
  const completeDailyChallenge = async (
    dailyChallengeId: string, 
    valueAchieved?: number, 
    notes?: string
  ): Promise<void> => {
    debug.log(`Completing daily challenge: ${dailyChallengeId}`);
    if (!user) return;

    try {
      // Use the daily challenges service to complete the challenge
      await dailyChallengesService.completeDailyChallenge(
        user.id,
        dailyChallengeId,
        valueAchieved,
        notes
      );

      debug.log("Successfully completed daily challenge");
      toast({
        title: "Challenge Completed! 🎉",
        description: "Great job! You've completed today's challenge.",
        variant: "default",
      });
    } catch (error) {
      debug.error("Unexpected error completing daily challenge:", error);
      toast({
        title: "Error",
        description: "Failed to complete challenge",
        variant: "destructive",
      });
    }
  };

  // Get user activity dates within a date range
  const getUserActivityDates = async (startDate: string, endDate: string): Promise<string[]> => {
    debug.log(`Getting user activity dates from ${startDate} to ${endDate}`);
    if (!user) return [];

    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from("entries")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (entriesError) {
        debug.error("Error fetching user activity dates:", entriesError);
        return [];
      }

      // Extract unique dates from entries
      const activityDates = entriesData?.map(entry => 
        entry.created_at.split('T')[0]
      ) || [];

      // Remove duplicates and return
      return [...new Set(activityDates)];
    } catch (error) {
      debug.error("Error loading user activity dates:", error);
      return [];
    }
  };

  const value = {
    createChallenge,
    joinChallenge,
    updateProgress,
    getChallenge,
    getUserChallenges,
    getChallengeProgress,
    createMockBingoChallenge,
    getParticipantProgress,
    getParticipants,
    getCreatorAvatar,
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
