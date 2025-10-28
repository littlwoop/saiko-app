import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { stravaService } from "@/lib/strava";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Strava authorization failed: ${error}`);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('No authorization code received from Strava');
          return;
        }

        if (!user) {
          setStatus('error');
          setMessage('User not authenticated');
          return;
        }

        // Exchange code for token
        const tokenResponse = await stravaService.exchangeCodeForToken(code, user.id);
        
        // Save connection to database
        await stravaService.saveConnection(user.id, tokenResponse);
        
        // Import profile information
        await stravaService.importProfile(user.id);

        setStatus('success');
        setMessage('Strava account connected successfully! Your profile has been updated.');
        
        // Redirect to profile page after 3 seconds
        setTimeout(() => {
          navigate('/profile');
        }, 3000);

      } catch (error) {
        console.error('Strava callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      }
    };

    handleCallback();
  }, [searchParams, user, navigate]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className={`w-full max-w-md ${getStatusColor()}`}>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-xl font-semibold">
            {status === 'loading' && 'Connecting to Strava...'}
            {status === 'success' && 'Connection Successful!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we connect your Strava account.'}
            {status === 'success' && 'Your Strava account has been successfully connected.'}
            {status === 'error' && 'There was an issue connecting your Strava account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Alert className="mb-4">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          
          {status === 'success' && (
            <p className="text-sm text-gray-600 mb-4">
              You will be redirected to your profile page in a few seconds.
            </p>
          )}
          
          {status === 'error' && (
            <div className="space-y-2">
              <Button 
                onClick={() => navigate('/profile')}
                variant="outline"
                className="w-full"
              >
                Go to Profile
              </Button>
              <Button 
                onClick={() => navigate('/')}
                variant="ghost"
                className="w-full"
              >
                Go Home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
