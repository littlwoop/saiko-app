
import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Challenge, Objective, UserChallenge, UserProgress } from "@/types";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";

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

// Mock data for challenges
const initialChallenges: Challenge[] = [
  {
    id: "1",
    title: "Summer Fitness Challenge",
    description: "Get fit during summer with this 30-day challenge",
    createdById: "1",
    creatorName: "John Doe",
    startDate: "2025-06-01",
    endDate: "2025-06-30",
    objectives: [
      {
        id: "101",
        title: "Daily Steps",
        description: "Walk at least 10,000 steps every day",
        targetValue: 10000,
        unit: "steps",
        pointsPerUnit: 0.01,
      },
      {
        id: "102",
        title: "Weekly Runs",
        description: "Complete at least 3 runs per week",
        targetValue: 12, // 3 runs × 4 weeks
        unit: "runs",
        pointsPerUnit: 100,
      }
    ],
    participants: ["1", "2"],
    totalPoints: 1200,
  },
  {
    id: "2",
    title: "Reading Challenge",
    description: "Read more books this month",
    createdById: "2",
    creatorName: "Jane Smith",
    startDate: "2025-05-01",
    endDate: "2025-05-31",
    objectives: [
      {
        id: "201",
        title: "Books Completed",
        description: "Finish reading books completely",
        targetValue: 4,
        unit: "books",
        pointsPerUnit: 200,
      },
      {
        id: "202",
        title: "Reading Minutes",
        description: "Time spent reading daily",
        targetValue: 1500, // 50 minutes × 30 days
        unit: "minutes",
        pointsPerUnit: 1,
      }
    ],
    participants: ["2"],
    totalPoints: 2300,
  }
];

const initialUserChallenges: UserChallenge[] = [
  {
    userId: "1",
    challengeId: "1",
    joinedAt: "2025-05-20",
    totalScore: 450,
  },
  {
    userId: "2",
    challengeId: "1",
    joinedAt: "2025-05-21",
    totalScore: 530,
  },
  {
    userId: "2",
    challengeId: "2",
    joinedAt: "2025-05-01",
    totalScore: 1200,
  }
];

const initialUserProgress: UserProgress[] = [
  {
    userId: "1",
    challengeId: "1",
    objectiveId: "101",
    currentValue: 45000, // steps
  },
  {
    userId: "1",
    challengeId: "1",
    objectiveId: "102",
    currentValue: 0, // runs
  },
  {
    userId: "2",
    challengeId: "1",
    objectiveId: "101",
    currentValue: 53000, // steps
  },
  {
    userId: "2",
    challengeId: "1",
    objectiveId: "102",
    currentValue: 0, // runs
  },
  {
    userId: "2",
    challengeId: "2",
    objectiveId: "201",
    currentValue: 2, // books
  },
  {
    userId: "2",
    challengeId: "2",
    objectiveId: "202",
    currentValue: 600, // minutes
  },
];

export const ChallengeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>(initialUserChallenges);
  const [userProgress, setUserProgress] = useState<UserProgress[]>(initialUserProgress);

  // Create a new challenge
  const createChallenge = (challengeData: Omit<Challenge, "id" | "createdById" | "creatorName" | "participants" | "totalPoints">) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a challenge",
        variant: "destructive",
      });
      return;
    }

    // Calculate total possible points
    const totalPoints = challengeData.objectives.reduce((total, objective) => {
      return total + (objective.targetValue * objective.pointsPerUnit);
    }, 0);

    const newChallenge: Challenge = {
      ...challengeData,
      id: `${challenges.length + 1}`,
      createdById: user.id,
      creatorName: user.name,
      participants: [user.id],
      totalPoints,
    };

    setChallenges([...challenges, newChallenge]);
    
    // Automatically join the creator to the challenge
    const newUserChallenge: UserChallenge = {
      userId: user.id,
      challengeId: newChallenge.id,
      joinedAt: new Date().toISOString(),
      totalScore: 0,
    };
    
    setUserChallenges([...userChallenges, newUserChallenge]);
    
    // Initialize progress for objectives
    const newProgress = newChallenge.objectives.map(objective => ({
      userId: user.id,
      challengeId: newChallenge.id,
      objectiveId: objective.id,
      currentValue: 0,
    }));
    
    setUserProgress([...userProgress, ...newProgress]);

    toast({
      title: "Success!",
      description: "Challenge created successfully",
    });
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
