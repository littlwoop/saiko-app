export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Objective {
  id: string;
  title: string;
  description?: string; // Optional for all challenge types
  targetValue?: number; // Optional for checklist challenges
  unit?: string; // Optional for checklist challenges
  pointsPerUnit?: number; // Optional for checklist challenges
  currentValue?: number;
}

export type ChallengeType = "standard" | "bingo" | "completion" | "checklist" | "collection";

export interface Challenge {
  id: number;
  title: string;
  description: string;
  createdById: string;
  creatorName: string;
  creatorAvatar?: string;
  startDate: string;
  endDate?: string; // Optional - challenges can be ongoing
  objectives: Objective[];
  participants: string[];
  totalPoints: number;
  challenge_type: ChallengeType;
  capedPoints?: boolean;
}

export interface UserProgress {
  userId: string;
  challengeId: number;
  objectiveId: string;
  currentValue: number;
}

export interface UserChallenge {
  userId: string;
  challengeId: number;
  joinedAt: string;
  totalScore: number;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  unit: string;
  points: number;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyChallengeEntry {
  id: string;
  userId: string;
  dailyChallengeId: string;
  completedAt: string;
  completedDate: string;
  valueAchieved?: number;
  pointsEarned: number;
  notes?: string;
}
