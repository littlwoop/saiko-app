// Service Worker for push notifications
const CACHE_NAME = 'challenge-crafters-v1';
const NOTIFICATION_ICON = '/icon-192.png';

// Install event - cache resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already a window open, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/dashboard');
      }
    })
  );
});

// Handle push events for Web Push notifications
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Daily Challenge Reminder',
    body: 'Don\'t forget to complete your daily challenge!',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag: 'daily-challenge-reminder',
    data: {}
  };

  // Try to parse push data
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || NOTIFICATION_ICON,
        badge: data.badge || NOTIFICATION_ICON,
        tag: data.tag || notificationData.tag,
        data: data.data || {}
      };
    } catch (e) {
      // If data is not JSON, try as text
      try {
        const text = event.data.text();
        if (text) {
          notificationData.body = text;
        }
      } catch (e2) {
        console.error('Error parsing push data:', e2);
      }
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: false,
    data: notificationData.data
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Listen for messages from clients (for future use with push notifications)
self.addEventListener('message', (event) => {
  // This will be used for push notification handling in the new implementation
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
