'use client';
/**
 * lib/fan-alerts.ts — shared client helpers for the anonymous fan notification opt-in.
 *
 * State lives in localStorage under `fl_fan_alerts_${orgSlug}_${tournamentSlug}`:
 *   { endpoint, teamId, notifyMessages, notifyScores }
 * There is ONE subscription row per (endpoint, tournament) on the server, so BOTH the
 * per-team FollowAlertsToggle and the tournament-wide notification bell read/write this same
 * shared state and stay in sync via the `fl-fan-alerts-change` event.
 *
 * Categories (mig 177):
 *   notifyMessages — organizer announcements / day-of messages (rain delays). Tournament-wide.
 *   notifyScores   — game score alerts for the followed team (teamId).
 *
 * Back-compat: rows stored before categories existed had only { endpoint, teamId } — read as
 * both categories ON (that was the old behavior: a follower got scores + messages).
 *
 * Plan-gated to Tournament Plus+ at the mount sites and at the API route; these helpers are
 * pure browser plumbing.
 */
import { subscribeToPush, getCurrentPushEndpoint } from './push-client';

export interface FanAlertsOptIn {
  endpoint?: string;
  teamId?: string | null;
  notifyMessages?: boolean;
  notifyScores?: boolean;
}

/** The normalized state (categories always resolved to booleans). */
export interface FanAlertsState {
  endpoint?: string;
  teamId: string | null;
  notifyMessages: boolean;
  notifyScores: boolean;
}

export function fanAlertsKey(orgSlug: string, tournamentSlug: string): string {
  return `fl_fan_alerts_${orgSlug}_${tournamentSlug}`;
}

/** Raw stored opt-in (unnormalized) — kept for callers that only need endpoint/teamId. */
export function readFanAlertsOptIn(orgSlug: string, tournamentSlug: string): FanAlertsOptIn | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(fanAlertsKey(orgSlug, tournamentSlug));
    return raw ? (JSON.parse(raw) as FanAlertsOptIn) : null;
  } catch {
    return null;
  }
}

/** Normalized state — categories default to true (back-compat with pre-category rows). */
export function readFanAlertsState(orgSlug: string, tournamentSlug: string): FanAlertsState | null {
  const raw = readFanAlertsOptIn(orgSlug, tournamentSlug);
  if (!raw) return null;
  return {
    endpoint: raw.endpoint,
    teamId: raw.teamId ?? null,
    notifyMessages: raw.notifyMessages ?? true,
    notifyScores: raw.notifyScores ?? true,
  };
}

function writeFanAlertsState(orgSlug: string, tournamentSlug: string, state: FanAlertsState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(fanAlertsKey(orgSlug, tournamentSlug), JSON.stringify(state));
  notifyFanAlertsChange();
}

export function clearFanAlertsOptIn(orgSlug: string, tournamentSlug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(fanAlertsKey(orgSlug, tournamentSlug));
}

/** Notify other toggle/nudge/bell instances on the same tab (the native `storage`
 *  event only fires cross-tab) so every on-screen alerts control stays in sync. */
export function notifyFanAlertsChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('fl-fan-alerts-change'));
}

/**
 * Core opt-in: subscribe this browser to push, register/update the anonymous fan row with the
 * chosen categories (and optional followed team), and persist the state. If BOTH categories are
 * off this is a full unsubscribe. Throws PushPermissionError (permission flow) or Error (server)
 * on failure — callers own the UX. On success `fl-fan-alerts-change` fires.
 */
export async function subscribeFanAlerts(opts: {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
  team?: { id: string; name: string } | null;
  notifyMessages: boolean;
  notifyScores: boolean;
}): Promise<void> {
  // Everything off = unsubscribe (don't leave a dead row).
  if (!opts.notifyMessages && !opts.notifyScores) {
    await disableFanAlerts(opts);
    return;
  }

  const sub = await subscribeToPush();
  const res = await fetch('/api/public/fan-push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: sub.keys,
      tournamentId: opts.tournamentId,
      teamId: opts.team?.id ?? null,
      notifyMessages: opts.notifyMessages,
      notifyScores: opts.notifyScores,
      deviceLabel: sub.deviceLabel,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Could not enable notifications.');
  }
  writeFanAlertsState(opts.orgSlug, opts.tournamentSlug, {
    endpoint: sub.endpoint,
    teamId: opts.team?.id ?? null,
    notifyMessages: opts.notifyMessages,
    notifyScores: opts.notifyScores,
  });
}

/**
 * Full unsubscribe: remove the server row and clear local state. Best-effort — even if the
 * network call fails we clear locally so the UI stops claiming the fan is subscribed.
 */
export async function disableFanAlerts(opts: {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
}): Promise<void> {
  try {
    let endpoint = readFanAlertsOptIn(opts.orgSlug, opts.tournamentSlug)?.endpoint ?? null;
    endpoint = endpoint ?? (await getCurrentPushEndpoint());
    if (endpoint) {
      await fetch('/api/public/fan-push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, tournamentId: opts.tournamentId }),
      });
    }
  } catch {
    /* best-effort — fall through to clearing local state */
  }
  clearFanAlertsOptIn(opts.orgSlug, opts.tournamentSlug);
  notifyFanAlertsChange();
}

/**
 * Team score-alerts opt-in (the per-team FollowAlertsToggle + the AlertsNudge). Turns SCORE
 * alerts on for the given team while preserving any existing "messages" preference (default on).
 * Thin wrapper over subscribeFanAlerts so the team toggle and the bell share one path.
 */
export async function enableFanAlerts(opts: {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
  team: { id: string; name: string };
}): Promise<void> {
  const existing = readFanAlertsState(opts.orgSlug, opts.tournamentSlug);
  await subscribeFanAlerts({
    orgSlug: opts.orgSlug,
    tournamentSlug: opts.tournamentSlug,
    tournamentId: opts.tournamentId,
    team: opts.team,
    notifyMessages: existing?.notifyMessages ?? true,
    notifyScores: true,
  });
}

/**
 * True only when a stored opt-in still reflects reality: notifications are granted AND a live
 * push subscription exists AND (if we recorded one) its endpoint still matches. A revoked
 * permission or an evicted/rotated subscription returns false so the UI can stop claiming
 * "on" while pushes silently fail (J6-050).
 */
export async function verifyFanAlertsLive(stored: FanAlertsOptIn | null): Promise<boolean> {
  if (!stored) return false;
  const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  if (!granted) return false;
  const liveEndpoint = await getCurrentPushEndpoint();
  if (!liveEndpoint) return false;
  return !stored.endpoint || stored.endpoint === liveEndpoint;
}
