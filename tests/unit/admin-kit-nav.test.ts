import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  kitPrograms, kitOrgLinks, kitBillingLink, isKitLinkActive, isKitLinkActiveAmong, activeKitSection,
  clubProgramOrder, INTERIM_PROGRAM_ORDER, PROGRAM_CAPABILITY, accountingTabs, accountingTabFor, tournamentBarKeys,
  familiesTabs, familiesTabFor, familiesChildHref, isFamiliesChildPage, kitOrgPlace, litClubPlace, orgTabs, placeGroupHeading,
  clubPlaceAt, showsOrgBoard, kitPermitsLink, isTournamentOrgScreen, type ClubPlaceAccess,
} from '../../lib/admin-kit-nav.ts';
import { clubNavFor, CLUB_BASE, RUNS_BOTH, RUNS_NEITHER } from './_club-people.ts';
import { hasCapability, type Capability } from '../../lib/roles.ts';
import { TOUR_GROUPS } from '../../components/admin/admin-nav-config.ts';
import { kitTournamentGroups } from '../../components/admin/kit/kit-tournament-groups.ts';
import { readCode } from './_source-code.ts';
import { CHAT_PAUSED } from '../../lib/chat-pause.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { getBillingHref } from '../../lib/billing-urls.ts';
import { CreditCard } from 'lucide-react';
import type { OrgPlan, OrgRole } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ADMIN KIT'S NAVIGATION (Admin Design Continuity slice 1 — ratified club Stage 1 specimens 3–4)
 *
 *   1. NO DEAD DOOR. Every page the rail, the phone bar and the "In <program>" row can open is a
 *      real route. A door to a page that does not exist is "the 404 wearing a politer face" — which
 *      is exactly why the drawn Audit log / Notifications rows wait for Club Stage 1.
 *   2. TODAY'S GATES. A restyle must not widen or narrow who sees a door: Plan & billing and
 *      Settings stay owner-only, PDF settings owner-or-admin, a cancelled club keeps only its billing
 *      door. ("Coaches Portal links" left Organization for Rep Teams › Bring in a coach's team, Club
 *      Tier Stage 2 — the Rep Teams group is gated by the module, and the page by owner/admin.)
 *   3. THE NAVS DO NOT DRIFT. The rail and the phone bar read ONE model through ONE hook; neither
 *      may grow its own list (the coaches portal pins the same thing in coach-nav-groups.test.ts).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const BASE = '/demo-club/admin';
const everything = () => true;

