import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { 
  CheckCircle, 
  Info
} from "lucide-react";

export default function StravaAppSetup() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
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
            Strava integration is pre-configured! You can now connect your Strava account directly from the challenge pages.
          </AlertDescription>
        </Alert>
        
        <div className="rounded-lg border p-4 bg-muted/50">
          <h4 className="font-medium mb-2">{t("currentConfiguration")}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge className="bg-green-500">
                <CheckCircle className="mr-1 h-3 w-3" />
                {t("configured")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Integration:</span>
              <span className="font-medium">Pre-configured</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}