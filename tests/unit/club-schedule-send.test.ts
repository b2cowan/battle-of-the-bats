import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findClashPairs, findClubClashes, repEventBooking } from '../../lib/venue-clash.ts';
import { diffAgainstSent, slotPatterns, type DiffSlot, type SentPractice, type Slot } from '../../lib/club-schedule-engine.ts';
import {
  billPhrase, changeLine, closingRowLine, heldLine, measureLines, patternLine, sendLogLine, teamEmail, unreachableSentence,
} from '../../lib/club-schedule-words.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';

/**
 * THE SCHEDULER'S SENDS, IN BEHAVIOUR (Club Tier Stage 11a, part A): two teams sharing one club slot are one booking
 * (P11-04a); what Send the changes applies (Ask 14); and the words a coach reads (Ask 7 — drafts for /marketing). A send
 * tells the club's coaches only, never the venue (owner 2026-10-12, walk §300 W7).
 */

const at = (day: string, time: string) => zonedWallClockToUtc(day, time)!;

describe('rows from one club slot never clash with each other (P11-04a)', () => {
  const row = (id: string, team: string, slot: string | null, facility = 'f-lane1') => repEventBooking({
    id, team_id: team, event_type: 'practice', starts_at: at('2027-01-04', '18:00'), ends_at: at('2027-01-04', '19:00'), status: 'scheduled',
    org_venue_id: 'v-dome', org_venue_facility_id: facility, club_schedule_slot_id: slot,
  }, { team: team.toUpperCase() })!;
  it('two teams sharing Lane 1 from one slot: no pair, no finding', () => {
    const a = row('e1', 't13aaa', 's-1'), b = row('e2', 't12aa', 's-1');
    assert.equal(a.clubSlotOf, 's-1');
    assert.deepEqual(findClashPairs([a, b]), []);
    assert.deepEqual(findClubClashes(a, [b]), []);
  });
  it('two different slots on one lane at one time ARE a clash (the club double-booked itself)', () => {
    const a = row('e1', 't13aaa', 's-1'), b = row('e2', 't12aa', 's-2');
    assert.equal(findClashPairs([a, b])[0]?.kind, 'booked_by');
  });
  it('a club practice against another program\'s booking still clashes', () => {
    const club = row('e1', 't13aaa', 's-1');
    const own = row('e9', 't15aa', null);
    assert.equal(findClubClashes(club, [own])[0]?.kind, 'booked_by');
  });
});

