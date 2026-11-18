import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familyTeamFacts, mergeLost, partBillOf, partIsGone, samePartsSeen, type MemberShare } from '../../lib/club-schedule-family-send.ts';
import { carriesMoney, teamBells, teamEmails } from '../../lib/club-schedule-money-audience.ts';
import { PART_WORDS } from '../../lib/club-schedule-words.ts';
import { functionBody, readCode } from './_source-code.ts';

/**
 * SEND THE CHANGES SENDS THE FAMILY (Phase 8, Session 3 — plan docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md
 * §8; drawing tab 5; owner rulings 4 and 5). One email per team listing every member's news; a part's line names the part;
 * its bill is its own (named as the part is), a notice per bill; added time is never a correction on the parent's bill.
 * The database half (two allocations, the parent byte-identical) is tests/sql/schedule-part-send-fixture.sql.
 */

const parent = (o: Partial<MemberShare> = {}): MemberShare => ({ memberId: 'P', label: null, lines: [], groups: [], billedCents: null, lost: null, bill: null, ...o });
const part = (o: Partial<MemberShare> = {}): MemberShare => ({
  memberId: 'C', label: 'Time added Nov 16', lines: ['Gains Thu, Dec 10, 6:00 p.m. · Prospect Park · Diamond 1'],
  groups: [{ kind: 'gains', count: 1, head: 'Gains Thu, Dec 10, 6:00 p.m. · Prospect Park · Diamond 1', pattern: null, months: [], firstDay: '2026-12-10' }],
  billedCents: null, lost: null,
  bill: { name: 'Fall practices · Time added Nov 16', cents: 13500, installments: [{ installmentNumber: 1, dueDate: '2026-12-01', amount: 135 }] }, ...o,
});

describe('one team, told once (drawing tab 5)', () => {
  it('a part-only send: the coach row names the part, no money there; its bill is its own, by the part\'s name', () => {
    const f = familyTeamFacts([parent(), part()]);
    assert.deepEqual(f.lines, ['Gains Thu, Dec 10, 6:00 p.m. · Prospect Park · Diamond 1 · Time added Nov 16']);
    // Added time is never a correction on the schedule's bill.
    assert.equal(f.billedCents, null);
    assert.equal(f.lost, null);
    assert.deepEqual(f.partBills, [{ name: 'Fall practices · Time added Nov 16', cents: 13500, installments: [{ installmentNumber: 1, dueDate: '2026-12-01', amount: 135 }] }]);
  });
  it('the schedule\'s own change and a part, in one email: its lines first, unsuffixed; its correction stays its own', () => {
    const f = familyTeamFacts([parent({ lines: ['Gains Mon, Nov 9, 7:00 p.m. · Kinsmen'], billedCents: 4000 }), part()]);
    assert.deepEqual(f.lines, ['Gains Mon, Nov 9, 7:00 p.m. · Kinsmen', 'Gains Thu, Dec 10, 6:00 p.m. · Prospect Park · Diamond 1 · Time added Nov 16']);
    assert.equal(f.billedCents, 4000);
    assert.equal(f.partBills.length, 1);
  });
  it('an unbilled part: no bill line on the email; a sent part\'s own correction and credit add up with the schedule\'s', () => {
    assert.deepEqual(familyTeamFacts([parent(), part({ bill: null })]).partBills, []);
    const lost = { cents: 500, creditCents: 500, payCents: 0, moves: [] };
    const f = familyTeamFacts([parent({ billedCents: 1000, lost }), part({ bill: null, billedCents: 2000, lost: { ...lost, cents: 300, creditCents: 100, payCents: 200 } })]);
    assert.equal(f.billedCents, 3000);
    assert.deepEqual(f.lost, { cents: 800, creditCents: 600, payCents: 200, moves: [] });
  });
  it('only the members whose steps landed are told (a later refusal never tells of practices that did not land)', () => {
    const f = familyTeamFacts([parent({ lines: ['Gains Mon, Nov 9'] }), part()], new Set(['P']));
    assert.deepEqual(f.lines, ['Gains Mon, Nov 9']);
    assert.deepEqual(f.groups, []);
    assert.deepEqual(f.partBills, []);
  });
  it('groups (owner 2026-11-17): a part\'s label is said once on each group, and the team\'s groups read soonest first', () => {
    const run = { kind: 'gains' as const, count: 2, head: 'Gains 2 practices', pattern: 'Tue · 7:00 p.m. · Lane 2 · Dec 1 – 8', months: [{ month: 'Dec', days: '1 · 8' }], firstDay: '2026-12-01' };
    const f = familyTeamFacts([parent({ groups: [{ kind: 'loses', count: 1, head: 'No longer Thu, Dec 3, 6:00 p.m. · Diamond A', pattern: null, months: [], firstDay: '2026-12-03' }] }), part({ groups: [run] })]);
    assert.deepEqual(f.groups.map(g => [g.head, g.pattern]), [
      ['Gains 2 practices', 'Tue · 7:00 p.m. · Lane 2 · Dec 1 – 8 · Time added Nov 16'],
      ['No longer Thu, Dec 3, 6:00 p.m. · Diamond A', null],
    ]);
  });
  it('mergeLost keeps either side alone', () => {
    const l = { cents: 1, creditCents: 1, payCents: 0, moves: [] };
    assert.equal(mergeLost(null, null), null);
    assert.equal(mergeLost(l, null), l);
    assert.equal(mergeLost(null, l), l);
  });
});

