-- Remove push notification infrastructure
-- This migration removes the push_subscriptions table and related cron jobs

-- Remove the cron job for daily challenge reminders (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-challenge-reminder') THEN
    PERFORM cron.unschedule('daily-challenge-reminder');
  END IF;
END $$;

-- Drop the push_subscriptions table and related objects
DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON push_subscriptions;
DROP FUNCTION IF EXISTS update_push_subscriptions_updated_at();
DROP TABLE IF EXISTS push_subscriptions CASCADE;
