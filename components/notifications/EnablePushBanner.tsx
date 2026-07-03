'use client';

/**
 * components/notifications/EnablePushBanner.tsx
 *
 * A slim, dismissible prompt that offers to turn on OS-level notifications for
 * the current device in ONE tap. Solves the discovery problem: previously the
 * only way to enable push was buried in a per-event settings table, and the
 * "Allow" confirm rendered off-screen on mobile.
 *
 * Shows only when: push is supported, the browser hasn't blocked notifications,
 * this device isn't already subscribed, and the user hasn't recently dismissed it.
 * Auto-hides forever on this device once enabled. Tapping "Turn on" fires the
 * phone's Allow dialog directly (browser-rendered → always visible) inside the
 * click gesture, then registers the device server-side so notify() can reach it.
 */

import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  isPushSupported,
  getCurrentPushEndpoint,
  enablePushOnThisDevice,
  PushPermissionError,
} from '@/lib/push-client';
import styles from './EnablePushBanner.module.css';

const DISMISS_KEY = 'flhq-push-prompt-dismissed';
const RESURFACE_MS = 30 * 24 * 60 * 60 * 1000; // re-offer 30 days after a dismiss

/** Resolve to the current subscription endpoint, or null — never hang (dev has no SW). */
async function subscribedEndpoint(): Promise<string | null> {
  return Promise.race([
    getCurrentPushEndpoint(),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
  ]);
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < RESURFACE_MS;
  } catch {
    return false;
  }
}

type Status = 'hidden' | 'offer' | 'working' | 'done' | 'error';

export default function EnablePushBanner() {
  const [status, setStatus] = useState<Status>('hidden');
  const [errMsg, setErrMsg] = useState('');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the "done" auto-hide timer if we unmount before it fires.
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Decide on mount whether to show. Client-only checks — start hidden to avoid
  // any SSR/hydration flash.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isPushSupported()) return;
      if (Notification.permission === 'denied') return;
      if (recentlyDismissed()) return;
      const endpoint = await subscribedEndpoint();
      if (cancelled) return;
      if (endpoint) return; // already receiving push on this device
      setStatus('offer');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTurnOn() {
    setStatus('working');
    setErrMsg('');
    try {
      await enablePushOnThisDevice();
      setStatus('done');
      // Fade the confirmation out shortly after (cleared on unmount).
      hideTimer.current = setTimeout(() => setStatus('hidden'), 4000);
    } catch (e) {
      const reason = e instanceof PushPermissionError ? e.reason : 'failed';
      setErrMsg(
        reason === 'denied'
          ? 'Notifications are blocked. Turn them on for this app in your browser or phone settings, then try again.'
        : reason === 'unsupported'
          ? 'On iPhone, add the app to your Home Screen first (iOS 16.4+), then try again.'
        : reason === 'unconfigured'
          ? 'Notifications aren’t set up on the server yet. Please try again later.'
        : 'Couldn’t turn on notifications. Please try again.'
      );
      setStatus('error');
    }
  }

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore storage failures */
    }
    setStatus('hidden');
  }

  if (status === 'hidden') return null;

  if (status === 'done') {
    return (
      <div className={`${styles.banner} ${styles.bannerDone}`} role="status">
        <Bell size={16} className={styles.icon} aria-hidden />
        <span className={styles.text}>Notifications are on for this device.</span>
      </div>
    );
  }

  return (
    <div className={styles.banner} role="region" aria-label="Enable notifications">
      <Bell size={16} className={styles.icon} aria-hidden />
      <div className={styles.body}>
        <span className={styles.text}>
          <strong>Get alerts on this device</strong> — new registrations, payments, scores and more,
          even when the app is closed.
        </span>
        {status === 'error' && errMsg && <span className={styles.error}>{errMsg}</span>}
      </div>
      <button
        type="button"
        className={styles.cta}
        onClick={handleTurnOn}
        disabled={status === 'working'}
      >
        {status === 'working' ? 'Turning on…' : 'Turn on'}
      </button>
      <button
        type="button"
        className={styles.dismiss}
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}
