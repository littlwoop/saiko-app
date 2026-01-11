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
});

// Push event listener - handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received!', event);
  
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
        console.log('Parsed push data as JSON:', data);
      } catch (jsonError) {
        // If JSON parsing fails, try as text
        const text = event.data.text();
        console.log('Push data as text:', text);
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('Could not parse push data:', parseError);
          // Use text as body if JSON parsing fails
          data = { body: text };
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
      console.error('Error parsing push notification data:', e);
      // Use default notification data
    }
  } else {
    console.log('Push event has no data');
  }

  console.log('Showing notification with data:', notificationData);

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
    }).then(() => {
      console.log('Notification shown successfully');
    }).catch((error) => {
      console.error('Error showing notification:', error);
    })
  );
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