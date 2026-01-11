import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentPushSubscription } from '@/lib/push-subscription';
import { supabase } from '@/lib/supabase';

export function DebugNotifications() {
  const { user } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [dbSubscriptions, setDbSubscriptions] = useState<any[]>([]);

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
        <CardTitle>Debug Push Notifications</CardTitle>
        <CardDescription>Check subscription status and test service worker</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={checkSubscription} variant="outline">
            Check Subscription Status
          </Button>
          <Button onClick={testServiceWorker} variant="outline">
            Test Service Worker
          </Button>
        </div>

        {subscriptionInfo && (
          <div className="p-4 bg-muted rounded-md">
            <h3 className="font-semibold mb-2">Browser Subscription:</h3>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(subscriptionInfo, null, 2)}
            </pre>
          </div>
        )}

        {dbSubscriptions.length > 0 && (
          <div className="p-4 bg-muted rounded-md">
            <h3 className="font-semibold mb-2">Database Subscriptions ({dbSubscriptions.length}):</h3>
            <pre className="text-xs overflow-auto">
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
          <p className="text-sm text-muted-foreground">
            No browser subscription found. Enable notifications first.
          </p>
        )}

        {dbSubscriptions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No database subscriptions found for this user.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
