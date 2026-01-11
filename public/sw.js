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

// Handle push events (for future push notification support)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Don\'t forget to complete your daily challenge!',
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: 'daily-challenge-reminder',
      requireInteraction: false,
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Daily Challenge Reminder', options)
    );
  }
});

// Listen for messages from clients (for future use with push notifications)
self.addEventListener('message', (event) => {
  // This will be used for push notification handling in the new implementation
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
