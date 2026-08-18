import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ROLE_DEFAULTS, ALL_CAPABILITY_KEYS, hasCapability, type Capability } from '../../lib/roles.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import type { OrgRole } from '../../lib/types.ts';

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
