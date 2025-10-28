import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { stravaService } from "@/lib/strava";
import { StravaAthlete, StravaConnection } from "@/types";
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

  const loadConnection = useCallback(async () => {
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
        description: t("profileImportFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, t, toast]);

  useEffect(() => {
    if (user) {
      loadConnection();
    }
  }, [user, loadConnection]);

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
        description: error instanceof Error ? error.message : t("profileImportFailed"),
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
        description: t("profileImportedSuccessfully"),
      });
    } catch (error) {
      console.error("Error importing profile:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("profileImportFailed"),
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
        description: t("stravaAccountDisconnected"),
      });
    } catch (error) {
      console.error("Error disconnecting Strava:", error);
      toast({
        title: t("error"),
        description: t("stravaDisconnectFailed"),
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
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer (same as strava service)
    
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
          <span className="ml-2">{t("loadingStravaConnection")}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {t("stravaConnection")}
        </CardTitle>
        <CardDescription>
          {t("stravaConnectionDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connection ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("connectStravaAccount")}
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
                  {t("connecting")}
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("connectToStrava")}
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
                  {status.status === 'connected' ? t('connected') : t('expired')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {t("stravaAthleteId")}: {connection.stravaAthleteId}
                </span>
              </div>
            </div>

            {athlete && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="font-medium">{athlete.firstname} {athlete.lastname}</div>
                  </div>
                  {athlete.city && (
                    <div>
                      <span className="text-muted-foreground">{t("location")}:</span>
                      <div className="font-medium">
                        {athlete.city}{athlete.state && `, ${athlete.state}`}
                      </div>
                    </div>
                  )}
                  {athlete.country && (
                    <div>
                      <span className="text-muted-foreground">{t("location")}:</span>
                      <div className="font-medium">{athlete.country}</div>
                    </div>
                  )}
                  {athlete.bio && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">{t("location")}:</span>
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
                    {t("importingProfile")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("importProfile")}
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
                    {t("disconnecting")}
                  </>
                ) : (
                  <>
                    <Unlink className="mr-2 h-4 w-4" />
                    {t("disconnect")}
                  </>
                )}
              </Button>
            </div>

            {status.status === 'expired' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("stravaConnectionExpired")}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
