# Push Notifications Setup

This guide explains how to set up push notifications for incomplete completion challenges.

## Overview

The app now sends push notifications to users who have incomplete completion challenges where the day is not completed. This uses Web Push API with VAPID authentication.

## Prerequisites

1. **VAPID Keys**: You need to generate VAPID (Voluntary Application Server Identification) keys for web push notifications.
2. **Supabase Edge Functions**: The push notification system uses Supabase Edge Functions.
3. **Service Worker**: Already configured in `public/sw.js`.

## Step 1: Generate VAPID Keys

You can generate VAPID keys using Node.js:

```bash
npm install -g web-push
web-push generate-vapid-keys
```

This will output:
- **Public Key**: A base64 URL-safe string (starts with `B`)
- **Private Key**: A base64 URL-safe string (starts with a longer string)

**Important**: Keep the private key secure and never expose it in client-side code!

## Step 2: Configure Environment Variables

### Frontend (.env)

Add the VAPID public key to your frontend environment variables:

```env
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here
```

### Supabase Edge Functions

Add the following secrets to your Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Secrets**
3. Add the following secrets:
   - `VAPID_PUBLIC_KEY`: Your VAPID public key
   - `VAPID_PRIVATE_KEY`: Your VAPID private key

You can also set these using the Supabase CLI:

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key
```

## Step 3: Run Database Migration

Run the migration to create the `push_subscriptions` table:

```sql
-- Run database/migrations/015_create_push_subscriptions.sql in your Supabase SQL editor
```

## Step 4: Deploy Edge Functions

Deploy the Edge Functions to Supabase:

```bash
# Deploy send-push-notification function
supabase functions deploy send-push-notification

# Deploy check-incomplete-challenges function (optional, for scheduled checks)
supabase functions deploy check-incomplete-challenges
```

## Step 5: Set Up Scheduled Checks (Optional)

To automatically check for incomplete challenges and send notifications, you can set up a cron job in Supabase:

1. Go to **Database** → **Cron Jobs** in your Supabase dashboard
2. Create a new cron job:
   - **Schedule**: `0 18 * * *` (6 PM daily) or your preferred schedule
   - **Function**: `check-incomplete-challenges`

Alternatively, you can use pg_cron:

```sql
SELECT cron.schedule(
  'check-incomplete-challenges',
  '0 18 * * *', -- 6 PM daily
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-incomplete-challenges',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);
```

## Step 6: Test Push Notifications

1. Start your app: `npm run dev`
2. Log in to your account
3. Join a completion challenge
4. Wait for the notification permission prompt (or manually enable notifications in browser settings)
5. Ensure you haven't completed all objectives for today
6. The app will automatically check and send a notification

## How It Works

1. **User Subscription**: When a user visits the dashboard, the app:
   - Requests notification permission
   - Subscribes to push notifications using the VAPID public key
   - Saves the subscription to the `push_subscriptions` table

2. **Notification Checking**: The app checks for incomplete challenges:
   - On page load
   - Every 30 minutes while the user is on the dashboard
   - Only sends one notification per day per user

3. **Push Notification Sending**: When incomplete challenges are detected:
   - The app calls the `send-push-notification` Edge Function
   - The function sends push notifications to all of the user's registered devices
   - Users receive the notification even if they're not on the website

## Edge Function Implementation Note

The current `send-push-notification` Edge Function uses a simplified implementation. For production use, you should:

1. Use the `web-push` library properly with VAPID signing
2. Implement proper payload encryption
3. Handle notification delivery status and cleanup invalid subscriptions

You may need to use a Deno-compatible web-push library or implement the encryption manually.

## Troubleshooting

### Notifications not appearing

1. **Check browser permissions**: Ensure notifications are allowed in browser settings
2. **Check VAPID keys**: Verify both public and private keys are correctly set
3. **Check service worker**: Ensure the service worker is registered (check browser DevTools → Application → Service Workers)
4. **Check console**: Look for errors in the browser console and Edge Function logs

### Service Worker issues

1. Clear browser cache and service workers
2. Re-register the service worker by visiting the site
3. Check that `public/sw.js` is accessible at `/sw.js`

### Database issues

1. Verify the `push_subscriptions` table exists and has the correct schema
2. Check RLS policies allow users to insert their own subscriptions
3. Verify the Edge Function has access via service role key

## Security Notes

- Never expose the VAPID private key in client-side code
- Always use Row Level Security (RLS) on the `push_subscriptions` table
- Validate user authentication in Edge Functions
- Rate limit notification sending to prevent abuse