describe('what changed since it was sent (Ask 14)', () => {
  const ms = (day: string, time: string) => Date.parse(at(day, time));
  const slot = (id: string, day: string, time: string, week: string): DiffSlot => ({ id, key: `k-${id}`, week, startMs: ms(day, time) });
  const W1 = '2027-01-11';
  const slots = [slot('a', '2027-01-11', '19:00', W1), slot('b', '2027-01-12', '20:00', W1), slot('c', '2027-01-13', '19:00', W1), slot('d', '2027-01-18', '19:00', '2027-01-18')];
  const weekOf = (t: number) => (t < ms('2027-01-18', '00:00') ? W1 : '2027-01-18');
  const sent = (id: string, team: string, slotId: string, startMs: number, cancelled = false): SentPractice => ({ id, teamId: team, slotId, cancelled, startMs });
  it('14U AA moved Mon 7:00 → Tue 8:00 in the same week: ONE move, its practice updated in place', () => {
    const assign = new Map([['k-a', []], ['k-b', ['14u']]]);
    const d = diffAgainstSent(slots, assign, [sent('p1', '14u', 'a', ms('2027-01-11', '19:00'))], weekOf);
    assert.deepEqual(d, { moves: [{ teamId: '14u', practiceId: 'p1', toKey: 'k-b' }], gains: [], losses: [] });
  });
  it('13U AAA handed its Wednesday back and 16U AA gains it: a gain for 16U AA, nothing for 13U AAA (already gone)', () => {
    const assign = new Map([['k-c', ['16u']]]);
    const d = diffAgainstSent(slots, assign, [], weekOf);
    assert.deepEqual(d, { moves: [], gains: [{ teamId: '16u', key: 'k-c', reinstate: false }], losses: [] });
  });
  it('a slot taken away with nothing in its week to move to: a loss (the step cancels or deletes it)', () => {
    const d = diffAgainstSent(slots, new Map(), [sent('p2', '9u', 'd', ms('2027-01-18', '19:00'))], weekOf);
    assert.deepEqual(d, { moves: [], gains: [], losses: [{ teamId: '9u', practiceId: 'p2' }] });
  });
  it('a lost and a gained slot in DIFFERENT weeks are a loss and a gain, never a move', () => {
    const assign = new Map([['k-d', ['14u']]]);
    const d = diffAgainstSent(slots, assign, [sent('p1', '14u', 'a', ms('2027-01-11', '19:00'))], weekOf);
    assert.deepEqual(d.moves, []);
    assert.deepEqual(d.gains, [{ teamId: '14u', key: 'k-d', reinstate: false }]);
    assert.deepEqual(d.losses, [{ teamId: '14u', practiceId: 'p1' }]);
  });
  it('a slot given back to a team whose practice there was cancelled: its practice comes back (reinstate), never paired', () => {
    const assign = new Map([['k-a', ['14u']]]);
    const d = diffAgainstSent(slots, assign, [sent('p1', '14u', 'a', ms('2027-01-11', '19:00'), true)], weekOf);
    assert.deepEqual(d, { moves: [], gains: [{ teamId: '14u', key: 'k-a', reinstate: true }], losses: [] });
  });
  it('nothing changed: nothing to send', () => {
    const assign = new Map([['k-a', ['14u']]]);
    assert.deepEqual(diffAgainstSent(slots, assign, [sent('p1', '14u', 'a', ms('2027-01-11', '19:00'))], weekOf), { moves: [], gains: [], losses: [] });
  });
});

