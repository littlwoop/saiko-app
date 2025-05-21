
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

export interface Challenge {
  id: string;
  title: string;
  description: string;
  createdById: string;
  creatorName: string;
  startDate: string;
  endDate: string;
  objectives: Objective[];
  participants: string[];
  totalPoints: number;
}

export interface UserProgress {
  userId: string;
  challengeId: string;
  objectiveId: string;
  currentValue: number;
}

export interface UserChallenge {
  userId: string;
  challengeId: string;
  joinedAt: string;
  totalScore: number;
}
