import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Database, ExternalLink } from "lucide-react";

export default function DatabaseSetupAlert() {
  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Database className="h-5 w-5" />
          Database Setup Required
        </CardTitle>
        <CardDescription className="text-orange-700">
          The Strava integration requires database tables to be created first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to run the database migrations before using Strava integration.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <h4 className="font-medium text-orange-800">Required Migrations:</h4>
          <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside ml-4">
            <li><code>database/migrations/001_create_strava_connections.sql</code></li>
            <li><code>database/migrations/002_create_strava_app_configs.sql</code></li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-orange-800">How to run migrations:</h4>
          <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside ml-4">
            <li>Go to your Supabase project dashboard</li>
            <li>Navigate to SQL Editor</li>
            <li>Copy and paste the contents of each migration file</li>
            <li>Run the SQL</li>
            <li>Refresh this page</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Supabase Dashboard
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
