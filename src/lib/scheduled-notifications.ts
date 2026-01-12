/**
 * Client-side scheduled notifications without Supabase
 * Uses service worker and IndexedDB for persistence
 */

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  scheduledTime: number; // Unix timestamp in milliseconds
  repeat?: 'daily' | 'weekly' | null;
  enabled: boolean;
}

const DB_NAME = 'notifications-db';
const DB_VERSION = 1;
const STORE_NAME = 'scheduled-notifications';

/**
 * Initialize IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save a scheduled notification
 */
export async function saveScheduledNotification(
  notification: ScheduledNotification
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(notification);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Notify service worker
      notifyServiceWorker('SCHEDULE_UPDATE');
      resolve();
    };
  });
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<ScheduledNotification[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Delete a scheduled notification
 */
export async function deleteScheduledNotification(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      notifyServiceWorker('SCHEDULE_UPDATE');
      resolve();
    };
  });
}

/**
 * Notify service worker to update schedules
 */
function notifyServiceWorker(type: string): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({ type });
    });
  }
}

/**
 * Schedule a notification at a specific time
 */
export async function scheduleNotification(
  title: string,
  body: string,
  scheduledTime: Date,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    repeat?: 'daily' | 'weekly';
  }
): Promise<string> {
  const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const notification: ScheduledNotification = {
    id,
    title,
    body,
    icon: options?.icon || '/icon-192.png',
    badge: options?.badge || '/icon-192.png',
    tag: options?.tag || 'scheduled-notification',
    scheduledTime: scheduledTime.getTime(),
    repeat: options?.repeat || null,
    enabled: true,
  };

  await saveScheduledNotification(notification);
  
  // Notify service worker immediately to set up the timer
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: 'SCHEDULE_NOTIFICATION',
      notification,
    });
  }

  return id;
}

/**
 * Schedule a daily notification at a specific time
 */
export async function scheduleDailyNotification(
  title: string,
  body: string,
  hour: number, // 0-23
  minute: number = 0, // 0-59
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
  }
): Promise<string> {
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hour, minute, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (scheduledTime.getTime() <= now.getTime()) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  return scheduleNotification(title, body, scheduledTime, {
    ...options,
    repeat: 'daily',
  });
}

/**
 * Calculate next scheduled time based on repeat setting
 */
export function getNextScheduledTime(
  originalTime: number,
  repeat?: 'daily' | 'weekly' | null
): number {
  if (!repeat) return originalTime;

  const now = Date.now();
  const scheduled = new Date(originalTime);
  const next = new Date(scheduled);

  if (repeat === 'daily') {
    // Move to same time tomorrow (or today if not passed)
    next.setDate(next.getDate() + 1);
    while (next.getTime() <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (repeat === 'weekly') {
    // Move to same time next week
    next.setDate(next.getDate() + 7);
    while (next.getTime() <= now) {
      next.setDate(next.getDate() + 7);
    }
  }

  return next.getTime();
}
