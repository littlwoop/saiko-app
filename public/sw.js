// Service Worker
const CACHE_NAME = 'challenge-crafters-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle scheduled notification updates
  if (event.data && event.data.type === 'SCHEDULE_UPDATE') {
    checkAndScheduleNotifications();
  }
  
  // Handle new notification schedule
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    scheduleNotificationInWorker(event.data.notification);
  }
  
  // Handle scheduled notifications list from client
  if (event.data && event.data.type === 'SCHEDULED_NOTIFICATIONS_LIST') {
    const notifications = event.data.notifications || [];
    
    // Clear all existing timers
    scheduledTimers.forEach(timer => clearTimeout(timer));
    scheduledTimers.clear();
    
    // Schedule all enabled notifications
    notifications
      .filter(n => n.enabled)
      .forEach(notification => {
        scheduleNotificationInWorker(notification);
      });
  }
});

// Store for scheduled notification timers
const scheduledTimers = new Map();

/**
 * Schedule a notification in the service worker
 */
function scheduleNotificationInWorker(notification) {
  const now = Date.now();
  const scheduledTime = notification.scheduledTime;
  
  // Clear existing timer for this notification if any
  if (scheduledTimers.has(notification.id)) {
    clearTimeout(scheduledTimers.get(notification.id));
  }
  
  // If the time has passed and it's not repeating, don't schedule
  if (scheduledTime <= now && !notification.repeat) {
    return;
  }
  
  // Calculate delay
  let delay = scheduledTime - now;
  
  // If time has passed and it's repeating, calculate next occurrence
  if (scheduledTime <= now && notification.repeat) {
    const nextTime = calculateNextTime(scheduledTime, notification.repeat);
    delay = nextTime - now;
  }
  
  // Don't schedule if delay is negative or too large (max 24 hours for safety)
  if (delay < 0 || delay > 24 * 60 * 60 * 1000) {
    return;
  }
  
  console.log(`[SW] Scheduling notification "${notification.title}" in ${Math.round(delay / 1000 / 60)} minutes`);
  
  const timerId = setTimeout(() => {
    showScheduledNotification(notification);
    scheduledTimers.delete(notification.id);
    
    // If repeating, schedule the next occurrence
    if (notification.repeat) {
      const nextNotification = {
        ...notification,
        scheduledTime: calculateNextTime(notification.scheduledTime, notification.repeat),
      };
      scheduleNotificationInWorker(nextNotification);
    }
  }, delay);
  
  scheduledTimers.set(notification.id, timerId);
}

/**
 * Calculate next scheduled time based on repeat
 */
function calculateNextTime(originalTime, repeat) {
  const scheduled = new Date(originalTime);
  const now = new Date();
  const next = new Date(scheduled);
  
  if (repeat === 'daily') {
    next.setDate(next.getDate() + 1);
    while (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
  } else if (repeat === 'weekly') {
    next.setDate(next.getDate() + 7);
    while (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 7);
    }
  }
  
  return next.getTime();
}

/**
 * Show a scheduled notification
 */
async function showScheduledNotification(notification) {
  console.log('[SW] Showing scheduled notification:', notification.title);
  
  try {
    await self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon || '/icon-192.png',
      badge: notification.badge || '/icon-192.png',
      tag: notification.tag || 'scheduled-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
      data: {
        type: 'scheduled',
        id: notification.id,
      },
    });
  } catch (error) {
    console.error('[SW] Error showing scheduled notification:', error);
  }
}

/**
 * Check and schedule all notifications from IndexedDB
 */
async function checkAndScheduleNotifications() {
  try {
    // Request notifications from client
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'GET_SCHEDULED_NOTIFICATIONS' });
    });
  } catch (error) {
    console.error('[SW] Error checking scheduled notifications:', error);
  }
}

// On service worker activation, check for scheduled notifications
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      checkAndScheduleNotifications()
    ])
  );
});

// Push event listener - handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received!', {
    hasData: !!event.data,
    type: event.type,
    timestamp: new Date().toISOString(),
  });
  
  let notificationData = {
    title: 'Challenge Crafters Unite',
    body: 'You have incomplete challenges!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'challenge-reminder',
    requireInteraction: false,
  };

  if (event.data) {
    try {
      // Try to parse as JSON first
      let data;
      try {
        data = event.data.json();
        console.log('[SW] Parsed push data as JSON:', data);
      } catch (jsonError) {
        console.log('[SW] JSON parse failed, trying as text:', jsonError);
        // If JSON parsing fails, try as text
        try {
          const text = event.data.text();
          console.log('[SW] Push data as text:', text);
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('[SW] Could not parse push data:', parseError);
          // Use text as body if JSON parsing fails
          const text = event.data.text();
          data = { body: text || 'New notification' };
        }
      }

      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : notificationData.requireInteraction,
        data: data.data || {},
      };
    } catch (e) {
      console.error('[SW] Error parsing push notification data:', e);
      // Use default notification data
    }
  } else {
    console.log('[SW] Push event has no data, using defaults');
  }

  console.log('[SW] Showing notification with data:', notificationData);

  const notificationPromise = self.registration.showNotification(notificationData.title, {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    data: notificationData.data,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    actions: [],
  });

  notificationPromise
    .then(() => {
      console.log('[SW] Notification shown successfully');
    })
    .catch((error) => {
      console.error('[SW] Error showing notification:', error);
      console.error('[SW] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    });

  event.waitUntil(notificationPromise);
});

// Notification click event listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      const urlToOpen = new URL('/', self.location.origin).href;
      
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});