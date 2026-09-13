import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_PRESETS, STAFF_KINDS, STAFF_KIND_COPY, ASSISTANT_DEFAULTS, resolveCoachCapabilities, sanitizeAssistantGrants,
  grantsOf, applyOrgGrantPolicy, staffKindCopyFor,
} from '../../lib/coach-capabilities.ts';
import { SENSITIVE_KEYS, delegationViolation, clampForDelegate } from '../../lib/coach-staff-delegation.ts';
import { GRANT_LABELS } from '../../lib/coach-staff-labels.ts';
import {
  TOURNAMENT_BUNDLE, TOURNAMENT_GRANT_KEY, readTournamentGrant, applyTournamentGrant,
} from '../../lib/coach-tournament-grant.ts';
import { ROLE_DEFAULTS, hasCapability } from '../../lib/roles.ts';
import { TOURNAMENT_PLUS_ACQUISITION_SOURCES } from '../../lib/tournament-plus-analytics.ts';

/**
 * Run tournaments, delegated (owner ruling 2026-09-13) — the grant, the Manager preset, the
 * bundle it projects onto the workspace membership, and the walls around it. Plan:
 * `COACH_TOURNAMENT_DELEGATION_PLAN.md` §2.1. A failure is a model change, and the fix is a
 * decision, not a new expectation.
 */

describe('the Run tournaments grant', () => {
  it('is off by default, on for a head coach, and resolves from a stored bundle', () => {
    assert.equal(ASSISTANT_DEFAULTS.tournaments, false);
    assert.equal(resolveCoachCapabilities('head_coach').tournaments, true);
    assert.equal(resolveCoachCapabilities('assistant_coach', { schedule: true }).tournaments, false, 'a bundle stored before the key existed reads OFF');
    assert.equal(resolveCoachCapabilities('assistant_coach', { tournaments: true }).tournaments, true);
    // A head coach's stored grants are ignored — the switch is not theirs to turn off.
    assert.equal(resolveCoachCapabilities('head_coach', { tournaments: false }).tournaments, true);
  });

  it('is ON in the Team manager preset and OFF in every other kind', () => {
    for (const kind of STAFF_KINDS) {
      assert.equal(STAFF_PRESETS[kind].tournaments, kind === 'manager', `${kind}`);
    }
  });

  it('is promised by the manager invite email in a WORKSPACE, and not in a club — the copy follows the policy', () => {
    const ws = staffKindCopyFor('manager', { isTeamWorkspace: true });
    assert.match(ws.emailWhat, /tournaments/);
    assert.match(ws.sentence, /tournaments/);
    const club = staffKindCopyFor('manager', { isTeamWorkspace: false });
    assert.doesNotMatch(club.emailWhat, /tournament/, 'a club manager never holds it (applyOrgGrantPolicy), so the email must not promise it');
    assert.doesNotMatch(club.sentence, /tournament/);
    assert.equal(club, STAFF_KIND_COPY.manager, 'the bare table is the club-true base');
    for (const kind of STAFF_KINDS) {
      if (kind !== 'manager') assert.equal(staffKindCopyFor(kind, { isTeamWorkspace: true }), STAFF_KIND_COPY[kind], `${kind} is the same everywhere`);
      assert.doesNotMatch(STAFF_KIND_COPY[kind].emailWhat, /tournament/, `${kind}'s base copy must not promise what a club withholds`);
    }
  });

  it('survives sanitising and the stored-bundle round trip', () => {
    assert.deepEqual(sanitizeAssistantGrants({ tournaments: true }), { tournaments: true });
    assert.deepEqual(sanitizeAssistantGrants({ tournaments: 'yes' }), {}, 'a non-boolean is dropped, not coerced');
    assert.equal(grantsOf(resolveCoachCapabilities('assistant_coach', { tournaments: true })).tournaments, true);
  });

  it('has a label, so a refusal can name the control', () => {
    assert.equal(GRANT_LABELS.tournaments, 'Run tournaments');
  });
});

