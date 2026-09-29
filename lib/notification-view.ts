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
  practice_plan_sent:                '📋',
  club_season_changed:               '📅',
  club_coach_joined:                 '🧑‍🏫',
  club_coach_declined:               '✉️',
  team_move_requested:               '🤝',
  team_move_answered:                '🏟️',
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
/** A Date's local clock in the house spelling ("6:21 p.m.") — the list's time and the reader's stamp. */
function clockOf(d: Date): string {
  return formatTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
}

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

  const clock = clockOf(d);
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

// ── The reader (coach feed, owner ruling 2026-09-25 — D3 option B) ─────────────
// A tap on a coach notification opens it in a reader sheet: the whole message, when it arrived,
// and ONE button on to the place that deals with it. Marking it read no longer means leaving the
// page — the reason the owner gave for the ruling ("open, read, close").

/**
 * The reader's date line — the day AND the clock, always. The list can lean on its day headings
 * ("Earlier", "Yesterday"); a sheet over the list has no heading above it, so it names both.
 * "Sun, Sep 20 · 7:00 p.m." — the clock through formatTime(), the house spelling.
 */
export function notificationStamp(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${clockOf(d)}`;
}

/** Every notification an entry stands for — one row's own, or a bundle's members (newest first). */
export function entryMembers(entry: ActivityEntry): AppNotification[] {
  return entry.kind === 'bundle' ? entry.members : [entry.notification];
}

/**
 * Where a coach team route opens, in the NAV'S OWN WORDS — the sidebar and the More sheet name
 * these pages, so the reader's button says the same word the coach will land on. Keyed by the
 * segment after `/coaches/teams/{id}`; the empty key is the team's Overview.
 * ⚠ A THIRD COPY OF THE NAV'S PAGE NAMES, AND PINNED TO THEM: `coach-nav-groups.test.ts` reads the
 * phone nav's `{ key, label }` pairs and fails when a name here differs from the nav's, or a page
 * here is one the nav no longer has — so a rename cannot leave "Open Skills & Goals" behind.
 */
export const COACH_TEAM_PAGE: Record<string, string> = {
  '':              'Overview',
  schedule:        'Schedule',
  practice:        'Practice plans',
  lineups:         'Lineups',
  tournaments:     'Tournaments',
  development:     'Skills & Goals',
  history:         'Insights',
  accounting:      'Money',
  announcements:   'Email families',
  roster:          'Roster',
  chat:            'Chat',
  tryouts:         'Tryouts',
  staff:           'Staff',
  documents:       'Documents',
  settings:        'Settings',
};

/** The practice hub's library routes — pages under `/practice/` that are NOT one practice. */
const PRACTICE_LIBRARIES: ReadonlySet<string> = new Set(['templates', 'circuits']);

/**
 * The reader's onward button, named for where it goes: "Open Insights", "Open the practice plan",
 * "Open Chat". Null when the notification has no link (the reader then offers only Close).
 * ⚠ Named from the LINK, not the event type: 23 kinds of notification point at far fewer places,
 * and a label keyed on the kind would be one more table to keep true every time a sender changes
 * its link. An unknown place still gets a working button — "Open" — never a guessed name.
 * ⚠ `/admin/` links reach a coach through the parked recipient-scoping bug (notifications review
 * D4): the button says so plainly rather than dressing an admin page up as a coach one.
 */
export function notificationDestination(link: string | null | undefined): string | null {
  if (!link) return null;
  const path = link.split(/[?#]/)[0];
  const team = /\/coaches\/teams\/[^/]+(?:\/([^/]+))?(\/[^/]+)?/.exec(path);
  if (team) {
    const segment = team[1] ?? '';
    // One practice is `/practice/{eventId}`; `/practice/templates` and `/practice/circuits` are the
    // libraries, not a plan — they fall through to the hub's name (/review 2026-09-25).
    if (segment === 'practice' && team[2] && !PRACTICE_LIBRARIES.has(team[2].slice(1))) return 'Open the practice plan';
    const page = COACH_TEAM_PAGE[segment];
    return page ? `Open ${page}` : 'Open';
  }
  if (/^\/chat(\/|$)/.test(path) || /\/coaches\/chat(\/|$)/.test(path)) return 'Open Chat';
  if (/^\/[^/]+\/admin(\/|$)/.test(path)) return 'Open in admin';
  return 'Open';
}
