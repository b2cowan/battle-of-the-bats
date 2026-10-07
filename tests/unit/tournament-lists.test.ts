/**
 * THE ONE TOURNAMENTS LIST (Tournament admin redesign Stage 4, D7 — it replaced A22's two lists): every event
 * in exactly one band, the bands in the order of an event's life, an empty band absent, and a record's
 * Previous / Next walking the list's own order.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isFinished, listBands, walkOrder, type ListEvent } from '../../lib/tournament-lists';
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

describe('one list, every event in exactly one band', () => {
  it('the bands run in the order of an event’s life: Active, Draft, Completed, Archived', () => {
    assert.deepEqual(listBands(events).map(x => x.key), ['active', 'draft', 'completed', 'archived']);
  });

  it('what is ahead is soonest first, an undated draft last', () => {
    const b = listBands(events);
    assert.deepEqual(b[0].events.map(e => e.id), ['summer', 'invitational']);
    assert.deepEqual(b[1].events.map(e => e.id), ['winter-draft', 'fall-draft']);
  });

  it('what is finished is most recent first', () => {
    const b = listBands(events);
    assert.deepEqual(b[2].events.map(e => e.id), ['opener', 'spring']);
    assert.deepEqual(b[3].events.map(e => e.id), ['classic']);
  });

  it('every event is in exactly one band', () => {
    const ids = walkOrder(listBands(events)).map(e => e.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, events.length);
  });

  it('an empty band is absent', () => {
    assert.deepEqual(listBands(events.filter(e => e.status !== 'archived' && e.status !== 'draft')).map(b => b.key), ['active', 'completed']);
    assert.deepEqual(listBands([]), []);
  });

  it('a record walks the list band by band, so history always comes after what is ahead', () => {
    assert.deepEqual(walkOrder(listBands(events)).map(e => e.id), ['summer', 'invitational', 'winter-draft', 'fall-draft', 'opener', 'spring', 'classic']);
  });

  it('Completed and Archived are finished; Active and Draft are not', () => {
    assert.equal(isFinished('completed'), true);
    assert.equal(isFinished('archived'), true);
    assert.equal(isFinished('active'), false);
    assert.equal(isFinished('draft'), false);
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
