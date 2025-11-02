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
  strava?: boolean; // Flag to indicate if Strava integration is enabled
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

export interface StravaActivity {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  location_city?: string;
  location_state?: string;
  location_country?: string;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  workout_type?: number;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  suffer_score?: number;
}

// Strava DB connection record used across app
export interface StravaConnection {
  id: string;
  userId: string;
  stravaAthleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO string or epoch string depending on persistence
  createdAt: string;
  updatedAt: string;
}

export type PersonalBestType = "5k" | "10k" | "half_marathon" | "marathon" | "longest_run" | "longest_bike_ride" | "olympic_triathlon";

export interface PersonalBest {
  id: string;
  userId: string;
  achievementType: PersonalBestType;
  timeSeconds?: number; // For time-based achievements
  distanceMeters?: number; // For distance-based achievements
  achievementDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}