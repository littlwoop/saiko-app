/**
 * Push subscription service for web push notifications
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Convert a PushSubscription to a format we can store
 */
export function subscriptionToJSON(subscription: PushSubscription): PushSubscriptionData {
  const keys = subscription.getKey
    ? {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth')),
      }
    : {
        p256dh: '',
        auth: '',
      };

  return {
    endpoint: subscription.endpoint,
    keys,
  };
}

/**
 * Convert VAPID public key (base64 URL-safe) to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Remove any whitespace
  const base64Clean = base64.trim();
  
  // VAPID keys are base64 URL-safe, need to convert to regular base64
  const padding = '='.repeat((4 - (base64Clean.length % 4)) % 4);
  const base64String = (base64Clean + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64String);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Request push notification subscription
 */
export async function subscribeToPushNotifications(
  userId: string,
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported in this browser');
    return null;
  }

  try {
    // Register service worker if not already registered
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      // Update subscription in database
      await savePushSubscription(userId, existingSubscription);
      return existingSubscription;
    }

    // Convert VAPID public key
    const applicationServerKey = base64ToArrayBuffer(vapidPublicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Save subscription to database
    await savePushSubscription(userId, subscription);

    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(
  userId: string
): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await deletePushSubscription(userId, subscription.endpoint);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Save push subscription to database
 */
async function savePushSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const subscriptionData = subscriptionToJSON(subscription);

  const { supabase } = await import('./supabase');

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscriptionData.endpoint,
      p256dh: subscriptionData.keys.p256dh,
      auth: subscriptionData.keys.auth,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,endpoint',
    }
  );

  if (error) {
    console.error('Error saving push subscription:', error);
    throw error;
  }
}

/**
 * Delete push subscription from database
 */
async function deletePushSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  const { supabase } = await import('./supabase');

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('Error deleting push subscription:', error);
    throw error;
  }
}

/**
 * Check if push notifications are supported
 */
export function isPushNotificationSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current push subscription
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Error getting push subscription:', error);
    return null;
  }
}
