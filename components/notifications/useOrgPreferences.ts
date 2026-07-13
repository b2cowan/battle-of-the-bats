'use client';

/**
 * components/notifications/useOrgPreferences.ts
 *
 * The shared load/save/toggle state machine behind every org-scoped notification card
 * (Notification Settings Phase 1). Extracted from the old org preferences page so the
 * universal /account/notifications cards and any future surface all behave identically:
 * optimistic toggles, debounced per-row saves, and the in-gesture push-enrolment flow
 * (turning Push ON registers THIS device so a green toggle is never a silent no-op).
 *
 * Reuses the org-membership preferences API (rep + team-workspace coaches ARE org
 * members, so it authorizes every Phase 1 card) — no schema change, no new endpoint.
 *
 * `eventTypes` must be referentially stable across renders (pass a module constant or a
 * useMemo'd array) — it drives the load/save effects.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PUSH_DEFAULT_ON_EVENTS } from '@/lib/notification-labels';
import { enablePushOnThisDevice, PushPermissionError } from '@/lib/push-client';
import type { NotificationEventType, NotificationPreference } from '@/lib/types';

type Channel = 'channelBell' | 'channelPush' | 'channelEmail';

/** System defaults applied when no saved row exists — mirrors lib/notify.ts systemDefaults(). */
export function orgSystemDefault(eventType: NotificationEventType, role: string): NotificationPreference {
  return {
    eventType,
    channelBell:  true,
    channelPush:  PUSH_DEFAULT_ON_EVENTS.has(eventType),
    channelEmail: eventType === 'payment_failed' && (role === 'owner' || role === 'admin'),
  };
}

export function useOrgPreferences({
  orgSlug,
  role,
  eventTypes,
}: {
  orgSlug: string | undefined;
  role: string;
  eventTypes: NotificationEventType[];
}) {
  const [prefs, setPrefs]     = useState<Map<NotificationEventType, NotificationPreference>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState<Set<NotificationEventType>>(new Set());

  // null = not yet checked (SSR), false = unsupported, true = supported.
  const [pushSupported, setPushSupported] = useState<boolean | null>(null);
  const [enablingPush, setEnablingPush]   = useState(false);

  // Mirror of the latest committed prefs, read (never rendered) by the async saves below so a
  // debounced or post-push save always persists the up-to-date row — even after several quick
  // toggles, or a future caller that flips multiple rows in one batch (Phase 2 group rollups).
  // Synced in an effect (not during render); the saves that read it fire ≥300ms later / after
  // an async push round-trip, always after this effect has committed the newest value.
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const debounceRefs = useRef<Map<NotificationEventType, ReturnType<typeof setTimeout>>>(new Map());

  const systemDefaultFor = useCallback(
    (et: NotificationEventType) => orgSystemDefault(et, role),
    [role],
  );

  // ── Detect push support on mount (client-only) ─────────────────────────────
  useEffect(() => {
    setPushSupported(
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window,
    );
  }, []);

  // ── Cancel any pending debounced saves on unmount (navigating away mid-debounce) ──
  useEffect(() => {
    const timers = debounceRefs.current;
    return () => { for (const t of timers.values()) clearTimeout(t); };
  }, []);

  // ── Load preferences ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgSlug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/org/notification-preferences?orgSlug=${orgSlug}`);
        if (!res.ok) throw new Error('Failed to load preferences.');
        const { preferences } = await res.json() as { preferences: NotificationPreference[] };
        if (cancelled) return;

        const map = new Map<NotificationEventType, NotificationPreference>();
        for (const et of eventTypes) map.set(et, orgSystemDefault(et, role));
        for (const p of preferences) map.set(p.eventType, p);
        setPrefs(map);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [orgSlug, role, eventTypes]);

  // ── Save a single preference row ────────────────────────────────────────────
  const savePref = useCallback(async (pref: NotificationPreference) => {
    if (!orgSlug) return;
    setSaving(prev => new Set(prev).add(pref.eventType));
    try {
      const res = await fetch(`/api/admin/org/notification-preferences?orgSlug=${orgSlug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ preferences: [pref] }),
      });
      if (!res.ok) throw new Error('Save failed.');
    } catch {
      setError('Failed to save preference. Please try again.');
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(pref.eventType); return n; });
    }
  }, [orgSlug]);

  // ── Optimistic toggle handler ────────────────────────────────────────────────
  const handleToggle = useCallback((
    eventType: NotificationEventType,
    channel: Channel,
    value: boolean,
  ) => {
    // Apply optimistically with a FUNCTIONAL updater so the new row is always built on the
    // latest committed state, never a stale closure — safe even if a handler flips several
    // rows in one batch. The async saves below read the freshly-committed row from prefsRef
    // (at fire time), so they can never persist a value that a later toggle superseded.
    const applyOptimistic = (chan: Channel, val: boolean) =>
      setPrefs(prev => {
        const current = prev.get(eventType) ?? orgSystemDefault(eventType, role);
        return new Map(prev).set(eventType, { ...current, [chan]: val });
      });
    const saveLatest = () => {
      const latest = prefsRef.current.get(eventType);
      if (latest) savePref(latest);
    };

    // Turning Push ON must register THIS device inside the click gesture so the OS
    // "Allow notifications?" dialog appears immediately — otherwise the toggle goes
    // green but no device is subscribed and nothing is ever delivered.
    if (channel === 'channelPush' && value === true) {
      setError(null);
      applyOptimistic('channelPush', true); // optimistic ON
      setEnablingPush(true);
      enablePushOnThisDevice()
        .then(saveLatest)
        .catch((e: unknown) => {
          applyOptimistic('channelPush', false); // revert
          const reason = e instanceof PushPermissionError ? e.reason : 'failed';
          setError(
            reason === 'denied'
              ? 'Notifications are blocked for this site. Turn them on in your browser or phone settings, then try again.'
            : reason === 'unsupported'
              ? 'This browser doesn’t support push notifications. On iPhone, add the app to your Home Screen first (iOS 16.4+).'
            : reason === 'unconfigured'
              ? 'Push isn’t set up on the server yet. Please try again later.'
            : (e instanceof Error ? e.message : 'Could not enable push notifications.'),
          );
        })
        .finally(() => setEnablingPush(false));
      return;
    }

    // All other channels + push toggle OFF — optimistic update, debounced save of the
    // latest committed row (read at fire time so batched toggles never persist a stale value).
    applyOptimistic(channel, value);
    const existing = debounceRefs.current.get(eventType);
    if (existing) clearTimeout(existing);
    const t = setTimeout(saveLatest, 300);
    debounceRefs.current.set(eventType, t);
  }, [role, savePref]);

  return {
    prefs,
    loading,
    error,
    saving,
    pushSupported,
    enablingPush,
    systemDefaultFor,
    handleToggle,
    setError,
  };
}