describe('the words a coach reads (Ask 7 — drafts for /marketing)', () => {
  // The dome: 15U AAA on Field 1 at 8:00 every Sunday, Oct 4 – Mar 28, Dec 27 off.
  const sundays: string[] = [];
  for (let d = new Date('2026-10-04T12:00:00Z'); d <= new Date('2027-03-28T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 7)) {
    const day = d.toISOString().slice(0, 10);
    if (day !== '2026-12-27') sundays.push(day);
  }
  const slots: Slot[] = sundays.map(day => ({
    key: `k-${day}`, venueId: 'v', facilityId: 'f1', blockIndex: 0, day, weekday: 7, week: day, startClock: '08:00', endClock: '09:30',
    startMs: Date.parse(at(day, '08:00')), endMs: Date.parse(at(day, '09:30')), pos: '7|08:00|v|f1', prime: false, weight: 1,
  }));
  const assign = new Map(slots.map(s => [s.key, ['t15aaa']]));
  it('a team\'s slots as a pattern: "Sundays, 8:00–9:30 a.m. · Field 1, Oct 4 – Mar 28, not Dec 27"', () => {
    const [p] = slotPatterns(slots, 't15aaa', assign);
    assert.equal(patternLine(p, 'Field 1'), 'Sundays, 8:00–9:30 a.m. · Field 1, Oct 4 – Mar 28, not Dec 27');
  });
  it('a pattern on one date reads as that date', () => {
    const one = slotPatterns(slots.slice(0, 1), 't15aaa', assign)[0];
    assert.equal(patternLine(one, 'Field 1'), 'Sun, Oct 4, 8:00–9:30 a.m. · Field 1');
  });
  it('the email: the slots, the bill and its payments, the link, how to hand one back', () => {
    const e = teamEmail({
      kind: 'final', orgName: 'UAT Rep Club', scheduleName: 'Winter dome · Sundays', teamName: '15U AAA', venueName: 'Lakeshore Dome',
      recipientNames: ['Dana Whitfield', 'Sam Ortiz'], slotCount: 25, firstDay: '2026-10-04', lastDay: '2027-03-28',
      patterns: ['Sundays, 8:00–9:30 a.m. · Field 1, Oct 4 – Mar 28, not Dec 27'],
      bill: { cents: 270000, installments: [{ installmentNumber: 1, amount: 972, dueDate: '2026-10-01' }, { installmentNumber: 2, amount: 864, dueDate: '2026-12-01' }, { installmentNumber: 3, amount: 864, dueDate: '2027-02-01' }] },
      replyBy: null, link: '/uat-rep-club/coaches/teams/t/schedule',
    });
    assert.equal(e.greeting, 'Hi Dana and Sam,');
    assert.equal(e.subject, 'Winter dome · Sundays: 15U AAA’s slots');
    assert.equal(e.paragraphs[0], 'UAT Rep Club has given 15U AAA 25 slots at Lakeshore Dome, from Sun, Oct 4 to Sun, Mar 28, 2027:');
    assert.equal(e.lists[1].title, 'The bill: $2,700.00 in 3 payments, for the time you got.');
    assert.deepEqual(e.lists[1].items, ['Oct 1 · $972.00', 'Dec 1 · $864.00', 'Feb 1 · $864.00']);
    assert.match(e.outro ?? '', /hand it back from the practice on your schedule/);
    assert.doesNotMatch(JSON.stringify(e), /From the club\b/);
  });
  it('who can\'t be reached, in the reminders\' words, said for a schedule', () => {
    assert.equal(unreachableSentence('12U AA', 'invitation_unanswered', 36, 'final'),
      '12U AA has a head coach invitation nobody has accepted yet. Its 36 slots go on its schedule; nobody is emailed about them. Name or chase its coach from its Coaches page.');
  });
  it('a draft card\'s measures, as the drawing reads them', () => {
    const names: Record<string, string> = { t16: '16U AA', t9: '9U AA', t12: '12U AA' };
    assert.deepEqual(measureLines([
      { kind: 'shares', allMet: true, sameCount: 36, short: [] },
      { kind: 'prime', min: 23, max: 24, rotated: false, lowTeamId: null },
      { kind: 'nights', same: true, ratio: 1 },
      { kind: 'held', count: 2, owners: ['13U AAA'], what: 'tryout' },
    ], id => names[id] ?? id), [
      'Every team gets 36 slots', 'Prime time 23–24 each', 'Each team on the same nights every week',
      'Leaves out the 2 slots 13U AAA’s tryout day holds',
    ]);
    assert.deepEqual(measureLines([{ kind: 'prime', min: 21, max: 26, rotated: false, lowTeamId: 't16' }, { kind: 'youngest', teamIds: ['t9', 't12'], latestStart: '19:00' }], id => names[id]),
      ['Prime time 21–26: 16U AA gets 21', '9U AA and 12U AA never after 7:00 p.m.']);
    assert.equal(heldLine(5, ['a', 'b']), 'Leaves out the 5 slots bookings already hold');
  });
  it('the change lines, the closing row, the send log', () => {
    const clockOf = (m: number) => ({ day: new Date(m - 5 * 3_600_000).toISOString().slice(0, 10), time: new Date(m - 5 * 3_600_000).toISOString().slice(11, 16) });
    assert.equal(changeLine({ kind: 'moved', fromStartMs: Date.parse(at('2027-01-11', '19:00')), fromPlace: 'Lane 2', toStartMs: Date.parse(at('2027-01-12', '20:00')), toEndMs: 0, toPlace: 'Lane 2' }, clockOf),
      'Mon, Jan 11, 7:00 p.m. · Lane 2 → Tue, Jan 12, 8:00 p.m. · Lane 2');
    assert.equal(closingRowLine({ kind: 'matches', permitCents: 2700000 }), 'Matches the permit’s $27,000.00: nothing left for the club to cover.');
    assert.equal(billPhrase(270000, 3), '$2,700.00 in 3 payments');
    assert.equal(sendLogLine({ kind: 'changes', teams: 2, people: 4 }), 'Changes · 2 teams, 4 people');
    assert.equal(sendLogLine({ kind: 'final', teams: 7, people: 14 }), 'The whole schedule · 7 teams, 14 people');
  });
});
