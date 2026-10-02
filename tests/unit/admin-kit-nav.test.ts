import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  kitPrograms, kitOrgLinks, isKitLinkActive, activeKitSection, kitTournamentLabel,
  clubProgramOrder, INTERIM_PROGRAM_ORDER, PROGRAM_CAPABILITY, accountingTabs, accountingTabFor,
} from '../../lib/admin-kit-nav.ts';
import { TOUR_GROUPS } from '../../components/admin/admin-nav-config.ts';
import { kitTournamentGroups } from '../../components/admin/kit/kit-tournament-groups.ts';
import { readCode } from './_source-code.ts';

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
  const rel = href.replace(BASE, '').replace(/[?#].*$/, '');
  return existsSync(path.join('app/[orgSlug]/admin', rel, 'page.tsx'));
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
    assert.deepEqual(labels('owner'), ['Members', 'Audit log', 'Plan & billing', 'Settings', 'Venue library', 'PDF settings']);
    assert.deepEqual(labels('admin'), ['Members', 'Venue library', 'PDF settings']);
    assert.deepEqual(labels('treasurer'), ['Members', 'Venue library']);
    assert.deepEqual(labels('owner', true), ['Plan & billing'], 'a cancelled club keeps only the way to pay again');
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
    const owner = ['Audit log', 'Plan & billing', 'Settings'];
    const adminDoors = kitOrgLinks({ base: BASE, role: 'admin', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true }).map(l => l.label);
    for (const label of owner) assert.ok(!adminDoors.includes(label), `${label} is the owner's — not listed for an admin`);
    const ownerDoors = kitOrgLinks({ base: BASE, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true }).map(l => l.label);
    for (const label of owner) assert.ok(ownerDoors.includes(label), `the owner keeps ${label} as a door`);
    const nav = readCode('lib/admin-kit-nav.ts');
    assert.doesNotMatch(nav, /export function kitOrgLockedRows|export type KitLockedRow/, 'the locked-row list must not come back');
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
    assert.match(hook, /clubProgramOrder\(club\.shape\)/, 'the hook orders by the morning brief\'s shape');
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

  it('⚖ Accounting is ONE ROW that never opens; its pages are the tab row (Club Tier Stage 3a, Ask 2 option B)', () => {
    const [acct] = kitPrograms({ base: BASE, canUse: c => c === 'module_accounting' });
    assert.equal(acct.key, 'accounting');
    assert.deepEqual(acct.pages, [], 'no rail pages under Accounting — and so no phone "In Accounting" row');
    const [rep] = kitPrograms({ base: BASE, canUse: c => c === 'module_rep_teams' });
    assert.ok(!rep.pages.some(p => /allocations|payment-requests/.test(p.href)), 'the two money pages left Rep Teams');
    // The tabs: the loop's two only where the club runs rep teams.
    assert.deepEqual(accountingTabs(BASE, { runsRepTeams: true }).map(t => t.label),
      ['Overview', 'Ledger', 'Allocations', 'Payment requests', 'Budget', 'Budget vs. Actual']);
    assert.deepEqual(accountingTabs(BASE, { runsRepTeams: false }).map(t => t.id), ['overview', 'ledger', 'budget', 'budget-vs-actual']);
    // A tab lights on its own address; a page one level down is no tab (back arrow, no tab row).
    const REP = { runsRepTeams: true };
    assert.equal(accountingTabFor(`${BASE}/accounting`, BASE, REP), 'overview');
    assert.equal(accountingTabFor(`${BASE}/accounting/budget-vs-actual`, BASE, REP), 'budget-vs-actual');
    assert.equal(accountingTabFor(`${BASE}/accounting/budget`, BASE, REP), 'budget', 'Budget must not light on Budget vs. Actual');
    for (const down of ['allocations/a1', 'teams/t1', 'payees', 'budget/allocate/l1', 'allocations/new', 'ledger/l1']) {
      assert.equal(accountingTabFor(`${BASE}/accounting/${down}`, BASE, REP), null, `${down} is one level down`);
    }
    // A club with no rep teams has no loop tabs, so their addresses light nothing (/review, 10-01).
    assert.equal(accountingTabFor(`${BASE}/accounting/allocations`, BASE, REP), 'allocations');
    assert.equal(accountingTabFor(`${BASE}/accounting/allocations`, BASE, { runsRepTeams: false }), null);
    assert.equal(accountingTabFor(`${BASE}/accounting/payment-requests`, BASE, { runsRepTeams: false }), null);
    // No dead tab: every tab is a real page.
    for (const t of accountingTabs(BASE, { runsRepTeams: true })) assert.ok(routeExists(t.href), `${t.label} → ${t.href}`);
  });

  it('knows which group to open', () => {
    assert.equal(activeKitSection(`${BASE}/rep-teams/past`, BASE), 'rep-teams');
    assert.equal(activeKitSection(`${BASE}/org/members`, BASE), 'org');
    assert.equal(activeKitSection(BASE, BASE), null);
    assert.equal(activeKitSection(`${BASE}/help`, BASE), null);
  });

  it('the tournament rail keeps its words, in the kit case', () => {
    for (const item of TOUR_GROUPS.flatMap(g => g.items)) {
      const kit = kitTournamentLabel(item.label);
      assert.equal(kit.toLowerCase(), item.label.toLowerCase(), `${item.label} changed a WORD, not a capital`);
      assert.equal(kit[0], item.label[0], 'the first letter keeps its capital');
    }
  });
});

describe('the admin kit nav — one model, two navs', () => {
  it('the rail and the phone bar both read the shared hook and none holds its own program list', () => {
    for (const file of ['components/admin/kit/AdminKitRail.tsx', 'components/admin/kit/AdminKitBottomNav.tsx', 'components/admin/kit/AdminKitProgramRow.tsx']) {
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
    const keys = (role: string, status: string, isSandbox = false) =>
      kitTournamentGroups({ status, isSandbox, role }).flatMap(g => g.items.map(i => i.key));
    assert.ok(keys('owner', 'draft').includes('settings/event'));
    assert.ok(!keys('treasurer', 'draft').includes('settings/event'), 'Event Settings is owner/admin-only');
    assert.ok(!keys('owner', 'active').includes('summary'));
    assert.ok(keys('owner', 'completed').includes('summary') && keys('owner', 'archived').includes('summary'));
    assert.ok(keys('owner', 'active', true).length < keys('owner', 'active').length, 'the sandbox hides its curated corners');
    for (const g of kitTournamentGroups({ status: 'active', isSandbox: true, role: 'official' })) {
      assert.ok(g.items.length > 0, `${g.key} kept as an empty group`);
    }
  });
});
