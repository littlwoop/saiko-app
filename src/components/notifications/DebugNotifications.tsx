import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentPushSubscription } from '@/lib/push-subscription';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { TestNotificationButton } from './TestNotificationButton';

export function DebugNotifications() {
  const { user } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [dbSubscriptions, setDbSubscriptions] = useState<any[]>([]);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<{
    registered: boolean;
    active: boolean;
    scope?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    checkServiceWorkerStatus();
  }, []);

  const checkServiceWorkerStatus = async () => {
    if (!('serviceWorker' in navigator)) {
      setServiceWorkerStatus({
        registered: false,
        active: false,
        error: 'Service Workers not supported in this browser',
      });
      return;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) {
        setServiceWorkerStatus({
          registered: false,
          active: false,
          error: 'No service worker registered',
        });
        return;
      }

      const registration = registrations[0];
      setServiceWorkerStatus({
        registered: true,
        active: !!registration.active,
        scope: registration.scope,
      });
    } catch (error) {
      setServiceWorkerStatus({
        registered: false,
        active: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const checkSubscription = async () => {
    if (!user) return;

    // Check browser subscription
    const subscription = await getCurrentPushSubscription();
    if (subscription) {
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      
      let keys = null;
      if (p256dhKey && authKey) {
        const p256dhArray = new Uint8Array(p256dhKey);
        const authArray = new Uint8Array(authKey);
        const p256dhString = String.fromCharCode(...p256dhArray);
        const authString = String.fromCharCode(...authArray);
        
        keys = {
          p256dh: btoa(p256dhString),
          auth: btoa(authString),
        };
      }

      setSubscriptionInfo({
        endpoint: subscription.endpoint,
        keys,
        expirationTime: subscription.expirationTime,
      });
    } else {
      setSubscriptionInfo(null);
    }

    // Check database subscriptions
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      setDbSubscriptions([]);
    } else {
      setDbSubscriptions(data || []);
    }
  };

  const testServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      console.log('Service Worker registration:', registration);
      console.log('Service Worker scope:', registration.scope);
      console.log('Active worker:', registration.active);
      
      // Send a test message to service worker
      if (registration.active) {
        registration.active.postMessage({ type: 'TEST', data: 'Hello from page' });
        console.log('Sent test message to service worker');
      }
    }
  };

  if (!user) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Debug Push Notifications</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Check subscription status and test service worker
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service Worker Status */}
        {serviceWorkerStatus && (
          <div className="p-3 sm:p-4 bg-muted rounded-md border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm sm:text-base">Service Worker Status</h3>
              {serviceWorkerStatus.registered && serviceWorkerStatus.active ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {serviceWorkerStatus.registered ? 'Inactive' : 'Not Registered'}
                </Badge>
              )}
            </div>
            {serviceWorkerStatus.scope && (
              <p className="text-xs sm:text-sm text-muted-foreground break-all">
                Scope: {serviceWorkerStatus.scope}
              </p>
            )}
            {serviceWorkerStatus.error && (
              <p className="text-xs sm:text-sm text-destructive mt-1">
                {serviceWorkerStatus.error}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={checkSubscription} 
            variant="outline"
            className="w-full sm:w-auto"
          >
            Check Subscription Status
          </Button>
          <Button 
            onClick={testServiceWorker} 
            variant="outline"
            className="w-full sm:w-auto"
          >
            Test Service Worker
          </Button>
          <Button 
            onClick={checkServiceWorkerStatus} 
            variant="outline"
            className="w-full sm:w-auto"
          >
            Refresh Status
          </Button>
        </div>

        {/* Test Notification Button */}
        <div className="pt-2">
          <TestNotificationButton />
        </div>

        {subscriptionInfo && (
          <div className="p-3 sm:p-4 bg-muted rounded-md border">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Browser Subscription:</h3>
            <pre className="text-xs sm:text-sm overflow-auto bg-background p-2 rounded border max-h-40 sm:max-h-60">
              {JSON.stringify(subscriptionInfo, null, 2)}
            </pre>
          </div>
        )}

        {dbSubscriptions.length > 0 && (
          <div className="p-3 sm:p-4 bg-muted rounded-md border">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">
              Database Subscriptions ({dbSubscriptions.length}):
            </h3>
            <pre className="text-xs sm:text-sm overflow-auto bg-background p-2 rounded border max-h-40 sm:max-h-60">
              {JSON.stringify(
                dbSubscriptions.map((sub) => ({
                  id: sub.id,
                  endpoint: sub.endpoint.substring(0, 50) + '...',
                  hasP256dh: !!sub.p256dh,
                  hasAuth: !!sub.auth,
                  createdAt: sub.created_at,
                })),
                null,
                2
              )}
            </pre>
          </div>
        )}

        {!subscriptionInfo && (
          <p className="text-xs sm:text-sm text-muted-foreground">
            No browser subscription found. Enable notifications first.
          </p>
        )}

        {dbSubscriptions.length === 0 && subscriptionInfo && (
          <p className="text-xs sm:text-sm text-muted-foreground">
            No database subscriptions found for this user.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
