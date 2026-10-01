import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ROLE_DEFAULTS, type Capability } from '../../lib/roles.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { isTournamentOnlyWorkspace, type EntitlementOrg } from '../../lib/module-entitlements.ts';
import { canOpenRepMoney } from '../../lib/member-access.ts';
import type { OrgPlan, OrgRole } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE ROLE-DEFAULTS GUARD (Club Tier Readiness plan §8; ruling D8, owner 2026-09-25)
 *
 *   D8 — "Admin gets every module the plan carries by default (rep teams, accounting, public
 *   site, house league); Families stays explicit-grant; never billing / org_settings. The hub
 *   decides 'tournament-only' from the PLAN."
 *
 * Before D8 an admin held no program module, so a club's vice-president read as a tournament-only
 * user and was bounced out of the club's hub (A01); `plan-gating.spec.ts` even asserted it. This
 * file is where a later "tidy-up" of ROLE_DEFAULTS, or a new program added to a plan without
 * adding it to the admin, is forced to announce itself.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const PLANS = Object.keys(PLAN_CONFIG) as OrgPlan[];
const org = (planId: OrgPlan, extra: Partial<EntitlementOrg> = {}): EntitlementOrg => ({
  planId, subscriptionStatus: 'active', enabledAddons: [], freeFloor: null, ...extra,
});
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('D8 — an admin opens every program the plan carries', () => {
  it('every module any plan carries (except Families) is in the admin defaults', () => {
    for (const plan of PLANS) {
      for (const cap of PLAN_CONFIG[plan].moduleEntitlements) {
        if (cap === 'module_families') continue;
        assert.ok(
          ROLE_DEFAULTS.admin.has(cap),
          `plan '${plan}' carries ${cap} but an admin does not hold it by default — D8 says an admin ` +
          'opens every program the plan carries. Add it to ROLE_DEFAULTS.admin, or record an owner ruling.',
        );
      }
    }
  });

  it('Families stays an explicit grant — never an admin default', () => {
    assert.equal(ROLE_DEFAULTS.admin.has('module_families'), false);
  });

  it('owner-only powers (billing, org_settings) are no role default except the owner', () => {
    for (const [role, caps] of Object.entries(ROLE_DEFAULTS) as [OrgRole, Set<Capability>][]) {
      if (role === 'owner') continue;
      for (const cap of ['billing', 'org_settings'] as const) {
        assert.equal(caps.has(cap), false, `ROLE_DEFAULTS['${role}'] holds ${cap} — an owner-only power (J10-022)`);
      }
    }
  });

  it('staff and scorekeepers did not gain programs (D8 names the admin only)', () => {
    for (const role of ['staff', 'official'] as const) {
      for (const cap of ['module_rep_teams', 'module_accounting', 'module_public_site', 'module_house_league'] as const) {
        assert.equal(ROLE_DEFAULTS[role].has(cap), false, `${role} holds ${cap} by default`);
      }
    }
  });
});

