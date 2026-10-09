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
  club_money_received:               '💵',
  club_money_undone:                 '↩️',
  club_request_approved:             '✅',
  club_request_declined:             '✋',
  club_request_reversed:             '↩️',
  team_money_sent:                   '📤',
  team_request_filed:                '🧾',
  team_request_holding_payout:       '⏳',
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

/** The most rows one delete request may name (the API refuses more); the feed sends larger deletes —
 *  an opened bundle — in batches of this size. */
export const NOTIFICATION_DELETE_MAX_IDS = 200;

/** Every notification an entry stands for — one row's own, or a bundle's members (newest first). */
export function entryMembers(entry: ActivityEntry): AppNotification[] {
  return entry.kind === 'bundle' ? entry.members : [entry.notification];
}

/** One name per row, stable while the row is on screen: a notification's id, or a bundle's kind + its
 *  newest member (Load more only adds OLDER rows, so a bundle keeps its name as it grows). */
export function entryKey(entry: ActivityEntry): string {
  return entry.kind === 'bundle' ? `bundle-${entry.eventType}-${entry.members[0].id}` : entry.notification.id;
}

/** What an empty list says, in each portal's own words. */
export interface FeedEmptyCopy {
  /** The headline when the account has NO notifications yet. */
  headline: string;
  /** What arrives here — the sentence that makes the emptiness make sense. */
  description?: string;
  /** A quieter footnote (e.g. where chat lives instead). */
  note?: string;
}

/**
 * The empty list's words, ONE copy per portal: the Notifications page and the bell's drawer say the
 * same thing when there is nothing to show (owner, 2026-10-06, step 2 Q2 — "the Notifications page's
 * own words, so the drawer and the page never say two different things").
 */
/** What a list on Unread says when everything is read — the page and the drawer alike. `view` is the
 *  read switch's other label, drawn bold between `lead` and `tail`. */
export const FEED_CAUGHT_UP = {
  headline: 'You’re all caught up',
  lead: 'Everything unread is handled. Switch to',
  view: 'All',
  tail: 'to read back through the season.',
} as const;

export const FEED_EMPTY_COPY: Record<'admin' | 'coach', FeedEmptyCopy> = {
  admin: { headline: 'No notifications yet' },
  coach: {
    headline: 'Nothing here yet',
    description: 'When something needs you — an assistant asking to join, a game that moved, your Sunday week in review — it lands here.',
    note: 'Chat has its own badge on the Chat tab.',
  },
};

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
 * The admin pages a notification opens, in the ADMIN'S OWN WORDS (owner ruling 2026-10-05, D4: "the
 * button names the page in that screen's own words and lands on the record"). One entry per link
 * shape a sender writes; `notificationDestination` maps the path onto these.
 * ⚠ PINNED TO THE ADMIN NAV, like COACH_TEAM_PAGE: `notification-open-in-place-guard.test.ts` reads
 * the Accounting tabs, the tournament nav, the Organization links and the Bring-in page's title and
 * fails when a word here stops matching the page it names.
 * ⚠ A tournament's registrations page is TEAMS — its nav entry and its own title both say so — and
 * a house league's is Registrations. Same folder name, two different screens.
 */
export const ADMIN_PAGE = {
  paymentRequests:     'Payment requests',
  tournamentTeams:     'Teams',
  results:             'Results',
  checkIn:             'Check-in',
  leagueRegistrations: 'Registrations',
  billing:             'Plan & billing',
  repTeams:            'Rep Teams',
  bringIn:             'Bring in a coach’s team',
} as const;

/** An admin path (everything after `/{org}/admin`) as its button, or null for a page not named here. */
function adminDestination(rest: string, query: URLSearchParams): string | null {
  const opens = (key: string) => Boolean(query.get(key));
  // A link that carries one record lands on it open, so the button names the RECORD.
  if (/^\/accounting\/payment-requests\/?$/.test(rest)) {
    return opens('request') ? 'Open the request' : `Open ${ADMIN_PAGE.paymentRequests}`;
  }
  // An allocation's window on Allocations (Stage 3d: `?allocation=`, `&bill=`), and its retired page's address, which
  // notices already in people's bells still carry (the proxy forwards it).
  if (/^\/accounting\/allocations\/?$/.test(rest) && opens('allocation')) return opens('bill') ? 'Open the bill' : 'Open the allocation';
  if (/^\/accounting\/allocations\/[^/]+\/?$/.test(rest)) return opens('bill') ? 'Open the bill' : 'Open the allocation';
  if (/^\/tournaments\/registrations\/?$/.test(rest)) return `Open ${ADMIN_PAGE.tournamentTeams}`;
  // `?gameId=` opens that game's score editor on arrival (Tournament admin redesign, G3).
  if (/^\/tournaments\/results\/?$/.test(rest)) return opens('gameId') ? 'Open the game' : `Open ${ADMIN_PAGE.results}`;
  if (/^\/tournaments\/check-in\/?$/.test(rest)) return `Open ${ADMIN_PAGE.checkIn}`;
  if (/^\/house-league\/seasons\/[^/]+\/registrations\/?$/.test(rest)) return `Open ${ADMIN_PAGE.leagueRegistrations}`;
  if (/^\/org\/billing\/?$/.test(rest)) return `Open ${ADMIN_PAGE.billing}`;
  if (/^\/rep-teams\/?$/.test(rest)) return `Open ${ADMIN_PAGE.repTeams}`;
  if (/^\/rep-teams\/bring-in\/?$/.test(rest)) return `Open ${ADMIN_PAGE.bringIn}`;
  if (/^\/rep-teams\/teams\/[^/]+\/coaches\/?$/.test(rest)) return 'Open the team’s coaches';
  if (/^\/rep-teams\/teams\/[^/]+\/?$/.test(rest)) return 'Open the team';
  return null;
}

/**
 * The onward button, named for where it goes: "Open Insights", "Open the practice plan", "Open
 * Chat", "Open the request". Null when the notification has no link (only Close is offered).
 * ⚠ Named from the LINK, not the event type: 23 kinds of notification point at far fewer places,
 * and a label keyed on the kind would be one more table to keep true every time a sender changes
 * its link. An unknown place still gets a working button — "Open" — never a guessed name.
 * ⚠ `portal` is WHO IS READING, and it is required on purpose. In the admin an admin link names its
 * page (D4). In the coach portal an `/admin/` link reached the coach through the parked
 * recipient-scoping bug (notifications review D4, its own ticket), so it says "Open in admin"
 * plainly rather than dressing an admin page up as one the coach can surely open.
 */
export function notificationDestination(
  link: string | null | undefined,
  portal: 'coach' | 'admin',
): string | null {
  if (!link) return null;
  const [beforeHash] = link.split('#');
  const [path, queryString = ''] = beforeHash.split('?');
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
  const admin = /^\/[^/]+\/admin(\/.*)?$/.exec(path);
  if (admin) {
    if (portal === 'coach') return 'Open in admin';
    return adminDestination(admin[1] ?? '', new URLSearchParams(queryString)) ?? 'Open';
  }
  return 'Open';
}
