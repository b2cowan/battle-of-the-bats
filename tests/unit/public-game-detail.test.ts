import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPlayoffStakes, publicGameDetailView, publicGameRefreshSignature, publicGameRound } from '../../lib/public-game-detail.ts';
import type { Division, Game, PublicTeam, Venue } from '../../lib/types.ts';

const now = new Date('2026-10-29T15:30:00Z'); // 11:30 a.m. Toronto
const game = (over: Partial<Game> = {}): Game => ({ id: 'g', tournamentId: 't', divisionId: 'u11', homeTeamId: 'h', awayTeamId: 'a',
  date: '2026-10-29', time: '11:00', status: 'scheduled', location: '', ...over });
const teams = [{ id: 'a', name: 'Away team' }, { id: 'h', name: 'Home team' }] as PublicTeam[];
const divisions = [{ id: 'u11', name: 'U11' }] as Division[];
const venue = { id: 'park', name: 'Community Park', address: '1 Park Road', facilities: [{ id: 'field', name: 'Diamond 2' }] } as Venue;
const view = (g: Game, extra: Partial<Parameters<typeof publicGameDetailView>[1]> = {}) => publicGameDetailView(g, { games: [g], teams, divisions, venues: [venue], requireFinalization: true, now, ...extra });

describe('the preview game page: when, where and the score', () => {
  it('Cancelled keeps the address but has no Directions, scores, share eligibility or countdown', () => {
    const v = view(game({ status: 'cancelled', venueId: 'park', venueFacilityId: 'field', homeScore: 5, awayScore: 3 }));
    assert.equal(v.address, '1 Park Road'); assert.equal(v.field, 'Diamond 2');
    assert.equal(v.directions, null); assert.equal(v.hasScore, false); assert.equal(v.countdown, null);
    assert.deepEqual(v.sides.map(s => s.score), [null, null]);
    assert.equal(v.noScore, null); assert.equal(v.foot, 'This game will not be played.');
  });
  it('Unofficial keeps its scores and the confirmation foot; no championship gold before confirmation', () => {
    const g = game({ status: 'submitted', time: '08:00', isPlayoff: true, bracketCode: 'FIN', awayScore: 2, homeScore: 5 });
    const v = view(g);
    assert.equal(v.stateLabel, 'Unofficial'); assert.equal(v.hasScore, true);
    assert.equal(v.foot, 'Not yet confirmed by the organizer'); assert.equal(v.gold, false);
    assert.deepEqual(v.sides.map(s => s.name), ['Away team', 'Home team']);
    assert.deepEqual(v.sides.map(s => s.score), [2, 5]);
    assert.equal(view(g, { requireFinalization: false }).stateLabel, 'Final');
  });
  it('a live scheduled game exposes its running score, while a scoreless game says No score yet', () => {
    const unscored = view(game());
    assert.equal(unscored.stateLabel, 'Live now'); assert.equal(unscored.noScore, 'No score yet');
    assert.deepEqual(unscored.sides.map(s => s.score), [null, null]);
    const scored = view(game({ homeScore: 3, awayScore: 0 }));
    assert.equal(scored.hasScore, true); assert.equal(scored.noScore, null);
    assert.equal(scored.sides[0].trailing, true); assert.equal(scored.sides[1].trailing, false);
  });
  it('an entered zero-zero is a score; no zero is invented before the first entry', () => {
    const v = view(game({ homeScore: 0, awayScore: 0 }));
    assert.equal(v.hasScore, true); assert.equal(v.noScore, null);
  });
  it('before the game, the countdown uses the venue timezone as an absolute instant', () => {
    const v = view(game({ time: '20:00' }));
    assert.equal(v.countdown, '2026-10-30T00:00:00.000Z'); assert.equal(v.stateLabel, null);
    assert.equal(v.hasScore, false);
  });
  it('a venue name alone or a free-text location keeps Directions; only no location loses it', () => {
    const nameOnly = view(game({ venueId: 'park', venueFacilityId: 'field' }), { venues: [{ ...venue, address: undefined }] });
    assert.equal(nameOnly.directions, 'https://www.google.com/maps/search/?api=1&query=Community%20Park%20%E2%80%94%20Diamond%202');
    assert.equal(view(game({ location: 'Town Park' })).directions, 'https://www.google.com/maps/search/?api=1&query=Town%20Park');
    assert.equal(view(game()).directions, null); assert.equal(view(game()).field, 'Location TBD');
  });
  it('real names link to teams; unresolved and NIL-UUID slots use the settled fan words', () => {
    const v = view(game({ awayTeamId: '00000000-0000-0000-0000-000000000000', awayPlaceholder: 'Winner SF1' }));
    assert.equal(v.sides[0].name, 'Semifinal 1 winner'); assert.equal(v.sides[0].teamId, null);
    assert.equal(v.sides[1].teamId, 'h');
  });
  it('Notes is the last fact and absent when empty; forfeit is a finished state', () => {
    const g = game({ status: 'forfeit', awayScore: 7, homeScore: 0, isPlayoff: true, bracketCode: 'FIN', notes: ' Bring water. ' });
    const v = view(g);
    assert.equal(v.stateLabel, 'Final'); assert.equal(v.round, 'Championship');
    assert.equal(v.facts.at(-1)?.text, 'Bring water.'); assert.equal(v.facts.at(-1)?.label, 'Notes');
    assert.equal(view({ ...g, notes: ' ' }).facts.length, 3);
    assert.equal(v.foot, 'The winner takes the title'); assert.equal(v.gold, true);
  });
  it('Final is never the round name, including custom labels and double-elimination title games', () => {
    for (const bracketCode of ['FIN', 'GF', 'IF']) assert.equal(publicGameRound(game({ isPlayoff: true, bracketCode })), 'Championship');
    assert.equal(publicGameRound(game({ isPlayoff: true, bracketCode: 'GF2' })), 'Championship (Game 2)');
    assert.equal(publicGameRound(game({ isPlayoff: true, roundLabel: 'Final' })), 'Championship');
    assert.equal(publicGameRound(game({ isPlayoff: true, bracketCode: 'SF1' })), 'Semifinal');
  });
});