describe('D8 — the treasurer holds what the allocation loop needs', () => {
  it('a treasurer holds Accounting by default', () => {
    assert.ok(ROLE_DEFAULTS.treasurer.has('module_accounting'));
  });

  it('…and NOT Rep Teams (Ask 1: team names inside Accounting, no Rep Teams door)', () => {
    assert.equal(ROLE_DEFAULTS.treasurer.has('module_rep_teams'), false);
  });

  it('…which reaches the club ↔ team money loop on a club, and nothing where rep teams are absent', () => {
    const treasurer = { role: 'treasurer' as OrgRole, capabilities: null };
    assert.equal(canOpenRepMoney(treasurer, org('club')), true);
    assert.equal(canOpenRepMoney(treasurer, org('club_large')), true);
    assert.equal(canOpenRepMoney(treasurer, org('league')), false);
    assert.equal(canOpenRepMoney(treasurer, org('club', { subscriptionStatus: 'canceled' })), false);
    // A staff member holds neither program, so the loop stays shut to them.
    assert.equal(canOpenRepMoney({ role: 'staff', capabilities: null }, org('club')), false);
  });

  it('the money-loop routes gate on that rule, not on Rep Teams alone (C03)', () => {
    const routes = [
      'app/api/admin/rep-teams/allocations/route.ts',
      'app/api/admin/rep-teams/allocations/[allocationId]/route.ts',
      'app/api/admin/rep-teams/allocations/[allocationId]/splits/[splitId]/installments/[installId]/route.ts',
      'app/api/admin/rep-teams/payment-requests/route.ts',
      'app/api/admin/rep-teams/payment-requests/[id]/route.ts',
    ];
    // Club Tier Stage 3a: the loop's decisions go through the shared club-money gate, whose 'loop'
    // scope IS canOpenRepMoney (asserted below) — either form satisfies the rule.
    for (const route of routes) {
      const src = read(route);
      assert.match(src, /canOpenRepMoney\(ctx, ctx\.org\)|resolveClubMoney\(req, \{ scope: 'loop'/, `${route} must gate on canOpenRepMoney`);
      assert.doesNotMatch(src, /'module_rep_teams'/, `${route} gates on Rep Teams alone again — a treasurer is refused (C03)`);
    }
    assert.match(read('lib/club-money-route.ts'), /opts\.scope === 'loop'\s*\?\s*canOpenRepMoney\(ctx, ctx\.org\)/,
      'the shared gate\'s loop scope must stay canOpenRepMoney');
  });

  it('the allocate wizard reads its teams from Accounting, never from a Rep Teams route', () => {
    const src = read('app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx');
    assert.match(src, /\/api\/admin\/accounting\/team-options/);
    assert.doesNotMatch(src, /fetch\(`\/api\/admin\/rep-teams\//);
  });
});

describe('D8 — "tournament-only" is decided from the plan', () => {
  it('the tournament tiers and the Coaches Portal workspace carry nothing beyond tournaments', () => {
    for (const plan of ['tournament', 'tournament_plus', 'team'] as const) {
      assert.equal(isTournamentOnlyWorkspace(org(plan)), true, plan);
    }
  });

  it('League Plus and both Club bands are never tournament-only', () => {
    for (const plan of ['league', 'club', 'club_large'] as const) {
      assert.equal(isTournamentOnlyWorkspace(org(plan)), false, plan);
    }
  });

  it('an add-on or the League Starter floor makes a tournament tier more than tournaments', () => {
    assert.equal(isTournamentOnlyWorkspace(org('tournament_plus', { enabledAddons: ['module_rep_teams'] })), false);
    assert.equal(isTournamentOnlyWorkspace(org('tournament', { freeFloor: 'league_starter' })), false);
  });

  it('a CANCELLED club is still a club (the shape question ignores suspension)', () => {
    assert.equal(isTournamentOnlyWorkspace(org('club', { subscriptionStatus: 'canceled' })), false);
  });

  it('the hub, the rail and the post-login resolver all ask the plan helper, not the member', () => {
    const hub = read('app/[orgSlug]/admin/AdminHubClient.tsx');
    assert.match(hub, /isTournamentOnlyWorkspace\(currentOrg\)/);
    assert.doesNotMatch(hub, /!canSeePublicSite && !canSeeAccounting/, 'the hub derives tournament-only from the member again (A01)');
    const resolver = read('lib/user-contexts.ts');
    assert.match(resolver, /isTournamentOnlyWorkspace\(entitlementOrg\)/);
    // The admin's rail and phone bar (Admin Design Continuity slice 1; the old console sidebar that this
    // test also held was deleted in Part B, 2026-09-29).
    const kitNav = read('components/admin/kit/useAdminKitNav.ts');
    assert.match(kitNav, /isTournamentOnlyWorkspace\(currentOrg\)/);
    assert.doesNotMatch(kitNav, /!canSeePublicSite && !canSeeAccounting/, 'the rail derives tournament-only from the member again (A01)');
    // The rail asks the ONE gate through the org context (`canOpen` → `canOpenModule`), never restates it.
    assert.match(kitNav, /const canUse = canOpen;/, 'the kit rail should ask the ONE gate, not restate it');
    assert.match(read('lib/org-context.tsx'), /canOpenModule\(\{ role: userRole, capabilities: userCapabilities \}, currentOrg, cap\)/);
  });

  it('a non-owner is never routed into owner-only setup (the J10-014 loop)', () => {
    const hub = read('app/[orgSlug]/admin/AdminHubClient.tsx');
    assert.match(hub, /userRole !== 'owner'\) \{\s*router\.replace\(`\$\{base\}\/tournaments`\)/);
    const resolver = read('lib/user-contexts.ts');
    assert.match(resolver, /if \(!isOwner \|\| await hasSkippedFirstTournamentWizard\(orgId\)\)/);
  });
});
