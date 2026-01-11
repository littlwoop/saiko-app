/**
 * Notification service for push notifications
 */

import { supabase } from './supabase';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Permission is 'default', request it
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Check if notifications are supported and enabled
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * Check current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Send a push notification via Supabase Edge Function
 */
export async function sendPushNotification(
  userId: string,
  options: NotificationOptions
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        notification: {
          title: options.title,
          body: options.body,
          icon: options.icon || '/icon-192.png',
          badge: options.badge || '/icon-192.png',
          tag: options.tag,
          requireInteraction: options.requireInteraction || false,
          data: options.data || {},
        },
      },
    });

    if (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }

    // Log response for debugging
    if (data) {
      console.log('Push notification response:', data);
      if (data.failed && data.failed > 0) {
        console.error('Some notifications failed:', data.details);
      }
    }

    return data?.successful > 0 || false;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

/**
 * Send a notification for incomplete completion challenges
 */
export async function notifyIncompleteChallenges(
  userId: string,
  challengeCount: number
): Promise<void> {
  if (challengeCount === 0) return;

  const title = challengeCount === 1
    ? 'Complete your challenge today!'
    : `Complete your ${challengeCount} challenges today!`;
  
  const body = challengeCount === 1
    ? "You have an incomplete completion challenge. Don't forget to complete today's objectives!"
    : `You have ${challengeCount} incomplete completion challenges. Don't forget to complete today's objectives!`;

  await sendPushNotification(userId, {
    title,
    body,
    tag: 'incomplete-challenge',
    requireInteraction: false,
  });
}
