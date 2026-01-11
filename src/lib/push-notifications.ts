/**
 * Push Notification utility for Web Push API
 * Works with Supabase Edge Functions to send notifications even when app is closed
 */

import { supabase } from "./supabase";

// VAPID public key - should be set in environment variables
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Debug: Log environment variable status (always log to help with debugging)
console.log('🔑 VAPID_PUBLIC_KEY Environment Check:', {
  exists: !!import.meta.env.VITE_VAPID_PUBLIC_KEY,
  isString: typeof import.meta.env.VITE_VAPID_PUBLIC_KEY === 'string',
  length: import.meta.env.VITE_VAPID_PUBLIC_KEY?.length || 0,
  first20Chars: import.meta.env.VITE_VAPID_PUBLIC_KEY?.substring(0, 20) || 'undefined',
  allVAPIDKeys: Object.keys(import.meta.env).filter(key => key.includes('VAPID')),
  rawValue: import.meta.env.VITE_VAPID_PUBLIC_KEY || 'NOT SET'
});

export interface PushSubscription {
  id?: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
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
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission has been denied');
    return false;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Get notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Convert base64 URL safe to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(userId: string): Promise<PushSubscription | null> {
  // Check for VAPID key with more detailed error
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey || vapidKey.trim() === '') {
    console.error('VAPID_PUBLIC_KEY is not configured.');
    console.error('Please check:');
    console.error('1. Is VITE_VAPID_PUBLIC_KEY set in your .env file?');
    console.error('2. Did you restart the dev server after adding it?');
    console.error('3. Is the .env file in the project root?');
    console.error('4. Does the variable name start with VITE_?');
    console.error('Current value:', vapidKey);
    console.error('All env vars:', Object.keys(import.meta.env).filter(k => k.includes('VAPID')));
    return null;
  }

  if (!isPushNotificationSupported()) {
    console.warn('Push notifications are not supported in this browser');
    return null;
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('Already subscribed to push notifications');
      // Check if it's saved in database, if not, save it
      const subscriptionJson = existingSubscription.toJSON();
      if (subscriptionJson.keys) {
        const pushSubscription: PushSubscription = {
          user_id: userId,
          endpoint: existingSubscription.endpoint,
          p256dh: subscriptionJson.keys.p256dh!,
          auth: subscriptionJson.keys.auth!,
          user_agent: navigator.userAgent,
        };
        
        const { data, error } = await supabase
          .from('push_subscriptions')
          .upsert(pushSubscription, {
            onConflict: 'user_id,endpoint',
          })
          .select()
          .single();
          
        if (!error && data) {
          return data as PushSubscription;
        }
      }
    }

    // Subscribe to push manager
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    console.log('Subscribing to push notifications with VAPID key:', vapidKey ? `Present (${vapidKey.substring(0, 20)}...)` : 'Missing');
    
    if (!vapidKey || vapidKey.trim() === '') {
      throw new Error('VAPID_PUBLIC_KEY is not configured. Please set VITE_VAPID_PUBLIC_KEY in your .env file and restart the dev server.');
    }
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // Extract subscription keys
    const subscriptionJson = subscription.toJSON();
    if (!subscriptionJson.keys) {
      throw new Error('Subscription keys are missing');
    }

    const pushSubscription: PushSubscription = {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscriptionJson.keys.p256dh!,
      auth: subscriptionJson.keys.auth!,
      user_agent: navigator.userAgent,
    };

    // Save subscription to database
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(pushSubscription, {
        onConflict: 'user_id,endpoint',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving push subscription:', error);
      throw error;
    }

    console.log('Push subscription saved successfully');
    return data as PushSubscription;
  } catch (error: any) {
    console.error('Error subscribing to push notifications:', error);
    
    // Provide more detailed error information
    if (error.message) {
      console.error('Error details:', error.message);
    }
    
    // Check for specific error types
    if (error.code === 'PGRST301' || error.message?.includes('permission denied')) {
      console.error('Permission denied - check RLS policies on push_subscriptions table');
    } else if (error.message?.includes('service worker')) {
      console.error('Service worker error - make sure service worker is registered');
    } else if (error.message?.includes('VAPID')) {
      console.error('VAPID key error - check VITE_VAPID_PUBLIC_KEY is set correctly');
    }
    
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Delete from database
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting push subscription from database:', deleteError);
      }

      // Unsubscribe from push service
      const unsubscribed = await subscription.unsubscribe();
      if (unsubscribed) {
        console.log('Successfully unsubscribed from push notifications');
      }
      return unsubscribed;
    }

    return true;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Check if user is subscribed to push notifications
 */
export async function isSubscribedToPushNotifications(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Error checking push subscription:', error);
    return false;
  }
}

/**
 * Get user's push subscriptions from database
 */
export async function getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching push subscriptions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching push subscriptions:', error);
    return [];
  }
}

/**
 * Send a test push notification to the current user
 */
export async function sendTestPushNotification(userId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: 'Test Notification',
        body: 'This is a test push notification from Challenge Crafters Unite! 🎉',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'test-notification',
        url: '/dashboard',
      },
    });

    if (error) {
      console.error('Error sending test notification:', error);
      return { success: false, error: error.message || 'Failed to send notification' };
    }

    return { success: true, message: 'Test notification sent successfully!' };
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return { success: false, error: error.message || 'Failed to send notification' };
  }
}