describe('the bill line (tab 5, note 2)', () => {
  it('sums a part\'s bill from its splits: total, teams, the most payments, the first due', () => {
    assert.deepEqual(partBillOf([
      { teamName: '14U AA', cents: 13500, installments: [{ dueDate: '2026-12-01' }] },
      { teamName: '15U AA', cents: 9000, installments: [{ dueDate: '2027-01-01' }, { dueDate: '2026-12-15' }] },
    ]), { cents: 22500, teamNames: ['14U AA', '15U AA'], payments: 2, firstDue: '2026-12-01' });
    assert.equal(partBillOf([]), null);
  });
  it('words: "$135.00 · 14U AA · one payment, due Dec 1" and "1.5 hours of Halton Hills evenings for 14U AA"', () => {
    assert.equal(PART_WORDS.billLineSet('$135.00', ['14U AA'], 1, 'Dec 1'), '$135.00 · 14U AA · one payment, due Dec 1');
    assert.equal(PART_WORDS.billLineTime('1.5 hours', ['Halton Hills evenings'], ['14U AA']), '1.5 hours of Halton Hills evenings for 14U AA');
    assert.equal(PART_WORDS.billLineHead('Time added Nov 16'), 'Time added Nov 16 · its bill');
  });
});

describe('a part leaves the page once its take-off is sent (11-17 ruling)', () => {
  it('gone: sent, nothing waiting, no practices; never while its change waits or while it is unsent', () => {
    assert.equal(partIsGone({ state: 'final', changedSinceSent: false, liveSlots: 0 }), true);
    assert.equal(partIsGone({ state: 'final', changedSinceSent: true, liveSlots: 0 }), false);
    assert.equal(partIsGone({ state: 'final', changedSinceSent: false, liveSlots: 2 }), false);
    assert.equal(partIsGone({ state: 'draft', changedSinceSent: false, liveSlots: 0 }), false);
  });
});

describe('the send sends what the window saw', () => {
  it('a part added, changed or sent since the preview is refused (read again)', () => {
    const parts = [{ id: 'C', version: 3 }];
    assert.equal(samePartsSeen([{ id: 'C', version: 3 }], parts), true);
    assert.equal(samePartsSeen([{ id: 'C', version: 2 }], parts), false);
    assert.equal(samePartsSeen([], parts), false);
    assert.equal(samePartsSeen([{ id: 'C', version: 3 }, { id: 'D', version: 1 }], parts), false);
    assert.equal(samePartsSeen(undefined, []), true);
  });
});

