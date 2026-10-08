import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { hasCapability } from '../../lib/roles.ts';
import {
  canGate, canScore, isVolunteerJobChangeOnly, parseVolunteerJob, volunteerCapabilitiesFor, volunteerHome,
  volunteerJobOf, withVolunteerJob, VOLUNTEER_JOBS, type VolunteerJob,
} from '../../lib/volunteer-jobs.ts';
import { memberOpensSentence, roleLabel, roleOpensSentence } from '../../lib/member-access.ts';
import { HELPING_WITH, VOLUNTEER_OPENS, volunteerDuties } from '../../lib/volunteer-words.ts';

/**
 * A VOLUNTEER LANDS ON THE JOB THEY WERE GIVEN (Tournament admin redesign Stage 6, A26 + P1 + P2,
 * ruled 2026-10-07). The invite's "Helping with" writes the job as a subtractive override; every
 * landing without a link reads it through `volunteerHome`; a non-owner may switch the two job keys and
 * nothing else; a volunteer always keeps one job.
 */

const SLUG = 'club';
const read = (p: string) => readFileSync(p, 'utf8');

describe('the landing rule, every job', () => {
  const cases: [string, Record<string, boolean> | null, string][] = [
    ['both (the role default)', null, '/club/scorekeeper'],
    ['scoring only', { check_in_teams: false }, '/club/scorekeeper'],
    ['the gate only', { submit_scores: false }, '/club/check-in'],
    ['neither (an old hand-made override) — the scorekeeper, whose wall says why', { submit_scores: false, check_in_teams: false }, '/club/scorekeeper'],
    ['the gate through manage_registrations (an owner grant)', { submit_scores: false, check_in_teams: false, manage_registrations: true }, '/club/check-in'],
  ];
  for (const [name, caps, home] of cases) {
    it(name, () => assert.equal(volunteerHome(SLUG, 'official', caps), home));
  }
  it('staff keeps the resolver’s own landing (A25) — and every other role too', () => {
    for (const role of ['owner', 'admin', 'staff', 'treasurer', 'league_admin', 'league_registrar', 'coach'] as const) {
      assert.equal(volunteerHome(SLUG, role, null), null, role);
      assert.equal(volunteerHome(SLUG, role, { submit_scores: false }), null, `${role} narrowed`);
    }
  });
});

describe('a job is a subtractive override, never a grant', () => {
  it('the invite writes exactly the one key the job takes away', () => {
    assert.deepEqual(volunteerCapabilitiesFor('gate'), { submit_scores: false });
    assert.deepEqual(volunteerCapabilitiesFor('scoring'), { check_in_teams: false });
    assert.equal(volunteerCapabilitiesFor('both'), null);
  });
  it('no job ever writes a `true` (nothing beyond the role’s defaults)', () => {
    const befores: (Record<string, boolean> | null)[] = [null, { submit_scores: false }, { check_in_teams: false }, { manage_registrations: true }];
    for (const job of VOLUNTEER_JOBS) {
      for (const before of befores) {
        const after = withVolunteerJob(before, job) ?? {};
        assert.ok(!Object.entries(after).some(([k, v]) => v === true && k !== 'manage_registrations'), `${job} over ${JSON.stringify(before)}`);
      }
    }
  });
  it('each job reads back as itself, and the shells’ two questions agree', () => {
    for (const job of VOLUNTEER_JOBS) {
      const caps = volunteerCapabilitiesFor(job);
      assert.equal(volunteerJobOf(caps), job);
      assert.equal(canScore('official', caps), job !== 'gate');
      assert.equal(canGate('official', caps), job !== 'scoring');
      // …and the gate's / scorekeeper's own capability checks say the same.
      assert.equal(hasCapability('official', caps, 'submit_scores'), job !== 'gate');
    }
  });
  it('the job is the two job keys — an owner-granted manage_registrations opens the gate but is not a job', () => {
    const scoringPlusRegistrations = { check_in_teams: false, manage_registrations: true };
    assert.equal(volunteerJobOf(scoringPlusRegistrations), 'scoring', '"Helping with" reads Scoring, not Both');
    assert.equal(canGate('official', scoringPlusRegistrations), true, 'yet they can still open the gate');
    assert.equal(volunteerJobOf({ submit_scores: false, check_in_teams: false, manage_registrations: true }), null);
  });
  it('switching jobs keeps an owner’s other overrides untouched', () => {
    const before = { submit_scores: false, manage_registrations: true };
    assert.deepEqual(withVolunteerJob(before, 'both'), { manage_registrations: true });
    assert.deepEqual(withVolunteerJob(before, 'scoring'), { manage_registrations: true, check_in_teams: false });
  });
  it('the invite body’s Helping with: the old `scorekeeping` value still means scoring, anything else both', () => {
    assert.equal(parseVolunteerJob('scorekeeping'), 'scoring');
    assert.equal(parseVolunteerJob('scoring'), 'scoring');
    assert.equal(parseVolunteerJob('gate'), 'gate');
    assert.equal(parseVolunteerJob(undefined), 'both');
    assert.equal(parseVolunteerJob('admin'), 'both');
  });
});

