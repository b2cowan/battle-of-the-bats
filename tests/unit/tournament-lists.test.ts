/**
 * THE TWO LISTS (Tournament admin redesign Stage 4, D4 · D5 · A22): each event in ONE list by where it is
 * in its life, bands in a fixed order, an empty band absent, and a record's Previous / Next walking the
 * list's own order.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aheadBands, listOf, pastBands, walkOrder, type ListEvent } from '../../lib/tournament-lists';
import { readFileSync } from 'node:fs';
import { statusConfirm, statusSentence } from '../../lib/tournament-status-words';

function ev(id: string, status: ListEvent['status'], startDate: string | null, endDate: string | null = startDate): ListEvent {
  return {
    id, name: id, slug: id, year: startDate ? Number(startDate.slice(0, 4)) : null, status, startDate, endDate,
    contactEmail: null, defaultContactMemberId: null, acceptedTeams: 0, divisionCount: 0, teamsPlayed: 0, gamesPlayed: 0,
  };
}

const events = [
  ev('opener', 'completed', '2026-10-02', '2026-10-04'),
  ev('classic', 'archived', '2026-06-12', '2026-06-14'),
  ev('spring', 'completed', '2026-05-01', '2026-05-03'),
  ev('invitational', 'active', '2026-10-26'),
  ev('summer', 'active', '2026-10-03'),
  ev('fall-draft', 'draft', null),
  ev('winter-draft', 'draft', '2026-12-05'),
];

describe('each event lives in one list', () => {
  it('the Tournaments list holds what is ahead: Active, then Draft, soonest first, undated last', () => {
    const b = aheadBands(events);
    assert.deepEqual(b.map(x => x.key), ['active', 'draft']);
    assert.deepEqual(b[0].events.map(e => e.id), ['summer', 'invitational']);
    assert.deepEqual(b[1].events.map(e => e.id), ['winter-draft', 'fall-draft']);
  });

  it('Past tournaments holds every finished event: Completed, then Archived, most recent first', () => {
    const b = pastBands(events);
    assert.deepEqual(b.map(x => x.key), ['completed', 'archived']);
    assert.deepEqual(b[0].events.map(e => e.id), ['opener', 'spring']);
    assert.deepEqual(b[1].events.map(e => e.id), ['classic']);
  });

  it('no event is on both lists', () => {
    const ahead = walkOrder(aheadBands(events)).map(e => e.id);
    const past = walkOrder(pastBands(events)).map(e => e.id);
    assert.equal(ahead.filter(id => past.includes(id)).length, 0);
    assert.equal(ahead.length + past.length, events.length);
  });

  it('an empty band is absent', () => {
    assert.deepEqual(pastBands(events.filter(e => e.status !== 'archived')).map(b => b.key), ['completed']);
    assert.deepEqual(aheadBands([]), []);
  });

  it('a record walks the list it was opened from, band by band', () => {
    assert.deepEqual(walkOrder(aheadBands(events)).map(e => e.id), ['summer', 'invitational', 'winter-draft', 'fall-draft']);
  });

  it('Mark complete moves an event to Past tournaments; Reopen moves it back', () => {
    assert.equal(listOf('active'), 'ahead');
    assert.equal(listOf('completed'), 'past');
    assert.equal(listOf('archived'), 'past');
    assert.equal(listOf('draft'), 'ahead');
  });
});

describe('the status rules the record says before a tap (/review 2026-10-06)', () => {
  const facts = { name: 'Summer Classic', startDate: '2026-06-12', today: '2026-10-06', finiteSlots: false };

  it('Bring back says the results email when the route will send it — a change TO Completed, like Mark complete', () => {
    assert.match(statusConfirm('bringBack', { ...facts, willEmailTeams: true }).body, /email with the final results/);
    assert.doesNotMatch(statusConfirm('bringBack', { ...facts, willEmailTeams: false }).body, /email/);
  });

  it('the route keeps a sealed event out of Active AND Draft from any status (completed → draft → active, archived → active)', () => {
    const src = readFileSync('app/api/admin/tournaments/route.ts', 'utf8');
    const at = src.indexOf(".from('tournament_archives')");
    assert.ok(at > 0, 'set-status reads the sealed record');
    const guard = src.slice(Math.max(0, at - 700), at);
    assert.match(guard, /if \(newStatus === 'active' \|\| newStatus === 'draft'\) \{/);
    assert.doesNotMatch(guard, /current\.status === 'completed' && newStatus === 'active'/, 'the old completed→active-only guard is gone');
  });
});

describe('the status sentence (/review probe 2026-10-06)', () => {
  const base = { startDate: '2099-07-01', endDate: '2099-07-03', today: '2026-10-06', finiteSlots: true, sealed: false };
  it('an event archived before its dates never says it finished', () => {
    assert.doesNotMatch(statusSentence({ ...base, status: 'archived' }), /Finished/);
  });
  it('an event whose last day has come opens with the day it finished', () => {
    assert.match(statusSentence({ ...base, status: 'completed', startDate: '2026-10-02', endDate: '2026-10-04' }), /^Finished Oct 4\. /);
  });
});
