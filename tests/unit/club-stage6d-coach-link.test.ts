import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calendarLinkSecret,
  coachFeedUrl,
  coachLinkStopReason,
  shouldRecordCalendarRead,
  signCoachCalendarToken,
  verifyCoachCalendarToken,
} from '../../lib/coach-calendar-link.ts';
import { calendarAppOrder, calendarSubscribeDoors } from '../../lib/calendar-subscribe.ts';
import { readCode as readRaw, stripComments } from './_source-code.ts';

/** Code, never prose: a guard that reads a comment proves the comment (tests/unit/_source-code.ts). SQL is read raw. */
const readCode = (f: string) => (f.endsWith('.sql') ? readRaw(f) : stripComments(readRaw(f)));

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A COACH'S CALENDAR LINK (Club Tier Stage 6d, A2 — Asks 1, 8, 9; ruled 2026-10-11).
 *
 * Signed, never stored, so the window shows the same link until Reset; a link we never issued is "not found"; a link we
 * issued that has stopped answers an EMPTY calendar, so its events leave the subscriber's calendar instead of freezing
 * (S6D-04). "Removing a coach doesn't remove them" is a real defect class here — removal revokes, re-adding REACTIVATES
 * the same row — so removal bumps the generation in the same write (mig 323's trigger) and the old link stays stopped.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SECRET = 'test-secret-0123456789abcdef-0123456789abcdef';
const MEMBERSHIP = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

const seat = (over: Partial<Parameters<typeof coachLinkStopReason>[0] & object> = {}) => ({
  status: 'active' as const, generation: 0, coachRole: 'assistant_coach' as const,
  capabilities: { schedule: true }, ...over,
});

describe('the token', () => {
  it('round-trips: the same membership and generation sign the same link every time (shown again until Reset)', () => {
    const a = signCoachCalendarToken(MEMBERSHIP, 0, SECRET);
    assert.equal(a, signCoachCalendarToken(MEMBERSHIP, 0, SECRET));
    assert.deepEqual(verifyCoachCalendarToken(a, SECRET), { membershipId: MEMBERSHIP, generation: 0 });
    assert.deepEqual(verifyCoachCalendarToken(`${a}.ics`, SECRET), { membershipId: MEMBERSHIP, generation: 0 }, 'the .ics ending is the address\'s, not the token\'s');
  });

  it('a TAMPERED signature → null ("not found", a link we never issued)', () => {
    const t = signCoachCalendarToken(MEMBERSHIP, 3, SECRET);
    const sig = t.split('.')[2];
    const flipped = `${t.slice(0, -sig.length)}${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`;
    assert.equal(verifyCoachCalendarToken(flipped, SECRET), null);
  });

  it('a forged generation under a valid signature → null (the signature covers the generation)', () => {
    const [id, , sig] = signCoachCalendarToken(MEMBERSHIP, 3, SECRET).split('.');
    assert.equal(verifyCoachCalendarToken(`${id}.4.${sig}`, SECRET), null);
  });

  it('one spelling per link: a non-canonical spelling of a valid link → null', () => {
    const t = signCoachCalendarToken(MEMBERSHIP, 3, SECRET);
    const [id, gen, sig] = t.split('.');
    assert.equal(verifyCoachCalendarToken(`${id}.0${gen}.${sig}`, SECRET), null, 'a leading zero on the generation');
    // The 22nd character of a 16-byte base64url value carries 4 spare bits; flipping one keeps the same bytes.
    const last = sig[21];
    const sibling = 'AQgw'.includes(last) ? String.fromCharCode(last.charCodeAt(0) + 1) : null;
    if (sibling) assert.equal(verifyCoachCalendarToken(`${id}.${gen}.${sig.slice(0, 21)}${sibling}`, SECRET), null, 'spare bits');
  });

  it('another secret → null; a bad shape → null', () => {
    assert.equal(verifyCoachCalendarToken(signCoachCalendarToken(MEMBERSHIP, 0, SECRET), `${SECRET}-other`), null);
    for (const bad of ['', 'abc', '../../etc', 'x'.repeat(80), `${MEMBERSHIP}.0.sig`]) {
      assert.equal(verifyCoachCalendarToken(bad, SECRET), null, bad);
    }
  });

  it('the address is under /api, never a top-level segment a club\'s address could take', () => {
    assert.equal(coachFeedUrl('https://www.fieldlogichq.ca/', 'TOKEN'), 'https://www.fieldlogichq.ca/api/calendar/coach/TOKEN.ics');
  });

  it('no secret, or a short one, signs nothing — never an invented fallback', () => {
    const saved = process.env.CALENDAR_LINK_SECRET;
    try {
      delete process.env.CALENDAR_LINK_SECRET;
      assert.equal(calendarLinkSecret(), null);
      process.env.CALENDAR_LINK_SECRET = 'short';
      assert.equal(calendarLinkSecret(), null);
      process.env.CALENDAR_LINK_SECRET = SECRET;
      assert.equal(calendarLinkSecret(), SECRET);
    } finally {
      if (saved === undefined) delete process.env.CALENDAR_LINK_SECRET; else process.env.CALENDAR_LINK_SECRET = saved;
    }
  });
});

describe('a stopped link answers empty — every reason (Ask 9)', () => {
  it('the live seat at its own generation still answers', () => {
    assert.equal(coachLinkStopReason(seat(), 0), null);
  });
  it('an OLD generation (after Reset) → reset', () => {
    assert.equal(coachLinkStopReason(seat({ generation: 1 }), 0), 'reset');
  });
  it('REVOKED (removed from the team) → removed', () => {
    assert.equal(coachLinkStopReason(seat({ status: 'revoked', generation: 1 }), 0), 'removed');
  });
  it('schedule access OFF → no_schedule', () => {
    assert.equal(coachLinkStopReason(seat({ capabilities: { schedule: false } }), 0), 'no_schedule');
  });
  it('a head coach always holds the schedule, whatever is stored', () => {
    assert.equal(coachLinkStopReason(seat({ coachRole: 'head_coach', capabilities: { schedule: false } }), 0), null);
  });
  it('RE-ADDED: the row is active again, but removal bumped its generation, so the old link stays stopped', () => {
    // Removed at generation 0 → mig 323's trigger wrote 1 in the same write → re-added (reactivated, 1 kept).
    assert.equal(coachLinkStopReason(seat({ status: 'active', generation: 1 }), 0), 'reset');
    assert.equal(coachLinkStopReason(seat({ status: 'active', generation: 1 }), 1), null, 'the window\'s NEW link answers');
  });
  it('the membership is gone → gone', () => {
    assert.equal(coachLinkStopReason(null, 0), 'gone');
  });
});

describe('removal bumps the generation in the SAME write that revokes (mig 323)', () => {
  const sql = readCode('supabase/migrations/323_a_coach_subscribes_to_the_schedule.sql');
  it('a BEFORE UPDATE trigger on status bumps it on active → revoked', () => {
    assert.match(sql, /before update of status on public\.rep_team_staff_memberships/i);
    assert.match(sql, /old\.status = 'active' and new\.status = 'revoked'/i);
    assert.match(sql, /new\.calendar_link_generation := old\.calendar_link_generation \+ 1/i);
  });
  it('Reset is a compare-and-set on the generation it read, on an ACTIVE seat, and clears the last read', () => {
    const code = readCode('lib/coach-membership.ts');
    const reset = code.slice(code.indexOf('export async function resetCalendarLink'));
    assert.match(reset, /calendar_link_generation: expectedGeneration \+ 1, calendar_last_read_on: null/);
    assert.match(reset, /\.eq\('status', 'active'\)/);
    assert.match(reset, /\.eq\('calendar_link_generation', expectedGeneration\)/);
  });
});

describe('the last read is recorded at most once a day (the cost ruling)', () => {
  it('two reads on one day → one write', () => {
    let stored: string | null = null;
    let writes = 0;
    for (const read of ['2026-10-11', '2026-10-11']) {
      if (shouldRecordCalendarRead(stored, read)) { stored = read; writes += 1; }
    }
    assert.equal(writes, 1);
    assert.equal(shouldRecordCalendarRead(stored, '2026-10-12'), true, 'the next day writes again');
  });
  it('Reset names the link the window showed — a stale tab is refused, never silently retiring a fresh link', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/calendar-link/route.ts');
    assert.match(route, /const after = shown === own\.link\.generation \? await resetCalendarLink\(own\.link\.membershipId, shown\) : null;/);
    assert.match(readCode('components/coaches/CoachCalendarSubscribe.tsx'), /body: JSON\.stringify\(\{ generation: link\?\.generation \}\)/);
  });

  it('a read stamps only the link it read, still live (never a Reset\'s new link, never a removed seat)', () => {
    const code = readCode('lib/coach-membership.ts');
    const record = code.slice(code.indexOf('export async function recordCalendarRead'), code.indexOf('export async function resetCalendarLink'));
    assert.match(record, /\.eq\('calendar_link_generation', generation\)/);
    assert.match(record, /\.eq\('status', 'active'\)/);
  });

  it('the feed asks the portal\'s own wall: a club whose plan no longer carries the Coaches Portal answers empty', () => {
    const feed = readCode('lib/coach-calendar-feed.ts');
    assert.match(feed, /if \(!club \|\| !orgPlanCarriesCoachesPortal\(club\)\) return \{ kind: 'stopped', calendarName \};/);
    assert.match(feed, /if \(!\(await getActiveTeamEntitlement\(org\.id, team\.id\)\)\) return \{ kind: 'stopped', calendarName \};/);
  });

  it('the feed only writes after asking, and the WHERE repeats the question', () => {
    const feed = readCode('lib/coach-calendar-feed.ts');
    assert.match(feed, /if \(shouldRecordCalendarRead\(link\.lastReadOn, today\)\)/);
    const code = readCode('lib/coach-membership.ts');
    const record = code.slice(code.indexOf('export async function recordCalendarRead'), code.indexOf('export async function resetCalendarLink'));
    assert.match(record, /calendar_last_read_on\.is\.null,calendar_last_read_on\.lt\./);
  });
});

describe('the Subscribe window\'s doors', () => {
  const doors = calendarSubscribeDoors('https://www.fieldlogichq.ca/api/calendar/coach/T.ics', '13U AAA · UAT Rep Club');
  it('Apple opens the webcal link; Google its add page with the webcal link; Outlook the https link and the name', () => {
    assert.equal(doors.apple, 'webcal://www.fieldlogichq.ca/api/calendar/coach/T.ics');
    assert.equal(doors.google, `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(doors.webcal)}`);
    assert.equal(doors.outlook, `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(doors.https)}&name=${encodeURIComponent('13U AAA · UAT Rep Club')}`);
  });
  it('a desk lists Apple · Google · Outlook; a phone lists its OWN app first', () => {
    assert.deepEqual(calendarAppOrder({ phone: false, userAgent: 'iPhone' }), ['apple', 'google', 'outlook']);
    assert.deepEqual(calendarAppOrder({ phone: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), ['apple', 'google', 'outlook']);
    assert.deepEqual(calendarAppOrder({ phone: true, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)' }), ['google', 'apple', 'outlook']);
  });
});
