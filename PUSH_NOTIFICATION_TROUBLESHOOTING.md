# Push Notification Troubleshooting Guide

If push notifications are not working on your mobile device, follow these steps:

## 1. Verify Edge Function is Deployed

Make sure the Edge Function is deployed to Supabase:

```bash
supabase functions deploy send-push-notification
```

## 2. Check VAPID Keys Configuration

### Frontend (.env)
```env
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here
```

### Supabase Edge Function Secrets

Set these in Supabase Dashboard → Edge Functions → Secrets:
- `VAPID_PUBLIC_KEY` - Your VAPID public key
- `VAPID_PRIVATE_KEY` - Your VAPID private key  
- `VAPID_CONTACT_EMAIL` - Email like `mailto:admin@example.com` (optional)

Or via CLI:
```bash
supabase secrets set VAPID_PUBLIC_KEY=your_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_private_key
supabase secrets set VAPID_CONTACT_EMAIL=mailto:admin@example.com
```

## 3. Verify Service Worker is Registered

1. Open your app in the browser
2. Open DevTools (F12)
3. Go to **Application** → **Service Workers**
4. Verify the service worker is registered and active
5. Check the console for any errors

## 4. Check Browser Permissions

### Desktop
- Check browser notification settings
- Verify the site has notification permission

### Mobile (Android/Chrome)
1. Open Chrome settings
2. Go to **Site Settings** → **Notifications**
3. Find your app's domain
4. Ensure notifications are **Allowed**
5. Also check: **Settings** → **Apps** → **Chrome** → **Notifications**

### Mobile (iOS/Safari)
- Push notifications only work in PWAs on iOS
- Make sure the app is installed as a PWA
- Check **Settings** → **Notifications** → [Your App]

## 5. Test Notification Subscription

1. Go to Profile page
2. Click "Enable Notifications"
3. Grant permission when prompted
4. Check browser console for subscription details
5. Verify subscription is saved in database (check `push_subscriptions` table)

## 6. Test Push Notification

1. After enabling notifications, click "Test Push Notification"
2. Check browser console for errors
3. Check Supabase Edge Function logs:
   - Go to Supabase Dashboard → Edge Functions → Logs
   - Look for `send-push-notification` function logs

## 7. Common Issues

### Issue: "No push subscriptions found for user"
**Solution**: 
- User hasn't enabled notifications yet
- Subscription wasn't saved to database
- Check RLS policies on `push_subscriptions` table

### Issue: "Missing VAPID keys"
**Solution**:
- Make sure VAPID keys are set as Edge Function secrets
- Verify keys are in the correct format (base64url)

### Issue: Notification permission denied
**Solution**:
- Reset notification permission in browser settings
- Clear browser cache and cookies
- Re-register service worker

### Issue: Edge Function returns 500 error
**Solution**:
- Check Edge Function logs for detailed error
- Verify VAPID keys are correctly formatted
- Make sure the web-push library is accessible (check Deno import)

### Issue: Notifications work on desktop but not mobile
**Possible causes**:
- Mobile browser doesn't support push notifications
- Service worker not registered on mobile
- Mobile browser settings blocking notifications
- PWA not installed (required for iOS)

## 8. Verify Web Push Library

The Edge Function uses `https://deno.land/x/webpush@v1.1.2/mod.ts`. If this doesn't work:

1. Check if the package exists: https://deno.land/x/webpush
2. Try updating to latest version
3. Alternative: Use a different web-push implementation

## 9. Debug Steps

1. **Check subscription in database**:
```sql
SELECT * FROM push_subscriptions WHERE user_id = 'your-user-id';
```

2. **Check Edge Function logs**:
```bash
supabase functions logs send-push-notification
```

3. **Test Edge Function directly**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "notification": {
      "title": "Test",
      "body": "Test message"
    }
  }'
```

4. **Check browser console** for:
   - Service worker registration errors
   - Push subscription errors
   - Notification permission errors

## 10. Mobile-Specific Checks

### Android Chrome
- Must be HTTPS (not HTTP)
- Service worker must be registered
- Notifications must be allowed in Chrome settings
- App should be added to home screen for best results

### iOS Safari
- Push notifications only work in installed PWAs
- Must be installed from Safari (Add to Home Screen)
- iOS 16.4+ required for web push support
- Check Settings → Notifications → [Your PWA]

## 11. Alternative: Test with Browser Console

Run this in browser console after enabling notifications:

```javascript
// Check subscription
navigator.serviceWorker.ready.then(registration => {
  registration.pushManager.getSubscription().then(subscription => {
    console.log('Subscription:', subscription);
    if (subscription) {
      console.log('Endpoint:', subscription.endpoint);
      console.log('Keys:', {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
      });
    }
  });
});
```

If you're still having issues, check the Edge Function logs for detailed error messages.
