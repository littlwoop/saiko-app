import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Challenge, Objective, UserChallenge, UserProgress } from "@/types";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

interface ChallengeContextType {
  challenges: Challenge[];
  userChallenges: UserChallenge[];
  userProgress: UserProgress[];
  loading: boolean;
  createChallenge: (challenge: Omit<Challenge, "id" | "createdById" | "creatorName" | "participants" | "totalPoints">) => void;
  joinChallenge: (challengeId: string) => void;
  updateProgress: (challengeId: string, objectiveId: string, value: number, notes?: string) => void;
  getUserChallenges: () => Challenge[];
  refreshChallenges: () => Promise<void>;
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
  
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Load challenges from Supabase
  const fetchChallenges = async () => {
    try {
      setLoading(true);
      
      // Fetch challenges
      const { data: challengesData, error: challengesError } = await supabase
        .from('challenges')
        .select('*');
      
      if (challengesError) {
        console.error('Error fetching challenges:', challengesError);
        toast({ 
          title: "Error", 
          description: challengesError.message, 
          variant: "destructive" 
        });
      } else {
        setChallenges(challengesData || []);
        
        // Create user challenges from challenges where user is a participant
        if (user) {
          const userChallengesData = challengesData
            ?.filter(challenge => challenge.participants.includes(user.id))
            .map(challenge => ({
              userId: user.id,
              challengeId: challenge.id,
              joinedAt: new Date().toISOString(), // This is approximate since we don't store join date
              totalScore: 0 // This will be calculated from entries
            })) || [];
          
          setUserChallenges(userChallengesData);

          // Load entries for each challenge the user has joined
          for (const challenge of challengesData || []) {
            if (challenge.participants.includes(user.id)) {
              await loadChallengeEntries(challenge.id);
            }
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({ 
        title: "Error", 
        description: "Failed to load challenges", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, [user]);

  // Load entries for a specific challenge
  const loadChallengeEntries = async (challengeId: string) => {
    if (!user) return;

    try {
      // Fetch latest progress for each objective
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: false })
        .returns<Entry[]>();
      
      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        return;
      }

      if (entriesData) {
        // Calculate total progress for each objective by summing all entries
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

        // Calculate total points for the challenge
        const challenge = challenges.find(c => c.id === challengeId);
        if (challenge) {
          const totalPoints = challenge.objectives.reduce((points, objective) => {
            const progress = progressMap[`${challengeId}-${objective.id}`];
            if (progress) {
              return points + (progress.currentValue * objective.pointsPerUnit);
            }
            return points;
          }, 0);

          // Update user challenge with total points
          setUserChallenges(prev => prev.map(uc => 
            uc.challengeId === challengeId
              ? { ...uc, totalScore: totalPoints }
              : uc
          ));
        }

        setUserProgress(Object.values(progressMap));
      }
    } catch (error) {
      console.error('Error loading entries:', error);
      toast({
        title: "Error",
        description: "Failed to load challenge progress",
        variant: "destructive"
      });
    }
  };

  // Create a new challenge in Supabase
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
    };
    const { data, error } = await supabase
      .from('challenges')
      .insert([newChallenge])
      .select();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      setChallenges((prev) => [...prev, ...data]);
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

    // Check if user is already in the challenge
    const alreadyJoined = userChallenges.some(
      uc => uc.userId === user.id && uc.challengeId === challengeId
    );

    if (alreadyJoined) {
      toast({
        title: "Info",
        description: "You've already joined this challenge",
      });
      return;
    }

    try {
      // Get current challenge data
      const { data: challengeData, error: fetchError } = await supabase
        .from('challenges')
        .select('participants')
        .eq('id', challengeId)
        .single();

      if (fetchError) {
        console.error('Error fetching challenge:', fetchError);
        throw fetchError;
      }

      // Ensure participants is an array
      const currentParticipants = Array.isArray(challengeData?.participants) 
        ? challengeData.participants 
        : [];

      // Check if user is already in the participants array
      if (currentParticipants.includes(user.id)) {
        toast({
          title: "Info",
          description: "You've already joined this challenge",
        });
        return;
      }

      // Update the challenge participants in the database
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

      // Refresh challenges to get the updated data
      await fetchChallenges();

      // Create user challenge record
      const newUserChallenge: UserChallenge = {
        userId: user.id,
        challengeId,
        joinedAt: new Date().toISOString(),
        totalScore: 0,
      };
      
      setUserChallenges([...userChallenges, newUserChallenge]);

      // Initialize progress for the challenge
      await loadChallengeEntries(challengeId);

      toast({
        title: "Success!",
        description: "You've joined the challenge",
      });
    } catch (error) {
      console.error('Error joining challenge:', error);
      toast({
        title: "Error",
        description: "Failed to join the challenge. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Update progress for an objective
  const updateProgress = async (challengeId: string, objectiveId: string, value: number, notes?: string) => {
    if (!user) return;

    try {
      // Create a new entry for this progress update
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

      // Fetch all entries for this challenge to recalculate total score
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: false })
        .returns<Entry[]>();

      if (entriesError) {
        console.error('Error fetching entries:', entriesError);
        return;
      }

      if (entriesData) {
        // Calculate total progress for each objective by summing all entries
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

        // Calculate total points for the challenge
        const challenge = challenges.find(c => c.id === challengeId);
        if (challenge) {
          const totalPoints = challenge.objectives.reduce((points, objective) => {
            const progress = progressMap[`${challengeId}-${objective.id}`];
            if (progress) {
              return points + (progress.currentValue * objective.pointsPerUnit);
            }
            return points;
          }, 0);

          // Update user challenge with total points
          setUserChallenges(prev => prev.map(uc => 
            uc.challengeId === challengeId
              ? { ...uc, totalScore: totalPoints }
              : uc
          ));
        }

        setUserProgress(Object.values(progressMap));
      }

      toast({
        title: "Progress Updated",
        description: "Your progress has been saved successfully.",
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

  // Get challenges that the current user has joined
  const getUserChallenges = () => {
    if (!user) return [];
    
    const userChallengeIds = userChallenges
      .filter(uc => uc.userId === user.id)
      .map(uc => uc.challengeId);
    
    return challenges.filter(challenge => userChallengeIds.includes(challenge.id));
  };

  const value = {
    challenges,
    userChallenges,
    userProgress,
    loading,
    createChallenge,
    joinChallenge,
    updateProgress,
    getUserChallenges,
    refreshChallenges: fetchChallenges
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
