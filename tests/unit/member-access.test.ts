import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_CAPABILITY_KEYS, hasCapability, type Capability } from '../../lib/roles.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { hasModuleEntitlement, type EntitlementOrg } from '../../lib/module-entitlements.ts';
import {
  canOpenModule, whatTheyCanOpen, MEMBER_PROGRAMS, OWNER_ONLY_CAPABILITIES, isOwnerOnlyCapability,
  memberSection, roleLabel, roleEmailLabel, roleOpensSentence, ROLE_LABEL, describeAccessChange,
} from '../../lib/member-access.ts';
import type { OrgPlan, OrgRole } from '../../lib/types.ts';

/**
 * "WHAT THEY CAN OPEN" IS ONE COMPUTATION (Club Tier Stage 1, A13 / J10-024).
 *
 * The Members screen shows, per person, which programs they can open; the server decides it on
 * every request. If those two ever computed it differently, the screen would tell an owner that
 * someone can open Accounting while the server refused them — the defect class this project exists
 * to remove. This file proves they cannot disagree: across every role × every plan × every
 * override shape × cancelled or not, each row's `canOpen` equals the gate's own answer.
 */

const ROLES = Object.keys(ROLE_LABEL) as OrgRole[];
const PLANS = Object.keys(PLAN_CONFIG) as OrgPlan[];
const OVERRIDE_SHAPES: (Record<string, boolean> | null)[] = [
  null,
  {},
  { module_families: true },
  { module_accounting: false },
  { module_rep_teams: true, module_accounting: false },
  { module_public_site: false, module_house_league: true, module_tournaments: false },
];

function orgs(plan: OrgPlan): EntitlementOrg[] {
  return [
    { planId: plan, subscriptionStatus: 'active', enabledAddons: [], freeFloor: null },
    { planId: plan, subscriptionStatus: 'canceled', enabledAddons: [], freeFloor: null },
    { planId: plan, subscriptionStatus: 'active', enabledAddons: ['module_rep_teams'], freeFloor: null },
  ];
}

describe('canOpenModule is exactly the gate every route asks', () => {
  it('equals hasCapability && hasModuleEntitlement for every role, plan, override and program', () => {
    for (const role of ROLES) for (const plan of PLANS) for (const org of orgs(plan)) {
      for (const capabilities of OVERRIDE_SHAPES) {
        for (const { module } of MEMBER_PROGRAMS) {
          assert.equal(
            canOpenModule({ role, capabilities }, org, module),
            hasCapability(role, capabilities, module) && hasModuleEntitlement(org, module),
            `${role} / ${plan} / ${org.subscriptionStatus} / ${JSON.stringify(capabilities)} / ${module}`,
          );
        }
      }
    }
  });
});

describe('whatTheyCanOpen — the screen can never disagree with the gate', () => {
  it('every row’s canOpen is canOpenModule, for every combination', () => {
    for (const role of ROLES) for (const plan of PLANS) for (const org of orgs(plan)) {
      for (const capabilities of OVERRIDE_SHAPES) {
        for (const row of whatTheyCanOpen({ role, capabilities }, org)) {
          assert.equal(row.canOpen, canOpenModule({ role, capabilities }, org, row.module));
        }
      }
    }
  });

  it('lists only the programs the plan carries (a program the plan lacks is not offered)', () => {
    const tournament = whatTheyCanOpen({ role: 'admin', capabilities: null }, orgs('tournament')[0]);
    assert.deepEqual(tournament.map(r => r.module), ['module_tournaments', 'module_members']);
    const club = whatTheyCanOpen({ role: 'admin', capabilities: null }, orgs('club')[0]).map(r => r.module);
    for (const m of ['module_rep_teams', 'module_accounting', 'module_families', 'module_public_site', 'module_house_league']) {
      assert.ok(club.includes(m as Capability), `club lists ${m}`);
    }
  });

  it('a Club admin (D8) opens every program except Families', () => {
    const rows = whatTheyCanOpen({ role: 'admin', capabilities: null }, orgs('club')[0]);
    for (const r of rows) assert.equal(r.canOpen, r.module !== 'module_families', r.module);
  });

  it('a cancelled club keeps its rows, and nothing opens', () => {
    const rows = whatTheyCanOpen({ role: 'owner', capabilities: null }, orgs('club')[1]);
    assert.ok(rows.length > 0);
    assert.ok(rows.every(r => !r.canOpen));
  });

  it('the override chip names only a real change from the role default', () => {
    const at = (caps: Record<string, boolean> | null, m: string) =>
      whatTheyCanOpen({ role: 'admin', capabilities: caps }, orgs('club')[0]).find(r => r.module === m)!;
    assert.equal(at({ module_families: true }, 'module_families').override, 'on');     // "+ Families"
    assert.equal(at({ module_accounting: false }, 'module_accounting').override, 'off'); // "– Accounting"
    assert.equal(at({ module_accounting: true }, 'module_accounting').override, null);   // restates the default
    assert.equal(at(null, 'module_rep_teams').override, null);
  });

  it('the owner has no overrides and opens everything the plan carries', () => {
    const rows = whatTheyCanOpen({ role: 'owner', capabilities: { module_accounting: false } }, orgs('club')[0]);
    assert.ok(rows.every(r => r.canOpen && r.roleDefault && r.override === null));
  });
});

