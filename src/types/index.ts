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

export interface StravaAthlete {
  id: number;
  username?: string;
  resource_state: number;
  firstname: string;
  lastname: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
  badge_type_id: number;
  weight?: number;
  profile_medium?: string;
  profile?: string;
  friend?: boolean;
  follower?: boolean;
}

export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: StravaAthlete;
}

export interface StravaConnection {
  id: string;
  userId: string;
  stravaAthleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}