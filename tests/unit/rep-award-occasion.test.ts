/**
 * R5 (owner, 2026-09-11): "a player holds a given award ONCE PER OCCASION." This pins the pure
 * predicate both award routes refuse a collision against — see `lib/rep-award-occasion.ts`'s own
 * header for why the DB-level check (a SQL filter, in `findRepPlayerAwardCollision`) can't
 * literally share this function and must be kept in sync by hand.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  sameAwardOccasion,
  describeAwardOccasion,
  describeDatedAwardOccasion,
  awardOccasionLabel,
  awardEventKind,
  awardUnlockState,
  type AwardOccasion,
} from '../../lib/rep-award-occasion.ts';

const game1: AwardOccasion = { eventId: 'evt-1', tournamentLabel: null, awardedAt: '2026-04-16' };
const game1Again: AwardOccasion = { eventId: 'evt-1', tournamentLabel: null, awardedAt: '2026-04-16' };
const game2: AwardOccasion = { eventId: 'evt-2', tournamentLabel: null, awardedAt: '2026-04-23' };
const generalLabelled: AwardOccasion = { eventId: null, tournamentLabel: 'Milton Classic', awardedAt: '2026-06-02' };
const generalLabelledAgain: AwardOccasion = { eventId: null, tournamentLabel: 'Milton Classic', awardedAt: '2026-06-02' };
const generalDifferentLabel: AwardOccasion = { eventId: null, tournamentLabel: 'Provincials', awardedAt: '2026-06-02' };
const generalSameDateNoLabel1: AwardOccasion = { eventId: null, tournamentLabel: null, awardedAt: '2026-05-01' };
const generalSameDateNoLabel2: AwardOccasion = { eventId: null, tournamentLabel: null, awardedAt: '2026-05-01' };
const generalDifferentDateNoLabel: AwardOccasion = { eventId: null, tournamentLabel: null, awardedAt: '2026-05-02' };

describe('sameAwardOccasion', () => {
  it('collides on the same game', () => {
    assert.equal(sameAwardOccasion(game1, game1Again), true);
  });

  it('never collides across different games', () => {
    assert.equal(sameAwardOccasion(game1, game2), false);
  });

  it('a general award collides with the same date + label', () => {
    assert.equal(sameAwardOccasion(generalLabelled, generalLabelledAgain), true);
  });

  it('a general award does NOT collide on the same date with a different label', () => {
    assert.equal(sameAwardOccasion(generalLabelled, generalDifferentLabel), false);
  });

  it('two unlabelled general awards on the same date DO collide — NULL is not a wildcard here', () => {
    assert.equal(sameAwardOccasion(generalSameDateNoLabel1, generalSameDateNoLabel2), true);
  });

  it('two unlabelled general awards on different dates do not collide', () => {
    assert.equal(sameAwardOccasion(generalSameDateNoLabel1, generalDifferentDateNoLabel), false);
  });

  it('a game-linked award never collides with a general award, even dated the same day', () => {
    const generalSameDayAsGame1: AwardOccasion = { eventId: null, tournamentLabel: null, awardedAt: game1.awardedAt };
    assert.equal(sameAwardOccasion(game1, generalSameDayAsGame1), false);
  });

  it('is symmetric', () => {
    assert.equal(sameAwardOccasion(generalLabelled, generalDifferentLabel), sameAwardOccasion(generalDifferentLabel, generalLabelled));
  });
});

describe('describeAwardOccasion', () => {
  it('names the game', () => {
    assert.equal(describeAwardOccasion(game1, 'league_game'), 'for this game');
    assert.equal(describeAwardOccasion(game1, 'tournament_game'), 'for this game');
  });

  it('names a general award\'s label', () => {
    assert.equal(describeAwardOccasion(generalLabelled), 'for Milton Classic');
  });

  it('falls back to "already" for an unlabelled general award', () => {
    assert.equal(describeAwardOccasion(generalSameDateNoLabel1), 'already');
  });
});

/**
 * Awards at any event (owner, 2026-09-25): an award can be tied to a practice, a team event or a
 * whole tournament as well as a game. Every sentence and label used to assume a game — a practice
 * award would have read "General" on the report and "vs opponent" in its edit form.
 */
describe('awards at any event — the kind an event reads as', () => {
  it('reads both game types as a game, and each other type as itself', () => {
    assert.equal(awardEventKind('league_game'), 'game');
    assert.equal(awardEventKind('tournament_game'), 'game');
    assert.equal(awardEventKind('practice'), 'practice');
    assert.equal(awardEventKind('external_tournament'), 'tournament');
    assert.equal(awardEventKind('team_event'), 'event');
  });

  it('never reads an unknown or missing type as a game', () => {
    assert.equal(awardEventKind(null), 'event');
    assert.equal(awardEventKind(undefined), 'event');
    assert.equal(awardEventKind('something_new'), 'event');
  });
});

describe("describeAwardOccasion — the refusal names the event's kind", () => {
  it('says practice, tournament or event — never "game" for them', () => {
    assert.equal(describeAwardOccasion(game1, 'practice'), 'for this practice');
    assert.equal(describeAwardOccasion(game1, 'external_tournament'), 'for this tournament');
    assert.equal(describeAwardOccasion(game1, 'team_event'), 'for this event');
  });

  it('falls back to "this event", not "this game", when the type is unknown', () => {
    assert.equal(describeAwardOccasion(game1), 'for this event');
  });
});

