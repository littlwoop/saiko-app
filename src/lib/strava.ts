import { StravaAthlete, StravaTokenResponse, StravaConnection } from "@/types";
import { supabase } from "@/lib/supabase";

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
   * Generate the Strava OAuth authorization URL
   */
  async getAuthorizationUrl(userId: string): Promise<string> {
    const config = await this.getAppConfig(userId);
    
    if (!config) {
      throw new Error("Strava app not configured. Please set up your Strava app first.");
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "read,profile:read_all",
      approval_prompt: "force",
    });

    const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, userId: string): Promise<StravaTokenResponse> {
    const config = await this.getAppConfig(userId);
    
    if (!config) {
      throw new Error("Strava app not configured. Please set up your Strava app first.");
    }

    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to exchange code for token: ${errorData.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, userId: string): Promise<StravaTokenResponse> {
    const config = await this.getAppConfig(userId);
    
    if (!config) {
      throw new Error("Strava app not configured. Please set up your Strava app first.");
    }

    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
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

    if (now >= expiresAt - bufferTime) {
      // Token is expired or will expire soon, refresh it
      const tokenResponse = await this.refreshAccessToken(connection.refreshToken, connection.userId);
      
      // Update the connection in database
      await this.saveConnection(connection.userId, tokenResponse);
      
      return tokenResponse.access_token;
    }

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
