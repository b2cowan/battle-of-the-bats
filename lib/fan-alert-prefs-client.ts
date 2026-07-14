'use client';
/**
 * lib/fan-alert-prefs-client.ts — browser-side counterpart to lib/fan-alert-prefs.ts.
 *
 * One shared source for the signed-in fan's two global alert switches, used by
 * every surface that shows or edits them (FollowAlertsToggle, FanNotificationBell,
 * AlertsNudge, FanAlertsCard). A tournament page mounts several of these at once
 * (mobile strip + desktop rail + dock + navbar bell), so the GET is memoized
 * module-wide — all instances await ONE fetch per page load — and saves update
 * the cache + broadcast `fl-fan-prefs-change` so every mounted control stays in
 * sync without its own re-fetch.
 *
 * Auth transitions here are SPA navigations (login/logout use router.push, no
 * full reload), so the cache subscribes to supabase's auth events and resets
 * itself — a fan who taps "Sign in for score alerts" and lands back on the page
 * must see the signed-in state immediately, not the stale signed-out pitch.
 */
import { useEffect, useState } from 'react';
import { createClient } from './supabase-browser';
import { getSession } from './auth';
import { enablePushOnThisDevice, PushPermissionError } from './push-client';
import type { FanAlertPrefs } from './fan-alert-prefs';

const CHANGE_EVENT = 'fl-fan-prefs-change';

/** null = anonymous (no account prefs exist — alerts are sign-in gated). */
type PrefsResult = FanAlertPrefs | null;

let cached: Promise<PrefsResult> | null = null;
// Monotonic save counter — only the LATEST save's response may update the cache,
// so two in-flight saves can't let the earlier response stomp the later one.
let saveSeq = 0;
let authWatcherStarted = false;

/** Reset the cache whenever the auth session changes (sign-in/out are SPA navs). */
function ensureAuthWatcher() {
  if (authWatcherStarted || typeof window === 'undefined') return;
  authWatcherStarted = true;
  createClient().auth.onAuthStateChange(event => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      cached = null;
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  });
}

async function fetchPrefs(): Promise<PrefsResult> {
  const session = await getSession().catch(() => null);
  if (!session?.user) return null;
  try {
    const res = await fetch('/api/consumer/alert-prefs');
    if (!res.ok) return { gameAlerts: true, eventNews: true }; // signed in; defaults stand
    const data = await res.json();
    if (!data?.linked) return null;
    return { gameAlerts: !!data.gameAlerts, eventNews: !!data.eventNews };
  } catch {
    return { gameAlerts: true, eventNews: true };
  }
}

/** Memoized: every caller on the page shares one GET (and one session check). */
export function getFanAlertPrefsCached(): Promise<PrefsResult> {
  ensureAuthWatcher();
  if (!cached) cached = fetchPrefs();
  return cached;
}

export interface SavePrefResult {
  ok: boolean;
  /** Set when the account pref saved but THIS device couldn't register for push. */
  deviceIssue: string | null;
  /** Why the device registration failed, when it did (callers branch on 'denied'). */
  deviceReason: 'denied' | 'unsupported' | 'other' | null;
  error: string | null;
}

function describeDeviceIssue(err: unknown): string {
  if (err instanceof PushPermissionError) {
    if (err.reason === 'denied') {
      return 'Saved for your account — but notifications are blocked in this browser, so this device won’t receive them until you allow them in your browser settings.';
    }
    if (err.reason === 'unsupported') {
      return 'Saved for your account — this browser doesn’t support push, so alerts will arrive on your other signed-in devices.';
    }
  }
  return 'Saved for your account — but this device couldn’t be registered for push right now.';
}

function deviceReasonOf(err: unknown): 'denied' | 'unsupported' | 'other' {
  if (err instanceof PushPermissionError) {
    if (err.reason === 'denied') return 'denied';
    if (err.reason === 'unsupported') return 'unsupported';
  }
  return 'other';
}

/**
 * Save one switch: registers this device for push when turning ON (must be
 * called from the user gesture — the permission prompt requires it; device
 * failure is non-fatal, the account pref still saves), POSTs the patch, updates
 * the shared cache, and broadcasts the change to every mounted control.
 * Set `strictDevice` to treat a device-registration failure as a hard error
 * instead (the in-context toggle wants that; the settings card doesn't).
 */
export async function saveFanAlertPref(
  key: keyof FanAlertPrefs,
  value: boolean,
  opts: { strictDevice?: boolean } = {},
): Promise<SavePrefResult> {
  ensureAuthWatcher();
  const seq = ++saveSeq;
  let deviceIssue: string | null = null;
  let deviceReason: SavePrefResult['deviceReason'] = null;
  if (value) {
    try {
      await enablePushOnThisDevice();
    } catch (err) {
      deviceReason = deviceReasonOf(err);
      if (opts.strictDevice) {
        const msg = deviceReason === 'denied'
          ? 'Notifications are blocked — enable them in your browser settings.'
          : err instanceof Error ? err.message : 'Could not enable alerts.';
        return { ok: false, deviceIssue: null, deviceReason, error: msg };
      }
      deviceIssue = describeDeviceIssue(err);
    }
  }

  try {
    const res = await fetch('/api/consumer/alert-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    // Only the latest-issued save may write the cache — an earlier request's
    // response arriving late must not revert a newer change in the UI.
    if (seq === saveSeq) {
      const next: FanAlertPrefs = { gameAlerts: !!data.gameAlerts, eventNews: !!data.eventNews };
      cached = Promise.resolve(next);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
    return { ok: true, deviceIssue, deviceReason, error: null };
  } catch {
    return { ok: false, deviceIssue: null, deviceReason, error: 'Couldn’t save that change — try again.' };
  }
}

export type FanPrefsStatus =
  | { state: 'checking' }
  | { state: 'signedOut' }
  | { state: 'ready'; prefs: FanAlertPrefs };

/**
 * The signed-in fan's alert prefs, shared across every mounted control on the
 * page (one fetch, live cross-control sync via the change event).
 */
export function useFanAlertPrefs(): FanPrefsStatus {
  const [status, setStatus] = useState<FanPrefsStatus>({ state: 'checking' });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void getFanAlertPrefsCached().then(prefs => {
        if (cancelled) return;
        setStatus(prefs ? { state: 'ready', prefs } : { state: 'signedOut' });
      });
    };
    load();
    window.addEventListener(CHANGE_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGE_EVENT, load);
    };
  }, []);

  return status;
}
