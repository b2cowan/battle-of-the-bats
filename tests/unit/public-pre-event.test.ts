import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { joinNames, preEventFacts, registerCardView, teamSpotsLine, totalSpots } from '../../lib/public-pre-event.ts';

/**
 * THE BEFORE-THE-EVENT PAGE'S WORDS (Public tournament pages Stage 2 Part 3, plan §5): the Register card and the facts
 * list. The spots line keeps the old pre-event panel's privacy rule — a count only when the Teams page is public.
 */
describe('joinNames', () => {
  it('reads like a sentence and cuts a long list', () => {
    assert.equal(joinNames(['U11']), 'U11');
    assert.equal(joinNames(['U11', 'U13']), 'U11 and U13');
    assert.equal(joinNames(['U9', 'U11', 'U13']), 'U9, U11 and U13');
    assert.equal(joinNames(['U7', 'U9', 'U11', 'U13', 'U15']), 'U7, U9, U11 +2 more');
  });
});

describe('totalSpots: only when every division states one', () => {
  it('sums, or says nothing', () => {
    assert.equal(totalSpots([{ capacity: 8 }, { capacity: 8 }], false), 16);
    assert.equal(totalSpots([{ capacity: 8 }, { capacity: null }], false), null);
    assert.equal(totalSpots([{ capacity: 8 }, { capacity: 0 }], false), null);
    assert.equal(totalSpots([], false), null);
    assert.equal(totalSpots([{ capacity: 8 }], true), null, 'an invite-only event has no spots');
  });
});

describe('the spots line follows the team list\'s visibility', () => {
  const base = { inviteOnly: false, divisionNames: ['U11', 'U13'] };
  it('public Teams + capacity: "11 of 16 team spots taken · U11 and U13"', () => {
    assert.equal(teamSpotsLine({ ...base, showTeamsPage: true, accepted: 11, capacity: 16 }), '11 of 16 team spots taken · U11 and U13');
  });
  it('public Teams, no capacity: the count alone, and nothing when none are in', () => {
    assert.equal(teamSpotsLine({ ...base, showTeamsPage: true, accepted: 1, capacity: null }), '1 team accepted · U11 and U13');
    assert.equal(teamSpotsLine({ ...base, showTeamsPage: true, accepted: 0, capacity: null }), null);
  });
  it('hidden Teams: capacity is never private, the count is never printed', () => {
    assert.equal(teamSpotsLine({ ...base, showTeamsPage: false, accepted: 11, capacity: 16 }), '16 team spots · U11 and U13');
    assert.equal(teamSpotsLine({ ...base, showTeamsPage: false, accepted: 11, capacity: null }), null);
  });
  it('an invite-only event has no spots', () => {
    assert.equal(teamSpotsLine({ ...base, inviteOnly: true, showTeamsPage: true, accepted: 4, capacity: 16 }), null);
  });
});

describe('the Register card', () => {
  const open = { label: 'Registration is open', detail: 'Teams can register for available divisions now.', cta: 'register' as const };
  const input = { startDate: '2026-11-17', firstPitchISO: '2026-11-17T09:00:00', spotsLine: '11 of 16 team spots taken · U11 and U13', registration: open, registerOn: true, registerHref: '/o/t/register', isPreview: false };

  it('open: starts, countdown target, spots, the button and the Coaches Portal line — together', () => {
    const v = registerCardView(input)!;
    assert.equal(v.starts, 'Starts Tue, Nov 17');
    assert.equal(v.countdownTarget, '2026-11-17T09:00:00');
    assert.equal(v.spots, '11 of 16 team spots taken · U11 and U13');
    assert.deepEqual(v.button, { href: '/o/t/register', label: 'Register a team' });
    assert.match(v.portalNote!, /free Coaches Portal/);
    assert.equal(v.waitlistNote, null);
  });
  it('full: the same button says Join the waitlist, with the reason', () => {
    const v = registerCardView({ ...input, registration: { label: 'Join the waitlist', detail: 'Divisions are full, but teams can submit for waitlist consideration.', cta: 'waitlist' } })!;
    assert.equal(v.button!.label, 'Join the waitlist');
    assert.match(v.waitlistNote!, /full/);
    assert.match(v.portalNote!, /^Joining the waitlist also sets up/);
  });
  it('closed: the start line and the state\'s own words — no button, no spots, no portal line', () => {
    const v = registerCardView({ ...input, registration: { label: 'Registration closed', detail: 'x', cta: null } })!;
    assert.equal(v.button, null);
    assert.equal(v.spots, 'Registration closed');
    assert.equal(v.portalNote, null);
  });
  it('the Register page off (or invite-only): the start and the countdown alone', () => {
    const v = registerCardView({ ...input, registerOn: false })!;
    assert.equal(v.button, null);
    assert.equal(v.spots, null);
    assert.equal(v.starts, 'Starts Tue, Nov 17');
  });
  it('the organizer\'s preview shows the card, never the way in', () => {
    const v = registerCardView({ ...input, isPreview: true })!;
    assert.equal(v.button, null);
    assert.equal(v.portalNote, null);
  });
  it('no start date and no button: no card at all (absent beats empty)', () => {
    assert.equal(registerCardView({ ...input, startDate: null, firstPitchISO: null, registerOn: false }), null);
  });
});

describe('the facts list', () => {
  const full = { divisionNames: ['U11', 'U13'], venue: { name: 'Riverdale Community Park', href: 'https://maps.example/x', others: 0 }, showSchedulePage: true, hasVisibleGames: false, scheduleHref: '/s', showRulesPage: true, rulesHref: '/r' };
  it('in the drawing\'s order, with the schedule posted-before-the-event while there is nothing to show', () => {
    const rows = preEventFacts(full);
    assert.deepEqual(rows.map(r => r.key), ['divisions', 'where', 'schedule', 'rules']);
    assert.equal(rows[0].text, 'U11 · U13');
    assert.deepEqual([rows[2].text, rows[2].href], ['Posted before the event', undefined]);
    assert.equal(rows[3].href, '/r');
  });
  it('once a game is visible the Schedule row is a door', () => {
    const row = preEventFacts({ ...full, hasVisibleGames: true }).find(r => r.key === 'schedule')!;
    assert.deepEqual([row.text, row.href], ['Full schedule', '/s']);
  });
  it('a page that is off has no row; no venue, no divisions: no row', () => {
    const rows = preEventFacts({ ...full, showSchedulePage: false, showRulesPage: false, venue: null, divisionNames: [] });
    assert.deepEqual(rows, []);
  });
  it('several places say how many more', () => {
    assert.equal(preEventFacts({ ...full, venue: { name: 'Park', href: null, others: 2 } })[1].more, '+2 more');
  });
});
