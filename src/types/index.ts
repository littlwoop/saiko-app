export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  unit: string;
  pointsPerUnit: number;
  currentValue?: number;
}

export type ChallengeType = "standard" | "bingo";

export interface Challenge {
  id: number;
  title: string;
  description: string;
  createdById: string;
  creatorName: string;
  creatorAvatar?: string;
  startDate: string;
  endDate: string;
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
