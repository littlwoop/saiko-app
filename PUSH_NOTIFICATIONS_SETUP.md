# Push Notifications Setup Guide

This guide explains how to set up push notifications for the Challenge Crafters Unite app using Supabase Edge Functions.

## Overview

The push notification system uses:
- **Web Push API** for browser-based push notifications
- **VAPID keys** for authentication with push services
- **Supabase Edge Functions** for server-side notification sending
- **Database table** to store user push subscriptions

## Prerequisites

1. Supabase project with Edge Functions enabled
2. Node.js installed (for generating VAPID keys)
3. Supabase CLI installed (for deploying Edge Functions)

## Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for Web Push notifications.

### Install web-push package globally:

```bash
npm install -g web-push
```

### Generate VAPID keys:

```bash
web-push generate-vapid-keys
```

This will output something like:
```
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa40HIwP4eFZVvUbX1Gvz8L7o
...

Private Key:
5s71zx-... (keep this secret!)
```

**Save both keys securely** - you'll need them in the next steps.

## Step 2: Configure Environment Variables

### In Supabase Dashboard:

1. Go to your Supabase project
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add the following secrets:

   - `VAPID_PUBLIC_KEY`: Your public VAPID key
   - `VAPID_PRIVATE_KEY`: Your private VAPID key (keep this secret!)
   - `VAPID_CONTACT_EMAIL`: Your email address (e.g., `noreply@yourdomain.com`)

### In your local project:

Create or update your `.env` file:

```env
# VAPID Public Key (for client-side)
VITE_VAPID_PUBLIC_KEY=your_public_vapid_key_here

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The `VITE_VAPID_PUBLIC_KEY` is used by the client-side code to subscribe to push notifications.

## Step 3: Run Database Migration

Run the migration file to create the `push_subscriptions` table:

```sql
-- Run this in your Supabase SQL Editor
-- File: database/migrations/006_create_push_subscriptions.sql
```

Or use the Supabase CLI:

```bash
supabase db push
```

## Step 4: Deploy Edge Functions

### Install Supabase CLI (if not already installed):

**Note:** Supabase CLI cannot be installed via `npm install -g`. Use one of these methods:

#### Option 1: Using Scoop (Recommended for Windows)

```powershell
# Install Scoop if you don't have it
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Option 2: Using Chocolatey

```powershell
choco install supabase
```

#### Option 3: Using winget

```powershell
winget install --id=Supabase.CLI
```

#### Option 4: Direct Download

1. Visit: https://github.com/supabase/cli/releases/latest
2. Download `supabase_windows_amd64.zip` (or appropriate version)
3. Extract and add to your PATH

#### Option 5: Using npx (without global install)

You can use Supabase CLI without installing it globally:

```bash
npx supabase@latest login
npx supabase@latest functions deploy send-push-notification
```

**Verify installation:**
```bash
supabase --version
```

### Login to Supabase:

```bash
supabase login
```

### Link your project:

```bash
supabase link --project-ref your-project-ref
```

### Deploy the Edge Functions:

**If using npx (without global install):**

```bash
# Deploy send-push-notification function
npx supabase@latest functions deploy send-push-notification --project-ref your-project-ref

# Deploy daily-challenge-reminder function
npx supabase@latest functions deploy daily-challenge-reminder --project-ref your-project-ref
```

**If using installed CLI:**

```bash
# Deploy send-push-notification function
supabase functions deploy send-push-notification

# Deploy daily-challenge-reminder function
supabase functions deploy daily-challenge-reminder
```

Or deploy all functions at once (only works with installed CLI):

```bash
supabase functions deploy
```

**Note:** When using `npx`, you'll need to provide `--project-ref` for each command, or authenticate first:
```bash
npx supabase@latest login
```

## Step 5: Set Up Cron Job for Daily Reminders

The `daily-challenge-reminder` function should be called daily at 18:00 (6 PM).

### Option 1: Using Supabase pg_cron (Recommended)

