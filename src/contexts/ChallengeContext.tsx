import { createContext, useContext, ReactNode } from "react";
import { Challenge, Objective, UserChallenge, UserProgress } from "@/types";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

interface ChallengeContextType {
  createChallenge: (challenge: Omit<Challenge, "id" | "createdById" | "creatorName" | "participants" | "totalPoints">) => Promise<void>;
  joinChallenge: (challengeId: string) => Promise<void>;
  updateProgress: (challengeId: string, objectiveId: string, value: number, notes?: string) => Promise<void>;
  getChallenge: (challengeId: string) => Promise<Challenge | null>;
  getUserChallenges: () => Promise<UserChallenge[]>;
  getChallengeProgress: (challengeId: string) => Promise<UserProgress[]>;
  createMockBingoChallenge: () => Promise<void>;
  getParticipantProgress: (challengeId: string, userId: string) => Promise<UserProgress[]>;
  getParticipants: (challengeId: string) => Promise<Array<{ id: string; name: string; avatar?: string }>>;
  getCreatorAvatar: (userId: string) => Promise<string | undefined>;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

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

  // Get a single challenge by ID
  const getChallenge = async (challengeId: string): Promise<Challenge | null> => {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (error) {
        console.error('Error fetching challenge:', error);
        toast({ 
          title: "Error", 
          description: error.message, 
          variant: "destructive" 
        });
        return null;
      }

      return data;
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({ 
        title: "Error", 
        description: "Failed to load challenge", 
        variant: "destructive" 
      });
      return null;
    }
  };

  // Get all challenges for the current user
  const getUserChallenges = async (): Promise<UserChallenge[]> => {
    if (!user) return [];

    try {
      const { data: challengesData, error: challengesError } = await supabase
        .from('challenges')
        .select('*')
        .contains('participants', JSON.stringify([user.id]));

      if (challengesError) {
        console.error('Error fetching user challenges:', challengesError);
        toast({ 
          title: "Error", 
          description: challengesError.message, 
          variant: "destructive" 
        });
        return [];
      }

      return (challengesData || []).map(challenge => ({
        userId: user.id,
        challengeId: challenge.id,
        joinedAt: new Date().toISOString(),
        totalScore: 0 // This will be calculated when needed
      }));
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({ 
        title: "Error", 
        description: "Failed to load user challenges", 
        variant: "destructive" 
      });
      return [];
    }
  };

  // Get progress for a specific challenge
  const getChallengeProgress = async (challengeId: string): Promise<UserProgress[]> => {
    if (!user) return [];

    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: false })
        .returns<Entry[]>();

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        toast({
          title: "Error",
          description: "Failed to load progress data",
          variant: "destructive"
        });
        return [];
      }

      if (entriesData) {
        const progressMap = entriesData.reduce((acc, entry) => {
          const key = `${entry.challenge_id}-${entry.objective_id}`;
          if (!acc[key]) {
            acc[key] = {
              userId: entry.user_id,
              challengeId: entry.challenge_id,
              objectiveId: entry.objective_id,
              currentValue: 0
            };
          }
          acc[key].currentValue += entry.value;
          return acc;
        }, {} as Record<string, UserProgress>);

        return Object.values(progressMap);
      }

      return [];
    } catch (error) {
      console.error('Error loading entries:', error);
      toast({
        title: "Error",
        description: "Failed to load challenge progress",
        variant: "destructive"
      });
      return [];
    }
  };

  // Create a new challenge
  const createChallenge = async (challengeData: Omit<Challenge, "id" | "createdById" | "creatorName" | "participants" | "totalPoints">) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a challenge",
        variant: "destructive",
      });
      return;
    }

    const totalPoints = challengeData.objectives.reduce((total, objective) => {
      return total + (objective.targetValue * objective.pointsPerUnit);
    }, 0);

    const newChallenge = {
      ...challengeData,
      createdById: user.id,
      creatorName: user.name,
      participants: [],
      totalPoints,
      objectives: challengeData.objectives,
      isBingo: challengeData.isBingo || false,
    };

    const { error } = await supabase
      .from('challenges')
      .insert([newChallenge]);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success!", description: "Challenge created successfully" });
    }
  };

  // Join a challenge
  const joinChallenge = async (challengeId: string) => {
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
        .from('challenges')
        .select('participants')
        .eq('id', challengeId)
        .single();

      if (fetchError) {
        console.error('Error fetching challenge:', fetchError);
        throw fetchError;
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

      const { error: updateError } = await supabase
        .from('challenges')
        .update({ 
          participants: [...currentParticipants, user.id]
        })
        .eq('id', challengeId);

      if (updateError) {
        console.error('Error updating participants:', updateError);
        throw updateError;
      }

      toast({
        title: "Success!",
        description: "You've joined the challenge successfully",
      });
    } catch (error) {
      console.error('Error joining challenge:', error);
      toast({
        title: "Error",
        description: "Failed to join challenge",
        variant: "destructive"
      });
    }
  };

  // Update progress for a challenge
  const updateProgress = async (challengeId: string, objectiveId: string, value: number, notes?: string) => {
    if (!user) return;

    try {
      if (value === 0) {
        const { error: deleteError } = await supabase
          .from('entries')
          .delete()
          .eq('user_id', user.id)
          .eq('challenge_id', challengeId)
          .eq('objective_id', objectiveId);

        if (deleteError) {
          console.error('Error deleting entries:', deleteError);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('entries')
          .insert({
            user_id: user.id,
            challenge_id: challengeId,
            objective_id: objectiveId,
            value: value,
            notes: notes?.trim() || null,
            username: user.name || `User ${user.id}`
          });

        if (insertError) {
          console.error('Error creating entry:', insertError);
          return;
        }
      }

      toast({
        title: value === 0 ? "Objective Reset" : "Progress Updated",
        description: value === 0 ? "The objective has been reset." : "Your progress has been saved successfully.",
      });
    } catch (error) {
      console.error('Error updating progress:', error);
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive"
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
      { title: "30 min Rad", description: "Bike for 30 minutes" }
    ].map((obj, i) => ({
      id: crypto.randomUUID(),
      title: obj.title,
      description: obj.description,
      targetValue: 1,
      unit: "Abschluss",
      pointsPerUnit: 1
    }));

    const challengeData = {
      title: "June of Pain - Bingo Edition",
      description: "5 Felder in einer Reihe (horizontal, vertikal, diagonal) = BINGO! Pro Tag maximal 2 Felder abhaken! Alle Ziele sind einzeln zu bewerten",
      startDate: new Date('2025-06-01T00:00:00Z').toISOString(),
      endDate: new Date('2025-06-30T23:59:59Z').toISOString(),
      objectives,
      isBingo: true
    };

    await createChallenge(challengeData);
  };

  // Get progress for a specific participant
  const getParticipantProgress = async (challengeId: string, userId: string): Promise<UserProgress[]> => {
    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: false })
        .returns<Entry[]>();

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        toast({
          title: "Error",
          description: "Failed to load progress data",
          variant: "destructive"
        });
        return [];
      }

      if (entriesData) {
        const progressMap = entriesData.reduce((acc, entry) => {
          const key = `${entry.challenge_id}-${entry.objective_id}`;
          if (!acc[key]) {
            acc[key] = {
              userId: entry.user_id,
              challengeId: entry.challenge_id,
              objectiveId: entry.objective_id,
              currentValue: 0
            };
          }
          acc[key].currentValue += entry.value;
          return acc;
        }, {} as Record<string, UserProgress>);

        return Object.values(progressMap);
      }

      return [];
    } catch (error) {
      console.error('Error loading entries:', error);
      toast({
        title: "Error",
        description: "Failed to load challenge progress",
        variant: "destructive"
      });
      return [];
    }
  };

  // Get participants for a challenge
  const getParticipants = async (challengeId: string): Promise<Array<{ id: string; name: string; avatar?: string }>> => {
    try {
      const { data: challengeData, error: challengeError } = await supabase
        .from('challenges')
        .select('participants')
        .eq('id', challengeId)
        .single();

      if (challengeError || !challengeData) {
        console.error('Error fetching challenge:', challengeError);
        return [];
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, name, avatar_url')
        .in('id', challengeData.participants);

      if (profilesError) {
        console.error('Error fetching participant profiles:', profilesError);
        return [];
      }

      return challengeData.participants.map(id => {
        const profile = profiles?.find(p => p.id === id);
        return {
          id,
          name: profile?.name || `User ${id.slice(0, 4)}`,
          avatar: profile?.avatar_url
        };
      });
    } catch (error) {
      console.error('Error loading participants:', error);
      return [];
    }
  };

  // Get creator's avatar
  const getCreatorAvatar = async (userId: string): Promise<string | undefined> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching creator avatar:', error);
        return undefined;
      }

      return data?.avatar_url;
    } catch (error) {
      console.error('Error loading creator avatar:', error);
      return undefined;
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
    getCreatorAvatar
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
