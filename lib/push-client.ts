'use client';
/**
 * lib/push-client.ts — Browser-side Web Push subscription helpers.
 *
 * The subscribe core was originally inline in PushPermissionPrompt (staff flow).
 * Extracted here so the anonymous fan flow (FollowAlertsToggle) can reuse it.
 * Server send lives in lib/web-push.ts; this is the browser counterpart.
 */

export interface BrowserPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceLabel: string;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Convert a base64url VAPID key to a Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Human-readable device label derived from the userAgent. */
export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const android = /Android/.test(ua);
  const mac = /Mac OS X/.test(ua) && !ios;
  const win = /Windows/.test(ua);
  const linux = /Linux/.test(ua) && !android;

  let os = 'Unknown OS';
  if (ios) os = /iPad/.test(ua) ? 'iPad' : 'iPhone';
  else if (android) os = 'Android';
  else if (mac) os = 'macOS';
  else if (win) os = 'Windows';
  else if (linux) os = 'Linux';

  const lower = ua.toLowerCase();
  let browser = 'Browser';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome')) browser = 'Chrome';
  else if (lower.includes('safari')) browser = 'Safari';
  else if (lower.includes('firefox')) browser = 'Firefox';

  return `${os} / ${browser}`;
}

export class PushPermissionError extends Error {
  constructor(message: string, public reason: 'unsupported' | 'denied' | 'dismissed' | 'unconfigured' | 'failed') {
    super(message);
    this.name = 'PushPermissionError';
  }
}

/**
 * Request permission (if needed) and return the active push subscription.
 * Reuses an existing browser subscription when present so the same device
 * isn't re-subscribed across features. Throws PushPermissionError on failure.
 */
export async function subscribeToPush(): Promise<BrowserPushSubscription> {
  if (!isPushSupported()) {
    throw new PushPermissionError('Push notifications are not supported in this browser.', 'unsupported');
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new PushPermissionError('Push notifications are not configured on this server.', 'unconfigured');
  }
  if (Notification.permission === 'denied') {
    throw new PushPermissionError('Notifications are blocked in this browser.', 'denied');
  }
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result === 'denied') throw new PushPermissionError('Notifications are blocked in this browser.', 'denied');
    if (result !== 'granted') throw new PushPermissionError('Notification permission was not granted.', 'dismissed');
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast: TS widens Uint8Array buffer; the Web Push API accepts the
      // ArrayBuffer-backed Uint8Array urlBase64ToUint8Array returns at runtime.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new PushPermissionError('Subscription was incomplete.', 'failed');
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    deviceLabel: getDeviceLabel(),
  };
}

/** The current browser push endpoint, if any (used to unsubscribe a fan row). */
export async function getCurrentPushEndpoint(): Promise<string | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}