If you have Supabase Pro, you can use pg_cron:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job that calls the Edge Function daily at 18:00 UTC
SELECT cron.schedule(
  'daily-challenge-reminder',
  '0 18 * * *', -- Daily at 18:00 UTC
  $$
  SELECT
    net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/daily-challenge-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5eHl3cGJlc25oZWduZ3F1cGRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzgzMjM4MCwiZXhwIjoyMDYzNDA4MzgwfQ.NwZ8rcs_6eQPCbrfxlz7R8Y0P0plHUUVyMJ5tkdyB3Q'
      ),
      body := jsonb_build_object('cron', true)
    ) AS request_id;
  $$
);
```

**Note:** Replace `YOUR_SERVICE_ROLE_KEY` with your Supabase service role key (found in Settings → API).

#### Changing the Notification Time

To change when notifications are sent, you need to update the cron schedule:

1. **First, unschedule the existing job:**
   ```sql
   SELECT cron.unschedule('daily-challenge-reminder');
   ```

2. **Create a new schedule with your desired time:**
   ```sql
   SELECT cron.schedule(
     'daily-challenge-reminder',
     '0 20 * * *', -- Change this: format is 'minute hour * * *' (UTC)
     $$
     SELECT
       net.http_post(
         url := 'https://your-project-ref.supabase.co/functions/v1/daily-challenge-reminder',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
         ),
         body := jsonb_build_object('cron', true)
       ) AS request_id;
     $$
   );
   ```

**Cron format examples:**
- `'0 20 * * *'` - Daily at 20:00 UTC (8 PM UTC)
- `'0 12 * * *'` - Daily at 12:00 UTC (noon UTC)
- `'30 18 * * *'` - Daily at 18:30 UTC (6:30 PM UTC)
- `'0 9 * * *'` - Daily at 09:00 UTC (9 AM UTC)

**Important:** Times are in UTC. Convert your local time to UTC when setting the schedule.

**To check existing cron jobs:**
```sql
SELECT * FROM cron.job;
```

**To view job schedule:**
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-challenge-reminder';
```

3. **Update text descriptions** (optional): If you want the UI to reflect the new time, update the translation files in `src/lib/translations.ts` to mention your chosen time.

### Option 2: Using External Cron Service

You can use services like:
- **cron-job.org**
- **EasyCron**
- **GitHub Actions** (with scheduled workflows)

Set up a cron job to call:
```
POST https://your-project-ref.supabase.co/functions/v1/daily-challenge-reminder
Headers:
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
Body:
  {}
```

### Option 3: Create a CRON_SECRET for Security

For better security, you can set a CRON_SECRET:

1. Add to Supabase Edge Function secrets:
   ```
   CRON_SECRET=your-secret-token-here
   ```

2. Update your cron job to include the secret:
   ```json
   {
     "authorization": "Bearer your-secret-token-here"
   }
   ```

## Step 6: Test Push Notifications

### Test subscription:

1. Open your app in a browser
2. Log in
3. Click "Enable Notifications" when prompted
4. Allow notifications in your browser

### Test sending a notification:

You can test by calling the Edge Function directly:

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-here",
    "title": "Test Notification",
    "body": "This is a test notification"
  }'
```

Or create a test button in your app (for development only).

## Step 7: Verify Setup

1. ✅ VAPID keys configured in Supabase secrets
2. ✅ `VITE_VAPID_PUBLIC_KEY` set in `.env`
3. ✅ Database migration run successfully
4. ✅ Edge Functions deployed
5. ✅ Cron job set up (for daily reminders)
6. ✅ Users can subscribe to notifications
7. ✅ Test notification received

## Implementation Note

The Edge Function uses a simplified Web Push implementation due to compatibility constraints with Deno. For production use, you may want to:

1. **Use a Push Notification Service**: Consider using services like:
   - OneSignal (has Supabase integration)
   - Firebase Cloud Messaging (FCM)
   - Pusher Beams
   
2. **Proper Web Push Encryption**: The current implementation uses a simplified approach. Full Web Push requires:
   - AES-128-GCM encryption
   - Proper JWT signing with ES256
   - ECDH key exchange

3. **Alternative: Call an External Service**: You could call an external API (Node.js service, Cloud Function, etc.) that handles the encryption properly.

## Troubleshooting

### Notifications not working:

1. **Check VAPID keys**: Ensure they're correctly set in Supabase secrets
2. **Check browser support**: Web Push requires HTTPS (except localhost)
3. **Check service worker**: Ensure it's registered and active
4. **Check subscription**: Verify subscription is saved in database
5. **Check browser console**: Look for errors in the console

### Edge Function errors:

1. **Check logs**: `supabase functions logs send-push-notification`
2. **Verify secrets**: Ensure VAPID keys are set correctly
3. **Check database**: Verify `push_subscriptions` table exists

### Cron job not running:

1. **Verify cron setup**: Check pg_cron extension is enabled
2. **Check cron logs**: Query `cron.job_run_details` in Supabase
3. **Verify function URL**: Ensure the URL in cron job is correct
4. **Check service role key**: Ensure it has proper permissions

## Browser Support

- ✅ Chrome/Edge (Desktop & Android)
- ✅ Firefox (Desktop & Android)
- ✅ Safari (iOS 16.4+ with installed PWA)
- ✅ Opera
- ❌ Safari (Desktop) - Limited support

## Security Notes

1. **Never expose VAPID_PRIVATE_KEY** in client-side code
2. **Use service role key** only in server-side contexts (cron jobs)
3. **Validate user permissions** before sending notifications
4. **Clean up expired subscriptions** regularly

## Additional Resources

- [Web Push API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [web-push Library](https://github.com/web-push-libs/web-push)
