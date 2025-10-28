import { StravaAthlete, StravaTokenResponse, StravaConnection, StravaActivity } from "@/types";
import { supabase } from "@/lib/supabase";

// Pre-configured Strava app credentials (you'll need to set these)
const STRAVA_CONFIG = {
  clientId: import.meta.env.VITE_STRAVA_CLIENT_ID || "YOUR_CLIENT_ID",
  clientSecret: import.meta.env.VITE_STRAVA_CLIENT_SECRET || "YOUR_CLIENT_SECRET", 
  redirectUri: import.meta.env.VITE_STRAVA_REDIRECT_URI || "https://www.saikochallenges.com/auth/strava/callback"
};

interface StravaAppConfig {
  id: string;
  userId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class StravaService {
  private static instance: StravaService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;

  static getInstance(): StravaService {
    if (!StravaService.instance) {
      StravaService.instance = new StravaService();
    }
    return StravaService.instance;
  }

  /**
   * Get Strava app configuration for a user
   */
  async getAppConfig(userId: string): Promise<StravaAppConfig | null> {
    const { data, error } = await supabase
      .from("strava_app_configs")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to get Strava app config: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      clientId: data.client_id,
      clientSecret: data.client_secret,
      redirectUri: data.redirect_uri,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Generate the Strava OAuth authorization URL using pre-configured app
   */
  async getAuthorizationUrl(userId: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: STRAVA_CONFIG.clientId,
      redirect_uri: STRAVA_CONFIG.redirectUri,
      response_type: "code",
      scope: "read,profile:read_all,activity:read",
      approval_prompt: "force",
      state: userId, // Pass userId in state for callback
    });

    const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
    return authUrl;
  }

  /**
   * Exchange authorization code for access token using pre-configured app
   */
  async exchangeCodeForToken(code: string, _userId: string): Promise<StravaTokenResponse> {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: STRAVA_CONFIG.clientId,
        client_secret: STRAVA_CONFIG.clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to exchange code for token: ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('Strava token exchange error:', errorData);
        errorMessage = `Failed to exchange code for token: ${errorData.message || JSON.stringify(errorData)}`;
      } catch (_e) {
        console.error('Could not parse Strava error response');
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Refresh access token using pre-configured app
   */
  async refreshAccessToken(refreshToken: string, _userId: string): Promise<StravaTokenResponse> {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: STRAVA_CONFIG.clientId,
        client_secret: STRAVA_CONFIG.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to refresh token: ${errorData.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get athlete profile information
   */
  async getAthleteProfile(accessToken: string): Promise<StravaAthlete> {
    const response = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to get athlete profile: ${errorData.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Save Strava connection to database
   */
  async saveConnection(
    userId: string,
    tokenResponse: StravaTokenResponse
  ): Promise<StravaConnection> {
    const connectionData = {
      user_id: userId,
      strava_athlete_id: tokenResponse.athlete.id,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: new Date(tokenResponse.expires_at * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("strava_connections")
      .upsert(connectionData, {
        onConflict: "user_id",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save Strava connection: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      stravaAthleteId: data.strava_athlete_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Get Strava connection for user
   */
  async getConnection(userId: string): Promise<StravaConnection | null> {
    const { data, error } = await supabase
      .from("strava_connections")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No connection found
        return null;
      }
      throw new Error(`Failed to get Strava connection: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      stravaAthleteId: data.strava_athlete_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Check if access token is expired and refresh if needed
   */
  async ensureValidToken(connection: StravaConnection): Promise<string> {
    const expiresAt = new Date(connection.expiresAt).getTime();
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    console.log('Token validation:', {
      now: new Date(now).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      bufferTime: bufferTime / 1000 / 60 + ' minutes',
      isExpired: now >= expiresAt - bufferTime,
      timeUntilExpiry: (expiresAt - now) / 1000 / 60 + ' minutes'
    });

    if (now >= expiresAt - bufferTime) {
      console.log("Token expired or expiring soon, refreshing...");
      try {
        // Token is expired or will expire soon, refresh it
        const tokenResponse = await this.refreshAccessToken(connection.refreshToken, connection.userId);
        
        // Update the connection in database
        await this.saveConnection(connection.userId, tokenResponse);
        
        console.log("Token refreshed successfully");
        return tokenResponse.access_token;
      } catch (error) {
        console.error("Failed to refresh token:", error);
        throw new Error(`Failed to refresh Strava token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log("Token is still valid");
    return connection.accessToken;
  }

  /**
   * Import profile information from Strava
   */
  async importProfile(userId: string): Promise<StravaAthlete> {
    const connection = await this.getConnection(userId);
    
    if (!connection) {
      throw new Error("No Strava connection found. Please connect your Strava account first.");
    }

    const accessToken = await this.ensureValidToken(connection);
    const athlete = await this.getAthleteProfile(accessToken);
    // Return athlete only; do not update user_profiles
    return athlete;
  }

  /**
   * Get athlete activities from the last month
   */
  async getRecentActivities(userId: string, days: number = 30): Promise<StravaActivity[]> {
    const connection = await this.getConnection(userId);
    
    if (!connection) {
      throw new Error("No Strava connection found. Please connect your Strava account first.");
    }

    console.log('Current connection:', {
      userId,
      expiresAt: connection.expiresAt,
      isExpired: new Date(connection.expiresAt) < new Date()
    });

    const accessToken = await this.ensureValidToken(connection);
    
    console.log('Using access token:', accessToken ? `${accessToken.substring(0, 10)}...` : 'null');
    
    // Calculate date range (last 30 days by default)
    const before = Math.floor(Date.now() / 1000);
    const after = Math.floor((Date.now() - (days * 24 * 60 * 60 * 1000)) / 1000);
    
    console.log('Fetching activities:', { before, after, days });
    
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?before=${before}&after=${after}&per_page=200`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('Strava API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `Failed to get activities: ${response.statusText}`;
      try {
        const errorData = await response.json();
        console.error('Strava activities error:', errorData);
        errorMessage = `Failed to get activities: ${errorData.message || JSON.stringify(errorData)}`;
      } catch (_e) {
        console.error('Could not parse Strava error response');
      }
      throw new Error(errorMessage);
    }

    const activities = await response.json();
    console.log('Successfully loaded activities:', activities.length);
    return activities;
  }

  /**
   * Disconnect Strava account
   */
  async disconnect(userId: string): Promise<void> {
    const { error } = await supabase
      .from("strava_connections")
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to disconnect Strava account: ${error.message}`);
    }
  }
}

export const stravaService = StravaService.getInstance();
