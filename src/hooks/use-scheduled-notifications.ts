import { useEffect, useCallback } from 'react';
import {
  getScheduledNotifications,
  scheduleDailyNotification,
  scheduleNotification,
  deleteScheduledNotification,
  ScheduledNotification,
} from '@/lib/scheduled-notifications';

/**
 * Hook to manage scheduled notifications
 */
export function useScheduledNotifications() {
  // Sync scheduled notifications with service worker on mount
  useEffect(() => {
    const syncWithServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const notifications = await getScheduledNotifications();
          
          // Send list to service worker
          registration.active?.postMessage({
            type: 'SCHEDULED_NOTIFICATIONS_LIST',
            notifications,
          });
        } catch (error) {
          console.error('Error syncing scheduled notifications:', error);
        }
      }
    };

    syncWithServiceWorker();

    // Listen for requests from service worker
    const messageHandler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GET_SCHEDULED_NOTIFICATIONS') {
        syncWithServiceWorker();
      }
    };

    navigator.serviceWorker.addEventListener('message', messageHandler);

    return () => {
      navigator.serviceWorker.removeEventListener('message', messageHandler);
    };
  }, []);

  const schedule = useCallback(
    async (
      title: string,
      body: string,
      scheduledTime: Date,
      options?: {
        icon?: string;
        badge?: string;
        tag?: string;
        repeat?: 'daily' | 'weekly';
      }
    ) => {
      return scheduleNotification(title, body, scheduledTime, options);
    },
    []
  );

  const scheduleDaily = useCallback(
    async (
      title: string,
      body: string,
      hour: number,
      minute?: number,
      options?: {
        icon?: string;
        badge?: string;
        tag?: string;
      }
    ) => {
      return scheduleDailyNotification(title, body, hour, minute, options);
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await deleteScheduledNotification(id);
    // Sync with service worker after deletion
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await getScheduledNotifications();
      registration.active?.postMessage({
        type: 'SCHEDULED_NOTIFICATIONS_LIST',
        notifications,
      });
    }
  }, []);

  const getAll = useCallback(async () => {
    return getScheduledNotifications();
  }, []);

  return {
    schedule,
    scheduleDaily,
    remove,
    getAll,
  };
}
