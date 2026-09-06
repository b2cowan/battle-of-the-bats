/**
 * tests/unit/notification-feed-grouping.test.ts
 *
 * The notification feed's clock, its day buckets, and what keeps a row in "Needs attention".
 * (Owner ruling 2026-09-06, mockup artifact 9427bc24 — COACH_NOTIFICATIONS_FEED_FIXES_PLAN.)
 *
 * ⚠ THE FIRST BLOCK IS A REGRESSION TEST FOR A SHIPPED DEFECT, not a formatting preference.
 * `relativeTime()` counted elapsed hours ("1d ago" = age ÷ 24) while `dayBucket()` counted calendar
 * days, so a row and the heading above it disagreed by up to a full day in BOTH directions. The
 * owner caught it on a phone: a Friday-evening notice reading "1d ago" under the heading "Earlier".
 * Any future change that puts an age label under a calendar heading fails here.
 *
 * The clock is INJECTED rather than mocked — `dayBucket`/`notificationTime` take an optional `now`
 * — so the calendar edges these functions exist to get right (midnight, the Monday boundary) are
 * asserted by running the real arithmetic on a fixed date, not by faking global time.
 */
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { dayBucket, notificationTime, DAY_ORDER } from '../../lib/notification-view.ts';
import { notificationCategory } from '../../lib/notification-labels.ts';
import type { AppNotification, NotificationEventType } from '../../lib/types.ts';

/** A local-time instant, as the ISO string the API hands the client. */
const at = (y: number, mZeroBased: number, d: number, h: number, min = 0) =>
  new Date(y, mZeroBased, d, h, min, 0, 0).toISOString();

/** Sunday 6 September 2026, 10:00 — a coach catching up on the week. */
const SUNDAY_10AM = new Date(2026, 8, 6, 10, 0, 0, 0);

// ── The clock ─────────────────────────────────────────────────────────────────

test('the row label never contradicts the heading above it (the owner’s screenshot)', () => {
  // Friday 4 Sep, 6:21 p.m. — 47h 39m before the frozen "now", which the old elapsed-hours maths
  // floored to "1d ago" while the calendar filed it two days back under "Earlier".
  const friday = at(2026, 8, 4, 18, 21);

  assert.equal(dayBucket(friday, SUNDAY_10AM), 'Earlier this week');
  const label = notificationTime(friday, SUNDAY_10AM);
  assert.equal(label, 'Fri, 6:21 p.m.');
  // The precise defect: an age label under a calendar heading. Never again, in any form.
  assert.doesNotMatch(label, /\d+\s*d ago/);
});

test('nor “1h ago” under a “Yesterday” heading — the same bug, reversed', () => {
  // Ten past midnight. A row from 23:00 last night is 70 minutes old but a calendar day back.
  const justAfterMidnight = new Date(2026, 8, 6, 0, 10, 0, 0);
  const lastNight = at(2026, 8, 5, 23, 0);

  assert.equal(dayBucket(lastNight, justAfterMidnight), 'Yesterday');
  assert.equal(notificationTime(lastNight, justAfterMidnight), '11:00 p.m.');
  assert.doesNotMatch(notificationTime(lastNight, justAfterMidnight), /ago/);
});

test('recency stays inside Today, where it cannot contradict the heading', () => {
  const twoPm = new Date(2026, 8, 6, 14, 0, 0, 0);
  assert.equal(notificationTime(at(2026, 8, 6, 14, 0), twoPm), 'just now');
  assert.equal(notificationTime(at(2026, 8, 6, 13, 20), twoPm), '40m ago');
  assert.equal(notificationTime(at(2026, 8, 6, 12, 0),  twoPm), '2h ago');
  // Posted at 00:05, read at 2 p.m. — still Today, so still an age. 13h never becomes "1d ago".
  assert.equal(notificationTime(at(2026, 8, 6, 0, 5),   twoPm), '13h ago');
});

