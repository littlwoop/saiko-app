import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { checkIncompleteCompletionChallenges } from '@/lib/completion-challenge-notifications';
import { requestNotificationPermission, getNotificationPermission, notifyIncompleteChallenges } from '@/lib/notifications';
import { subscribeToPushNotifications, isPushNotificationSupported, getCurrentPushSubscription } from '@/lib/push-subscription';

/**
 * Hook to check and send notifications for incomplete completion challenges
 * 
 * @param enabled - Whether to enable notification checking (default: true)
 * @param checkInterval - Interval in milliseconds to check for incomplete challenges (default: 60000 = 1 minute)
 * @param vapidPublicKey - VAPID public key for push notifications (required from environment)
 */
export function useCompletionNotifications(
  enabled: boolean = true,
  checkInterval: number = 60000,
  vapidPublicKey?: string
) {
  const { user } = useAuth();
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckDateRef = useRef<string | null>(null);

  // Check subscription status (don't auto-request permission - requires user gesture)
  useEffect(() => {
    if (!enabled || !user) return;

    const checkSubscriptionStatus = async () => {
      // Check if push notifications are supported
      if (!isPushNotificationSupported()) {
        return;
      }

      // Only check if already subscribed - don't request permission automatically
      // Permission must be requested via user interaction (button click)
      const existingSubscription = await getCurrentPushSubscription();
      if (existingSubscription) {
        setIsSubscribed(true);
      } else {
        setIsSubscribed(false);
      }
    };

    checkSubscriptionStatus();

    // Also listen for subscription changes
    const checkInterval = setInterval(checkSubscriptionStatus, 5000);
    return () => clearInterval(checkInterval);
  }, [enabled, user, vapidPublicKey]);

  // Check for incomplete challenges
  useEffect(() => {
    if (!enabled || !user) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    const checkIncompleteChallenges = async () => {
      try {
        const today = new Date().toDateString();
        
        // Reset notification flag if it's a new day
        if (lastCheckDateRef.current !== null && lastCheckDateRef.current !== today) {
          lastCheckDateRef.current = null;
        }
        
        // Check for incomplete challenges
        const incompleteChallenges = await checkIncompleteCompletionChallenges(user.id);
        
        // Only notify once per day if there are incomplete challenges and user is subscribed
        if (incompleteChallenges.length > 0 && lastCheckDateRef.current !== today && isSubscribed) {
          await notifyIncompleteChallenges(user.id, incompleteChallenges.length);
          lastCheckDateRef.current = today;
        }
      } catch (error) {
        console.error('Error checking incomplete challenges:', error);
      }
    };

    // Check immediately on mount
    checkIncompleteChallenges();

    // Set up interval to check periodically
    checkIntervalRef.current = setInterval(checkIncompleteChallenges, checkInterval);

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [enabled, user, checkInterval, isSubscribed]);

  return {
    permission: getNotificationPermission(),
    isSubscribed,
  };
}
