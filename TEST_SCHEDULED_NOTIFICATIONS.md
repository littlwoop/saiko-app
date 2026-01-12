# Testing Scheduled Notifications (Client-Side)

This guide shows you how to test the client-side scheduled notification system that works without Supabase.

## Quick Test Steps

### Step 1: Enable Notifications Permission

1. Go to your **Profile** page
2. Click **"Enable Notifications"** button
3. Grant notification permission when prompted

### Step 2: Schedule a Test Notification

1. Scroll down to the **"Schedule Notifications"** section
2. Fill in:
   - **Title**: `Test Notification`
   - **Message**: `This is a test scheduled notification!`
   - **Hour**: Current hour (or next hour)
   - **Minute**: Current minute + 2 minutes (e.g., if it's 14:30, set to 32)
3. Click **"Schedule Daily Notification"**

### Step 3: Verify It's Scheduled

1. You should see the notification appear in the "Scheduled Notifications" list
2. It should show the time (e.g., "Daily at 14:32")

### Step 4: Check Service Worker Console

1. Open **Browser DevTools** (F12)
2. Go to **Console** tab
3. Look for message: `[SW] Scheduling notification "Test Notification" in X minutes`
4. If you see this, it's scheduled correctly!

### Step 5: Wait and Verify

1. **Keep the browser tab open** (don't close it)
2. Wait for the scheduled time
3. You should see a notification appear automatically
4. In the console, you should see: `[SW] Showing scheduled notification: Test Notification`

## Testing with Browser Closed/Minimized

### Test with Browser Minimized

1. Schedule a notification for 2-3 minutes from now
2. **Minimize the browser** (don't close it)
3. Wait for the scheduled time
4. Notification should still appear! ✅

### Test with Browser Closed (Service Worker Active)

1. Schedule a notification for 2-3 minutes from now
2. **Close the browser tab** completely
3. Wait for the scheduled time
4. **Notification should appear** if service worker is still active ✅

**Note**: Service workers may be killed by the browser after inactivity. For best results, keep the browser running (even if tab is closed).

## Testing in Browser Console Directly

You can also test directly in the browser console:

```javascript
// Schedule a notification for 2 minutes from now
const testTime = new Date();
testTime.setMinutes(testTime.getMinutes() + 2);

// Import the function (if using ES modules)
import { scheduleNotification } from './lib/scheduled-notifications';

scheduleNotification(
  'Console Test',
  'This was scheduled from the console!',
  testTime
).then(id => {
  console.log('Scheduled notification with ID:', id);
});
```

Or use the hook in a React component:

```typescript
const { schedule } = useScheduledNotifications();

// Schedule for 2 minutes from now
const testTime = new Date();
testTime.setMinutes(testTime.getMinutes() + 2);

await schedule(
  'Test',
  'Testing scheduled notification',
  testTime
);
```

## What to Check

### ✅ Success Indicators:

1. **Notification appears in the list** after scheduling
2. **Console shows**: `[SW] Scheduling notification "..." in X minutes`
3. **At scheduled time**: Notification appears
4. **Console shows**: `[SW] Showing scheduled notification: ...`

### ❌ Troubleshooting:

**No notification in list:**
- Check browser console for errors
- Verify IndexedDB is enabled in browser
- Check if notification permission is granted

**Service worker not scheduling:**
- Open DevTools → **Application** → **Service Workers**
- Verify service worker is **activated**
- Check console for errors
- Try refreshing the page

**Notification doesn't appear at scheduled time:**
- Check if browser is still running
- Verify service worker is still active
- Check console for errors
- Make sure notification permission is still granted

**Browser killed the service worker:**
- This is normal - browsers can kill inactive service workers
- Solution: Schedule shorter intervals or use push notifications from server

## Testing Daily Repeats

1. Schedule a daily notification (e.g., at 14:35)
2. Wait for it to fire
3. The next day at the same time, it should fire again automatically
4. Check the scheduled time updates in the list

## Viewing Stored Schedules

You can check what's stored in IndexedDB:

1. Open DevTools → **Application** tab
2. Go to **IndexedDB** → **notifications-db**
3. Click on **scheduled-notifications** store
4. You should see your scheduled notifications stored there

## Cleanup Test Notifications

To remove test notifications:
1. Click the **trash icon** next to the notification in the list
2. Or use the console:

```javascript
import { deleteScheduledNotification } from './lib/scheduled-notifications';

// Get the ID from the notification list, then:
await deleteScheduledNotification('notification-id-here');
```

## Expected Behavior

### ✅ Works:
- Browser tab open → Notification appears on time
- Browser minimized → Notification appears on time
- Browser closed (service worker active) → Notification appears on time
- Daily repeats → Notification repeats daily

### ⚠️ May Not Work:
- Browser completely closed for >24 hours → Service worker may be killed
- Very long delays (>24 hours) → Service worker may timeout
- Browser in battery saver mode → May suspend service workers

## Best Practices

1. **For testing**: Schedule 2-5 minutes ahead
2. **For production**: Use daily notifications (reliable)
3. **For critical notifications**: Use server-side push notifications (Supabase)
4. **Combine both**: Use scheduled for reminders, push for important alerts

## Console Commands for Debugging

```javascript
// Check if service worker is registered
navigator.serviceWorker.ready.then(reg => {
  console.log('SW registered:', reg.active !== null);
});

// Check notification permission
console.log('Permission:', Notification.permission);

// Get all scheduled notifications
import { getScheduledNotifications } from './lib/scheduled-notifications';
getScheduledNotifications().then(n => console.log('Scheduled:', n));
```
