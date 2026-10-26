import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COACH_PAGE_DAYS_AFTER_FINISH, coachPageOpenUntil, houseLeagueAccess, houseLeagueCoachAccess, type HouseLeagueCoachLink,
} from '../../lib/house-league-access.ts';
import type { EntitlementOrg } from '../../lib/module-entitlements.ts';
import type { OrgRole } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9c, PART 1 — THE GATE'S TWO NEW COLUMNS (rulings 9c·1, 9c·2a/b, owner 2026-10-26).
 *   1. RATINGS are the runners' alone: the registrar, the treasurer and a `coach` member read none, and nobody rates a
 *      finished season (its ratings are erased).
 *   2. A COACH is a row, not a role: they read their own team while they coach it, a quiet "gone" once removed, and
 *      nothing at all of a team they never coached — however the rows are passed in.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const CLUB: EntitlementOrg = { planId: 'club', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null };
const LIVE = { status: 'active' };
const DONE = { status: 'completed' };
const access = (role: OrgRole, season?: { status: string }) => houseLeagueAccess({ role, capabilities: null }, CLUB, season);

describe('1 · ratings: the people who run the league, and only them (9c·2a)', () => {
  for (const role of ['owner', 'admin', 'league_admin'] as const) {
    it(`${role} reads and rates on a live season`, () => {
      assert.equal(access(role, LIVE).seeRatings, true);
      assert.equal(access(role, LIVE).rate, true);
    });
    it(`${role} rates nothing on a finished season (9c·2b)`, () => assert.equal(access(role, DONE).rate, false));
  }
  for (const role of ['league_registrar', 'treasurer', 'coach', 'staff', 'official'] as const) {
    it(`${role} neither reads nor rates`, () => {
      assert.equal(access(role, LIVE).seeRatings, false);
      assert.equal(access(role, LIVE).rate, false);
    });
  }
  it('a club admin whose House league was switched off reads no rating', () => {
    assert.equal(houseLeagueAccess({ role: 'admin', capabilities: { module_house_league: false } }, CLUB, LIVE).seeRatings, false);
  });
});

describe('2 · the coach column: one person, one team (9c·1)', () => {
  const PAT = 'user-pat', SAM = 'user-sam';
  const JAYS = 'team-jays', CARDINALS = 'team-cardinals';
  const accepted = (userId: string, teamId: string, removedAt: string | null = null): HouseLeagueCoachLink =>
    ({ userId, teamId, acceptedAt: '2026-10-25T12:00:00Z', removedAt });
  const live = { status: 'active', finishedAt: null };

  it('a coach reads their own team', () => {
    assert.equal(houseLeagueCoachAccess([accepted(PAT, JAYS)], PAT, JAYS, live), 'open');
  });
  it('a coach of the Jays reads nothing of the Cardinals, even handed every link', () => {
    const links = [accepted(PAT, JAYS), accepted(SAM, CARDINALS)];
    assert.equal(houseLeagueCoachAccess(links, PAT, CARDINALS, live), 'none');
  });
  it("another person's link opens nothing for me", () => {
    assert.equal(houseLeagueCoachAccess([accepted(SAM, JAYS)], PAT, JAYS, live), 'none');
  });
  it('an invite not yet accepted opens nothing', () => {
    assert.equal(houseLeagueCoachAccess([{ userId: PAT, teamId: JAYS, acceptedAt: null, removedAt: null }], PAT, JAYS, live), 'none');
  });
  it('a removed coach is told they no longer coach the team, and reads no players', () => {
    assert.equal(houseLeagueCoachAccess([accepted(PAT, JAYS, '2026-11-01T00:00:00Z')], PAT, JAYS, live), 'gone');
  });
  it('removed then added again reads the team', () => {
    const links = [accepted(PAT, JAYS, '2026-11-01T00:00:00Z'), accepted(PAT, JAYS)];
    assert.equal(houseLeagueCoachAccess(links, PAT, JAYS, live), 'open');
  });
  it(`a finished season keeps the page ${COACH_PAGE_DAYS_AFTER_FINISH} days, then ends it`, () => {
    const finishedAt = '2026-11-01T00:00:00Z';
    const done = { status: 'completed', finishedAt };
    assert.equal(houseLeagueCoachAccess([accepted(PAT, JAYS)], PAT, JAYS, done, new Date('2026-11-20T00:00:00Z')), 'finished');
    assert.equal(houseLeagueCoachAccess([accepted(PAT, JAYS)], PAT, JAYS, done, new Date('2026-12-02T00:00:00Z')), 'ended');
    assert.equal(coachPageOpenUntil(finishedAt, new Date(finishedAt))?.toISOString(), '2026-12-01T00:00:00.000Z');
  });
  it('a finished season with no finish time closes the page rather than keeping it forever', () => {
    assert.equal(houseLeagueCoachAccess([accepted(PAT, JAYS)], PAT, JAYS, { status: 'archived', finishedAt: null }), 'ended');
  });
  it('a `coach` member gets nothing from the role gate: the column is the row, not the role', () => {
    const a = access('coach', LIVE);
    assert.deepEqual([a.read, a.run, a.register, a.email, a.seeRatings], [false, false, false, false, false]);
  });
});
