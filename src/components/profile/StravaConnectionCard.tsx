import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { stravaService } from "@/lib/strava";
import { StravaConnection, StravaAthlete } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { 
  Activity, 
  ExternalLink, 
  RefreshCw, 
  Unlink, 
  CheckCircle, 
  AlertCircle,
  Loader2 
} from "lucide-react";

export default function StravaConnectionCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  
  const [connection, setConnection] = useState<StravaConnection | null>(null);
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    if (user) {
      loadConnection();
    }
  }, [user]);

  const loadConnection = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const conn = await stravaService.getConnection(user.id);
      setConnection(conn);
      
      if (conn) {
        // Get athlete profile
        const accessToken = await stravaService.ensureValidToken(conn);
        const athleteData = await stravaService.getAthleteProfile(accessToken);
        setAthlete(athleteData);
      }
    } catch (error) {
      console.error("Error loading Strava connection:", error);
      toast({
        title: t("error"),
        description: "Failed to load Strava connection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user) return;

    try {
      setIsConnecting(true);
      const authUrl = await stravaService.getAuthorizationUrl(user.id);
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error initiating Strava connection:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : "Failed to initiate Strava connection",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleImportProfile = async () => {
    if (!user || !connection) return;

    try {
      setIsImporting(true);
      const athleteData = await stravaService.importProfile(user.id);
      setAthlete(athleteData);
      
      toast({
        title: t("success"),
        description: "Profile information imported from Strava successfully!",
      });
    } catch (error) {
      console.error("Error importing profile:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : "Failed to import profile",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      setIsDisconnecting(true);
      await stravaService.disconnect(user.id);
      setConnection(null);
      setAthlete(null);
      
      toast({
        title: t("success"),
        description: "Strava account disconnected successfully",
      });
    } catch (error) {
      console.error("Error disconnecting Strava:", error);
      toast({
        title: t("error"),
        description: "Failed to disconnect Strava account",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getConnectionStatus = () => {
    if (!connection) return { status: 'disconnected', color: 'gray' };
    
    const expiresAt = new Date(connection.expiresAt).getTime();
    const now = Date.now();
    const bufferTime = 24 * 60 * 60 * 1000; // 24 hours buffer
    
    if (now >= expiresAt - bufferTime) {
      return { status: 'expired', color: 'red' };
    }
    
    return { status: 'connected', color: 'green' };
  };

  const status = getConnectionStatus();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading Strava connection...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Strava Integration
        </CardTitle>
        <CardDescription>
          Connect your Strava account to import your profile information and activity data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connection ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Connect your Strava account to automatically import your profile information and sync your fitness data.
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect to Strava
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={status.color === 'green' ? 'default' : 'destructive'}>
                  {status.status === 'connected' && <CheckCircle className="mr-1 h-3 w-3" />}
                  {status.status === 'expired' && <AlertCircle className="mr-1 h-3 w-3" />}
                  {status.status === 'connected' ? 'Connected' : 'Expired'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Strava Athlete ID: {connection.stravaAthleteId}
                </span>
              </div>
            </div>

            {athlete && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="font-medium mb-2">Imported Profile Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <div className="font-medium">{athlete.firstname} {athlete.lastname}</div>
                  </div>
                  {athlete.city && (
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <div className="font-medium">
                        {athlete.city}{athlete.state && `, ${athlete.state}`}
                      </div>
                    </div>
                  )}
                  {athlete.country && (
                    <div>
                      <span className="text-muted-foreground">Country:</span>
                      <div className="font-medium">{athlete.country}</div>
                    </div>
                  )}
                  {athlete.bio && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Bio:</span>
                      <div className="font-medium">{athlete.bio}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleImportProfile} 
                disabled={isImporting}
                variant="outline"
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Import Profile
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleDisconnect} 
                disabled={isDisconnecting}
                variant="destructive"
                className="flex-1"
              >
                {isDisconnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect
                  </>
                )}
              </Button>
            </div>

            {status.status === 'expired' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your Strava connection has expired. Please reconnect to continue syncing your data.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
