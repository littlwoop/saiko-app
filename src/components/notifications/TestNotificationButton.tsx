import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { sendPushNotification } from '@/lib/notifications';
import { useToast } from '@/components/ui/use-toast';

export function TestNotificationButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const handleTest = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      // Also test with a simple notification via the Notification API first
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const testNotification = new Notification('Browser Notification Test', {
            body: 'If you see this, browser notifications work. Checking push notifications...',
            icon: '/icon-192.png',
            tag: 'browser-test',
          });
          console.log('Browser notification created:', testNotification);
          setTimeout(() => testNotification.close(), 3000);
        } catch (error) {
          console.error('Browser notification failed:', error);
        }
      }

      // Now test push notification
      console.log('Sending push notification test...');
      const success = await sendPushNotification(user.id, {
        title: 'Push Notification Test',
        body: 'This is a test push notification sent via Edge Function. If you see this, push notifications are working!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'push-test',
        requireInteraction: false,
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
      });

      if (success) {
        toast({
          title: 'Push Notification Sent',
          description: 'Check your device for the notification. Also check the browser console and Edge Function logs.',
        });
      } else {
        throw new Error('Failed to send - check Edge Function logs');
      }
    } catch (error) {
      console.error('Test notification error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test notification',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!user) return null;

  return (
    <Button
      onClick={handleTest}
      variant="secondary"
      disabled={isSending}
      className="w-full sm:w-auto"
    >
      <Bell className="mr-2 h-4 w-4" />
      {isSending ? 'Sending Test...' : 'Test Browser + Push Notification'}
    </Button>
  );
}