describe('describeAccessChange — the J10-020 email says exactly what changed', () => {
  const club = orgs('club')[0];

  it('a role change names the new and old roles, and the programs gained or lost', () => {
    const lines = describeAccessChange({ role: 'staff', capabilities: null }, { role: 'treasurer', capabilities: null }, club);
    assert.equal(lines[0], 'Your role is now Treasurer (it was Staff).');
    assert.ok(lines.some(l => l === 'You can now open Accounting and Members.'), lines.join(' | '));
    assert.ok(lines.some(l => l === 'You can no longer open Tournaments.'), lines.join(' | '));
  });

  it('a grant and a removal on the same role read as gained and lost', () => {
    const lines = describeAccessChange(
      { role: 'admin', capabilities: null },
      { role: 'admin', capabilities: { module_families: true, module_accounting: false } },
      club,
    );
    assert.deepEqual(lines, ['You can now open Families.', 'You can no longer open Accounting.']);
  });

  it('an override that restates the default changes nothing, so nothing is sent', () => {
    assert.deepEqual(describeAccessChange(
      { role: 'admin', capabilities: null },
      { role: 'admin', capabilities: { module_accounting: true } },
      club,
    ), []);
  });

  it('on a plan without a program, granting it changes nothing the person can open', () => {
    assert.deepEqual(describeAccessChange(
      { role: 'staff', capabilities: null },
      { role: 'staff', capabilities: { module_accounting: true } },
      orgs('tournament_plus')[0],
    ), []);
  });
});

describe('owner-only powers', () => {
  it('are billing and org_settings, and nothing else', () => {
    assert.deepEqual([...OWNER_ONLY_CAPABILITIES].sort(), ['billing', 'org_settings']);
    for (const cap of ALL_CAPABILITY_KEYS) {
      assert.equal(isOwnerOnlyCapability(cap), cap === 'billing' || cap === 'org_settings', cap);
    }
  });
});

describe('roles as people read them', () => {
  it('Members sections: the board, scorekeepers, coaching staff', () => {
    assert.equal(memberSection('official'), 'scorekeepers');
    assert.equal(memberSection('coach'), 'coaching_staff');
    for (const role of ['owner', 'admin', 'staff', 'treasurer', 'league_admin', 'league_registrar']) {
      assert.equal(memberSection(role), 'board', role);
    }
  });

  it('every role has a screen label, an email noun and a sentence (the owner is never invited)', () => {
    for (const role of ROLES) {
      assert.ok(roleLabel(role).length > 0, role);
      assert.ok(roleEmailLabel(role).length > 0, role);
      if (role !== 'owner') assert.ok(roleOpensSentence(role).length > 0, role);
    }
  });

  it('the email noun is never "team <role>" (J10-005: the resend called a treasurer a "team treasurer")', () => {
    for (const role of ROLES) assert.doesNotMatch(roleEmailLabel(role), /^team /, role);
  });
});