test('a PINNED row names its own day — nothing above it does', () => {
  // "Needs attention" is a triage list, not a slice of the calendar, so it has no day heading for
  // its rows to lean on. Caught in rendered verification, not by reading the code: the zone showed
  // a bare "12:53 p.m." and the coach could not tell which day's 12:53 it was.
  const pinned = { withDay: true };
  assert.equal(notificationTime(at(2026, 8, 5, 12, 53), SUNDAY_10AM, pinned), 'Yesterday, 12:53 p.m.');
  // The other three buckets already answer the question, so they must NOT gain a second answer.
  assert.equal(notificationTime(at(2026, 8, 3, 14, 53), SUNDAY_10AM, pinned), 'Thu, 2:53 p.m.');
  assert.equal(notificationTime(at(2026, 8, 6, 8, 0),   SUNDAY_10AM, pinned), '2h ago');
  assert.equal(notificationTime(at(2026, 7, 30, 9, 0),  SUNDAY_10AM, pinned), 'Aug 30');
  // And a row that DOES sit under a heading never repeats it.
  assert.equal(notificationTime(at(2026, 8, 5, 12, 53), SUNDAY_10AM), '12:53 p.m.');
});

test('past a week the hour stops mattering and the date is what shows', () => {
  assert.equal(dayBucket(at(2026, 7, 30, 9, 0), SUNDAY_10AM), 'Earlier');
  assert.equal(notificationTime(at(2026, 7, 30, 9, 0), SUNDAY_10AM), 'Aug 30');
});

test('every clock label is spelled the house way — lowercase, with periods', () => {
  const labels = [
    notificationTime(at(2026, 8, 5, 8, 0),  SUNDAY_10AM), // Yesterday, morning
    notificationTime(at(2026, 8, 5, 20, 0), SUNDAY_10AM), // Yesterday, evening
    notificationTime(at(2026, 8, 2, 8, 0),  SUNDAY_10AM), // Earlier this week
    notificationTime(at(2026, 8, 5, 12, 0), SUNDAY_10AM), // noon — the 12-hour edge
    notificationTime(at(2026, 8, 5, 0, 30), SUNDAY_10AM), // after midnight — the other edge
  ];
  assert.deepEqual(labels, ['8:00 a.m.', '8:00 p.m.', 'Wed, 8:00 a.m.', '12:00 p.m.', '12:30 a.m.']);
  for (const label of labels) assert.doesNotMatch(label, /[AP]\.?M\.?/);
});

// ── The buckets ───────────────────────────────────────────────────────────────

test('the headings run newest-first, so the feed reads down the calendar', () => {
  assert.deepEqual([...DAY_ORDER], ['Today', 'Yesterday', 'Earlier this week', 'Earlier']);
});

test('a Sunday coach gets a Mon–Fri bucket — the case the heading exists for', () => {
  assert.equal(dayBucket(at(2026, 8, 6, 9, 0),   SUNDAY_10AM), 'Today');
  assert.equal(dayBucket(at(2026, 8, 5, 9, 0),   SUNDAY_10AM), 'Yesterday');
  assert.equal(dayBucket(at(2026, 8, 4, 9, 0),   SUNDAY_10AM), 'Earlier this week'); // Friday
  assert.equal(dayBucket(at(2026, 7, 31, 0, 5),  SUNDAY_10AM), 'Earlier this week'); // Mon 31 Aug
  assert.equal(dayBucket(at(2026, 7, 30, 23, 55), SUNDAY_10AM), 'Earlier');          // Sun — last week
});

test('the week bucket is correctly empty early in the week, not wrongly populated', () => {
  const tuesday = new Date(2026, 8, 8, 10, 0, 0, 0); // Today + Yesterday already cover the week
  const week = [at(2026, 8, 8, 9, 0), at(2026, 8, 7, 9, 0), at(2026, 8, 6, 9, 0)];
  assert.deepEqual(week.map(iso => dayBucket(iso, tuesday)), ['Today', 'Yesterday', 'Earlier']);
});