describe('the shared stakes line', () => {
  it('names the singular downstream round within this division and bracket, using a whole code', () => {
    const source = game({ isPlayoff: true, bracketCode: 'QF1', bracketId: 'gold' });
    const next = game({ id: 'next', isPlayoff: true, bracketCode: 'SF1', bracketId: 'gold', homePlaceholder: 'Winner QF1' });
    assert.deepEqual(getPlayoffStakes(source, [source, next], true), { text: 'Winner advances to the Semifinal', gold: false });
    assert.equal(getPlayoffStakes(source, [source, next])?.text, 'Winner advances to the Semifinals');
    assert.equal(getPlayoffStakes(source, [{ ...next, divisionId: 'u13' }], true), null);
    assert.equal(getPlayoffStakes(source, [{ ...next, bracketId: 'silver' }], true), null);
    assert.equal(getPlayoffStakes(source, [{ ...next, homePlaceholder: 'Winner QF10' }], true), null);
  });
  it('retains legacy words by default while new pages use the ruled championship foot', () => {
    const g = game({ isPlayoff: true, bracketCode: 'FIN' });
    assert.equal(getPlayoffStakes(g, [])?.text, 'Championship — winner takes the title');
    assert.equal(getPlayoffStakes(g, [], true)?.text, 'The winner takes the title');
    assert.equal(getPlayoffStakes(game({ isPlayoff: true, bracketCode: 'P3' }), [], true)?.text, 'Battling for 3rd place');
    assert.equal(getPlayoffStakes(game({ isPlayoff: true, bracketCode: 'CON' }), [], true)?.text, 'Consolation final');
  });
});

describe('the new game page refresh signature', () => {
  it('changes at kickoff and the live-window end without a score edit; unchanged polls stay unchanged', () => {
    const g = game({ durationMinutes: 60 });
    const key = (time: string) => publicGameRefreshSignature(g, true, new Date(time));
    assert.notEqual(key('2026-10-29T14:59:00Z'), key('2026-10-29T15:00:00Z'));
    assert.equal(key('2026-10-29T15:00:00Z'), key('2026-10-29T15:20:00Z'));
    assert.notEqual(key('2026-10-29T16:29:00Z'), key('2026-10-29T16:30:00Z'));
  });
  it('changes when the public feed withholds/removes a game, or a score is finalized', () => {
    const g = game({ status: 'submitted', time: '08:00' });
    assert.notEqual(publicGameRefreshSignature(g, true, now), publicGameRefreshSignature(null, true, now));
    assert.equal(publicGameRefreshSignature(null, true, now), 'missing');
    assert.notEqual(publicGameRefreshSignature(g, true, now), publicGameRefreshSignature({ ...g, status: 'completed' }, true, now));
  });
});
