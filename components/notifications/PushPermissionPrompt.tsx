'use client';
/**
 * components/notifications/PushPermissionPrompt.tsx
 *
 * Handles the full Web Push subscription flow:
 *   granted   → subscribe silently + POST to /api/notifications/push/subscribe
 *   default   → show browser permission prompt, handle result
 *   denied    → show browser-specific "how to unblock" instructions
 *
 * Props:
 *   onSuccess(endpoint)   — called after a subscription is saved; parent can hide the prompt
 *   onError(msg)          — called if subscription fails; parent should revert any toggle
 *   onDismiss             — called when user explicitly closes the prompt (denied state)
 */

import { useEffect, useState } from 'react';
import { Smartphone, CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';
import styles from './PushPermissionPrompt.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a rough browser name from userAgent for instructions copy. */
function detectBrowser(): 'chrome' | 'safari' | 'firefox' | 'edge' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('edg/'))     return 'edge';
  if (ua.includes('chrome'))   return 'chrome';
  if (ua.includes('safari'))   return 'safari';
  if (ua.includes('firefox'))  return 'firefox';
  return 'other';
}

/** Derive a human-readable device label from userAgent. */
function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua  = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const android = /Android/.test(ua);
  const mac = /Mac OS X/.test(ua) && !ios;
  const win = /Windows/.test(ua);
  const linux = /Linux/.test(ua) && !android;

  let os = 'Unknown OS';
  if (ios)     os = /iPad/.test(ua) ? 'iPad' : 'iPhone';
  else if (android) os = 'Android';
  else if (mac)     os = 'macOS';
  else if (win)     os = 'Windows';
  else if (linux)   os = 'Linux';

  const browser = detectBrowser();
  const browserLabel: Record<string, string> = {
    chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', edge: 'Edge', other: 'Browser',
  };

  return `${os} / ${browserLabel[browser]}`;
}

const UNBLOCK_INSTRUCTIONS: Record<string, string[]> = {
  chrome: [
    'Click the 🔒 lock icon in the address bar.',
    'Find "Notifications" and change it to "Allow".',
    'Reload the page.',
  ],
  edge: [
    'Click the lock icon in the address bar.',
    'Find "Notifications" and change it to "Allow".',
    'Reload the page.',
  ],
  safari: [
    'Open Safari → Settings → Websites → Notifications.',
    'Find FieldLogicHQ and change the setting to "Allow".',
    'Reload the page.',
  ],
  firefox: [
    'Click the lock icon in the address bar.',
    'Click "Connection Secure" → "More Information".',
    'Go to the Permissions tab and remove the "Blocked" setting for Notifications.',
    'Reload the page.',
  ],
  other: [
    'Open your browser settings and find Notifications permissions.',
    'Allow notifications for this site, then reload.',
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────

type PromptState =
  | 'idle'       // requesting permission
  | 'waiting'    // browser prompt shown, awaiting user response
  | 'subscribing'// permission granted, subscribing
  | 'success'
  | 'denied'
  | 'error';

interface Props {
  onSuccess: (endpoint: string) => void;
  onError:   (message: string) => void;
  onDismiss?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PushPermissionPrompt({ onSuccess, onError, onDismiss }: Props) {
  const [state,   setState]   = useState<PromptState>('idle');
  const [errMsg,  setErrMsg]  = useState('');
  const browser = detectBrowser();

  // On mount: check current permission state and act immediately if already resolved
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onError('Push notifications are not supported in this browser.');
      return;
    }

    if (Notification.permission === 'granted') {
      // Already allowed — skip the prompt and subscribe silently
      setState('subscribing');
      subscribe();
    } else if (Notification.permission === 'denied') {
      setState('denied');
    }
    // 'default' = show the prompt UI asking the user to click Allow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe() {
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error('Push notifications are not configured on this server.');
      }

      const registration = await navigator.serviceWorker.ready;

      // Convert base64url VAPID key to Uint8Array
      const keyBytes = urlBase64ToUint8Array(publicKey);

      let subscription: PushSubscription;
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly:      true,
          // Cast needed: TS5 widens Uint8Array buffer to ArrayBufferLike; the
          // Web Push API accepts ArrayBuffer-backed Uint8Array, which is what
          // urlBase64ToUint8Array always returns at runtime.
          applicationServerKey: keyBytes as unknown as BufferSource,
        });
      } catch (subErr) {
        // User dismissed the browser prompt or it failed
        if (Notification.permission === 'denied') {
          setState('denied');
          return;
        }
        throw subErr;
      }

      const subJson = subscription.toJSON();

      const res = await fetch('/api/notifications/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          endpoint:    subJson.endpoint,
          keys:        subJson.keys,
          deviceLabel: getDeviceLabel(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save subscription.');
      }

      setState('success');
      onSuccess(subscription.endpoint);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Subscription failed.';
      setErrMsg(msg);
      setState('error');
      onError(msg);
    }
  }

  async function handleAllow() {
    setState('waiting');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setState('subscribing');
      await subscribe();
    } else if (permission === 'denied') {
      setState('denied');
    } else {
      // dismissed
      setState('idle');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (state === 'success') {
    return (
      <div className={styles.prompt}>
        <CheckCircle size={15} className={styles.iconSuccess} />
        <span className={styles.text}>
          Push notifications enabled for this device.
        </span>
      </div>
    );
  }

  if (state === 'subscribing') {
    return (
      <div className={styles.prompt}>
        <Smartphone size={15} className={styles.iconIdle} />
        <span className={styles.text}>Registering device…</span>
      </div>
    );
  }

  if (state === 'denied') {
    const steps = UNBLOCK_INSTRUCTIONS[browser] ?? UNBLOCK_INSTRUCTIONS.other;
    return (
      <div className={`${styles.prompt} ${styles.promptDenied}`}>
        <div className={styles.deniedHeader}>
          <XCircle size={15} className={styles.iconDenied} />
          <strong>Notifications blocked in this browser</strong>
          {onDismiss && (
            <button className={styles.dismissBtn} onClick={onDismiss} aria-label="Dismiss">
              <X size={13} />
            </button>
          )}
        </div>
        <ol className={styles.steps}>
          {steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={`${styles.prompt} ${styles.promptError}`}>
        <AlertTriangle size={15} className={styles.iconDenied} />
        <span className={styles.text}>{errMsg || 'Could not enable push notifications.'}</span>
      </div>
    );
  }

  // idle / waiting — show the Allow button
  return (
    <div className={styles.prompt}>
      <Smartphone size={15} className={styles.iconIdle} />
      <span className={styles.text}>
        {state === 'waiting'
          ? 'Check your browser — click "Allow" in the permission prompt.'
          : 'Click to enable push notifications on this device.'}
      </span>
      {state === 'idle' && (
        <button className={styles.allowBtn} onClick={handleAllow}>
          Allow
        </button>
      )}
    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Convert a base64url string to a Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
