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

// Handle background sync (for better mobile support)
self.addEventListener('sync', (event) => {
  // Handle background sync for daily challenge reminders
  if (event.tag && event.tag.startsWith('check-daily-challenge-')) {
    event.waitUntil(handleDailyChallengeSync(event.tag));
  }
});

// Handle periodic background sync (for scheduling notifications)
// Note: Periodic sync has limited browser support
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-daily-challenge') {
    event.waitUntil(checkAndNotify());
  }
});

// Handle background sync for daily challenge reminders
async function handleDailyChallengeSync(tag) {
  try {
    // Extract userId and date from tag
    const parts = tag.replace('check-daily-challenge-', '').split('-');
    const userId = parts[0];
    const date = parts.slice(1).join('-'); // Handle date format YYYY-MM-DD
    
    // Get stored schedules from IndexedDB or send message to client
    // For now, we'll check localStorage via postMessage to active clients
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    
    if (clients.length > 0) {
      // Send message to client to check and show reminder
      clients.forEach(client => {
        client.postMessage({
          type: 'CHECK_DAILY_CHALLENGE_REMINDER',
          userId,
          date
        });
      });
    }
  } catch (error) {
    console.error('Error in background sync:', error);
  }
}

// Function to check and show notification if challenge not completed
async function checkAndNotify() {
  // Get all clients to check if user is logged in
  const clients = await self.clients.matchAll();
  
  if (clients.length === 0) {
    // No active clients, can't check status - notification will be scheduled from client side
    return;
  }

  // This will be handled from the client side with scheduled notifications
  // The service worker just handles displaying them
}

// Listen for messages from clients to show notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_DAILY_CHALLENGE_REMINDER') {
    const { title, body, challengeId } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'Daily Challenge Reminder', {
        body: body || 'Don\'t forget to complete today\'s challenge!',
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: `daily-challenge-${new Date().toISOString().split('T')[0]}`,
        requireInteraction: false,
        data: {
          url: '/dashboard',
          challengeId: challengeId,
        },
      })
    );
  }
});