describe('awardOccasionLabel — what the report and the Give form say an award was for', () => {
  const ev = (eventType: string, name: string, opponent: string | null = null) => ({ eventType, name, opponent });

  it('reads a game by its opponent', () => {
    assert.equal(awardOccasionLabel(ev('league_game', 'vs Oakville', 'Oakville A’s'), null), 'vs Oakville A’s');
    assert.equal(awardOccasionLabel(ev('tournament_game', 'Pool game 2', 'Lady Jays'), null), 'vs Lady Jays');
  });

  it('reads an opponent-less game by its name, never "vs opponent"', () => {
    assert.equal(awardOccasionLabel(ev('tournament_game', 'Semi-final'), null), 'Semi-final');
  });

  it('reads every other event by the name the schedule shows', () => {
    assert.equal(awardOccasionLabel(ev('practice', 'Practice'), null), 'Practice');
    assert.equal(awardOccasionLabel(ev('practice', 'Batting cages'), null), 'Batting cages');
    assert.equal(awardOccasionLabel(ev('team_event', 'Team pizza night'), null), 'Team pizza night');
    assert.equal(awardOccasionLabel(ev('external_tournament', 'Sherwood Park Invitational'), null), 'Sherwood Park Invitational');
  });

  it('never calls an event-linked award "General"', () => {
    for (const type of ['league_game', 'tournament_game', 'practice', 'team_event', 'external_tournament']) {
      assert.notEqual(awardOccasionLabel(ev(type, 'Something'), null), 'General');
    }
  });

  it('reads an award tied to no event by its typed label, or "General"', () => {
    assert.equal(awardOccasionLabel(null, 'Milton Classic'), 'Milton Classic');
    assert.equal(awardOccasionLabel(null, null), 'General');
  });
});

describe("describeDatedAwardOccasion — the merge preview's sentence", () => {
  const linked = { eventId: 'evt-1', tournamentLabel: null };

  it('reads a game and a practice by date, a tournament and a team event by name', () => {
    assert.equal(describeDatedAwardOccasion(linked, { eventType: 'league_game', name: 'x' }, 'Sep 21'), 'for the Sep 21 game');
    assert.equal(describeDatedAwardOccasion(linked, { eventType: 'practice', name: 'Practice' }, 'Sep 21'), 'for the Sep 21 practice');
    assert.equal(describeDatedAwardOccasion(linked, { eventType: 'team_event', name: 'Team pizza night' }, 'Sep 12'), 'for Team pizza night');
    assert.equal(describeDatedAwardOccasion(linked, { eventType: 'external_tournament', name: 'Sherwood Park Invitational' }, 'Sep 5'), 'for Sherwood Park Invitational');
  });

  it('reads an event it could not resolve as "the <date> event", not a game', () => {
    assert.equal(describeDatedAwardOccasion(linked, null, 'Sep 21'), 'for the Sep 21 event');
  });

  it('keeps the no-event wording', () => {
    assert.equal(describeDatedAwardOccasion({ eventId: null, tournamentLabel: 'Milton Classic' }, null, 'Aug 30'), 'for Milton Classic');
    assert.equal(describeDatedAwardOccasion({ eventId: null, tournamentLabel: null }, null, 'Aug 30'), 'for Aug 30');
  });
});

describe('awardUnlockState — when an event can carry an award (R1 + R2, 2026-09-25)', () => {
  const START = '2026-09-21T22:00:00+00:00';
  const startMs = Date.parse(START);
  const event = (eventType: string, extra: Partial<{ status: string; teamScore: number | null; opponentScore: number | null; startsAt: string }> = {}) => ({
    eventType, status: 'scheduled', startsAt: START, teamScore: null as number | null, opponentScore: null as number | null, ...extra,
  });

  it('a game waits for its final score, however long ago it started — unchanged', () => {
    assert.equal(awardUnlockState(event('league_game'), startMs + 86_400_000), 'needs-score');
    assert.equal(awardUnlockState(event('league_game', { teamScore: 5 }), startMs + 86_400_000), 'needs-score');
    assert.equal(awardUnlockState(event('league_game', { teamScore: 5, opponentScore: 3 }), startMs + 1), 'open');
    assert.equal(awardUnlockState(event('tournament_game', { teamScore: 0, opponentScore: 0 }), startMs + 1), 'open');
  });

  it('every other event opens at its start time — not a minute before', () => {
    for (const type of ['practice', 'team_event', 'external_tournament']) {
      assert.equal(awardUnlockState(event(type), startMs - 60_000), 'not-started', type);
      assert.equal(awardUnlockState(event(type), startMs), 'open', type);
      assert.equal(awardUnlockState(event(type), startMs + 7_200_000), 'open', type);
    }
  });

  it('a cancelled event never carries one, game or not', () => {
    assert.equal(awardUnlockState(event('practice', { status: 'cancelled' }), startMs + 1), 'cancelled');
    assert.equal(awardUnlockState(event('league_game', { status: 'cancelled', teamScore: 1, opponentScore: 0 }), startMs + 1), 'cancelled');
  });

  it('an unreadable start time never opens a non-game early', () => {
    assert.equal(awardUnlockState(event('practice', { startsAt: 'not a date' }), startMs), 'not-started');
  });
});