describe('the coach is told once, with a notice per bill (money to Money people only)', () => {
  const partBills = [{ name: 'Fall practices · Time added Nov 16', cents: 13500, installments: [{ installmentNumber: 1, dueDate: '2026-12-01', amount: 135 }] }];
  const base = {
    kind: 'changes' as const, orgName: 'Riverdale', scheduleName: 'Fall practices', teamName: '14U AA',
    lines: ['Gains Thu, Dec 10, 6:00 p.m. · Prospect Park · Time added Nov 16'], venueName: '', slotCount: 1, firstDay: '2026-12-10', lastDay: '2026-12-10',
    replyBy: null, bill: null, billedCents: null, lost: null, link: '/x', moneyLink: '/m',
  };
  it('a part\'s bill is money: carried, listed with its name, and the reason it is separate', () => {
    assert.equal(carriesMoney({ bill: null, billedCents: null, lost: null, partBills }), true);
    const told = teamEmails({ ...base, partBills, people: [{ name: 'Dana Whitfield', money: true }, { name: 'Sam Lee', money: false }] });
    assert.ok(told.sample.lists.some(l => l.title === PART_WORDS.emailBillTitle('Fall practices · Time added Nov 16', '$135.00 in 1 payment')));
    assert.match(told.sample.outro ?? '', /billed on its own/);
    // The coach without Money gets the same changes, no bill.
    assert.ok(told.plainSample);
    assert.equal(told.plainSample!.lists.length, 1);
    assert.doesNotMatch(told.plainSample!.outro ?? '', /billed on its own/);
  });
  it('one changes bell to everyone, and one bill bell per part bill to the Money people, named as the part', () => {
    const bells = teamBells({
      kind: 'changes', orgName: 'Riverdale', scheduleName: 'Fall practices', replyBy: null,
      team: { teamName: '14U AA', slots: 1, lines: base.lines, bill: null, billedCents: null, partBills },
      staff: [{ userId: 'u1', money: true }, { userId: 'u2', money: false }],
    });
    assert.deepEqual(bells.map(b => b.eventType), ['club_schedule_changes', 'club_bill_arrived']);
    assert.deepEqual(bells[1].userIds, ['u1']);
    assert.match(bells[1].body, /^For Fall practices · Time added Nov 16 · 1 payment/);
  });
});

describe('the wiring (source)', () => {
  const send = readCode('lib/club-schedule-send.ts');
  it('a part\'s first send is Finalize\'s own step on the part — its bill named as the part is; added time never rides the schedule\'s correction', () => {
    assert.match(functionBody(send, 'partsToSend'), /const kind = l\.row\.state === 'final' \? 'changes' as const : 'final' as const;/);
    assert.match(functionBody(send, 'stepFor'), /const bill = preview\.splits\?\.length \? \{ description: row\.name,/);
    // The schedule's own step runs only when it has something of its own to send.
    assert.match(functionBody(send, 'sendSchedule'), /const ownWork = kind !== 'changes' \|\| !subs\.length \|\| row\.changed_since_sent/);
  });
  it('a regenerate of one part never touches another: the window keeps the part\'s own view and address', () => {
    const page = readCode('app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx');
    assert.match(page, /view: winPart\?\.view \?\? own, regenerate: win\.regenerate/);
    assert.match(readCode('components/admin/kit/club/schedules/NewScheduleWindow.tsx'), /action: 'regenerate', version: editing\.schedule\.version/);
    assert.match(page, /setWin\(parts\.length \? \{ kind: 'which', then: 'regenerate' \} : \{ kind: 'settings', regenerate: true \}\)/);
  });
  it('a part-only send shows no corrections switch, and says why once (tab 5, note 3)', () => {
    const w = readCode('components/admin/kit/club/schedules/SendWindow.tsx');
    assert.match(w, /firstParts\.length > 0 && !correctionShown && <p className=\{ck\.hint\}>\{P\.correctionsOnlyOwn/);
  });
  it('Bill it… is a money reader\'s door only', () => {
    const page = readCode('app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx');
    assert.match(page, /onBillPart=\{own\.canMoney \? \(partId, keep\) => setWin\(\{ kind: 'bill', partId, back: 'send', keep \}\) : undefined\}/);
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/send/route.ts'), /bill: money \? x\.line\.bill : null/);
  });
});
