import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Challenge, Objective, UserChallenge, UserProgress } from "@/types";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

interface ChallengeContextType {
  challenges: Challenge[];
  userChallenges: UserChallenge[];
  userProgress: UserProgress[];
  createChallenge: (challenge: Omit<Challenge, "id" | "createdById" | "creatorName" | "participants" | "totalPoints">) => void;
  joinChallenge: (challengeId: string) => void;
  updateProgress: (challengeId: string, objectiveId: string, value: number) => void;
  getUserChallenges: () => Challenge[];
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

  // Load challenges and user progress from Supabase
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
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
        }

        // Fetch user challenges
        const { data: userChallengesData, error: userChallengesError } = await supabase
          .from('user_challenges')
          .select('*')
          .eq('user_id', user.id);
        
        if (userChallengesError) {
          console.error('Error fetching user challenges:', userChallengesError);
        } else {
          setUserChallenges(userChallengesData || []);
        }

        // Fetch latest progress for each objective
        const { data: entriesData, error: entriesError } = await supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .returns<Entry[]>();
        
        if (entriesError) {
          console.error('Error fetching entries:', entriesError);
        } else if (entriesData) {
          // Get the latest entry for each objective
          const latestEntries = entriesData.reduce((acc, entry) => {
            const key = `${entry.challenge_id}-${entry.objective_id}`;
            if (!acc[key]) {
              acc[key] = entry;
            }
            return acc;
          }, {} as Record<string, Entry>);

          // Convert entries to UserProgress format
          const progress = Object.values(latestEntries).map(entry => ({
            userId: entry.user_id,
            challengeId: entry.challenge_id,
            objectiveId: entry.objective_id,
            currentValue: entry.value
          }));

          setUserProgress(progress);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        toast({ 
          title: "Error", 
          description: "Failed to load data", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

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
  const joinChallenge = (challengeId: string) => {
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

    // Update the challenge participants
    setChallenges(challenges.map(challenge => {
      if (challenge.id === challengeId) {
        return {
          ...challenge,
          participants: [...challenge.participants, user.id]
        };
      }
      return challenge;
    }));

    // Create user challenge record
    const newUserChallenge: UserChallenge = {
      userId: user.id,
      challengeId,
      joinedAt: new Date().toISOString(),
      totalScore: 0,
    };
    
    setUserChallenges([...userChallenges, newUserChallenge]);

    // Find the challenge to get its objectives
    const challenge = challenges.find(c => c.id === challengeId);
    
    if (challenge) {
      // Initialize progress for all objectives in the challenge
      const newProgress = challenge.objectives.map(objective => ({
        userId: user.id,
        challengeId,
        objectiveId: objective.id,
        currentValue: 0,
      }));
      
      setUserProgress([...userProgress, ...newProgress]);
    }

    toast({
      title: "Success!",
      description: "You've joined the challenge",
    });
  };

  // Update progress for an objective
  const updateProgress = async (challengeId: string, objectiveId: string, value: number) => {
    if (!user) return;

    try {
      // Create a new entry for this progress update
      const { error: insertError } = await supabase
        .from('entries')
        .insert({
          user_id: user.id,
          challenge_id: challengeId,
          objective_id: objectiveId,
          value: value
        });

      if (insertError) {
        console.error('Error creating entry:', insertError);
        return;
      }

      // Update local state
      setUserProgress(prev => {
        const existing = prev.find(p => 
          p.challengeId === challengeId && p.objectiveId === objectiveId
        );

        if (existing) {
          return prev.map(p => 
            p.challengeId === challengeId && p.objectiveId === objectiveId
              ? { ...p, currentValue: value }
              : p
          );
        }

        return [...prev, {
          userId: user.id,
          challengeId,
          objectiveId,
          currentValue: value
        }];
      });

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

  return (
    <ChallengeContext.Provider
      value={{
        challenges,
        userChallenges,
        userProgress,
        createChallenge,
        joinChallenge,
        updateProgress,
        getUserChallenges,
      }}
    >
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
