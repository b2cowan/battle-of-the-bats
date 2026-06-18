/**
 * lib/web-push.ts — Server-only Web Push sender
 *
 * IMPORTANT: This module uses the `web-push` npm package which is Node.js-only.
 * Never import this file from client-side code.
 *
 * Consumed by:
 *   - lib/notify.ts         (Phase E9 — dispatch loop)
 *   - API routes are thin callers of notify(), not direct callers here
 */

import webPush from 'web-push';

// ── VAPID setup (runs once on module load) ────────────────────────────────────

const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const email      = process.env.VAPID_EMAIL ?? 'mailto:fieldlogichq@gmail.com';

if (!publicKey || !privateKey) {
  // Warn at startup — don't hard-crash so the app still boots without push configured
  console.warn(
    '[web-push] NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set. ' +
    'Push notifications will be disabled until these env vars are configured.'
  );
} else {
  webPush.setVapidDetails(email, publicKey, privateKey);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushSubscriptionKeys {
  p256dh: string;
  auth:   string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys:     PushSubscriptionKeys;
}

export interface PushPayload {
  title:  string;
  body?:  string;
  link?:  string;
  /** Notification icon URL (e.g. tournament/org logo). The SW falls back to the
   *  platform icon when this is absent. May be absolute or origin-relative. */
  icon?:  string;
}

// ── sendWebPush ───────────────────────────────────────────────────────────────

/**
 * Send a Web Push notification to a single subscription.
 *
 * Returns: void on success
 * Throws:  WebPushError with statusCode 410 when the subscription has expired/been revoked
 *          (caller should delete that push_subscriptions row)
 *          Other errors are rethrown as-is.
 */
export async function sendWebPush(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<void> {
  if (!publicKey || !privateKey) {
    // Silently skip — VAPID not configured; don't crash the caller
    return;
  }

  await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth:   subscription.keys.auth,
      },
    },
    JSON.stringify(payload),
    {
      TTL: 60 * 60 * 24, // 24 hours — message survives if device is offline
    }
  );
}
