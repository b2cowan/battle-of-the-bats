import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ROLE_DEFAULTS, ALL_CAPABILITY_KEYS, hasCapability, type Capability } from '../../lib/roles.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import type { OrgRole } from '../../lib/types.ts';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE FAMILIES CAPABILITY'S STANDING INVARIANTS (owner decisions 2026-08-17,
 * CLUB_FAMILIES_BOOK_PLAN.md §1.2 + §5.3)
 *
 * The Families area concentrates every household's contact details, consent and balances on
 * one searchable screen. Two rulings hold it shut, and both are the kind of thing a later
 * "cleanup" would loosen without noticing:
 *
 *   1. **OFF BY DEFAULT FOR EVERY ROLE.** No role — not even admin — carries module_families
 *      in its defaults. The only ways in are the owner short-circuit and an explicit
 *      per-member Grant in the members screen. Adding it to a role's defaults is an owner
 *      decision, and this file is where that change is forced to announce itself.
 *
 *   2. **LEAGUE PLUS AND CLUB BANDS ONLY.** Households exist where a club runs several teams.
 *      Tournament tiers and the standalone Premium Coaches Portal must not gain the module by
 *      a careless entitlement edit.
 *
 *   3. **NEVER A MEMBER LIMITED TO A GROUP OF TEAMS** (Club Tier Stage 5a, Ask 12, owner 2026-10-17). A household spans
 *      teams, so a family's record would show a limited member other teams' children. Refused at every Families route
 *      AND at the Members grant — in both directions (granting it to a limited member; limiting a member who holds it).
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

describe('Families capability — off by default for every role', () => {
  it('module_families is a real capability key', () => {
    assert.ok(ALL_CAPABILITY_KEYS.includes('module_families'));
  });

  it('NO role default grants module_families — not even admin', () => {
    for (const [role, caps] of Object.entries(ROLE_DEFAULTS)) {
      assert.ok(
        !caps.has('module_families' as Capability),
        `ROLE_DEFAULTS['${role}'] grants module_families — that reverses the owner's off-by-default ruling (plan §1.2). ` +
        'If this is deliberate, it needs an owner decision recorded in the plan, not just this test edited.',
      );
    }
  });

  it('the owner short-circuit still holds (owners always see the area)', () => {
    assert.equal(hasCapability('owner' as OrgRole, null, 'module_families'), true);
  });

  it('an explicit Grant opens it for an admin; absence keeps it shut', () => {
    assert.equal(hasCapability('admin' as OrgRole, null, 'module_families'), false);
    assert.equal(hasCapability('admin' as OrgRole, { module_families: true }, 'module_families'), true);
    assert.equal(hasCapability('admin' as OrgRole, { module_families: false }, 'module_families'), false);
  });
});

describe('Families module — League Plus and Club bands only', () => {
  const has = (plan: string) =>
    PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG].moduleEntitlements.includes('module_families');

  it('league, club, club_large carry module_families', () => {
    assert.equal(has('league'), true);
    assert.equal(has('club'), true);
    assert.equal(has('club_large'), true);
  });

  it('tournament tiers and the standalone coaches portal do NOT', () => {
    assert.equal(has('tournament'), false);
    assert.equal(has('tournament_plus'), false);
    assert.equal(has('team'), false);
  });
});

describe('Families — never a member limited to a group of teams (Ask 12)', () => {
  it('the route gate refuses a team-limited member, in words', () => {
    const src = readCode('lib/families-auth.ts');
    assert.match(src, /if \(ctx\.repGroupIds\) \{\s*return \{ failure:/);
    assert.match(src, /FAMILIES_GRANT_REFUSAL/);
  });
  it('the Members write path refuses the grant (both directions), in words', () => {
    const src = readCode('app/api/admin/members/[memberId]/route.ts');
    assert.match(src, /hasCapability\(resultingRole, resultingCaps, 'module_families'\)/);
    assert.match(src, /code: 'families_team_limited'/);
    assert.match(src, /org_member_rep_group_scopes/);
  });
});