/** Does `href` (under BASE) resolve to an admin page file? Dynamic segments are not needed here. */
function routeExists(href: string): boolean {
  const rel = href.replace('/demo-club/', '').replace(/[?#].*$/, '');
  return existsSync(path.join('app/[orgSlug]', rel, 'page.tsx'));
}

describe('the admin kit nav — no dead door', () => {
  it('every program and every page it lists is a real admin route', () => {
    const dead: string[] = [];
    for (const p of kitPrograms({ base: BASE, canUse: everything })) {
      if (!routeExists(p.href)) dead.push(`${p.label} → ${p.href}`);
      for (const page of p.pages) if (!routeExists(page.href)) dead.push(`${p.label} › ${page.label} → ${page.href}`);
    }
    for (const link of kitOrgLinks({ base: BASE, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true })) {
      if (!routeExists(link.href)) dead.push(`Organization › ${link.label} → ${link.href}`);
    }
    assert.ok(routeExists(`${BASE}/org`), 'the Organization row opens the org overview');
    assert.deepEqual(dead, []);
  });

  it('the audit log has its row now that its page works; Notifications is still held', () => {
    const labels = kitOrgLinks({ base: BASE, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true }).map(l => l.label);
    assert.ok(labels.includes('Audit log'), 'Club Stage 1 (H08): the audit log works again (A04) and gets its row');
    assert.ok(!labels.includes('Notifications'), 'the org notifications path redirects to account settings, whose club card is not built (specimen 12)');
  });
});

describe("the admin kit nav — today's gates", () => {
  it('a program appears only when its capability is usable, in the interim order', () => {
    const only = new Set(['module_accounting', 'module_rep_teams']);
    const programs = kitPrograms({ base: BASE, canUse: c => only.has(c) });
    assert.deepEqual(programs.map(p => p.key), ['rep-teams', 'accounting']);
    assert.deepEqual([...INTERIM_PROGRAM_ORDER].sort(), Object.keys(PROGRAM_CAPABILITY).sort());
  });

  it('the Organization rows keep their owner / admin / cancelled gates', () => {
    const labels = (role: string, isCanceled = false) => kitOrgLinks({
      base: BASE, role, isCanceled, canSeeMembers: true, hasVenueLibrary: true,
    }).map(l => l.label);
    assert.deepEqual(labels('owner'), ['Members', 'Audit log', 'Settings', 'Venue library', 'PDF settings']);
    const teamLinks = kitOrgLinks({ base: BASE, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: false, isTeamWorkspace: true });
    assert.equal(teamLinks.find(link => link.key === 'org/members')?.label, 'Staff & access');
    assert.equal(teamLinks.find(link => link.key === 'org/members')?.href, `${BASE}/org/members`);
    assert.deepEqual(labels('admin'), ['Members', 'Venue library', 'PDF settings']);
    assert.deepEqual(labels('treasurer'), ['Members', 'Venue library']);
    assert.deepEqual(labels('owner', true), [], 'billing is in the foot, never Organization');
  });

  it('bringing in a coach’s team lives under Rep Teams, beside the teams it adds to (Club Tier Stage 2)', () => {
    const repTeams = kitPrograms({ base: BASE, canUse: c => c === 'module_rep_teams' }).find(p => p.key === 'rep-teams')!;
    const page = repTeams.pages.find(p => p.key === 'rt-bring-in');
    assert.equal(page?.href, `${BASE}/rep-teams/bring-in`);
    assert.ok(page?.also?.includes(`${BASE}/org/coaches-portal-links`), 'the old address still lights the row');
  });

  it("the nav lists doors only — an owner's area is simply not there for anyone else (owner, 2026-10-01)", () => {
    // The locked "Owner only" rows (Club Stage 1 specimens 2–3, J10-016) left the rail and the phone's
    // More sheet: three of an admin's five Organization rows were permanently dead. The hub's
    // Organization section still says whose they are (club-stage1-screens-guard).
    const owner = ['Audit log', 'Settings'];
    const adminDoors = kitOrgLinks({ base: BASE, role: 'admin', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true }).map(l => l.label);
    for (const label of owner) assert.ok(!adminDoors.includes(label), `${label} is the owner's — not listed for an admin`);
    const ownerDoors = kitOrgLinks({ base: BASE, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true }).map(l => l.label);
    for (const label of owner) assert.ok(ownerDoors.includes(label), `the owner keeps ${label} as a door`);
    const nav = readCode('lib/admin-kit-nav.ts');
    assert.doesNotMatch(nav, /export function kitOrgLockedRows|export type KitLockedRow/, 'the locked-row list must not come back');
  });
});

describe('billing in the rail foot and More → You', () => {
  for (const planId of Object.keys(PLAN_CONFIG) as OrgPlan[]) {
    for (const role of ['owner', 'admin', 'staff', 'treasurer', 'coach', 'official', 'league_admin', 'league_registrar'] as OrgRole[]) {
      for (const capabilities of [null, { billing: true }, { billing: false }]) it(`${planId}/${role}/${JSON.stringify(capabilities)}: only the owner has the door, whatever a stored grant says`, () => {
        const link = kitBillingLink({ orgSlug: 'demo-club', planId, role, capabilities });
        const allowed = role === 'owner';
        if (!allowed) { assert.equal(link, null); return; }
        assert.equal(link?.href, getBillingHref({ slug: 'demo-club', planId }));
        assert.equal(link?.label, 'Plan & billing'); assert.equal(link?.icon, CreditCard);
        assert.ok(routeExists(link!.href), 'the billing destination is a real route');
        assert.ok(isKitLinkActive(link!.href, link!));
        if (planId === 'team') {
          // The coach mock returns directly to its billing host instead of an admin mock page.
          assert.match(readCode('app/api/billing/portal/route.ts'), /isTeamWorkspaceOrg\(auth\.org\)[\s\S]*getBillingHref\(auth\.org, \{ purpose: 'return' \}\)/);
        } else assert.ok(routeExists(`${link!.href}/mock-portal`), 'the mock portal shares the same tier boundary');
      });
    }
  }
  it('unauthenticated nav has no billing row; suspension does not remove the billing comeback door', () => {
    assert.equal(kitBillingLink({ orgSlug: 'falcons', planId: 'club', accountKind: 'team_workspace', role: 'owner', capabilities: null })?.href,
      '/falcons/coaches/billing');
    assert.equal(kitBillingLink({ orgSlug: 'demo-club', planId: 'club', role: null, capabilities: { billing: true } }), null);
    assert.ok(kitBillingLink({ orgSlug: 'demo-club', planId: 'club', role: 'owner', capabilities: null }));
    assert.doesNotMatch(readCode('lib/admin-kit-nav.ts').split('export function kitBillingLink')[1].split('export function kitOrgLinks')[0], /isCanceled/);
  });
});

describe('Plan & billing under Settings & access (tournament tiers)', () => {
  const settings = { key: 'settings', label: 'Settings & access', href: '/demo/admin/tournaments/settings' };
  const billing = kitBillingLink({ orgSlug: 'demo', planId: 'tournament_plus', role: 'owner', capabilities: null });
  it('only Plan & billing lights on its own page — Settings & access steps aside', () => {
    const page = '/demo/admin/tournaments/settings/subscription';
    assert.ok(billing);
    assert.equal(isKitLinkActiveAmong(page, settings, [billing]), false);
    assert.equal(isKitLinkActiveAmong(page, billing!, [billing]), true);
  });
  it("Settings & access still lights on its own pages (the page itself, members, payouts)", () => {
    for (const p of ['/demo/admin/tournaments/settings', '/demo/admin/tournaments/settings/members', '/demo/admin/tournaments/settings/payouts']) {
      assert.equal(isKitLinkActiveAmong(p, settings, [billing]), true, p);
    }
  });
  it('with no billing door (not the owner) nothing changes', () => {
    assert.equal(isKitLinkActiveAmong('/demo/admin/tournaments/settings/subscription', settings, [null]), true);
  });
});

describe('Audit log under Members (Organization rows)', () => {
  const base = '/demo/admin';
  const org = kitOrgLinks({ base, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true });
  const lit = (page: string) => org.filter(l => isKitLinkActiveAmong(`${base}/org/${page}`, l, org)).map(l => l.key);
  it('only Audit log lights on its own page — Members steps aside', () => {
    assert.deepEqual(lit('members/audit'), ['org/audit']);
  });
  it('Members still lights on its own page, and every other Organization page lights exactly one row', () => {
    assert.deepEqual(lit('members'), ['org/members']);
    assert.deepEqual(lit('settings'), ['org/settings']);
    assert.deepEqual(lit('venues'), ['org/venues']);
    assert.deepEqual(lit('settings/pdf'), ['org/pdf']);
  });
});

describe('the admin kit nav — the plan-aware order (Club Tier Stage 1)', () => {
  it('what the club RUNS leads; house league and tournaments wait in "Also on your plan" until it has one', () => {
    const repClub = clubProgramOrder({ runsHouseLeague: false, hostsTournaments: false });
    assert.deepEqual(repClub.lead, ['rep-teams', 'accounting', 'families', 'public-site']);
    assert.deepEqual(repClub.also, ['house-league', 'tournaments']);

    const everything = clubProgramOrder({ runsHouseLeague: true, hostsTournaments: true });
    assert.deepEqual(everything.lead, ['rep-teams', 'house-league', 'accounting', 'families', 'public-site', 'tournaments']);
    assert.deepEqual(everything.also, []);
  });

  it('tournaments are always last among what the club runs — a rep club is not a tournament club', () => {
    const { lead } = clubProgramOrder({ runsHouseLeague: true, hostsTournaments: true });
    assert.equal(lead[lead.length - 1], 'tournaments');
  });

  it('every program is in exactly one of the two lists, whatever the club runs', () => {
    for (const runsHouseLeague of [true, false]) {
      for (const hostsTournaments of [true, false]) {
        const { lead, also } = clubProgramOrder({ runsHouseLeague, hostsTournaments });
        assert.deepEqual([...lead, ...also].sort(), [...INTERIM_PROGRAM_ORDER].sort());
      }
    }
  });

  it('the order never depends on the member: the person filter is applied AFTER it', () => {
    const { lead } = clubProgramOrder({ runsHouseLeague: false, hostsTournaments: false });
    // A treasurer (Accounting only) sees Accounting alone, from the same order.
    const treasurer = kitPrograms({ base: BASE, canUse: c => c === 'module_accounting', order: lead });
    assert.deepEqual(treasurer.map(p => p.key), ['accounting']);
  });

  it('the rail, the phone bar and the hub read the one order through the one hook', () => {
    const hook = readCode('components/admin/kit/useAdminKitNav.ts');
    // Through Ask 8's one exception (Stage 13a): a person whose only program is house league sees it lead.
    assert.match(hook, /clubProgramOrder\(personClubShape\(club\.shape, canUse\)\)/, 'the hook orders by the morning brief\'s shape');
    assert.match(readCode('components/admin/kit/club/ClubHubKit.tsx'), /useAdminKitNav\(\)/, 'the hub lists the hook\'s programs');
  });
});

describe('the admin kit nav — where you are', () => {
  it('a page lights on its drill-ins, and an index only on itself', () => {
    const [rep] = kitPrograms({ base: BASE, canUse: c => c === 'module_rep_teams' });
    const teams = rep.pages[0];
    assert.equal(isKitLinkActive(`${BASE}/rep-teams`, teams), true);
    // Club Tier Stage 2 (specimen 2's rail): inside a team, the rail's TEAM block lights "Team page",
    // and "Teams" — the board the back arrow leads to — does not light as well.
    assert.equal(isKitLinkActive(`${BASE}/rep-teams/teams/t1`, teams), false, 'a team page is lit in its own block, not as Teams');
    assert.equal(isKitLinkActive(`${BASE}/rep-teams/allocations`, teams), false);
  });

  it('inside a house league season only the season\'s row lights, not Seasons as well (Stage 13 fix-now 8)', () => {
    const [hl] = kitPrograms({ base: BASE, canUse: c => c === 'module_house_league' });
    const seasons = hl.pages.find(p => p.key === 'hl-seasons')!;
    assert.equal(isKitLinkActive(`${BASE}/house-league`, seasons), true, 'lit on its own page');
    assert.equal(isKitLinkActive(`${BASE}/house-league/seasons/s1`, seasons), false, 'a season page is lit in its own block');
    assert.equal(isKitLinkActive(`${BASE}/house-league/seasons/s1/schedule`, seasons), false);
    assert.equal(seasons.also, undefined, 'no also-path: there is no page at /house-league/seasons to light it for');
  });

  it('⚖ Accounting is ONE ROW that never opens; its pages are the tab row (Club Tier Stage 3a, Ask 2 option B)', () => {
    const [acct] = kitPrograms({ base: BASE, canUse: c => c === 'module_accounting' });
    assert.equal(acct.key, 'accounting');
    assert.deepEqual(acct.pages, [], 'no rail pages under Accounting — and so no phone "In Accounting" row');
    const [rep] = kitPrograms({ base: BASE, canUse: c => c === 'module_rep_teams' });
    assert.ok(!rep.pages.some(p => /allocations|payment-requests/.test(p.href)), 'the two money pages left Rep Teams');
    // The tabs: the loop's three only where the club runs rep teams — Budget SECOND, Teams THIRD (one row shape with the
    // coach's Money tabs, owner 2026-10-18).
    assert.deepEqual(accountingTabs(BASE, { runsRepTeams: true }).map(t => t.label),
      ['Overview', 'Budget', 'Teams', 'Ledger', 'Bank', 'Allocations', 'Payment requests', 'Budget vs. Actual']);
    assert.deepEqual(accountingTabs(BASE, { runsRepTeams: false }).map(t => t.id), ['overview', 'budget', 'ledger', 'bank', 'budget-vs-actual']);
    // ⚖ Bank right after the Ledger, for everyone, always (Bank reconciliation B8) — never behind a flag like Payouts.
    assert.equal(accountingTabFor(`${BASE}/accounting/bank`, BASE, { runsRepTeams: false }), 'bank');
    // A tab lights on its own address; a page one level down is no tab (back arrow, no tab row).
    const REP = { runsRepTeams: true };
    assert.equal(accountingTabFor(`${BASE}/accounting`, BASE, REP), 'overview');
    assert.equal(accountingTabFor(`${BASE}/accounting/budget-vs-actual`, BASE, REP), 'budget-vs-actual');
    assert.equal(accountingTabFor(`${BASE}/accounting/budget`, BASE, REP), 'budget', 'Budget must not light on Budget vs. Actual');
    for (const down of ['allocations/a1', 'payees', 'payees/p1', 'allocations/new', 'ledger/l1', 'teams/t1/x']) {
      assert.equal(accountingTabFor(`${BASE}/accounting/${down}`, BASE, REP), null, `${down} is no tab`);
    }
    // ⚖ A team's account is a VIEW of the Teams tab (Club Accounting · Teams, Ask 2): Teams lights on the list AND on a
    // team, and nothing else takes a prefix (Budget above still doesn't light on Budget vs. Actual).
    assert.equal(accountingTabFor(`${BASE}/accounting/teams`, BASE, REP), 'teams');
    assert.equal(accountingTabFor(`${BASE}/accounting/teams/t1`, BASE, REP), 'teams', 'teams/t1 is no longer one level down');
    assert.equal(accountingTabFor(`${BASE}/accounting/teams/t1`, BASE, { runsRepTeams: false }), null, 'no rep teams, no Teams tab to light');
    assert.equal(accountingTabFor(`${BASE}/accounting/teams`, BASE, { runsRepTeams: false }), null);
    // Only a tab with views lights under it, and only one segment down.
    assert.deepEqual(accountingTabs(BASE, REP).filter(t => t.views).map(t => t.id), ['teams']);
    assert.equal(accountingTabFor(`${BASE}/accounting/teams/`, BASE, REP), null);
    assert.equal(accountingTabFor(`${BASE}/accounting/ledger/l1`, BASE, REP), null);
    // A club with no rep teams has no loop tabs, so their addresses light nothing (/review, 10-01).
    assert.equal(accountingTabFor(`${BASE}/accounting/allocations`, BASE, REP), 'allocations');
    assert.equal(accountingTabFor(`${BASE}/accounting/allocations`, BASE, { runsRepTeams: false }), null);
    assert.equal(accountingTabFor(`${BASE}/accounting/payment-requests`, BASE, { runsRepTeams: false }), null);
    // No dead tab: every tab is a real page.
    for (const t of accountingTabs(BASE, { runsRepTeams: true })) assert.ok(routeExists(t.href), `${t.label} → ${t.href}`);
  });

  it('Families is one page with three tabs, its rail row with no pages (Club Tier Stage 5b, Ask 14; Stage 7c, Ask 7)', () => {
    const [fam] = kitPrograms({ base: BASE, canUse: c => c === 'module_families' });
    assert.equal(fam.key, 'families');
    assert.deepEqual(fam.pages, [], 'no rail pages under Families — the tab row moves between the three');
    assert.deepEqual(familiesTabs(BASE).map(t => t.label), ['Families', 'Duplicates', 'Emails']);
    assert.equal(familiesTabFor(`${BASE}/families`, BASE), 'families');
    assert.equal(familiesTabFor(`${BASE}/families/duplicates`, BASE), 'duplicates', 'Duplicates wins its own address');
    assert.equal(familiesTabFor(`${BASE}/families/emails`, BASE), 'emails', 'Emails wins its own address');
    // A family is a record OVER the Families tab: its address lights Families, one segment down only.
    assert.equal(familiesTabFor(`${BASE}/families/p1`, BASE), 'families');
    assert.equal(familiesTabFor(`${BASE}/families/p1/x`, BASE), null);
    for (const t of familiesTabs(BASE)) assert.ok(routeExists(t.href), `${t.label} → ${t.href}`);
    // A child's page (Club Tier Stage 14 S5) is a page of its own, two segments down: no tab, and the frame draws none.
    const child = familiesChildHref(BASE, 'c1', 'p1');
    assert.equal(child, `${BASE}/families/children/c1?from=p1`);
    assert.equal(familiesChildHref(BASE, 'c1'), `${BASE}/families/children/c1`);
    assert.equal(familiesTabFor(`${BASE}/families/children/c1`, BASE), null);
    assert.equal(isFamiliesChildPage(`${BASE}/families/children/c1`, BASE), true);
    assert.equal(isFamiliesChildPage(`${BASE}/families/children`, BASE), false);
    assert.equal(isFamiliesChildPage(`${BASE}/families/p1`, BASE), false);
    assert.equal(isFamiliesChildPage(`${BASE}/families/children/c1/x`, BASE), false);
    assert.ok(existsSync('app/[orgSlug]/admin/families/children/[childId]/page.tsx'), 'the child page is a real route');
  });

  it('knows which group to open', () => {
    assert.equal(activeKitSection(`${BASE}/rep-teams/past`, BASE), 'rep-teams');
    assert.equal(activeKitSection(`${BASE}/org/members`, BASE), 'org');
    assert.equal(activeKitSection(BASE, BASE), null);
    assert.equal(activeKitSection(`${BASE}/help`, BASE), null);
  });

  it('the tournament rail\'s words are in sentence case in the config itself (the old map retired, Stage 5)', () => {
    for (const item of TOUR_GROUPS.flatMap(g => g.items)) {
      // Only the first letter is a capital; every later word starts lower case.
      const laterWords = item.label.split(/\s+/).slice(1).filter(w => /^[A-Za-z]/.test(w));
      for (const w of laterWords) assert.equal(w[0], w[0].toLowerCase(), `${item.label}: "${w}" is Title Case`);
      assert.equal(item.label[0], item.label[0].toUpperCase(), 'the first letter keeps its capital');
    }
  });
});

describe('the admin kit nav — one model, two navs', () => {
  it('the rail and the phone bar both read the shared hook and none holds its own program list', () => {
    // ⚰ The phone's "In <program>" row (`AdminKitProgramRow`) retired with Club Tier Stage 13i (A6): its pages are tabs now.
    for (const file of ['components/admin/kit/AdminKitRail.tsx', 'components/admin/kit/AdminKitBottomNav.tsx']) {
      const code = readCode(file);
      assert.match(code, /useAdminKitNav\(\)/, `${file} must read the shared nav`);
      assert.doesNotMatch(code, /['"]\/rep-teams\/(allocations|documents|past)['"]/, `${file} hand-writes a program page`);
    }
  });

  it('the tournament groups are built once — the rail and the bar read them, neither re-filters', () => {
    for (const file of ['components/admin/kit/AdminKitRail.tsx', 'components/admin/kit/AdminKitBottomNav.tsx']) {
      const code = readCode(file);
      assert.match(code, /tournamentGroups/, `${file} must read the shared tournament groups`);
      assert.doesNotMatch(code, /isNavKeyHiddenInSandbox|\.roles\b/, `${file} re-applies a sandbox or role filter of its own`);
    }
  });

  it('a role-gated row drops out of EVERY group, the sandbox corners drop out, Summary joins once the event is over', () => {
    const keys = (role: string, status: string, isSandbox = false, planId = 'tournament_plus') =>
      kitTournamentGroups({ status, isSandbox, role, planId }).flatMap(g => g.items.map(i => i.key));
    assert.ok(keys('owner', 'draft').includes('settings/event'));
    assert.ok(!keys('treasurer', 'draft').includes('settings/event'), 'Event Settings is owner/admin-only');
    assert.ok(!keys('owner', 'active').includes('summary'));
    assert.ok(keys('owner', 'completed').includes('summary') && keys('owner', 'archived').includes('summary'));
    assert.ok(keys('owner', 'active', true).length < keys('owner', 'active').length, 'the sandbox hides its curated corners');
    for (const g of kitTournamentGroups({ status: 'active', isSandbox: true, role: 'official', planId: 'tournament_plus' })) {
      assert.ok(g.items.length > 0, `${g.key} kept as an empty group`);
    }
  });

  it('an invite-only event has no Check-in, Staff kit, Chat or Summary row — absent, never a wall (free tier R5)', () => {
    const keys = (planId: string, status: string) =>
      kitTournamentGroups({ status, isSandbox: false, role: 'owner', planId }).flatMap(g => g.items.map(i => i.key));
    for (const plan of ['tournament', 'team']) {
      for (const status of ['draft', 'active', 'completed', 'archived']) {
        for (const gone of ['check-in', 'staff-kit', 'chat', 'summary']) {
          assert.ok(!keys(plan, status).includes(gone), `${plan} ${status}: ${gone} is absent`);
        }
        for (const kept of ['dashboard', 'registrations', 'schedule', 'results', 'communication']) {
          assert.ok(keys(plan, status).includes(kept), `${plan} ${status}: ${kept} stays`);
        }
      }
    }
    for (const plan of ['tournament_plus', 'league', 'club', 'club_large']) {
      for (const kept of ['check-in', 'staff-kit', 'chat', 'summary']) {
        // ⚖ Chat is paused (2026-10-18): no plan shows the Chat row while the switch is on.
        const shown = kept === 'chat' ? !CHAT_PAUSED : true;
        assert.equal(keys(plan, 'completed').includes(kept), shown, `${plan} ${shown ? 'keeps' : 'hides'} ${kept}`);
      }
    }
  });

  it('the phone bar follows the event’s phase, not its status (owner, 2026-10-16)', () => {
    assert.deepEqual(tournamentBarKeys('draft'), ['dashboard', 'registrations', 'schedule', 'branding'], 'Draft: the checklist’s dashboard, Setup in More');
    assert.deepEqual(tournamentBarKeys('open'), ['dashboard', 'registrations', 'schedule', 'chat'], 'Open: no Results or Check-in months out');
    for (const phase of ['gameday', 'completed', 'archived'] as const) {
      assert.deepEqual(tournamentBarKeys(phase), ['dashboard', 'results', 'schedule', 'chat'], `${phase}: Check-in in More`);
    }
    // Every key is a real tournament nav row, so the bar never names a page the groups do not have.
    const navKeys = new Set(TOUR_GROUPS.flatMap(g => g.items.map(i => i.key)));
    for (const phase of ['draft', 'open', 'gameday', 'completed', 'archived'] as const) {
      for (const key of tournamentBarKeys(phase)) assert.ok(navKeys.has(key), `${phase}: ${key} is a nav row`);
      assert.equal(tournamentBarKeys(phase)[0], 'dashboard', `${phase}: Dashboard is pinned to the left corner`);
      assert.equal(tournamentBarKeys(phase)[2], 'schedule', `${phase}: Schedule keeps the third slot`);
    }
    const code = readCode('components/admin/kit/AdminKitBottomNav.tsx');
    assert.match(code, /tournamentBarKeys\(phase\)/, 'the bar reads the one phase rule');
    assert.match(code, /resolveEventPhase\(\{/, 'the phase is the header’s: the dates, or the first game having started, until the organizer marks it complete');
    assert.doesNotMatch(code, /opsByKey\.get\('check-in'\)/, 'Check-in is never a tab of the bar');
    assert.match(code, /opsByKey\.get\('chat'\) \?\? relabel\(opsByKey\.get\('communication'\), MESSAGES_TAB\)/, 'Messages takes Chat’s place (M6)');
    assert.match(code, /useChatUnread\(tournamentBar && chatInNav\)/, 'no Chat count where Chat is no door');
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚖ PLACES IN THE SIDEBAR (Club Tier Stage 13i Session B — Asks 1, 2 and 5 = A, Ask 4 = B, owner 2026-11-06; NAV_STANDARD
 * N2, N3, N11). The club sidebar lists places only and never grows: the same rows on every screen, one lit — the place you
 * are in, at any depth. The five people are read through the hook's own calls (`_club-people.ts`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('13i · the club sidebar lists places only', () => {
  const rows = (role: OrgRole, shape = RUNS_BOTH) => clubNavFor(role, shape).sidebarRows;

  // ⚖ 13c C1 = A (owner 2026-11-08): Permits is a place between Calendar and Schedules for every role that opened the permit
  // list before — owner 10 → 11, admin 9 → 10, league admin 4 → 5, registrar 4 → 5, treasurer 3 → 4 (and staff, the same day).
  // ⚖ E4 (navigation Phase 1, owner 2026-11-09): a hosted Tournaments left the places for the foot's door — owner 11 → 10,
  // admin 10 → 9 (the door is `tournamentsDoor`, below).
  it('the place lists and their gates: owner 10, admin 9, league admin 5, registrar 5, treasurer 4', () => {
    assert.deepEqual(rows('owner'), ['overview', 'calendar', 'permits', 'schedules', 'rep-teams', 'house-league', 'accounting', 'families', 'public-site', 'org']);
    assert.deepEqual(rows('admin'), ['overview', 'calendar', 'permits', 'schedules', 'rep-teams', 'house-league', 'accounting', 'public-site', 'org'], 'no Families: an explicit grant only');
    assert.deepEqual(rows('league_admin'), ['overview', 'calendar', 'permits', 'house-league', 'org']);
    assert.deepEqual(rows('league_registrar'), ['overview', 'calendar', 'permits', 'house-league', 'org']);
    assert.deepEqual(rows('treasurer'), ['overview', 'permits', 'accounting', 'org']);
  });

  it('13c · Permits: every role that read the permit list before keeps it (staff = A, owner 2026-11-08); never a coach or a volunteer', () => {
    const permitsFor = (role: OrgRole, o: Partial<Parameters<typeof kitPermitsLink>[0]> = {}) =>
      kitPermitsLink({ base: '/o/admin', role, isCanceled: false, tournamentTier: false, hasVenueLibrary: true, ...o });
    for (const role of ['owner', 'admin', 'league_admin', 'league_registrar', 'treasurer', 'staff'] as OrgRole[]) {
      assert.equal(permitsFor(role)?.href, '/o/admin/permits', role);
    }
    assert.equal(permitsFor('coach'), null, 'the permits route refuses a coach');
    assert.equal(permitsFor('official'), null, 'a volunteer never reaches the admin');
    assert.equal(permitsFor('owner', { hasVenueLibrary: false }), null, 'permits ride the Venue library’s plans (Ask 4)');
    assert.equal(permitsFor('owner', { tournamentTier: true }), null, 'a Tournament plan has no club side');
    assert.equal(permitsFor('owner', { isCanceled: true }), null);
  });

  it('13c · the bar names Permits where the rail lists it — a one-page place, so no tab row', () => {
    const access = { canUse: () => true, seasonAccess: null, orgTabs: null, runsRepTeams: true, hasPayouts: false, opensFamilies: true };
    const place = clubPlaceAt('/o/admin/permits', '/o/admin', { ...access, opensPermits: true });
    assert.equal(place?.key, 'permits');
    assert.equal(place?.title, 'Permits');
    assert.equal(place?.tabs.length, 1, 'a row of one tab is no row (HubTabBar)');
    assert.equal(clubPlaceAt('/o/admin/permits', '/o/admin', access), null, 'not for someone the rail does not list it for');
    assert.equal(clubPlaceAt('/o/admin/permitsx', '/o/admin', { ...access, opensPermits: true }), null, 'never a sibling address');
  });

  it('the groups: Programs (Rep teams, House league), then Also on your plan, then Club with Organization last', () => {
    const owner = clubNavFor('owner', RUNS_BOTH).groups.map(g => [g.key, g.places.map(p => p.key)]);
    assert.deepEqual(owner, [['programs', ['rep-teams', 'house-league']], ['club', ['accounting', 'families', 'public-site', 'org']]], 'a hosted Tournaments is the foot’s door, not a place');
    assert.equal(clubNavFor('owner', RUNS_BOTH).tournamentsDoor, true);
    const notYet = clubNavFor('owner', RUNS_NEITHER).groups.map(g => [g.key, g.places.map(p => p.key)]);
    assert.deepEqual(notYet, [['programs', ['rep-teams']], ['also', ['house-league', 'tournaments']], ['club', ['accounting', 'families', 'public-site', 'org']]]);
    assert.equal(clubNavFor('owner', RUNS_NEITHER).tournamentsDoor, false, 'no current tournament: the quiet row stays, no foot door');
  });

  // ⚖ E15 (navigation Phase 1, owner 2026-11-09): the tournament director — a person whose only program is tournaments,
  // decided by what they OPEN (the staff role's default) — keeps Tournaments as a row and a phone-bar slot, before the club
  // hosts one too: house league's twin (Ask 8). Never a foot door for them.
  it('E15: the tournament director keeps Tournaments as a Programs row and the bar’s third slot, hosted or not', () => {
    for (const shape of [RUNS_BOTH, RUNS_NEITHER]) {
      const n = clubNavFor('staff', shape);
      assert.deepEqual(n.programs.map(p => p.key), ['tournaments'], 'it leads');
      assert.deepEqual(n.alsoOnPlan.map(p => p.key), [], 'never "Also on your plan"');
      assert.equal(n.tournamentsDoor, false, 'no foot door: the row is the door');
      assert.deepEqual(n.groups.find(g => g.key === 'programs')?.places.map(p => p.key), ['tournaments']);
      assert.deepEqual(n.phone.tabs.map(t => t.key), ['calendar', 'tournaments']);
    }
    // A staff member also given Accounting opens two programs: the club's own shape, the door rule as everyone's.
    const both = clubNavFor('staff', RUNS_BOTH, { module_accounting: true });
    assert.ok(!both.programs.some(p => p.key === 'tournaments'));
    assert.equal(both.tournamentsDoor, true);
  });

  it('a heading over two or more rows; a lone row keeps its space with no word; "Also on your plan" always said', () => {
    const headings = (role: OrgRole, shape = RUNS_BOTH) => clubNavFor(role, shape).groups.map(placeGroupHeading);
    assert.deepEqual(headings('owner'), ['Programs', 'Club']);
    assert.deepEqual(headings('league_registrar'), [null, null], 'House league and Organization, each alone');
    assert.deepEqual(headings('treasurer'), ['Club'], 'Accounting and Organization');
    assert.deepEqual(headings('admin', RUNS_NEITHER), [null, 'Also on your plan', 'Club'], 'Rep teams alone; the quiet group is named');
  });

  it('one lit row at any depth: Rep teams on a team’s Roster, House league on a season’s Registrations, Organization on Audit log', () => {
    const billing = kitBillingLink({ orgSlug: 'demo-club', planId: 'club', role: 'owner', capabilities: null });
    const lit = (p: string) => litClubPlace(`${BASE}${p}`, BASE, billing);
    assert.equal(lit('/rep-teams/teams/t1/roster'), 'rep-teams');
    assert.equal(lit('/rep-teams/assistant-coaches'), 'rep-teams');
    assert.equal(lit('/house-league/seasons/s1/registrations'), 'house-league');
    assert.equal(lit('/org/members/audit'), 'org');
    assert.equal(lit('/org/board'), 'org');
    assert.equal(lit('/accounting/teams/t1'), 'accounting');
    assert.equal(lit('/calendar'), null, 'Calendar lights its own row, no place');
    assert.equal(lit(''), null, 'Overview lights its own row');
    // ⚖ Ask 4 = B: Plan & billing lives under /org but is no Organization tab — its foot row is the lit one, no place.
    assert.ok(billing && billing.href.startsWith(`${BASE}/org/`), 'the club plan’s billing page is under Organization’s address');
    assert.equal(lit('/org/billing'), null);
    assert.equal(litClubPlace(`${BASE}/org/billing`, BASE, null), 'org', 'a person with no billing door: the address alone');
  });

  it('LEAD_ORDER is unchanged: the groups are a map beside it, so no club’s phone bar or tiles move (N10)', () => {
    assert.deepEqual(clubProgramOrder(RUNS_BOTH).lead, ['rep-teams', 'house-league', 'accounting', 'families', 'public-site', 'tournaments']);
    const nav = readCode('lib/admin-kit-nav.ts');
    assert.match(nav, /const LEAD_ORDER: readonly AdminProgramKey\[\] = \[\n  'rep-teams', 'house-league', 'accounting', 'families', 'public-site', 'tournaments',\n\];/);
    assert.match(nav, /const PLACE_GROUP: Record<AdminProgramKey, 'programs' \| 'club'> = \{/);
  });

  it('the rail and the sheet read the one list of places; nothing renders under a row', () => {
    const rail = readCode('components/admin/kit/AdminKitRail.tsx');
    assert.match(rail, /\{placeGroups\.map\(group => \{/);
    assert.doesNotMatch(rail, /clubPlaceGroups\(/, 'the rail builds its own list of places');
    assert.doesNotMatch(readCode('components/admin/kit/AdminKitBottomNav.tsx'), /clubPlaceGroups\(/, 'the sheet builds its own list of places');
    assert.match(rail, /active=\{litPlace === place\.key\}/, 'one lit row: the place you are in');
    assert.doesNotMatch(rail, /RepTeamBlock|SeasonBlock|repTeamPages|seasonPages|\.pages\.map|programOpen|useRailTeam/, 'a row opens pages under it again');
    assert.ok(!existsSync(path.join(process.cwd(), 'components/admin/kit/useRailTeam.ts')), 'the rail’s team name store is back');
    const hook = readCode('components/admin/kit/useAdminKitNav.ts');
    assert.match(hook, /const placeGroups = tournamentOnly \|\| isCanceled \? \[\] : clubPlaceGroups<KitLink>\(\{\s*programs: navPrograms, alsoOnPlan, organization: kitOrgPlace\(\{ base, orgLinks, tournamentOnly \}\),\s*\}\);/);
    assert.match(hook, /const litPlace = litClubPlace\(pathname, base, billingLink\);/);
  });

  it('Organization is one place; its pages are its tabs, never Plan & billing (Ask 4 = B)', () => {
    const owner = clubNavFor('owner', RUNS_BOTH);
    assert.deepEqual(owner.orgPlace, { key: 'org', label: 'Organization', href: `${BASE}/org`, icon: owner.orgPlace!.icon });
    const tabs = orgTabs({ base: BASE, orgLinks: owner.orgLinks, showsBoard: false });
    assert.deepEqual(tabs.map(t => t.label), ['Members', 'Audit log', 'Settings', 'Venue library', 'PDF settings']);
    assert.ok(!tabs.some(t => t.id === 'org/billing' || /billing/i.test(t.href)), 'Plan & billing became an Organization tab');
    assert.equal(kitOrgPlace({ base: BASE, orgLinks: [], tournamentOnly: false }), null, 'no tabs to hold, no place');
    assert.equal(kitOrgPlace({ base: BASE, orgLinks: owner.orgLinks, tournamentOnly: true }), null, 'tournament-only: the flat Account list');
    assert.deepEqual(kitOrgLinks({ base: BASE, role: 'owner', isCanceled: true, canSeeMembers: true, hasVenueLibrary: true }), [], 'a cancelled club has no Organization links, so no place');
  });
});

// ⚖ Admin header bar Phase 2 session B (2026-11-07): the six places the pinned bar names from the ADDRESS alone, before a
// frame has handed it anything. A person refused a place keeps the club's name (null), and the row is only their tabs.
describe('the place an address is in (the pinned bar, Phase 2)', () => {
  const B = CLUB_BASE;
  const accessFor = (role: OrgRole, over: Partial<ClubPlaceAccess> = {}): ClubPlaceAccess => {
    const { orgLinks } = clubNavFor(role, RUNS_BOTH);
    return {
      canUse: (c: Capability) => hasCapability(role, null, c),
      seasonAccess: null,
      orgTabs: orgTabs({ base: B, orgLinks, showsBoard: showsOrgBoard({ role, orgLinks, isTeamWorkspace: false }) }),
      runsRepTeams: true,
      hasPayouts: false,
      opensFamilies: hasCapability(role, null, 'module_families'),
      ...over,
    };
  };
  const owner = accessFor('owner');

  it('a team is its own place inside Rep teams: "← Teams", five tabs, record pages none', () => {
    const p = clubPlaceAt(`${B}/rep-teams/teams/t1/roster`, B, owner);
    assert.equal(p?.key, 'team:t1');
    assert.equal(p?.title, 'Team');
    assert.deepEqual(p?.back, { href: `${B}/rep-teams`, label: 'Teams' });
    assert.deepEqual(p?.facts, ['Rep teams']);
    assert.deepEqual(p?.tabs.map(t => t.label), ['Team page', 'Roster', 'Schedule', 'Tryouts', 'Coaches']);
    assert.equal(p?.activeId, 'roster');
    // Phase 3 (A8): History is a record page — its own key, no tab row, back to the team (named once the page has it).
    const history = clubPlaceAt(`${B}/rep-teams/teams/t1/history`, B, owner);
    assert.equal(history?.key, 'team-history:t1', 'History is a record page of its own, never the team place');
    assert.deepEqual(history?.tabs, []);
    assert.equal(clubPlaceAt(`${B}/rep-teams`, B, owner)?.key, 'rep-teams', 'the Teams tab is still Rep teams');
    assert.equal(clubPlaceAt(`${B}/rep-teams/teams/t1`, B, { ...owner, canUse: () => false }), null, 'refused: the club’s name');
  });

  it('Accounting: its tabs, a team’s account lights Teams, no fiscal year, Payouts only where the club has payouts', () => {
    const p = clubPlaceAt(`${B}/accounting/ledger`, B, owner);
    assert.equal(p?.key, 'accounting');
    assert.equal(p?.title, 'Accounting');
    assert.deepEqual(p?.facts, [], 'A6: the bar never says which fiscal year');
    assert.equal(p?.back, undefined);
    assert.ok(!p?.tabs.some(t => t.id === 'payouts'), 'no payouts connected: no Payouts tab');
    assert.equal(clubPlaceAt(`${B}/accounting/teams/t1`, B, owner)?.activeId, 'teams', 'a team’s account is a view of Teams');
    // The server's fact (the admin layout reads it once): the first paint names the exact row, Payouts last.
    const paid = clubPlaceAt(`${B}/accounting/ledger`, B, { ...owner, hasPayouts: true });
    assert.equal(paid?.tabs.at(-1)?.id, 'payouts');
    assert.equal(clubPlaceAt(`${B}/accounting/payouts`, B, { ...owner, hasPayouts: true })?.activeId, 'payouts');
    assert.equal(clubPlaceAt(`${B}/accounting/payouts`, B, owner), null, 'no payouts: its address is no tab');
    assert.equal(clubPlaceAt(`${B}/accounting/allocations`, B, { ...owner, runsRepTeams: false }), null, 'no loop tab without rep teams');
    assert.equal(clubPlaceAt(`${B}/accounting`, B, accessFor('league_registrar'))?.key, undefined, 'a registrar is refused');
    assert.equal(clubPlaceAt(`${B}/accounting`, B, accessFor('treasurer'))?.key, 'accounting', 'the treasurer is in');
  });

  it('Families: three tabs, a family lights Families, a child’s page is a record page', () => {
    const p = clubPlaceAt(`${B}/families/duplicates`, B, accessFor('owner', { opensFamilies: true }));
    assert.equal(p?.key, 'families');
    assert.deepEqual(p?.tabs.map(t => t.id), ['families', 'duplicates', 'emails']);
    assert.equal(p?.activeId, 'duplicates');
    assert.equal(clubPlaceAt(`${B}/families/p1`, B, accessFor('owner', { opensFamilies: true }))?.activeId, 'families');
    // Phase 3 (A8): a child's page is a record page — "← Families" from the address, never the Families tab row.
    const child = clubPlaceAt(familiesChildHref(B, 'c1'), B, accessFor('owner', { opensFamilies: true }));
    assert.equal(child?.key, 'child:c1');
    assert.deepEqual(child?.tabs, []);
    assert.equal(clubPlaceAt(`${B}/families`, B, { ...owner, opensFamilies: false }), null, 'refused (or limited to some team groups): the club’s name');
  });

  it('Organization: only the person’s tabs, never Plan & billing, "The board" for someone without Members', () => {
    const p = clubPlaceAt(`${B}/org/members`, B, owner);
    assert.equal(p?.key, 'org');
    assert.equal(p?.title, 'Organization');
    assert.ok(!p?.tabs.some(t => t.href.includes('/org/billing')));
    assert.equal(clubPlaceAt(`${B}/org/billing`, B, owner), null, 'Plan & billing is no tab (and without its gate, no name)');
    assert.equal(clubPlaceAt(`${B}/org/billing`, B, { ...owner, opensBilling: true })?.key, 'billing', 'round 5 Q1: it names itself, no tab');
    const registrar = clubPlaceAt(`${B}/org/board`, B, accessFor('league_registrar'));
    assert.equal(registrar?.tabs[0]?.label, 'The board');
    assert.equal(clubPlaceAt(`${B}/org/members`, B, accessFor('league_registrar')), null, 'not their tab: no place');
    assert.equal(clubPlaceAt(`${B}/org/members`, B, { ...owner, orgTabs: null }), null, 'a one-team workspace: no place');
  });

  it('a one-tab person gets a place with ONE tab (the bar then draws no row)', () => {
    const one = clubPlaceAt(`${B}/org/venues`, B, { ...owner, orgTabs: [{ id: 'org/venues', label: 'Venue library', href: `${B}/org/venues` }] });
    assert.equal(one?.tabs.length, 1);
    // Round 4 (2026-11-08): the one place model both headers read decides it.
    assert.match(readCode('components/admin/useAdminPlace.tsx'), /tabbed: place && place\.tabs\.length > 1 \? place : null,/);
  });

  // ⚖ Phase 3 (round 5, owner 2026-11-08, Q1–Q6): the screens with no place of their own name themselves, each with its
  // page's own refusal rule, so the header never names a screen over its refusal (Q5).
  describe('Phase 3 · the screens with no place of their own', () => {
    const open = { ...owner, opensCalendar: true, opensSchedules: true, opensPublicSite: true, opensBilling: true,
      seasonAccess: { read: true, readMoney: true, email: true } };
    const named = (path: string, access: ClubPlaceAccess = open) => clubPlaceAt(path, B, access);

    it('each fixed-name screen is a name with no tab row and no way back', () => {
      for (const [path, key, title] of [
        [`${B}/calendar`, 'calendar', 'Calendar'], [`${B}/schedules`, 'schedules', 'Schedules'],
        [`${B}/notifications`, 'notifications', 'Notifications'], [`${B}/house-league`, 'hl-seasons', 'Seasons'],
        [`${B}/public-site`, 'public-site', 'Public site'], [`${B}/org/billing`, 'billing', 'Plan & billing'],
      ] as const) {
        const p = named(path);
        assert.equal(p?.key, key, path);
        assert.equal(p?.title, title, path);
        assert.deepEqual(p?.tabs, [], `${path}: no tab row`);
        assert.equal(p?.back, undefined, `${path}: no way back`);
      }
      assert.deepEqual(named(`${B}/house-league`)?.facts, ['House league'], 'Q2: the phone line says the section');
    });

    it('each screen refuses exactly where its page does: the club’s name, never the screen’s (Q5)', () => {
      assert.equal(named(`${B}/calendar`, { ...open, opensCalendar: false }), null);
      assert.equal(named(`${B}/schedules`, { ...open, opensSchedules: false }), null);
      assert.equal(named(`${B}/schedules/s1`, { ...open, opensSchedules: false }), null);
      assert.equal(named(`${B}/public-site`, { ...open, opensPublicSite: false }), null);
      assert.equal(named(`${B}/org/billing`, { ...open, opensBilling: false }), null);
      assert.equal(named(`${B}/house-league`, { ...open, seasonAccess: { read: false, readMoney: true, email: false } }), null,
        'a treasurer who reads a season’s money but not the house league: refused on Seasons, as the page refuses');
      assert.equal(named(`${B}/house-league`, { ...open, seasonAccess: null }), null, 'before the member is known: no place');
      const club = `${B}/house-league/seasons/se1/club-schedule/cs1`;
      assert.equal(named(club, { ...open, seasonAccess: { read: false, readMoney: true, email: false } }), null);
      assert.equal(named(`${B}/rep-teams/rename-slugs`, { ...open, canUse: () => false }), null);
      assert.equal(named(`${B}/rep-teams/teams/t1/history`, { ...open, canUse: () => false }), null);
      assert.equal(named(familiesChildHref(B, 'c1'), { ...open, opensFamilies: false }), null, 'a group-limited member: refused');
      assert.equal(named(`${B}/notifications`, accessFor('league_registrar'))?.key, 'notifications', 'Notifications is everyone’s');
    });

    it('record pages: a placeholder name, the way back, and their own key (the hand-off counts only for it)', () => {
      const sch = named(`${B}/schedules/s1`);
      assert.equal(sch?.key, 'schedule:s1');
      assert.equal(sch?.title, 'Schedule');
      assert.deepEqual(sch?.back, { href: `${B}/schedules`, label: 'Schedules' });
      const hist = named(`${B}/rep-teams/teams/t1/history`);
      assert.equal(hist?.title, 'History');
      assert.deepEqual(hist?.back, { href: `${B}/rep-teams/teams/t1`, label: 'Team' });
      const year = named(`${B}/rep-teams/teams/t1/history/y1`);
      assert.equal(year?.key, 'team-year:y1');
      assert.deepEqual(year?.back, { href: `${B}/rep-teams/teams/t1/history`, label: 'History' });
      const rename = named(`${B}/rep-teams/rename-slugs`);
      assert.deepEqual(rename?.back, { href: `${B}/rep-teams`, label: 'Rep teams' }, 'A9: "← Rep teams"');
      const club = named(`${B}/house-league/seasons/se1/club-schedule/cs1`);
      assert.equal(club?.key, 'club-schedule:cs1');
      assert.deepEqual(club?.back, { href: `${B}/house-league/seasons/se1/schedule?time=1`, label: 'House league’s time' });
      assert.deepEqual(club?.facts, ['The club’s schedule']);
      const child = named(familiesChildHref(B, 'c1'));
      assert.deepEqual(child?.back, { href: `${B}/families`, label: 'Families' });
      // Never a deeper or sibling address.
      assert.equal(named(`${B}/schedules/s1/x`), null);
      assert.equal(named(`${B}/rep-teams/teams/t1/history/y1/x`), null);
      assert.equal(named(`${B}/calendarx`), null);
      assert.equal(named(`${B}/house-league/new`), null);
    });

    it('not Phase 3: a team’s account in Accounting stays a view of Teams; Club setup keeps its heading (Q1)', () => {
      assert.equal(named(`${B}/accounting/teams/t1`)?.key, 'accounting');
      assert.equal(named(`${B}/onboarding`), null);
    });

    it('A10 + Q6: the org-wide tournament screens are the organization’s; event pages stay the event’s', () => {
      for (const p of ['manage', 'archives', 'settings', 'settings/members', 'settings/members/audit', 'settings/subscription',
        'settings/subscription/mock-portal', 'settings/payouts', 'settings/pdf']) {
        assert.ok(isTournamentOrgScreen(`${B}/tournaments/${p}`, B), `${p} names the organization`);
      }
      for (const p of ['dashboard', 'registrations', 'schedule', 'settings/event', 'settings/notifications',
        'settings/registration-fields', 'branding', 'managex', 'settings/eventx']) {
        assert.ok(!isTournamentOrgScreen(`${B}/tournaments/${p}`, B), `${p} is the event's`);
      }
      assert.match(readCode('components/admin/useAdminPlace.tsx'), /!\(currentOrg && isTournamentOrgScreen\(/, 'the model asks it');
    });
  });
});
