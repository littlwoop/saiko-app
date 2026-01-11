import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WebPush } from 'https://deno.land/x/webpush@v1.1.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
    const vapidContactEmail = Deno.env.get('VAPID_CONTACT_EMAIL') || 'mailto:admin@example.com';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('Missing VAPID keys. Make sure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set in Supabase Edge Function secrets.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { userId, notification } = (await req.json()) as {
      userId: string;
      notification: NotificationPayload;
    };

    if (!userId || !notification) {
      throw new Error('Missing userId or notification');
    }

    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No push subscriptions found for user',
          userId 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Initialize web-push with VAPID keys
    const webpush = new WebPush({
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
      subject: vapidContactEmail,
    });

    // Create notification payload
    const notificationPayload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icon-192.png',
      badge: notification.badge || '/icon-192.png',
      tag: notification.tag || 'notification',
      requireInteraction: notification.requireInteraction || false,
      data: notification.data || {},
    });

    // Send notification to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          console.log(`Attempting to send to subscription: ${sub.endpoint.substring(0, 50)}...`);
          
          const subscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          console.log('Sending notification with payload:', notificationPayload);

          const result = await webpush.sendNotification(
            subscription,
            notificationPayload
          );

          console.log(`Push notification response: ${result.status} ${result.statusText}`);
          
          // Log response headers for debugging
          const responseHeaders: Record<string, string> = {};
          result.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          console.log('Response headers:', responseHeaders);

          // Check if response is ok
          if (!result.ok) {
            const errorText = await result.text();
            console.error(`Push service returned error: ${result.status} ${errorText}`);
            throw new Error(`Push service error: ${result.status} ${errorText}`);
          }

          return {
            endpoint: sub.endpoint,
            status: result.status,
            statusText: result.statusText,
            ok: result.ok,
          };
        } catch (error) {
          console.error(`Failed to send to ${sub.endpoint}:`, error);
          console.error('Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw {
            endpoint: sub.endpoint,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          };
        }
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // Log detailed results
    const details = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          index,
          status: 'success',
          endpoint: subscriptions[index].endpoint,
          responseStatus: result.value.status,
        };
      } else {
        return {
          index,
          status: 'failed',
          endpoint: subscriptions[index].endpoint,
          error: result.reason?.error || String(result.reason),
        };
      }
    });

    // Log failures for debugging
    details.forEach((detail) => {
      if (detail.status === 'failed') {
        console.error(`Failed notification ${detail.index}:`, detail.error);
      }
    });

    return new Response(
      JSON.stringify({
        message: `Sent ${successful} notification(s), ${failed} failed`,
        successful,
        failed,
        total: subscriptions.length,
        details,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