describe('the ceiling — a delegate hands out only what they hold (D3)', () => {
  const manager = (g?: Record<string, unknown>) => resolveCoachCapabilities('assistant_coach', { ...STAFF_PRESETS.manager, ...(g ?? {}) });
  const cur = grantsOf(resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.assistant));

  it('is a Sensitive key, so the ceiling checks it', () => {
    assert.ok(SENSITIVE_KEYS.includes('tournaments'));
  });

  it('a manager who holds it may hand it out; one who does not is refused by name', () => {
    assert.equal(delegationViolation(manager(), cur, { ...cur, tournaments: true }), null);
    assert.deepEqual(
      delegationViolation(manager({ tournaments: false }), cur, { ...cur, tournaments: true }),
      { key: 'tournaments', reason: 'above_ceiling' },
    );
  });

  it('a preset applied by a manager without it is clamped, not refused', () => {
    const { grants, clamped } = clampForDelegate(manager({ tournaments: false }), null, grantsOf(resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.manager)));
    assert.equal(grants.tournaments, false);
    assert.ok(clamped.includes('tournaments'));
  });
});

describe('Premium workspaces only (D2)', () => {
  it('a club writes the key off — a client bundle or the manager preset alike', () => {
    assert.equal(applyOrgGrantPolicy({ ...STAFF_PRESETS.manager }, { isTeamWorkspace: false }).tournaments, false);
    assert.equal(applyOrgGrantPolicy({ tournaments: true }, { isTeamWorkspace: false }).tournaments, false);
    assert.equal(applyOrgGrantPolicy({ ...STAFF_PRESETS.manager }, { isTeamWorkspace: true }).tournaments, true);
  });

  it('returns the same object when there is nothing to change, so nothing is rewritten', () => {
    const g = { schedule: true };
    assert.equal(applyOrgGrantPolicy(g, { isTeamWorkspace: false }), g);
    const m = { ...STAFF_PRESETS.manager };
    assert.equal(applyOrgGrantPolicy(m, { isTeamWorkspace: true }), m);
  });
});

describe('the bundle — what the grant means on the admin side', () => {
  it('is the tournament module, every tournament action, and the look — never members, settings or billing', () => {
    assert.ok(TOURNAMENT_BUNDLE.includes('module_tournaments'));
    assert.ok(TOURNAMENT_BUNDLE.includes(TOURNAMENT_GRANT_KEY));
    assert.ok(TOURNAMENT_BUNDLE.includes('manage_branding'), 'D4: the tournament\'s look-and-feel is "everything on that page"');
    for (const never of ['manage_members', 'org_settings', 'billing', 'module_members', 'module_accounting', 'module_rep_teams', 'module_families'] as const) {
      assert.ok(!TOURNAMENT_BUNDLE.includes(never), `${never} must never ride the bundle`);
    }
  });

  it('turns a rights-less coach into someone every tournament route admits, and back', () => {
    assert.equal(ROLE_DEFAULTS.coach.size, 0, 'the coach role carries nothing (J4-005) — the bundle is the ONLY way in');
    const on = applyTournamentGrant(null, true);
    assert.equal(readTournamentGrant(on), true);
    for (const cap of TOURNAMENT_BUNDLE) assert.equal(hasCapability('coach', on, cap), true, cap);
    assert.equal(hasCapability('coach', on, 'manage_members'), false);
    assert.equal(hasCapability('coach', on, 'billing'), false);
    const off = applyTournamentGrant(on, false);
    assert.equal(off, null, 'nothing but the bundle was set, so the map empties');
    assert.equal(readTournamentGrant(off), false);
    assert.equal(hasCapability('coach', off, TOURNAMENT_GRANT_KEY), false);
  });

  it('never touches keys outside the bundle, and a partial hand-set map reads as OFF', () => {
    const admin = { module_families: true, create_tournaments: false };
    const on = applyTournamentGrant(admin, true);
    assert.equal(on?.module_families, true);
    assert.equal(readTournamentGrant(on), true);
    const off = applyTournamentGrant(on, false);
    assert.deepEqual(off, { module_families: true });
    assert.equal(readTournamentGrant({ submit_scores: true }), false, 'a partial map is not the grant');
  });

  it('returns the same object when nothing would change, so the projection can skip the write', () => {
    const on = applyTournamentGrant(null, true);
    assert.equal(applyTournamentGrant(on, true), on);
    assert.equal(applyTournamentGrant(null, false), null);
    const other = { module_families: true };
    assert.equal(applyTournamentGrant(other, false), other);
  });
});

describe('the section that replaced the banner', () => {
  it('has its own acquisition source, and the retired banner\'s stays for the rows already written', () => {
    assert.ok(TOURNAMENT_PLUS_ACQUISITION_SOURCES.includes('coach_portal_tournaments'));
    assert.ok(TOURNAMENT_PLUS_ACQUISITION_SOURCES.includes('coach_portal_banner'));
  });
});
