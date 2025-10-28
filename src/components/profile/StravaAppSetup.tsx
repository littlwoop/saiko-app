import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import DatabaseSetupAlert from "./DatabaseSetupAlert";
import { 
  Settings, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Info
} from "lucide-react";

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

export default function StravaAppSetup() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  
  const [config, setConfig] = useState<StravaAppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDatabaseError, setHasDatabaseError] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: `${window.location.origin}/auth/strava/callback`
  });

  useEffect(() => {
    if (user) {
      loadConfig();
    }
  }, [user]);

  const loadConfig = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('strava_app_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No config found, which is fine
          setConfig(null);
          return;
        }
        
        // Check if table doesn't exist
        if (error.message.includes('relation "strava_app_configs" does not exist') || 
            error.message.includes('406') || 
            error.message.includes('Not Acceptable')) {
          console.warn('Strava app configs table does not exist. Please run the database migration.');
          setHasDatabaseError(true);
          setConfig(null);
          return;
        }
        
        throw error;
      }

      setConfig(data);
      if (data) {
        setFormData({
          clientId: data.client_id,
          clientSecret: data.client_secret,
          redirectUri: data.redirect_uri
        });
      }
    } catch (error) {
      console.error('Error loading Strava config:', error);
      toast({
        title: t("error"),
        description: "Failed to load Strava configuration. Please ensure the database migration has been run.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      
      const configData = {
        user_id: user.id,
        client_id: formData.clientId,
        client_secret: formData.clientSecret,
        redirect_uri: formData.redirectUri,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('strava_app_configs')
        .upsert(configData, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;

      setConfig({
        id: data.id,
        userId: data.user_id,
        clientId: data.client_id,
        clientSecret: data.client_secret,
        redirectUri: data.redirect_uri,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });

      toast({
        title: t("success"),
        description: "Strava configuration saved successfully!",
      });
    } catch (error) {
      console.error('Error saving Strava config:', error);
      toast({
        title: t("error"),
        description: "Failed to save Strava configuration",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openStravaAppCreation = () => {
    window.open('https://www.strava.com/settings/api', '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading Strava configuration...</span>
        </CardContent>
      </Card>
    );
  }

  // Show database setup alert if there's a database error
  if (hasDatabaseError) {
    return <DatabaseSetupAlert />;
  }

  // Show setup form if no config exists
  if (!config && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("stravaAppSetup")}
          </CardTitle>
          <CardDescription>
            {t("stravaAppSetupDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t("stravaAppSetupDescription")}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">{t("clientId")}</Label>
              <Input
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                placeholder={t("enterClientId")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">{t("clientSecret")}</Label>
              <Input
                id="clientSecret"
                type="password"
                value={formData.clientSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
                placeholder={t("enterClientSecret")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="redirectUri">{t("redirectUri")}</Label>
              <Input
                id="redirectUri"
                value={formData.redirectUri}
                onChange={(e) => setFormData(prev => ({ ...prev, redirectUri: e.target.value }))}
                placeholder={t("enterRedirectUri")}
              />
              <p className="text-sm text-muted-foreground">
                {t("redirectUriHelp")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveConfig} disabled={isSaving || !formData.clientId || !formData.clientSecret}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  t("saveConfiguration")
                )}
              </Button>
              
              <Button variant="outline" onClick={openStravaAppCreation}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("createStravaApp")}
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">{t("howToCreateStravaApp")}</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>{t("stravaAppInstruction1")} <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t("stravaAppInstructionsLink")}</a></li>
              <li>{t("stravaAppInstruction2")}</li>
              <li>{t("stravaAppInstruction3")}
                <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                  <li><strong>{t("applicationName")}:</strong> {t("applicationNameValue")}</li>
                  <li><strong>{t("category")}:</strong> {t("categoryValue")}</li>
                  <li><strong>{t("authorizationCallbackDomain")}:</strong> {window.location.hostname}</li>
                </ul>
              </li>
              <li>{t("stravaAppInstruction4")}</li>
              <li>{t("stravaAppInstruction5")}</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show configured state if config exists
  if (config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("stravaAppSetup")}
          </CardTitle>
          <CardDescription>
            {t("stravaAppSetupDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {t("configured")}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setConfig(null)}>
              {t("updateConfiguration")}
            </Button>
          </div>

          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">{t("currentConfiguration")}</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Client ID:</span>
                <div className="font-mono text-xs bg-background p-1 rounded">
                  {config?.clientId?.substring(0, 8)}...
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Redirect URI:</span>
                <div className="font-medium">{config?.redirectUri}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Last Updated:</span>
                <div className="font-medium">
                  {config?.updatedAt ? new Date(config.updatedAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Your Strava app is configured! You can now use Strava integration features.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // This should never be reached, but just in case
  return null;
}
