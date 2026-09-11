/**
 * R5 (owner, 2026-09-11): "a player holds a given award ONCE PER OCCASION." This pins the pure
 * predicate both award routes refuse a collision against — see `lib/rep-award-occasion.ts`'s own
 * header for why the DB-level check (a SQL filter, in `findRepPlayerAwardCollision`) can't
 * literally share this function and must be kept in sync by hand.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sameAwardOccasion, describeAwardOccasion, type AwardOccasion } from '../../lib/rep-award-occasion.ts';

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
    assert.equal(describeAwardOccasion(game1), 'for this game');
  });

  it('names a general award\'s label', () => {
    assert.equal(describeAwardOccasion(generalLabelled), 'for Milton Classic');
  });

  it('falls back to "already" for an unlabelled general award', () => {
    assert.equal(describeAwardOccasion(generalSameDateNoLabel1), 'already');
  });
});
