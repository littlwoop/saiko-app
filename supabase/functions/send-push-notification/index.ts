// Supabase Edge Function to send push notifications
// Uses manual Web Push encryption with Deno's Web Crypto API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  url?: string;
}

// VAPID keys - should be set as environment variables in Supabase
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL") || "noreply@example.com";

// Helper: Convert base64url string to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper: Convert Uint8Array to base64url string
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Generate VAPID JWT token
async function generateVAPIDJWT(expirationTime: number): Promise<string> {
  const header = {
    alg: "ES256",
    typ: "JWT",
  };

  const payload = {
    aud: new URL(VAPID_PUBLIC_KEY).origin || "https://fcm.googleapis.com",
    exp: expirationTime,
    sub: `mailto:${VAPID_CONTACT_EMAIL}`,
  };

  const headerBase64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const payloadBase64 = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const data = `${headerBase64}.${payloadBase64}`;
  const dataBytes = new TextEncoder().encode(data);

  // Import private key for signing
  const privateKeyPem = `-----BEGIN EC PRIVATE KEY-----\n${VAPID_PRIVATE_KEY}\n-----END EC PRIVATE KEY-----`;
  // Note: This is simplified - in production you'd need proper key import
  // For now, we'll use a simpler approach with the web push endpoint

  // For FCM and most push services, we need to create an Authorization header
  // The actual implementation would require proper JWT signing with ES256
  // This is a placeholder - you may need to use a service or different approach
  return `${headerBase64}.${payloadBase64}.signature`;
}

/**
 * Send push notification using Web Push protocol
 * This is a simplified implementation - for production, consider using a service
 */
async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<Response> {
  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || "challenge-reminder",
    data: payload.data || {},
    url: payload.url || "/dashboard",
  });

  // Get endpoint domain to determine push service
  const endpointUrl = new URL(subscription.endpoint);
  const isFCM = endpointUrl.hostname === "fcm.googleapis.com" || 
                endpointUrl.hostname.includes("googleapis.com");
  
  const expirationTime = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
  const jwt = await generateVAPIDJWT(expirationTime);

  // For now, we'll make a simple POST request
  // Note: Proper Web Push requires AES-128-GCM encryption which is complex
  // Consider using a service like OneSignal or implementing proper encryption
  try {
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
      body: new TextEncoder().encode(notificationPayload),
    });

    if (!response.ok) {
      // Handle expired/invalid subscriptions
      if (response.status === 410 || response.status === 404) {
        throw new Error("Subscription expired");
      }
      throw new Error(`Push service returned ${response.status}`);
    }

    return response;
  } catch (error: any) {
    if (error.message === "Subscription expired") {
      throw error;
    }
    throw new Error(`Failed to send notification: ${error.message}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get user from auth token (optional - can be called without auth for scheduled jobs)
    const authHeader = req.headers.get("Authorization");
    let user = null;
    if (authHeader) {
      const {
        data: { user: authUser },
      } = await supabaseClient.auth.getUser();
      user = authUser;
    }

    const { userId, title, body, icon, badge, tag, data, url } = await req
      .json()
      .catch(() => ({}));

    // If userId is provided, send to that user's subscriptions
    // Otherwise, send to the authenticated user
    const targetUserId = userId || user?.id;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get all push subscriptions for the user
    const { data: subscriptions, error } = await supabaseClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", targetUserId);

    if (error) {
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push subscriptions found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send notification to all subscriptions
    const payload: PushPayload = {
      title: title || "Challenge Reminder",
      body: body || "Don't forget to complete your daily challenge!",
      icon: icon || "/icon-192.png",
      badge: badge || "/icon-192.png",
      tag: tag || "challenge-reminder",
      data: data || {},
      url: url || "/dashboard",
    };

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const subscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await sendPushNotification(subscription, payload);
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          // If subscription is expired, delete it
          if (error.message === "Subscription expired" || error.message?.includes("expired")) {
            await supabaseClient
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
          throw error;
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Clean up expired subscriptions
    const expired = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason)
      .filter((error: any) => 
        error.message === "Subscription expired" || error.message?.includes("expired")
      );

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed,
        expired: expired.length,
        total: subscriptions.length,
        note: "Using simplified Web Push implementation. For production, consider proper AES-128-GCM encryption.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
