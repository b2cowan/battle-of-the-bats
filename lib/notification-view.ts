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
import { formatTime } from './utils';

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
  // ⚠ This map is Record<string, …>, so TypeScript does NOT enforce a key per event type the
  // way the three maps in lib/notification-labels.ts do — a new event type falls back to the
  // generic bell instead of failing the build. Add here whenever one is added there.
  family_game_update:                '🗓️',
};

export function iconFor(eventType: string): string {
  return EVENT_ICONS[eventType] ?? '🔔';
}

// ── Date grouping (Today / Yesterday / Earlier this week / Earlier) ─────────────
//
// ⚠ "Earlier this week" is a CALENDAR week that starts on MONDAY, and the choice is deliberate.
// Sunday-start (the en-CA default) would make this bucket empty on a Sunday — exactly the day a
// coach sits down to catch up on the week's games — because Sunday would BE the start of the week.
// Monday-start puts Mon–Fri under it on that Sunday, which is the case it exists for. On a Monday
// or Tuesday the bucket is correctly empty (Today and Yesterday already cover the week so far) and
// simply doesn't render; a group with no items is dropped by both callers.
export const DAY_ORDER = ['Today', 'Yesterday', 'Earlier this week', 'Earlier'] as const;
export type DayBucket = (typeof DAY_ORDER)[number];

/**
 * @param now  Injectable clock. Callers never pass it; the tests do, so the calendar edges this
 *             function exists to get right (midnight, the week boundary) can be asserted without
 *             mocking global time — and so the arithmetic can be RUN rather than reasoned about.
 */
export function dayBucket(iso: string, now: Date = new Date()): DayBucket {
  const t = new Date(iso).getTime();
  const startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Calendar-correct "yesterday" (not today − 24h), so DST-change days don't mislabel.
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  // Monday-start: getDay() is 0 for Sunday, so (dow + 6) % 7 gives days back to Monday (Mon→0, Sun→6).
  const daysBackToMonday = (now.getDay() + 6) % 7;
  const startOfWeek      = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBackToMonday).getTime();
  if (t >= startOfToday)     return 'Today';
  if (t >= startOfYesterday) return 'Yesterday';
  if (t >= startOfWeek)      return 'Earlier this week';
  return 'Earlier';
}

// ── The timestamp on a row ──────────────────────────────────────────────────────
/**
 * The label under a notification's title — and it is DERIVED FROM ITS BUCKET, which is the whole
 * point of this function.
 *
 * ⚠⚠ THIS REPLACED `relativeTime()`, WHICH WAS A REAL DEFECT AND NOT A STYLE PREFERENCE (owner,
 * 2026-09-06). That function counted ELAPSED HOURS ("1d ago" = age ÷ 24) while `dayBucket` above
 * counts CALENDAR DAYS. Two clocks answering the same question, and they disagreed by up to a full
 * day in BOTH directions:
 *   · posted Friday 6:21 p.m., read on Sunday morning → "1d ago" (47h old) under the heading
 *     "Earlier" (two calendar days back). This is the one the owner caught on a phone.
 *   · posted 11:00 p.m., read at 00:30 → "1h ago" under the heading "Yesterday".
 * The fix is not to make both calendar-based — it is to stop asking them the same question. THE
 * HEADING OWNS THE DAY; THE ROW OWNS THE TIME INSIDE THAT DAY. There is then nothing left to
 * disagree about, and a coach can finally tell two Friday notices apart.
 *
 * ⚠ Never re-introduce a "Nd ago" branch here. If a surface needs an age, it needs the heading too.
 * Clock labels go through formatTime() — the one place the product builds a clock by hand, so
 * "6:21 p.m." stays the single house spelling (AGENCY_RULES, binding).
 *
 * @param withDay  Set by a row that has NO day heading above it to lean on — i.e. the pinned
 *                 "Needs attention" zone, which is a triage list rather than a slice of the
 *                 calendar. Without it a pinned row reads a bare "12:53 p.m." and the coach cannot
 *                 tell WHICH day's 12:53 it was; the whole point of this function is that the day
 *                 is always answered by exactly one of the heading or the row.
 */
export function notificationTime(
  iso: string,
  now: Date = new Date(),
  { withDay = false }: { withDay?: boolean } = {},
): string {
  const d = new Date(iso);
  const bucket = dayBucket(iso, now);

  if (bucket === 'Today') {
    // Recency is the useful fact while it is still today, and it cannot contradict the heading.
    const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  const clock = formatTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
  // "Earlier this week" and "Earlier" already name their day, so only Yesterday needs the prefix.
  if (bucket === 'Yesterday')         return withDay ? `Yesterday, ${clock}` : clock;
  // The heading covers several days here, so the row has to name which one.
  if (bucket === 'Earlier this week') return `${d.toLocaleDateString('en-CA', { weekday: 'short' })}, ${clock}`;
  // Past a week the hour stops meaning anything; the date is what gets read.
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
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
