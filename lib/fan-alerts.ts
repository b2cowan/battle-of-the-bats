'use client';
/**
 * lib/fan-alerts.ts — shared client helpers for the anonymous fan score-alerts
 * opt-in. State lives in localStorage under `fl_fan_alerts_${orgSlug}_${tournamentSlug}`
 * → { endpoint, teamId }. Extracted from FollowAlertsToggle so the toggle and the
 * post-install AlertsNudge subscribe through one identical path (no drift).
 *
 * Plan-gated to Tournament Plus+ at the mount sites and at the API route; these
 * helpers are pure browser plumbing.
 */
import { subscribeToPush, getCurrentPushEndpoint } from './push-client';

export interface FanAlertsOptIn {
  endpoint?: string;
  teamId?: string;
}

export function fanAlertsKey(orgSlug: string, tournamentSlug: string): string {
  return `fl_fan_alerts_${orgSlug}_${tournamentSlug}`;
}

export function readFanAlertsOptIn(orgSlug: string, tournamentSlug: string): FanAlertsOptIn | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(fanAlertsKey(orgSlug, tournamentSlug));
    return raw ? (JSON.parse(raw) as FanAlertsOptIn) : null;
  } catch {
    return null;
  }
}

export function clearFanAlertsOptIn(orgSlug: string, tournamentSlug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(fanAlertsKey(orgSlug, tournamentSlug));
}

/** Notify other toggle/nudge instances on the same tab (the native `storage`
 *  event only fires cross-tab) so every on-screen alerts control stays in sync. */
export function notifyFanAlertsChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('fl-fan-alerts-change'));
}

/**
 * Subscribe this browser to push, register the anonymous fan row, and persist the
 * opt-in. Throws PushPermissionError (permission flow) or Error (server) on
 * failure — callers own the UX. On success the `fl-fan-alerts-change` event fires.
 */
export async function enableFanAlerts(opts: {
  orgSlug: string;
  tournamentSlug: string;
  tournamentId: string;
  team: { id: string; name: string };
}): Promise<void> {
  const sub = await subscribeToPush();
  const res = await fetch('/api/public/fan-push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: sub.keys,
      tournamentId: opts.tournamentId,
      teamId: opts.team.id,
      deviceLabel: sub.deviceLabel,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Could not enable alerts.');
  }
  window.localStorage.setItem(
    fanAlertsKey(opts.orgSlug, opts.tournamentSlug),
    JSON.stringify({ endpoint: sub.endpoint, teamId: opts.team.id }),
  );
  notifyFanAlertsChange();
}

/**
 * True only when a stored opt-in still reflects reality: notifications are granted
 * AND a live push subscription exists AND (if we recorded one) its endpoint still
 * matches. A revoked permission or an evicted/rotated subscription returns false so
 * the UI can stop claiming "Alerts on" while pushes silently fail (J6-050).
 */
export async function verifyFanAlertsLive(stored: FanAlertsOptIn | null): Promise<boolean> {
  if (!stored) return false;
  const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  if (!granted) return false;
  const liveEndpoint = await getCurrentPushEndpoint();
  if (!liveEndpoint) return false;
  return !stored.endpoint || stored.endpoint === liveEndpoint;
}
