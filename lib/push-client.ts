'use client';
/**
 * lib/push-client.ts — Browser-side Web Push subscription helpers.
 *
 * The subscribe core was originally inline in a staff-flow prompt component.
 * Extracted here so the anonymous fan flow (FollowAlertsToggle) can reuse it.
 * ⚰ That component (`PushPermissionPrompt`) was deleted 2026-09-01 (cleanup tranche 6) — once the
 * core moved here it kept no importers, so this module is now the only home for the flow.
 * Server send lives in lib/web-push.ts; this is the browser counterpart.
 */

import { createClient } from './supabase-browser';
import { reportClientError } from './observability/client';

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

/** Why turning push on failed. `failed` = the browser would not create the subscription (or made an
 *  incomplete one); `save` = it did, but our server could not store it; `signedOut` = the server refused
 *  the save because the session has ended. */
export type PushFailureReason = 'unsupported' | 'denied' | 'dismissed' | 'unconfigured' | 'failed' | 'save' | 'signedOut';

export class PushPermissionError extends Error {
  constructor(message: string, public reason: PushFailureReason) {
    super(message);
    this.name = 'PushPermissionError';
  }
}

function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS 13+ reports a Mac user agent; a touch screen gives it away.
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * THE customer sentence for a failed "turn on notifications" — every surface that turns push on
 * (the admin banner, Notification settings' device list and switches, a fan's alerts) says the same
 * thing for the same cause. Each names a next step: "Please try again" alone told nobody anything
 * (2026-10-16: the owner's installed app predated the move to www, so its pages opened outside the
 * app and the banner could neither see his alerts nor create new ones — the fix was to reinstall).
 */
export function pushFailureMessage(reason: PushFailureReason): string {
  const host = typeof window !== 'undefined' ? window.location.host : 'this site';
  switch (reason) {
    case 'denied':
      return 'Notifications are blocked for this site. Allow them in your phone or browser settings, then try again.';
    case 'unsupported':
      // Two causes share this reason: a browser without Web Push (iPhone Safari before Add to Home Screen),
      // and one that has it but no service worker running on this page (a failed registration, a dev build).
      if (isPushSupported()) return 'Notifications can’t start on this page yet. Reload it and try again.';
      return isAppleMobile()
        ? 'On iPhone or iPad, add FieldLogicHQ to your home screen first (iOS 16.4 or later), then turn notifications on from there.'
        : 'This browser can’t receive notifications. Try Chrome, Edge, Firefox or Safari.';
    case 'unconfigured':
      return 'Notifications aren’t set up on the server yet. Please try again later.';
    case 'dismissed':
      return `The Allow prompt closed before you chose. Try again and choose Allow. If no prompt appears, open ${host} in your browser and try there.`;
    case 'save':
      return 'Couldn’t save this device. Please try again in a minute.';
    case 'signedOut':
      return 'You’re signed out. Sign in again, then turn notifications on.';
    case 'failed':
    default:
      return `Couldn’t turn on notifications in this window. Open ${host} in your browser and try there. If the FieldLogicHQ app shows an address bar at the top, remove it and install it again from that page.`;
  }
}

/** Any thrown value → the sentence a person reads. A non-push error (a bug, a network drop) reads as `failed`. */
export function pushFailureMessageFor(err: unknown): string {
  return pushFailureMessage(err instanceof PushPermissionError ? err.reason : 'failed');
}

/** Record a failure nobody chose, so the next one is a fact rather than a guess. Never throws. */
function reportPushFailure(step: 'subscribe' | 'save', detail: string): void {
  // One fixed route, so every page's failure of one cause groups together (the page path carries org slugs and ids).
  reportClientError({ name: `PushTurnOnFailed:${step}`, message: `${detail} (${getDeviceLabel()})`, route: '/push/turn-on' });
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

  // `navigator.serviceWorker.ready` NEVER settles when no service worker is registered — it waits
  // for a registration to become active, forever. That's guaranteed in dev (the app deliberately
  // unregisters the SW — see ServiceWorkerRegistration) and possible in prod if registration
  // failed, and it left every "turn on alerts" control stuck on its pending state. Check for a
  // registration first so the flow fails honestly instead of hanging.
  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (!existingRegistration) {
    throw new PushPermissionError(
      process.env.NODE_ENV !== 'production'
        ? 'Push is unavailable in dev builds (the service worker is disabled) — test alerts on a production build.'
        : 'This browser can’t receive push notifications right now.',
      'unsupported',
    );
  }
  // The browser can refuse here even with permission granted (a page outside an installed app's
  // address, a push service that is off). Its own error ("AbortError: Registration failed - push
  // service error") is for us, not for the person — record it and throw the plain reason.
  let subscription: PushSubscription;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: TS widens Uint8Array buffer; the Web Push API accepts the
        // ArrayBuffer-backed Uint8Array urlBase64ToUint8Array returns at runtime.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      }));
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // Permission withdrawn between the check above and the call: the person's own setting, not a failure.
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new PushPermissionError(`The browser refused: ${detail}`, 'denied');
    }
    reportPushFailure('subscribe', detail);
    throw new PushPermissionError(`The browser would not subscribe: ${detail}`, 'failed');
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    reportPushFailure('subscribe', 'Subscription was incomplete');
    throw new PushPermissionError('Subscription was incomplete.', 'failed');
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    deviceLabel: getDeviceLabel(),
  };
}

