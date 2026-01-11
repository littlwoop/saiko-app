import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  getCurrentPushSubscription,
  isPushNotificationSupported 
} from '@/lib/push-subscription';
import { requestNotificationPermission, getNotificationPermission } from '@/lib/notifications';
import { useToast } from '@/components/ui/use-toast';

interface EnableNotificationsButtonProps {
  vapidPublicKey?: string;
}

export function EnableNotificationsButton({ vapidPublicKey }: EnableNotificationsButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user || !isPushNotificationSupported()) {
        setIsLoading(false);
        return;
      }

      setPermission(getNotificationPermission());
      const subscription = await getCurrentPushSubscription();
      setIsSubscribed(!!subscription);
      setIsLoading(false);
    };

    checkSubscription();
  }, [user]);

  const handleEnableNotifications = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to enable notifications',
        variant: 'destructive',
      });
      return;
    }

    if (!isPushNotificationSupported()) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser',
        variant: 'destructive',
      });
      return;
    }

    if (!vapidPublicKey) {
      toast({
        title: 'Configuration Error',
        description: 'Push notifications are not configured. Please contact support.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Wait for service worker to be ready
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker not supported');
      }

      // Ensure service worker is registered first
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        // Try to register the service worker
        registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered:', registration);
      }

      // Wait for service worker to be ready
      registration = await navigator.serviceWorker.ready;
      console.log('Service worker ready');

      // Request notification permission first
      let currentPermission = getNotificationPermission();
      console.log('Current permission:', currentPermission);
      
      if (currentPermission === 'default') {
        currentPermission = await requestNotificationPermission();
        setPermission(currentPermission);
        console.log('Permission requested, result:', currentPermission);
      }

      if (currentPermission !== 'granted') {
        if (currentPermission === 'denied') {
          toast({
            title: 'Permission Denied',
            description: 'Notification permission was denied. Please enable it in your browser settings.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Permission Required',
            description: 'Please allow notifications to enable push notifications',
            variant: 'destructive',
          });
        }
        setIsLoading(false);
        return;
      }

      // Subscribe to push notifications
      const subscription = await subscribeToPushNotifications(user.id, vapidPublicKey);

      if (subscription) {
        setIsSubscribed(true);
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive push notifications for incomplete challenges',
        });
      } else {
        throw new Error('Failed to subscribe to push notifications');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to enable notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const success = await unsubscribeFromPushNotifications(user.id);
      if (success) {
        setIsSubscribed(false);
        toast({
          title: 'Notifications Disabled',
          description: 'You will no longer receive push notifications',
        });
      }
    } catch (error) {
      console.error('Error disabling notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to disable notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isPushNotificationSupported()) {
    return null;
  }

  if (isLoading) {
    return (
      <Button disabled variant="outline">
        <Bell className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  if (isSubscribed) {
    return (
      <Button 
        onClick={handleDisableNotifications} 
        variant="outline"
        disabled={isLoading}
      >
        <BellOff className="mr-2 h-4 w-4" />
        Disable Notifications
      </Button>
    );
  }

  if (permission === 'denied') {
    return (
      <Button disabled variant="outline" title="Notification permission was denied. Please enable it in your browser settings.">
        <BellOff className="mr-2 h-4 w-4" />
        Notifications Blocked
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleEnableNotifications} 
      variant="default"
      disabled={isLoading || !vapidPublicKey}
    >
      <Bell className="mr-2 h-4 w-4" />
      Enable Notifications
    </Button>
  );
}
