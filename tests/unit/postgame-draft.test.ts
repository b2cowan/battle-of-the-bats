/**
 * The postgame family email (Chunk D 3.1) — the ONE place the product puts words in a coach's
 * mouth, so the words are tested. Two properties matter: the facts are the coach's own, and
 * nothing is promised that the schedule cannot back up.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPostgameDraft,
  nextEventLine,
  postgameDraftHref,
  DRAFT_SUBJECT_PARAM,
  DRAFT_BODY_PARAM,
  type PostgameDraftNextEvent,
} from '../../lib/postgame-draft.ts';

const NEXT_GAME: PostgameDraftNextEvent = {
  eventType: 'league_game',
  name: 'Game vs Thunder',
  opponent: 'Thunder',
  homeAway: 'home',
  startsAt: '2026-08-09T18:00:00.000Z',
  location: 'Central Fields',
  fieldNumber: 'Diamond 1',
};

describe('the subject and the facts', () => {
  it('leads with the coach\'s own score, team first', () => {
    const d = buildPostgameDraft({
      teamName: 'Ravens',
      game: { opponent: 'Falcons', homeAway: 'home', teamScore: 4, opponentScore: 2 },
      nextEvent: null,
    });
    assert.equal(d.subject, 'Ravens 4–2 vs Falcons');
    assert.match(d.body, /^Final: Ravens 4, Falcons 2\./);
  });

  it('says "at" for an away game', () => {
    const d = buildPostgameDraft({
      teamName: 'Ravens',
      game: { opponent: 'Falcons', homeAway: 'away', teamScore: 1, opponentScore: 3 },
      nextEvent: null,
    });
    assert.equal(d.subject, 'Ravens 1–3 at Falcons');
  });

  it('never claims a great result under a loss', () => {
    const loss = buildPostgameDraft({
      teamName: 'Ravens',
      game: { opponent: 'Falcons', homeAway: 'home', teamScore: 1, opponentScore: 9 },
      nextEvent: null,
    });
    assert.match(loss.body, /tough result/i);
    assert.doesNotMatch(loss.body, /great effort from the whole team/i);
  });

  it('survives a missing opponent without printing an empty gap', () => {
    const d = buildPostgameDraft({
      teamName: 'Ravens',
      game: { opponent: null, homeAway: null, teamScore: 3, opponentScore: 3 },
      nextEvent: null,
    });
    assert.equal(d.subject, 'Ravens 3–3 vs our opponent');
    assert.doesNotMatch(d.body, /undefined|null/);
  });
});

describe('the "next up" line', () => {
  it('is omitted entirely when the season has nothing left', () => {
    const d = buildPostgameDraft({
      teamName: 'Ravens',
      game: { opponent: 'Falcons', homeAway: 'home', teamScore: 4, opponentScore: 2 },
      nextEvent: null,
    });
    assert.doesNotMatch(d.body, /Next up/, 'an empty promise is worse than silence');
  });

  it('names a practice as a practice, not as a game', () => {
    const line = nextEventLine({ ...NEXT_GAME, eventType: 'practice', opponent: null });
    assert.match(line, /— Practice/);
    // The opponent preposition must not appear — "at 2:00 p.m." is the clock, not a venue.
    assert.doesNotMatch(line, /vs |at Thunder/);
  });

  it('drops the venue when the coach never entered one', () => {
    const line = nextEventLine({ ...NEXT_GAME, location: null, fieldNumber: null });
    assert.doesNotMatch(line, /,\s*$/);
    assert.doesNotMatch(line, /undefined|null/);
  });

  it('falls back to the event name when a non-practice has no opponent', () => {
    const line = nextEventLine({ ...NEXT_GAME, eventType: 'team_event', opponent: null, name: 'Team photos' });
    assert.match(line, /Team photos/);
  });
});

describe('the handover to the compose screen', () => {
  it('carries subject and body as query values, encoded', () => {
    const draft = buildPostgameDraft({
      teamName: 'Ravens & Co',
      game: { opponent: 'Falcons', homeAway: 'home', teamScore: 4, opponentScore: 2 },
      nextEvent: NEXT_GAME,
    });
    const href = postgameDraftHref('/org/coaches/teams/t1', draft);
    const url = new URL(href, 'https://example.test');
    assert.equal(url.pathname, '/org/coaches/teams/t1/announcements');
    assert.equal(url.searchParams.get(DRAFT_SUBJECT_PARAM), draft.subject);
    assert.equal(url.searchParams.get(DRAFT_BODY_PARAM), draft.body);
  });
});