/**
 * Full "enable push on this device" flow for an authenticated staff user:
 * request permission (if needed), subscribe the device, and persist the
 * subscription server-side so notify() can reach it.
 *
 * Must be called directly from a user-gesture handler (e.g. a button onClick) —
 * browsers only allow Notification.requestPermission() inside a live gesture, so
 * don't defer this into an effect after a re-render.
 *
 * Returns the subscription endpoint on success. Throws PushPermissionError (a PushFailureReason);
 * show it with `pushFailureMessage` / `pushFailureMessageFor`.
 */
export async function enablePushOnThisDevice(): Promise<string> {
  const sub = await subscribeToPush();

  let res: Response;
  try {
    res = await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.keys,
        deviceLabel: sub.deviceLabel,
      }),
    });
  } catch {
    // Offline or dropped — nothing reached the server, so there is nothing for it to have logged.
    throw new PushPermissionError('The save request never reached the server.', 'save');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({} as { error?: string }));
    // A session that ended is the person's state, not our fault: say so, and keep it out of the error log.
    if (res.status === 401) throw new PushPermissionError(data.error ?? 'Unauthorized', 'signedOut');
    reportPushFailure('save', `HTTP ${res.status}: ${data.error ?? 'no message'}`);
    throw new PushPermissionError(data.error ?? 'Failed to save subscription.', 'save');
  }

  return sub.endpoint;
}

/**
 * Turn a registered device OFF: delete its server-side subscription so notify() stops
 * reaching it, and — if it's THIS browser's active subscription — unsubscribe it locally too.
 * Best-effort on the local unsubscribe; the server delete is the authoritative "off".
 */
export async function removePushDevice(endpoint: string): Promise<void> {
  try {
    if (isPushSupported()) {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub && sub.endpoint === endpoint) await sub.unsubscribe();
    }
  } catch {
    // Local unsubscribe is best-effort; the server delete below is what stops delivery.
  }

  const res = await fetch('/api/notifications/push/unsubscribe', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ endpoint }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(data.error ?? 'Failed to turn off notifications on this device.');
  }
}

/**
 * WI-6: silently re-attach this device's account push on sign-in — ONLY when the browser
 * permission is ALREADY 'granted'. This never prompts (requesting permission stays exclusively the
 * job of the opt-in flow / user gesture); on 'default' or 'denied' it no-ops. Idempotent: the
 * subscribe route upserts by endpoint and re-points user_id, so re-running is harmless — and that
 * re-point is exactly how a different account signing in on a shared device takes the device over.
 * Fully self-contained + swallow-all: a failure just means the next sign-in (or opt-in) retries.
 */
export async function reattachPushOnSignIn(): Promise<void> {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        deviceLabel: getDeviceLabel(),
      }),
    });
  } catch {
    // Silent best-effort — never surface an error from a background re-subscribe.
  }
}

/**
 * WI-6: this concern's OWN self-subscribed auth watcher (mirrors lib/follow.ts's + lib/
 * fan-alert-prefs-client.ts's pattern — each concern owns its watcher rather than piggybacking
 * another's). Installed once, browser-only. On a fresh sign-in it silently re-attaches this device's
 * account push; on sign-out it clears the de-dup marker. `onAuthStateChange` can re-emit SIGNED_IN
 * (cross-tab session sync), so we re-attach only when the signed-in user actually changes — no
 * redundant subscribe POST per emit.
 */
let pushAuthWatcherInstalled = false;
let lastReattachedUserId: string | null = null;
function ensurePushAuthWatcher(): void {
  if (pushAuthWatcherInstalled || typeof window === 'undefined') return;
  pushAuthWatcherInstalled = true;
  createClient().auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id ?? null;
    if (!userId) {
      lastReattachedUserId = null;
      return;
    }
    if (event === 'SIGNED_IN' && userId !== lastReattachedUserId) {
      lastReattachedUserId = userId;
      void reattachPushOnSignIn();
    }
  });
}
ensurePushAuthWatcher();

/**
 * WI-6: detach this device's ACCOUNT push server-side on sign-out, WITHOUT touching the browser's
 * shared Push subscription. That subscription is one-per-origin and is ALSO used by the anonymous
 * fan-follow alert flow (FollowAlertsToggle → `fan_push_subscriptions`, same endpoint) — so a local
 * `pushManager.unsubscribe()` here (what `removePushDevice` does) would silently kill a co-resident
 * fan's alerts too. Deleting only the account `push_subscriptions` row stops account push (notify()
 * has no row to target) while leaving the browser subscription + fan alerts intact, and lets the
 * sign-in re-attach cheaply reuse the existing subscription. Throws on server error (caller time-boxes).
 */
export async function detachAccountPushOnSignOut(endpoint: string): Promise<void> {
  const res = await fetch('/api/notifications/push/unsubscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(data.error ?? 'Failed to detach account push on sign-out.');
  }
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