describe('P1 — a non-owner may switch the two job keys, and nothing else', () => {
  it('a change in the two job keys only', () => {
    assert.ok(isVolunteerJobChangeOnly(null, { submit_scores: false }));
    assert.ok(isVolunteerJobChangeOnly({ submit_scores: false }, null));
    assert.ok(isVolunteerJobChangeOnly({ submit_scores: false, manage_registrations: true }, { check_in_teams: false, manage_registrations: true }));
  });
  it('any other key changing is refused', () => {
    assert.equal(isVolunteerJobChangeOnly(null, { manage_registrations: true }), false);
    assert.equal(isVolunteerJobChangeOnly({ manage_registrations: true }, null), false);
    assert.equal(isVolunteerJobChangeOnly(null, { submit_scores: false, module_tournaments: true }), false);
  });
});

describe('the member route holds P1 and P2, and the invite writes the job', () => {
  const patch = read('app/api/admin/members/[memberId]/route.ts');
  it('P1: a non-owner capability change must be a volunteer’s job change only', () => {
    assert.match(patch, /if \(hasCapabilitiesUpdate && ctx\.role !== 'owner'\) \{/);
    assert.match(patch, /resultingRole === 'official' && bodyCaps !== undefined\s*&& isVolunteerJobChangeOnly\(/);
    assert.doesNotMatch(patch, /if \(hasCapabilitiesUpdate && ctx\.role !== 'owner'\) return forbidden\(\);/);
  });
  it('P2: a volunteer left with no job is refused, before any write', () => {
    const start = patch.indexOf('export const PATCH');
    const p2 = patch.indexOf("code: 'volunteer_no_job'");
    assert.ok(p2 > start && start > 0);
    assert.ok(p2 < patch.indexOf('org_member_rep_group_scopes', start), 'P2 must run before the scope rows are written');
    assert.ok(p2 < patch.indexOf('.update(update)'), 'P2 must run before the row is written');
  });
  it('the invite writes `capabilities` on both of its inserts (and the coach-row upgrade)', () => {
    const invite = read('app/api/admin/members/invite/route.ts');
    assert.match(invite, /update\(\{ role, status: 'active', accepted_at: nowIso, capabilities \}\)/);
    assert.equal((invite.match(/^\s+capabilities,$/gm) ?? []).length, 2, 'both inserts carry the job');
    assert.match(invite, /const capabilities = job \? volunteerCapabilitiesFor\(job\) : null;/);
  });
  it('every landing without a link reads the one rule', () => {
    assert.match(read('lib/user-contexts.ts'), /volunteerHome\(slug, role, member\.capabilities\)/);
    assert.match(read('lib/user-contexts.ts'), /destination: officialHome\(slug, member\.capabilities\)/);
    assert.match(read('app/[orgSlug]/admin/layout.tsx'), /volunteerHome\(orgSlug, authCtx\.role, authCtx\.capabilities\)/);
    // The membership reads carry the column the rule needs.
    assert.match(read('lib/user-contexts.ts'), /select\('id, organization_id, role, capabilities, organizations\(/);
    assert.match(read('lib/invite-acceptance.ts'), /select\('id, organization_id, role, capabilities, organizations!inner\(/);
    // Nothing sends every official to the scorekeeper by role alone any more.
    assert.doesNotMatch(read('lib/user-contexts.ts'), /role === 'official'\) \{\s*return `\/\$\{slug\}\/scorekeeper`/);
    assert.doesNotMatch(read('app/[orgSlug]/admin/layout.tsx'), /redirect\(`\/\$\{orgSlug\}\/scorekeeper`\)/);
  });
});

describe('the words', () => {
  it('the role is "Volunteer"; the jobs keep their own names', () => {
    assert.equal(roleLabel('official'), 'Volunteer');
    assert.deepEqual(volunteerDuties('both'), ['Scorekeeper', 'Gate']);
    assert.deepEqual(volunteerDuties('gate'), ['Gate']);
    assert.deepEqual(volunteerDuties(null), []);
  });
  it('the accept page names the job once it is known', () => {
    for (const job of VOLUNTEER_JOBS as readonly VolunteerJob[]) {
      assert.equal(memberOpensSentence('official', volunteerCapabilitiesFor(job)), VOLUNTEER_OPENS[job]);
    }
    assert.equal(memberOpensSentence('official', { submit_scores: false, check_in_teams: false }), roleOpensSentence('official'));
    assert.equal(memberOpensSentence('staff', { submit_scores: false }), roleOpensSentence('staff'));
  });
  it('Helping with: Scoring · The gate · Both, in that order', () => {
    assert.deepEqual(VOLUNTEER_JOBS.map(j => HELPING_WITH.option[j]), ['Scoring', 'The gate', 'Both']);
  });
});
