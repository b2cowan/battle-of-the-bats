import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  kitPrograms, kitOrgLinks, isKitLinkActive, activeKitSection, kitTournamentLabel,
  INTERIM_PROGRAM_ORDER, PROGRAM_CAPABILITY,
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
 *      Settings stay owner-only, PDF settings and Coaches Portal links owner-or-admin, a cancelled
 *      club keeps only its billing door.
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

  it('holds back the drawn rows whose screens Club Stage 1 builds', () => {
    const labels = kitOrgLinks({ base: BASE, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true }).map(l => l.label);
    assert.ok(!labels.includes('Audit log'), 'the audit log fails today (A04) — Stage 1 adds its row');
    assert.ok(!labels.includes('Notifications'), 'the org notifications path redirects today — Stage 1 adds its row');
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
    assert.deepEqual(labels('owner'), ['Members', 'Plan & billing', 'Settings', 'Venue library', 'PDF settings', 'Coaches Portal links']);
    assert.deepEqual(labels('admin'), ['Members', 'Venue library', 'PDF settings', 'Coaches Portal links']);
    assert.deepEqual(labels('treasurer'), ['Members', 'Venue library']);
    assert.deepEqual(labels('owner', true), ['Plan & billing'], 'a cancelled club keeps only the way to pay again');
  });
});

describe('the admin kit nav — where you are', () => {
  it('a page lights on its drill-ins, and an index only on itself', () => {
    const [rep] = kitPrograms({ base: BASE, canUse: c => c === 'module_rep_teams' });
    const teams = rep.pages[0];
    assert.equal(isKitLinkActive(`${BASE}/rep-teams`, teams), true);
    assert.equal(isKitLinkActive(`${BASE}/rep-teams/teams/t1/program-years/y1`, teams), true, 'a team page is inside Teams');
    assert.equal(isKitLinkActive(`${BASE}/rep-teams/allocations`, teams), false);
    const budget = kitPrograms({ base: BASE, canUse: c => c === 'module_accounting' })[0].pages[1];
    assert.equal(isKitLinkActive(`${BASE}/accounting/budget-vs-actual`, budget), false, 'Budget must not light on Budget vs. Actual');
    assert.equal(isKitLinkActive(`${BASE}/accounting/budget/allocate/l1`, budget), true);
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