test('buckets count calendar days, not 24-hour blocks', () => {
  const justAfterMidnight = new Date(2026, 8, 6, 0, 10, 0, 0);
  // 20 minutes old, but the calendar day turned — Yesterday, and it must not read as Today.
  assert.equal(dayBucket(at(2026, 8, 5, 23, 50), justAfterMidnight), 'Yesterday');
});

// ── The wiring that keeps the two in step ─────────────────────────────────────

test('both surfaces pass an EXPLICIT clock to the grouping and to the labels', () => {
  // ⚠ THIS GUARDS A REVIEW FINDING, and it cannot be caught by testing the pure functions.
  // Each is correct on its own; the bug was that the page's day GROUPING is memoized while a row's
  // LABEL recomputes every render, so left to their own `new Date()` calls they read the clock at
  // two different moments and drift apart across a midnight boundary — reopening the very
  // contradiction this file's first test exists to prevent. The fix is that one clock is stamped
  // per grouping pass and handed to both. A default-argument call site silently undoes that.
  const files = [
    'components/notifications/NotificationFeedBody.tsx',
    'components/notifications/NotificationPanel.tsx',
  ];
  for (const rel of files) {
    const src = readFileSync(path.join(process.cwd(), rel), 'utf8');
    for (const fn of ['notificationTime', 'dayBucket']) {
      // Every call must pass a second argument. `fn(x)` and `fn(x, undefined` both fail.
      const bare = new RegExp(`${fn}\\(\\s*[^,)]+\\s*\\)`, 'g');
      const defaulted = new RegExp(`${fn}\\(\\s*[^,)]+,\\s*undefined`, 'g');
      assert.equal(src.match(bare), null,
        `${rel} calls ${fn}() without an explicit clock — the heading and the row would read the clock separately`);
      assert.equal(src.match(defaulted), null,
        `${rel} passes undefined as ${fn}()'s clock, which is the default and defeats the shared clock`);
    }
  }
});

// ── The zone ──────────────────────────────────────────────────────────────────

/** The zone rule both surfaces run (NotificationPanel + useNotificationFeed), asserted once. */
const inNeedsAttention = (n: AppNotification) =>
  !n.clearedAt && notificationCategory(n.eventType) === 'act';

function notification(over: Partial<AppNotification>): AppNotification {
  return {
    id: 'n1', orgId: 'o1', eventType: 'payment_failed' as NotificationEventType,
    title: 'Payment failed', body: null, link: null,
    readAt: null, clearedAt: null, createdAt: at(2026, 8, 2, 9, 15), metadata: {},
    ...over,
  };
}

test('an unhandled decision stays in the zone after the coach opens it', () => {
  // The defect this replaced: opening a failed payment and fixing nothing took it out of the zone
  // and dropped the count, so the list reported "clear" over an unpaid club subscription.
  assert.equal(inNeedsAttention(notification({ readAt: at(2026, 8, 6, 12, 0) })), true);
});

test('it leaves once — and only once — the coach says they are finished', () => {
  const cleared = notification({
    readAt:    at(2026, 8, 6, 12, 0),
    clearedAt: at(2026, 8, 6, 12, 1),
  });
  assert.equal(inNeedsAttention(cleared), false);
});

test('clearing works on an unread row too, without opening it first', () => {
  assert.equal(inNeedsAttention(notification({ clearedAt: at(2026, 8, 6, 12, 0) })), false);
});

test('an informational event is never pinned, cleared or not', () => {
  for (const eventType of ['payment_received', 'registration_new', 'score_submitted'] as const) {
    assert.equal(inNeedsAttention(notification({ eventType })), false);
  }
});

test('every act event a recipient can receive is pinned', () => {
  const acts: NotificationEventType[] = [
    'payment_failed', 'team_no_show', 'assistant_coach_approval_requested',
    'coach_access_requested', 'roster_change_requested', 'score_disputed',
  ];
  for (const eventType of acts) {
    assert.equal(inNeedsAttention(notification({ eventType })), true, eventType);
  }
});
