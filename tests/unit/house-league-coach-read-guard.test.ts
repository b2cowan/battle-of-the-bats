import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9c — A HOUSE-LEAGUE COACH READS THEIR OWN TEAM, AND ONLY THAT (rulings 9c·1, 9c·9).
 *   1. The player read names its columns: players and guardian name, email and phone. No fee, note, date of birth,
 *      status history or money; a rating is held off by the ratings guard.
 *   2. It filters on the team the access check approved, for accepted players only, and a page reads no player before
 *      the check answers.
 *   3. 9c adds nothing to the Coaches Portal: no house-league coach code lives under it, and the coach module never
 *      creates a club membership.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const COACH = 'lib/house-league-coach.ts';

describe('1 · the columns a coach reads (9c·9)', () => {
  const code = readCode(COACH);
  const cols = /COACH_PLAYER_COLUMNS\s*=\s*\n?\s*'([^']+)'/.exec(code)?.[1];
  it('are exactly the player and their guardian contact', () => {
    assert.ok(cols, 'COACH_PLAYER_COLUMNS is gone');
    assert.deepEqual(cols!.split(',').map(c => c.trim()).sort(), [
      'guardian_email', 'guardian_first_name', 'guardian_last_name', 'guardian_phone', 'id', 'player_first_name', 'player_last_name',
    ]);
  });
  it('the registration table is read only through those columns', () => {
    const reads = [...code.matchAll(/from\('league_registrations'\)\s*\.select\(([^)]*)\)/g)].map(m => m[1].trim());
    assert.deepEqual(reads, ['COACH_PLAYER_COLUMNS']);
  });
});

describe('2 · the team the check approved, accepted players only', () => {
  const code = readCode(COACH);
  it('the player read filters on the team and on accepted', () => {
    const body = functionBody(code, 'readTeamPlayers');
    assert.match(body, /\.eq\('team_id', teamId\)/);
    assert.match(body, /\.eq\('status', 'active'\)/);
  });
  it('the page reads its link for THIS person and THIS team before anything else, and stops at none', () => {
    const body = functionBody(code, 'readCoachTeamPage');
    const link = body.indexOf(".eq('user_id', userId).eq('team_id', teamId)");
    const check = body.indexOf("if (view === 'none') return null");
    const players = body.indexOf('readTeamPlayers(teamId)');
    assert.ok(link >= 0 && check > link && players > check, 'the read order changed');
    assert.match(body, /view === 'open' \|\| view === 'finished' \? readTeamPlayers/);
  });
  it("a team of another club is refused by the URL's club", () => {
    assert.match(functionBody(code, 'readCoachTeamPage'), /card\.orgSlug !== orgSlug\) return null/);
  });
});

describe('3 · nothing in the Coaches Portal (9c·1; CLAUDE.md: 9c adds no branch to the portal)', () => {
  it('no portal file names the house-league coach table or module', () => {
    const portal = [...filesUnder('app/[orgSlug]/coaches', '.tsx'), ...filesUnder('app/[orgSlug]/coaches', '.ts'),
      ...filesUnder('components/coaches', '.tsx'), ...filesUnder('app/api/coaches', '.ts')];
    const leaking = portal.filter(f => /league_team_coaches|house-league-coach/.test(readCode(f)));
    assert.deepEqual(leaking, []);
  });
  it('the coach module creates no club membership', () => {
    assert.doesNotMatch(readCode(COACH), /organization_members/);
  });
});
