/**
 * "Your team, in your own tournament" — the invariants that hold it together
 * (COACH_HOST_OWN_TEAM_ENTRY_PLAN.md; owner rulings 2026-09-13).
 *
 *  1. THE RECORD FOLLOWS THE LIST (Part D). Every coach-side reader of a tournament registration
 *     authorizes through the one guard that knows both answers — free-team membership, then a
 *     configuring coaching assignment on a rep team the registration belongs to. A route that
 *     goes back to reading the membership bridge directly re-opens the 404-from-the-list defect
 *     (W1/W2) for exactly the people who could see the row.
 *  2. THE ORGANIZER NEVER PICKS ANOTHER CLUB'S TEAM (the rejected directory). The "Add my team"
 *     write takes NO team identifier from the request — the team is resolved server-side from the
 *     org's own workspace — and the coach-account lookup answers a bare yes/no, never a name, a
 *     team or an org.
 *  3. EVERY PAID PORTAL CARRIES A FREE-TEAM SHADOW (Part C). Provisioning mints it and the UAT
 *     fixture mirrors provisioning; a from-scratch workspace with no shadow is the F04 defect.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('the record follows the list', () => {
  const guard = read('lib', 'coach-team-guard.ts');
  it('the registration guard carries the second answer (coaching assignment on the rep team)', () => {
    assert.match(guard, /findRepTeamAccessForRegistration\(/);
    assert.match(guard, /via: 'assignment'/);
  });

  const readers = [
    join('app', 'api', 'coaches', 'tournaments', '[teamId]', 'route.ts'),
    join('app', 'api', 'coaches', 'tournaments', '[teamId]', 'roster', 'route.ts'),
  ];
  for (const rel of readers) {
    it(`${rel} authorizes through requireCoachRegistrationAccess and never reads the membership bridge itself`, () => {
      const src = read(rel);
      assert.match(src, /requireCoachRegistrationAccess\(/);
      assert.doesNotMatch(src, /findLinkedBasicTeamForRegistration|canUserAccessTournamentRegistration/);
    });
  }

  it('the shared record falls back to the assignment right after the membership check', () => {
    const src = read('components', 'coaches', 'CoachTournamentRecord.tsx');
    assert.match(src, /findRepTeamAccessForRegistration\(userId, registrationId\)/);
  });

  it('the Premium record page proves the registration belongs to THIS rep team', () => {
    const src = read('app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'tournaments', '[registrationId]', 'page.tsx');
    assert.match(src, /registrationBelongsToRepTeam\(registrationId, teamId\)/);
  });
});

describe('the organizer never picks another club\'s team', () => {
  it('the Add my team write takes no team identifier from the request', () => {
    const src = read('app', 'api', 'admin', 'teams', 'own-team', 'route.ts');
    const bodyShape = src.match(/as \{([^}]*)\}/)?.[1] ?? '';
    assert.ok(bodyShape.includes('tournamentId') && bodyShape.includes('divisionId'), 'body shape is parsed explicitly');
    assert.doesNotMatch(bodyShape, /teamId|repTeamId|basicCoachTeamId|teamName/);
  });

  it('the host team is resolved from the org\'s own workspace, never from input', () => {
    const src = read('lib', 'host-own-team.ts');
    assert.match(src, /getTeamWorkspaceForOrg\(org\.id\)/);
    assert.match(src, /isTeamWorkspaceOrg\(org\)/);
  });

  it('the coach-account lookup answers only a yes/no', () => {
    const src = read('app', 'api', 'admin', 'teams', 'coach-account', 'route.ts');
    const responses = [...src.matchAll(/json\(\{([^}]*)\}/g)].map(m => m[1]);
    assert.ok(responses.length > 0);
    for (const body of responses) {
      assert.match(body, /exists/);
      assert.doesNotMatch(body, /name|team|org/);
    }
  });

  it('the Teams page keeps the rep-team picker behind the module gate (no cross-org list for a portal)', () => {
    const src = read('app', '[orgSlug]', 'admin', 'tournaments', 'registrations', 'page.tsx');
    assert.match(src, /\{orgHasRepTeams && renderRepLinkControl\(/);
  });
});

describe('every paid portal carries a free-team shadow', () => {
  it('provisioning mints the shadow when neither an upgrade nor a claim supplied one', () => {
    const src = read('lib', 'team-workspace-provisioning.ts');
    assert.match(src, /if \(!basicCoachTeamId\) \{[\s\S]*?resolveBasicCoachTeamIdForWorkspace\(/);
  });

  it('the resolver creates rather than giving up', () => {
    const src = read('lib', 'basic-coach-teams.ts');
    assert.match(src, /return await createWorkspaceShadowBasicCoachTeam\(teamWorkspace\)/);
  });

  it('the UAT standalone fixture mirrors provisioning', () => {
    const src = read('scripts', 'seed-uat-standalone-coach.mjs');
    assert.match(src, /insert into basic_coach_teams/);
    assert.match(src, /set basic_coach_team_id = /);
  });
});
