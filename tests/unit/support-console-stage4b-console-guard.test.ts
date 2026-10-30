/**
 * Support console Stage 4b, Part 4 · the console (drawings 4qzTiG3rUBTmihqPSUAzrW, A, B, E, F): a Coaches Portal's free
 * time on the Story (its own words, its own Put it back, never on "created" or "brought across", T12), the person
 * record's Coaches Portal tab (the door only for the `portal_free_time` power, R6), the portal's record (its own
 * windows, never a club's override end), and Today and the Free time list counting a portal (one queue, Q7/G).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { freeTimeStoryEntries, type FreeTimeStoryRow } from '../../lib/free-time-story';
import { copyShortfallLine, firstNameOf } from '../../lib/portal-free-time';
import type { AuditRow } from '../../lib/platform-story-view';

const NOW = new Date('2026-12-17T16:00:00.000Z');
const ORG = { name: 'UAT Free Team Coaches Portal', plan_id: 'team' };
const DEC26 = '2026-12-27T05:00:00.000Z'; // the end of Dec 26, Eastern
const JAN9 = '2027-01-10T05:00:00.000Z';

function grant(extra: Partial<FreeTimeStoryRow> = {}): FreeTimeStoryRow {
  return {
    id: 'g1', type: 'subscription_status', value: 'active', target: null, starts_at: '2026-10-27T18:31:00.000Z', expires_at: DEC26,
    reason: 'Wants to try Premium for the spring tournament', created_by: 'support@fieldlogichq.ca',
    created_at: '2026-10-27T18:31:00.000Z', revoked_at: null, revoked_by: null, ...extra,
  };
}
const giveAudit: AuditRow = {
  id: 40, actor_email: 'support@fieldlogichq.ca', action: 'give_portal_free_time', field: 'type', old_value: null,
  new_value: { mode: 'first', override_id: 'g1', last_day: '2026-12-26', team: 'UAT Free Team' }, created_at: '2026-10-27T18:31:02.000Z',
};
const change: AuditRow = {
  id: 41, actor_email: 'billing@fieldlogichq.ca', action: 'change_override_end', field: 'expires_at', old_value: DEC26,
  new_value: { override_id: 'g1', expires_at: JAN9, last_day: '2027-01-09', portal: true }, reason: 'Their tournament moved to January',
  created_at: '2026-12-10T15:00:00.000Z',
};
const ALL_COPIED = {
  ok: true, migratedAt: '2026-10-27T18:31:01.000Z',
  roster: { migrated: 12, failed: 0 }, schedule: { migrated: 6, failed: 0 }, fees: { migrated: 3, failed: 0, skippedZero: 0, skippedNoPlayer: 0 },
};
const story = (overrides: FreeTimeStoryRow[], audit: AuditRow[] = [giveAudit], summary: object | null = ALL_COPIED, now = NOW) =>
  freeTimeStoryEntries({ org: ORG, overrides, audit, putBackAt: new Map(), portal: { summary }, now });

describe('1 · a portal\'s free time on its Story (drawing B)', () => {
  it('given: the Premium Coaches Portal through its last day, then back to the free portal; Put it back is End it now', () => {
    const given = story([grant()]).find(e => e.key === 'override:g1')!;
    assert.equal(given.title, 'Free time given: Premium Coaches Portal through Dec 26, 2026');
    assert.equal(given.sub, 'Then back to the free Coaches Portal by itself');
    assert.equal(given.who, 'support@fieldlogichq.ca');
    assert.equal(given.putBack?.kind, 'portal_end_now');
    assert.match(given.putBack!.sentence, /ends now instead of on December 26, 2026\. The coach goes back to the free Coaches Portal at once\. Nothing is deleted\./);
  });

  it('created and brought across: read from the give and the copy, and NEVER carry Put it back (T12)', () => {
    const entries = story([grant()]);
    const made = entries.find(e => e.key === 'portal-made:40')!;
    const copy = entries.find(e => e.key === 'portal-copy:40')!;
    assert.equal(made.title, 'Coaches Portal created from the free team UAT Free Team');
    assert.equal(copy.title, 'Free team brought across: 12 players, 6 events, 3 fees');
    assert.equal(copy.sub, 'From UAT Free Team. All copied; the free team is unchanged');
    assert.equal(copy.who, 'The product');
    assert.equal(made.putBack, undefined);
    assert.equal(copy.putBack, undefined);
  });

  it('a copy that fell short says how many of each, and one that stopped says so', () => {
    const short = story([grant()], [giveAudit], { ...ALL_COPIED, ok: false, schedule: { migrated: 4, failed: 2 } })
      .find(e => e.key === 'portal-copy:40')!;
    assert.match(short.sub!, /2 events could not be copied; Try again on the portal brings them across\./);
    const stopped = story([grant()], [giveAudit], { ok: false, pending: true }).find(e => e.key === 'portal-copy:40')!;
    assert.equal(stopped.title, 'Free team not brought across yet');
  });

  it('changed: Put it back moves to the change and restores the earlier day on the portal\'s own path', () => {
    const entries = story([grant({ expires_at: JAN9 })], [change, giveAudit]);
    assert.equal(entries.find(e => e.key === 'override:g1')!.putBack, undefined);
    const changed = entries.find(e => e.key === 'audit:41')!;
    assert.equal(changed.title, 'Free time changed: Premium Coaches Portal now free through Jan 9, 2027');
    assert.equal(changed.putBack?.kind, 'portal_end');
    assert.equal((changed.putBack as { lastDay: string }).lastDay, '2026-12-26');
  });

  it('a change whose earlier day has passed is put back as End it now', () => {
    const late = new Date('2026-12-28T16:00:00.000Z');
    const changed = story([grant({ expires_at: JAN9 })], [change, giveAudit], ALL_COPIED, late).find(e => e.key === 'audit:41')!;
    assert.equal(changed.putBack?.kind, 'portal_end_now');
  });

  it('ended by itself is read from the date (nothing written), and keeps everything', () => {
    const after = new Date('2026-12-27T06:00:00.000Z');
    const entries = story([grant()], [giveAudit], ALL_COPIED, after);
    const ran = entries.find(e => e.key === 'override-ran-out:g1')!;
    assert.equal(ran.title, 'Free time ended by itself: Premium Coaches Portal');
    assert.equal(ran.sub, 'Back to the free Coaches Portal. Everything made on Premium is kept');
    assert.equal(ran.who, 'The product');
    assert.ok(entries.every(e => !e.putBack), 'nothing ended can be put back');
  });

  it('a club\'s billing-status grant keeps its own words and kinds', () => {
    const club = freeTimeStoryEntries({ org: { name: 'A club', plan_id: 'club' }, overrides: [grant()], audit: [], putBackAt: new Map(), now: NOW });
    assert.equal(club[0].title, 'Free time given: Billing status: Active through Dec 26, 2026');
    assert.equal(club[0].putBack?.kind, 'override');
  });
});

describe('2 · the give\'s answer when the copy fell short (drawing F2)', () => {
  it('all copied: no line; short: "n of m"; stopped: did not finish. Nothing lost either way', () => {
    assert.equal(copyShortfallLine(ALL_COPIED, 'UAT Free Team', 'Frankie'), null);
    const short = copyShortfallLine({ ok: false, schedule: { migrated: 4, failed: 2 } }, 'UAT Free Team', 'Frankie')!;
    assert.match(short, /^Free time is running, but 2 of 6 events could not be copied\. Nothing was lost: everything is still on UAT Free Team\./);
    assert.match(short, /Frankie’s Premium portal shows the "check these" notice with Try again, and the portal’s Story says what was copied\.$/);
    assert.match(copyShortfallLine({ ok: false, pending: true }, 'UAT Free Team', 'Frankie')!, /did not finish/);
    assert.match(copyShortfallLine(null, 'UAT Free Team', 'Frankie')!, /did not finish/);
  });
  it('a first name, and an address stays whole', () => {
    assert.equal(firstNameOf('Frankie Okafor'), 'Frankie');
    assert.equal(firstNameOf('coach@example.com'), 'coach@example.com');
  });
});

describe('3 · Put it back on a portal goes through the portal\'s own path, under its own power', () => {
  const route = readCode('app/api/platform-admin/orgs/[id]/put-back/route.ts');
  it('the portal kinds call the portal writes; a club\'s override end refuses a free-time portal', () => {
    assert.match(route, /requireAnyPlatformPower\(\['club_billing', 'club_sections', 'portal_free_time'\]\)/);
    assert.match(route, /endPortalFreeTimeNow\(\{ orgId: id, overrideId: target\.overrideId, reason, actor: portalActor, extra \}\)/);
    assert.match(route, /changePortalFreeTimeEnd\(\{/);
    assert.match(route, /\(target\.kind === 'override' \|\| target\.kind === 'override_end'\) && await readFreeTimePortal\(id\)/);
  });
  it('the portal writes keep the put_back_of mark on their audit entries', () => {
    const give = readCode('lib/portal-free-time-give.ts');
    assert.match(give, /portal: true, \.\.\.input\.extra,/);
    assert.match(give, /extra: \{ portal: true, \.\.\.input\.extra \}/);
  });
  it('the Story knows a portal by its mark, never by its source', () => {
    const builder = readCode('lib/platform-story.ts');
    assert.match(builder, /from\('team_workspaces'\)\.select\('free_time_given_at, migration_summary'\)/);
    assert.match(builder, /portal: portalRes\.data\?\.free_time_given_at/);
  });
});

describe('4 · the person record\'s Coaches Portal tab: read by every role, the door only for the power (R6)', () => {
  const page = readCode('app/platform-admin/customer-users/[id]/page.tsx');
  const screen = readCode('app/platform-admin/customer-users/[id]/PersonRecord.tsx');
  const tab = readCode('lib/portal-free-time-tab.ts');
  it('the server decides who gets the door, from the power', () => {
    assert.match(page, /const canGive = hasPlatformPower\(auth\.role, 'portal_free_time'\)/);
    assert.match(page, /readCoachPortalTab\(person\.id, \{ id: auth\.user\.id, email: auth\.user\.email \?\? '', role: auth\.role \}, canGive\)/);
    assert.match(tab, /if \(canGive && portalCapWords\(viewer\.role\)\) \{/);
  });
  it('the tab and the server decide from one rule (portalGiveBlockOf on the give\'s own facts)', () => {
    assert.match(tab, /readPortalGiveFacts\(coach, viewer\)/);
    assert.match(tab, /block: portalGiveBlockOf\(facts, viewer\.role\)/);
  });
  it('the door is absent with a line, never disabled; a failed read is said, never "no team"', () => {
    assert.match(screen, /const door = !!tab\.give && !block && /);
    assert.doesNotMatch(screen, /disabled=\{[^}]*give/i);
    assert.match(screen, /The Coaches Portal tab could not be read\./);
  });
  it('the window sends the team, the day and why; the coach is the address, never the body (T23)', () => {
    const win = readCode('app/platform-admin/orgs/[id]/PortalFreeTimeWindows.tsx');
    assert.match(win, /sendJson\(`\/api\/platform-admin\/people\/\$\{coachId\}\/portal-free-time`, 'POST', \{\s*team_id: give\.mode === 'first' \? teamId : undefined, last_day: lastDay, reason,\s*\}\)/);
    assert.match(win, /Hosting a tournament is not part of free time\./);
    // The 14- and 3-day reminders email the coach (4e4876d36): the window must never tell staff the opposite.
    assert.doesNotMatch(win, /is not emailed/);
    assert.match(win, /is emailed 14 days and 3 days before it runs out/);
  });
});

describe('5 · the portal\'s record: its own chip, band and windows', () => {
  const page = readCode('app/platform-admin/orgs/[id]/page.tsx');
  const record = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
  const win = readCode('app/platform-admin/orgs/[id]/PortalFreeTimeWindows.tsx');
  it('a portal never gets the club\'s free-time door', () => {
    assert.match(page, /freeTime: isPortal \|\| !doorFacts \? null : \{/);
  });
  it('Change the end date and End it now call the portal\'s route (it moves the entitlement too)', () => {
    assert.match(win, /`\/api\/platform-admin\/orgs\/\$\{orgId\}\/portal-free-time\/\$\{row\.id\}`, 'PATCH'/);
    assert.match(win, /`\/api\/platform-admin\/orgs\/\$\{orgId\}\/portal-free-time\/\$\{row\.id\}`, 'DELETE'/);
    assert.doesNotMatch(win, /\/overrides\//);
  });
  it('a stored-cancelled free-time portal never reads "Cancelled" on its record', () => {
    assert.match(record, /portalRunning \? 'Active' : 'Free time ended'/);
    assert.match(record, /hosting is not part of free time/);
    assert.match(record, /Given by staff, no Stripe subscription/);
  });
  it('Put it back on a portal entry is checked against the portal power on the screen too', () => {
    assert.match(record, /kind === 'portal_end_now' \|\| kind === 'portal_end' \? can\.portalFreeTime : can\.billing/);
  });
});

describe('6 · one queue: Today and the Free time list count a portal (drawing E)', () => {
  it('Today\'s sentence names both', () => {
    assert.match(readCode('lib/platform-waiting.ts'), /why: 'A club or a Coaches Portal whose free time ends in the next 14 days: a plan, sections or a billing status'/);
  });
  it('the list reads a portal by its mark and names what the coach has', () => {
    const list = readCode('lib/free-time-list.ts');
    assert.match(list, /freeTimePortalOrgIds\(\)/);
    assert.match(list, /if \(portal\) return 'Premium Coaches Portal';/);
    assert.match(list, /kind: portalIds\.has\(orgId\) \? 'portal' : 'club'/);
  });
});
