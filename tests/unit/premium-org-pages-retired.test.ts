/**
 * A PREMIUM COACHES PORTAL'S TOURNAMENT-SIDE SETTINGS ARE RETIRED, AND NO ADMIN SIDEBAR DRAWS AN "ACCOUNT" GROUP
 * (Settings in both workspaces, Session 3 — ruling 1R, 2026-11-20; RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md steps 2d + 4).
 *
 * The guard: the flat "Account" list (Staff & access · Audit log · Settings · PDF settings) a tournament-only organization's
 * sidebar drew is gone for EVERY plan — no organization the rail calls tournament-only lists Organization pages, and the
 * heading is not in the rail's source. Then each old address: the page's layout (or page) sends a Premium coach to the
 * setting's portal home, server-side, and every other organization falls through.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  adminListsOrgPages, premiumPortalHome, premiumWithoutOrgPages, type PremiumOrgPagesOrg, type RetiredOrgPage,
} from '../../lib/premium-org-pages.ts';
import { isTournamentOnlyWorkspace } from '../../lib/module-entitlements.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { kitTournamentGroups } from '../../components/admin/kit/kit-tournament-groups.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');
const A = 'app/[orgSlug]/admin';

const org = (planId: string, extra: Partial<PremiumOrgPagesOrg> = {}): PremiumOrgPagesOrg =>
  ({ planId, subscriptionStatus: 'active', enabledAddons: [], ...extra }) as PremiumOrgPagesOrg;

const PLANS = Object.keys(PLAN_CONFIG);
const KINDS = [null, 'organization', 'team_workspace'];
const STATUSES = ['active', 'trialing', 'canceled'];

describe('the guard — no admin sidebar draws an "Account" group, for any plan', () => {
  it('an organization the rail calls tournament-only lists no Organization pages (every plan, kind and status)', () => {
    // The rail's flag is `isTournamentOnlyWorkspace` (with the tournaments capability); the rows are `adminListsOrgPages`.
    // Two definitions, tied together only here.
    let tournamentOnlyCases = 0;
    for (const planId of PLANS) for (const accountKind of KINDS) for (const subscriptionStatus of STATUSES) {
      const o = org(planId, { accountKind, subscriptionStatus } as Partial<PremiumOrgPagesOrg>);
      if (isTournamentOnlyWorkspace(o)) {
        tournamentOnlyCases += 1;
        assert.equal(adminListsOrgPages(o), false, `${planId} / ${accountKind} / ${subscriptionStatus}`);
      }
    }
    // Tournament, Tournament Plus and Premium × three kinds × three statuses today: never a vacuous pass.
    assert.ok(tournamentOnlyCases >= 27, `only ${tournamentOnlyCases} tournament-only cases exercised`);
  });

  it('the rail has no "Account" heading and no flat list of Organization rows', () => {
    const rail = read('components/admin/kit/AdminKitRail.tsx');
    assert.doesNotMatch(rail, /className=\{styles\.label\}>\s*Account\s*</);
    assert.doesNotMatch(rail, /orgLinks\.map\(/);
    assert.doesNotMatch(rail, /tournamentOnly && orgLinks/);
  });

  it('no admin nav component draws a group headed "Account" (the phone sheet’s own Account row is the person’s, under You)', () => {
    const dir = join(REPO_ROOT, 'components/admin');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name)) files.push(p);
      }
    };
    walk(dir);
    assert.ok(files.some(f => f.endsWith(join('kit', 'AdminKitRail.tsx'))), 'the walk reaches the rail');
    assert.ok(files.some(f => f.endsWith('admin-nav-config.ts')), 'the walk reaches the nav config');
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // Any label-style class over the word (label, groupLabel, sectionLabel…) — the sheet's own Account row is a <span>.
      assert.doesNotMatch(src, /className=\{[^}]*[Ll]abel\}>\s*Account\s*</, f);
      // A nav group or row named Account in config.
      assert.doesNotMatch(src, /\b(heading|label|title|groupLabel):\s*'Account'/, f);
    }
  });

  it('the shell asks the one rule for its Organization rows', () => {
    const nav = read('components/admin/kit/useAdminKitNav.ts');
    assert.match(nav, /const orgLinks = currentOrg && !adminListsOrgPages\(currentOrg\) \? \[\] : kitOrgLinks\(/);
  });
});

describe('which organizations lose their Organization pages', () => {
  it('a Premium Coaches Portal does — on its own plan, on a tournament plan, and cancelled', () => {
    for (const o of [
      org('team'), org('team', { accountKind: 'team_workspace' }), org('tournament', { accountKind: 'team_workspace' }),
      org('tournament_plus', { accountKind: 'team_workspace' }), org('team', { subscriptionStatus: 'canceled' } as Partial<PremiumOrgPagesOrg>),
    ]) {
      assert.equal(premiumWithoutOrgPages(o), true, JSON.stringify(o));
      assert.equal(adminListsOrgPages(o), false, JSON.stringify(o));
    }
  });

  it('a Premium workspace whose plan grows (free Club time) keeps the club’s Organization', () => {
    for (const planId of ['league', 'club', 'club_large']) {
      const o = org(planId, { accountKind: 'team_workspace' });
      assert.equal(premiumWithoutOrgPages(o), false, planId);
      assert.equal(adminListsOrgPages(o), true, planId);
    }
  });

  it('clubs and leagues keep theirs; the Tournament plans never had them (and are never "Premium")', () => {
    for (const planId of ['league', 'club', 'club_large']) assert.equal(adminListsOrgPages(org(planId)), true, planId);
    for (const planId of ['tournament', 'tournament_plus']) {
      assert.equal(adminListsOrgPages(org(planId)), false, planId);
      assert.equal(premiumWithoutOrgPages(org(planId)), false, planId);
    }
  });
});

describe('each old address lands on its portal home', () => {
  it('the homes: Staff for people and the audit log; Team settings with the section open for Settings and PDF settings', () => {
    const home = (p: RetiredOrgPage) => premiumPortalHome(p, 'falcons', 't1');
    assert.equal(home('members'), '/falcons/coaches/teams/t1/staff');
    assert.equal(home('audit'), '/falcons/coaches/teams/t1/staff');
    assert.equal(home('settings'), '/falcons/coaches/teams/t1/settings?section=organization');
    assert.equal(home('pdf'), '/falcons/coaches/teams/t1/settings?section=documents');
  });

  it('the sections those addresses open exist, by those ids, on Team settings', () => {
    assert.match(read('app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx'), /sectionId="organization"/);
    assert.match(read('components/coaches/TeamDocumentsLookCard.tsx'), /sectionId="documents"/);
    assert.match(read('components/coaches/CoachCollapseSection.tsx'), /useSectionArrival/);
  });

  const SERVED: Array<{ file: string; page: string }> = [
    { file: `${A}/org/members/layout.tsx`, page: 'members' },          // Members and, under it, the Audit log
    { file: `${A}/org/page.tsx`, page: 'door' },                       // `/admin/org`, a door to tabs a Premium coach no longer has
  ];
  for (const { file, page } of SERVED) {
    it(`${file} sends a Premium coach on, server-side, before the page mounts`, () => {
      const src = read(file);
      assert.doesNotMatch(src, /^'use client'/m);
      assert.match(src, new RegExp(`await redirectPremiumOffOrgPage\\(\\(await params\\)\\.orgSlug, '${page}'\\)`));
    });
  }

  it('Settings and its PDF settings share one layout, which tells them apart by the proxy’s address', () => {
    const src = read(`${A}/org/settings/layout.tsx`);
    assert.doesNotMatch(src, /^'use client'/m);
    assert.match(src, /\(await headers\(\)\)\.get\('x-pathname'\)/);
    assert.match(src, /await redirectPremiumOffOrgPage\(\(await params\)\.orgSlug, \/\\\/settings\\\/pdf\\\/\?\$\/\.test\(pathname\) \? 'pdf' : 'settings'\)/);
    // The proxy names the path on every request, so a layout reads the address the person asked for, never the browser's.
    assert.match(read('proxy.ts'), /requestHeaders\.set\('x-pathname', pathname\);/);
    // Nested layouts would race each other's redirect; the pages themselves stay the client screens they were.
    for (const f of [`${A}/org/settings/pdf/layout.tsx`, `${A}/org/members/audit/layout.tsx`]) assert.throws(() => read(f), f);
    assert.match(read(`${A}/org/settings/page.tsx`), /^'use client'/m);
  });

  it('the pdf test tells the two addresses apart', () => {
    const pdf = /\/settings\/pdf\/?$/;
    assert.ok(pdf.test('/falcons/admin/org/settings/pdf'));
    assert.ok(pdf.test('/falcons/admin/org/settings/pdf/'));
    assert.ok(!pdf.test('/falcons/admin/org/settings'));
  });

  it('the resolver: the suspended-safe auth, the one rule, the team home, and sign-in’s landing for someone with no team', () => {
    const lib = read('lib/coach-portal-request.ts');
    const fn = lib.slice(lib.indexOf('export async function redirectPremiumOffOrgPage'), lib.indexOf('async function redirectToStandaloneLanding'));
    assert.match(fn, /getCoachPortalAuth\(orgSlug\)/);
    assert.match(fn, /premiumWithoutOrgPages\(auth\.org\)/);
    assert.match(fn, /redirect\(premiumPortalHome\(page, auth\.org\.slug, teamId\)\)/);
    assert.match(fn, /await redirectToStandaloneLanding\(auth\.org, auth\.user\.id\)/);
    assert.match(fn, /getCoachPortalAssignments\(orgId, userId, true\)/);
    assert.match(fn, /getCoachPortalClosedAssignments\(orgId, userId, true\)/);
  });

  it('the Tournament plans’ own Settings & access pages are untouched (they render the page, never the layouts above)', () => {
    assert.match(read(`${A}/tournaments/settings/members/page.tsx`), /export default tournamentSideOnly\(MembersPage, 'org\/members'\);/);
    assert.match(read(`${A}/tournaments/settings/pdf/page.tsx`), /export default tournamentSideOnly\(PdfSettingsPage, 'org\/settings\/pdf'\);/);
  });
});

describe('nothing on the tournament side links a Premium coach to the retired pages', () => {
  it('the phone More sheet’s Settings & access row goes for a one-team workspace; the Tournament plans keep it', () => {
    const keys = (planId: string, accountKind?: string) =>
      kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId, accountKind }).flatMap(g => g.items.map(i => i.key));
    for (const planId of ['team', 'tournament', 'tournament_plus', 'club']) {
      assert.ok(!keys(planId, 'team_workspace').includes('settings'), planId);
    }
    assert.ok(keys('tournament').includes('settings'));
    assert.ok(keys('tournament_plus').includes('settings'));
  });

  it('Event settings’ web-address line sends a Premium coach to Team settings › Organization', () => {
    const page = read(`${A}/tournaments/settings/event/page.tsx`);
    assert.match(page, /const premiumOrg = premiumWithoutOrgPages\(currentOrg\);/);
    assert.match(page, /premiumPortalHome\('settings', orgSlugForLinks, premiumTeamId\)/);
    assert.match(page, /premiumOrg \? WA\.publicUrlPremium/);
  });

  it('the declined-invitation notice opens a Premium workspace’s team Staff page', () => {
    const route = read('app/api/auth/invitations/[memberId]/route.ts');
    assert.match(route, /premiumPortalHome\('members', slug, ws\.repTeamId\)/);
    assert.match(route, /link: premiumStaff \?\? \(slug \? getMembersHref\(slug, planId\) : undefined\),/);
  });
});
