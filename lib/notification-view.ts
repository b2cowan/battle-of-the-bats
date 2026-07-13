/**
 * lib/notification-view.ts
 *
 * Shared presentational helpers for the notification bell dropdown AND the full
 * "See all" page (Notification Center Rework P1–P4). Kept in one place so the two
 * surfaces group, bundle, and label notifications identically — no drift.
 *
 * Pure client-safe data/functions only (no hooks, no JSX).
 */
import type { AppNotification } from './types';

// ── Per-event icons ────────────────────────────────────────────────────────────
// Every NotificationEventType has a distinct icon; 🔔 is only a safety fallback.
export const EVENT_ICONS: Record<string, string> = {
  registration_new:                  '📋',
  registration_status_changed:       '🔄',
  payment_received:                  '💳',
  payment_failed:                    '⚠️',
  roster_change_requested:           '👥',
  score_submitted:                   '🏆',
  score_disputed:                    '🚩',
  registration_deadline_approaching: '⏰',
  waitlist_opened:                   '🎉',
  team_no_show:                      '🚫',
  coach_access_requested:            '🔑',
  house_league_registration_new:     '📋',
  chat_message:                      '💬',
  chat_mention:                      '📣',
  tryout_offer_response:             '🤝',
  assistant_coach_joined:            '🧑‍🏫',
  assistant_coach_approval_requested:'✋',
  playoffs_set:                      '🥊',
  champions_crowned:                 '👑',
  tournament_announcement:           '📢',
  coach_insights_digest:             '📊',
};

export function iconFor(eventType: string): string {
  return EVENT_ICONS[eventType] ?? '🔔';
}

// ── Relative time ("2h ago") ────────────────────────────────────────────────────
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

// ── Date grouping (Today / Yesterday / Earlier) ─────────────────────────────────
export const DAY_ORDER = ['Today', 'Yesterday', 'Earlier'] as const;
export type DayBucket = (typeof DAY_ORDER)[number];

export function dayBucket(iso: string): DayBucket {
  const t   = new Date(iso).getTime();
  const now = new Date();
  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Calendar-correct "yesterday" (not today − 24h), so DST-change days don't mislabel.
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (t >= startOfToday)     return 'Today';
  if (t >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

// ── Same-type bundling ──────────────────────────────────────────────────────────
// The high-volume "know" events that roll up into a single summary row ("6 new
// registrations") when 2+ land on the same day. Only these types bundle. Value = noun.
export const BUNDLE_NOUN: Record<string, string> = {
  registration_new:              'new registrations',
  registration_status_changed:   'registration updates',
  payment_received:              'payments received',
  score_submitted:               'scores submitted',
  house_league_registration_new: 'house-league registrations',
};

/** A rendered activity entry: either a single notification or a same-type bundle. */
export type ActivityEntry =
  | { kind: 'item';   notification: AppNotification }
  | { kind: 'bundle'; eventType: string; members: AppNotification[] };

/**
 * Roll up bundleable same-type runs within a single day-group into one entry, placed at
 * the newest member's position; everything else stays an individual item. Order preserved.
 * The SAME function drives the dropdown and the "See all" page so they never diverge.
 */
export function groupActivityItems(items: AppNotification[]): ActivityEntry[] {
  const counts: Record<string, number> = {};
  for (const n of items) {
    if (BUNDLE_NOUN[n.eventType]) counts[n.eventType] = (counts[n.eventType] ?? 0) + 1;
  }
  const bundled = new Set<string>();
  const out: ActivityEntry[] = [];
  for (const n of items) {
    if (counts[n.eventType] >= 2) {
      if (!bundled.has(n.eventType)) {
        bundled.add(n.eventType);
        out.push({ kind: 'bundle', eventType: n.eventType, members: items.filter(m => m.eventType === n.eventType) });
      }
      // else: already represented by the bundle at its newest position
    } else {
      out.push({ kind: 'item', notification: n });
    }
  }
  return out;
}
