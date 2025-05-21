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

export const ChallengeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Load challenges from Supabase
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        setLoading(true);
        console.log('Fetching challenges...');
        const { data, error } = await supabase
          .from('challenges')
          .select('*');
        
        if (error) {
          console.error('Error fetching challenges:', error);
          toast({ 
            title: "Error", 
            description: error.message, 
            variant: "destructive" 
          });
        } else {
          console.log('Challenges loaded:', data);
          setChallenges(data || []);
        }
      } catch (err) {
        console.error('Unexpected error fetching challenges:', err);
        toast({ 
          title: "Error", 
          description: "Failed to load challenges", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchChallenges();
  }, []);

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
      participants: [user.id],
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
  const updateProgress = (challengeId: string, objectiveId: string, value: number) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to update progress",
        variant: "destructive",
      });
      return;
    }

    // Find the challenge and objective
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) {
      toast({
        title: "Error",
        description: "Challenge not found",
        variant: "destructive",
      });
      return;
    }

    const objective = challenge.objectives.find(o => o.id === objectiveId);
    if (!objective) {
      toast({
        title: "Error",
        description: "Objective not found",
        variant: "destructive",
      });
      return;
    }

    // Update the progress
    const updatedProgress = userProgress.map(progress => {
      if (
        progress.userId === user.id &&
        progress.challengeId === challengeId &&
        progress.objectiveId === objectiveId
      ) {
        return { ...progress, currentValue: value };
      }
      return progress;
    });
    
    setUserProgress(updatedProgress);

    // Calculate new score
    const userChallengeProgress = updatedProgress.filter(
      p => p.userId === user.id && p.challengeId === challengeId
    );
    
    let totalScore = 0;
    challenge.objectives.forEach(obj => {
      const progress = userChallengeProgress.find(p => p.objectiveId === obj.id);
      if (progress) {
        // Cap the progress at the target value
        const cappedValue = Math.min(progress.currentValue, obj.targetValue);
        totalScore += cappedValue * obj.pointsPerUnit;
      }
    });

    // Update user challenge score
    const updatedUserChallenges = userChallenges.map(uc => {
      if (uc.userId === user.id && uc.challengeId === challengeId) {
        return { ...uc, totalScore };
      }
      return uc;
    });
    
    setUserChallenges(updatedUserChallenges);

    toast({
      title: "Progress Updated",
      description: `Your progress for ${objective.title} has been updated.`,
    });
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
