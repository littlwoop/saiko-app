import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import { 
  Settings, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Info,
  Bug
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

export default function StravaDebugInfo() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  
  const [config, setConfig] = useState<StravaAppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          setConfig(null);
          return;
        }
        throw error;
      }

      setConfig(data);
    } catch (error) {
      console.error('Error loading Strava config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testRedirectUri = () => {
    const currentOrigin = window.location.origin;
    const expectedRedirectUri = `${currentOrigin}/auth/strava/callback`;
    
    toast({
      title: "Redirect URI Debug Info",
      description: `Current: ${expectedRedirectUri}\nStrava App Domain should be: ${window.location.hostname}`,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Strava Debug Info
          </CardTitle>
          <CardDescription>
            Debug information for Strava integration issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No Strava configuration found. Please set up your Strava app first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const currentOrigin = window.location.origin;
  const expectedRedirectUri = `${currentOrigin}/auth/strava/callback`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Strava Debug Info
        </CardTitle>
        <CardDescription>
          Debug information for Strava integration issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Current Configuration</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Client ID:</span>
                <div className="font-mono text-xs bg-background p-1 rounded">
                  {config.clientId.substring(0, 8)}...
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Redirect URI:</span>
                <div className="font-medium">{config.redirectUri}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-blue-50">
            <h4 className="font-medium mb-2 text-blue-800">Expected Values</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-blue-700">Current Origin:</span>
                <div className="font-medium">{currentOrigin}</div>
              </div>
              <div>
                <span className="text-blue-700">Expected Redirect URI:</span>
                <div className="font-medium">{expectedRedirectUri}</div>
              </div>
              <div>
                <span className="text-blue-700">Strava Callback Domain:</span>
                <div className="font-medium">{window.location.hostname}</div>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Fix Instructions:</strong>
              <ol className="mt-2 ml-4 list-decimal">
                <li>Go to <a href="https://www.strava.com/settings/api" target="_blank" className="text-primary hover:underline">Strava API Settings</a></li>
                <li>Edit your app</li>
                <li>Set "Authorization Callback Domain" to: <code className="bg-muted px-1 rounded">{window.location.hostname}</code></li>
                <li>Save changes</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={testRedirectUri} variant="outline">
              <Bug className="mr-2 h-4 w-4" />
              Test Redirect URI
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.open('https://www.strava.com/settings/api', '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Strava Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
