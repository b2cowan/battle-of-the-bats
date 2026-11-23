/**
 * THE SPONSORSHIPS SWITCH, HELD (owner ruling 2026-11-22, option A — lib/sponsorships-open.ts).
 *
 * Part 1 of the club's Sponsorships place is built but unwalked, and the Club and League Plus plans go on sale right after the next
 * promote, so no customer may see it until walk §560 passes. ONE switch closes every door by closing the one plan question
 * (`planCarriesModule`) that every entry point already asks. This test holds both halves:
 *   1. the BEHAVIOUR while the switch is off — it deliberately does not import `_sponsorships-open-for-test.ts`;
 *   2. the SOURCE: each entry point still asks the question, so a new door that bypasses it fails the build (the block that
 *      reads source runs in both states — it is what keeps a flipped switch honest too).
 * The held-state block skips itself once `SPONSORSHIPS_OPEN` is flipped to true; the feature's own tests
 * (board-ready-stage6-sponsorships, admin-kit-nav, member-access, nav-standard-guard, plan-billing-profile) import the seam instead.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SPONSORSHIPS_OPEN, sponsorshipsOpen } from '../../lib/sponsorships-open.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { hasModuleEntitlement, planCarriesModule, type EntitlementOrg } from '../../lib/module-entitlements.ts';
import { opensSponsorships } from '../../lib/club-sponsorships-place.ts';
import { MEMBER_PROGRAMS, whatTheyCanOpen } from '../../lib/member-access.ts';
import { organizationShutdownAreas, shortOrganizationShutdownAreas } from '../../lib/billing-cancellation-policy.ts';
import { withoutHeldHelp } from '../../lib/help-content/held.ts';
import { resolveSectionId } from '../../lib/help-content/index.ts';
import type { HelpPageContent } from '../../lib/help-content/index.ts';
import type { OrgPlan } from '../../lib/types.ts';
import { clubNavFor, RUNS_BOTH } from './_club-people.ts';

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
/** Source with its comments blanked, so a comment that names the switch cannot satisfy a check on the code. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p.replace(/\\/g, '/')];
});

const CLUB_PLANS: OrgPlan[] = ['league', 'club', 'club_large'];
const orgOn = (planId: OrgPlan): EntitlementOrg => ({ planId, subscriptionStatus: 'active', enabledAddons: [] } as unknown as EntitlementOrg);

describe('the Sponsorships switch is one boolean constant, default off until walk §560', () => {
  it('is exported as a boolean and read through sponsorshipsOpen()', () => {
    assert.equal(typeof SPONSORSHIPS_OPEN, 'boolean');
    assert.match(read('lib/sponsorships-open.ts'), /export const SPONSORSHIPS_OPEN: boolean = (true|false);/);
    assert.match(read('lib/sponsorships-open.ts'), /§560/, 'the comment names the walk that flips it');
    assert.match(read('lib/sponsorships-open.ts'), /2026-11-22/, 'the comment names the ruling');
  });
  it('the test seam is a global, never an environment variable, and no app code sets it', () => {
    assert.doesNotMatch(code('lib/sponsorships-open.ts'), /process\.env/);
    const hits = ['app', 'components', 'lib'].flatMap(d => walk(d))
      .filter(f => /\.(ts|tsx)$/.test(f) && f !== 'lib/sponsorships-open.ts' && /__SPONSORSHIPS_OPEN_FOR_TESTS__/.test(read(f)));
    assert.deepEqual(hits, []);
  });
});

describe('while the switch is off, no customer can reach the place', { skip: SPONSORSHIPS_OPEN || undefined }, () => {
  it('no plan carries or is entitled to module_sponsorships, even with it listed in PLAN_CONFIG', () => {
    assert.ok(CLUB_PLANS.every(p => PLAN_CONFIG[p].moduleEntitlements.includes('module_sponsorships')), 'the plans still list it (price and bands untouched)');
    assert.equal(sponsorshipsOpen(), false);
    for (const p of CLUB_PLANS) {
      assert.equal(planCarriesModule(orgOn(p), 'module_sponsorships'), false, p);
      assert.equal(hasModuleEntitlement(orgOn(p), 'module_sponsorships'), false, p);
    }
    // An add-on cannot open it either.
    assert.equal(planCarriesModule({ ...orgOn('tournament'), enabledAddons: ['module_sponsorships'] } as unknown as EntitlementOrg, 'module_sponsorships'), false);
  });
  it('the answer is only closed for Sponsorships: another module on the same plan is untouched', () => {
    assert.equal(planCarriesModule(orgOn('club'), 'module_accounting'), true);
    assert.equal(hasModuleEntitlement(orgOn('club'), 'module_families'), true);
  });
  it('nobody opens the place, so the route gate, the layout and the nav all refuse it', () => {
    for (const role of ['owner', 'admin', 'treasurer'] as const) {
      assert.equal(opensSponsorships({ role, capabilities: { module_sponsorships: true }, limited: false }, orgOn('club')), false, role);
    }
    for (const role of ['owner', 'admin', 'league_admin', 'league_registrar', 'treasurer'] as const) {
      const nav = clubNavFor(role, RUNS_BOTH, { module_sponsorships: true });
      assert.equal(nav.sponsorships, null, `${role}: no sidebar / phone / More row`);
      assert.ok(!nav.sidebarRows.includes('sponsorships'), role);
      assert.ok(!JSON.stringify(nav.groups).includes('Sponsorships'), role);
    }
  });
  it('Members "What they can open" offers no Sponsorships row', () => {
    assert.ok(MEMBER_PROGRAMS.some(m => m.module === 'module_sponsorships'), 'the catalog keeps the program');
    for (const p of CLUB_PLANS) {
      assert.ok(!whatTheyCanOpen({ role: 'owner', capabilities: null }, orgOn(p)).some(r => r.module === 'module_sponsorships'), p);
    }
  });
  it('the cancellation lists do not name a place customers cannot open', () => {
    for (const p of CLUB_PLANS) {
      assert.ok(!organizationShutdownAreas(PLAN_CONFIG[p]).some(a => /Sponsorships/.test(a)), p);
      assert.ok(!shortOrganizationShutdownAreas(PLAN_CONFIG[p]).includes('Sponsorships'), p);
    }
  });
  it('the guide drops the Sponsorships article, and no other section is renamed by the cut', () => {
    // org.tsx is JSX the unit runner cannot load, so the cut is proved on a stand-in with the same shape: an id-less section
    // AFTER the held one is named by its position, and that name must survive.
    const content: HelpPageContent = {
      title: 't', role: 'r', intro: 'i',
      sections: [
        { heading: 'Your first 30 days', content: null },
        { id: 'club-sponsorships', heading: 'Sponsorships', content: null },
        { heading: 'Public site', content: null },
      ],
    };
    const held = withoutHeldHelp(content);
    assert.deepEqual(held.sections.map(sec => sec.id), ['your-first-30-days-1', 'public-site-3']);
    assert.deepEqual(held.sections.map((sec, i) => resolveSectionId(sec, i)), ['your-first-30-days-1', 'public-site-3']);
    assert.match(read('lib/help-content/org.tsx'), /id: 'club-sponsorships',/, 'the held id is the real id of the article');
  });
});

describe('every entry point still asks the one question (source holds, in either state)', () => {
  it('planCarriesModule answers false for Sponsorships through sponsorshipsOpen()', () => {
    const src = code('lib/module-entitlements.ts');
    assert.match(src, /cap === 'module_sponsorships' && !sponsorshipsOpen\(\)\) return false;/);
    assert.match(src, /export function hasModuleEntitlement[\s\S]*?return planCarriesModule\(org, cap\);/, 'the access question rides the plan question');
  });
  it('opensSponsorships rides canOpenModule, which rides hasModuleEntitlement', () => {
    assert.match(code('lib/club-sponsorships-place.ts'), /canOpenModule\(member, org, 'module_sponsorships'\)/);
    assert.match(code('lib/member-access.ts'), /export function canOpenModule[\s\S]*?hasModuleEntitlement\(org, cap\)/);
  });
  it('the sidebar, phone bar, More sheet and bar name ask opensSponsorships; the place layout asks both questions', () => {
    assert.match(code('components/admin/kit/useAdminKitNav.ts'), /opensSponsorships\(/);
    assert.match(code('components/admin/AdminBarPlace.tsx'), /sponsorshipsLink/);
    const layout = code('app/[orgSlug]/admin/sponsorships/layout.tsx');
    assert.match(layout, /hasModuleEntitlement\(ctx\.org, 'module_sponsorships'\)/);
    assert.match(layout, /opensSponsorships\(/);
  });
  it('every Sponsorships admin route asks requireSponsorships, which asks opensSponsorships', () => {
    assert.match(code('lib/club-sponsorships-auth.ts'), /opensSponsorships\(member, ctx\.org\)/);
    const routes = walk('app/api/admin/sponsorships').filter(f => f.endsWith('route.ts'));
    assert.ok(routes.length >= 12, `${routes.length} routes`);
    for (const r of routes) assert.match(code(r), /requireSponsorships\(req/, r);
  });
  it('Payouts shows and accepts the sponsor fee row only where the plan carries Sponsorships', () => {
    const route = code('app/api/admin/payouts/route.ts');
    assert.match(route, /sponsorshipsOnPlan: hasModuleEntitlement\(ctx\.org, 'module_sponsorships'\)/);
    assert.match(route, /'sponsorFeePayer' in body[\s\S]*?!hasModuleEntitlement\(ctx\.org, 'module_sponsorships'\)/);
    assert.match(code('components/admin/kit/club/PayoutsCard.tsx'), /sponsorshipsOnPlan/);
  });
  it('the public site editor Sponsors door, the Manage member row and the role guide ask the plan question', () => {
    assert.match(code('app/[orgSlug]/admin/public-site/page.tsx'), /opensSponsorships\(/);
    assert.match(code('components/admin/kit/club/RoleGuide.tsx'), /carries\('module_sponsorships'\)/);
    assert.match(code('lib/member-access.ts'), /\.filter\(p => planCarriesModule\(org, p\.module\)/);
  });
  it('the help hub link, the guide article and the cancellation lists ask the switch', () => {
    assert.match(code('app/[orgSlug]/admin/help/page.tsx'), /hasModuleEntitlement\(currentOrg, 'module_sponsorships'\)/);
    assert.match(code('lib/billing-cancellation-policy.ts'), /cap !== 'module_sponsorships' \|\| sponsorshipsOpen\(\)/);
    assert.match(code('lib/help-content/registry.ts'), /org: withoutHeldHelp\(orgHelp\)/);
    assert.match(code('app/[orgSlug]/admin/help/org/page.tsx'), /withoutHeldHelp\(orgHelp\)/);
    assert.match(code('app/platform-admin/help/org/page.tsx'), /withoutHeldHelp\(orgHelp\)/);
    assert.match(code('lib/help-content/held.ts'), /'club-sponsorships'/);
  });
  it('every page of the place sits under the one layout that holds its gate', () => {
    const pages = walk('app/[orgSlug]/admin/sponsorships').filter(f => /(page|layout)\.tsx$/.test(f));
    assert.ok(pages.some(f => f === 'app/[orgSlug]/admin/sponsorships/layout.tsx'), 'the place keeps its layout');
    assert.ok(pages.filter(f => f.endsWith('page.tsx')).length >= 5, 'its pages are all under that layout');
  });
});
