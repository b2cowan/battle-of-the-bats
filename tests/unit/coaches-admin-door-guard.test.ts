/**
 * CLUB TIER STAGE 13 · FIX NOW 2 — item 2 (F-XR-2): the Coaches Portal's way back to the club admin.
 *
 * The portal's Admin door used to show for an owner or admin only, so a treasurer, league admin or registrar who also
 * coaches had no way back (the workspace switcher needs two places). The door is now decided by the admin's OWN admission
 * rule — `/{org}/admin` admits every accepted member except a volunteer (`official`), whom its layout sends to their job —
 * through ONE helper (`adminDoorHome`), and lands on the person's own home. Held here:
 *
 *   1. per role, the door matches the admin's admission, with the two deliberate narrowings (team workspace; a member whose
 *      only club role is `coach`, who would land on an empty Overview);
 *   2. the door lands on THAT person's home, not the owner's;
 *   3. the rule is not restated: the desktop sidebar and the phone More sheet both read the helper, neither keeps a role list;
 *   4. the admin layout still admits by the rule the door borrows (an `official` is sent away, nobody else is).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { adminDoorHome } from '../../lib/member-home.ts';
import { volunteerHome } from '../../lib/volunteer-jobs.ts';

const SLUG = 'riverdale';
// A club plan that carries both programs, so the treasurer's and the league roles' homes exist.
const club = { planId: 'club', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null, accountKind: 'organization' } as never;
const workspace = { planId: 'team', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null, accountKind: 'team_workspace' } as never;

describe('1+2. the door follows the admin’s admission, and lands on the person’s own home', () => {
  const cases: Array<[string, string | null, string | null]> = [
    ['owner', 'owner', `/${SLUG}/admin`],
    ['admin', 'admin', `/${SLUG}/admin`],
    ['staff', 'staff', `/${SLUG}/admin`],
    ['league admin', 'league_admin', `/${SLUG}/admin/house-league`],
    ['registrar', 'league_registrar', `/${SLUG}/admin/house-league`],
    ['treasurer', 'treasurer', `/${SLUG}/admin/accounting`],
    // Admitted by the layout, but it renders an empty Overview for them: a door there is a dead end (owner, 2026-11-07).
    ['coach-only member', 'coach', null],
    // The layout sends a volunteer to their job; there is no admin to go back to.
    ['volunteer (official)', 'official', null],
    ['no club role', null, null],
  ];
  for (const [name, role, href] of cases) {
    it(`${name} → ${href ?? 'no door'}`, () => {
      assert.equal(adminDoorHome(SLUG, role, club)?.href ?? null, href);
    });
  }

  it('a program home the person cannot open (their own access switched off on Members) falls back to the Overview', () => {
    assert.equal(adminDoorHome(SLUG, 'treasurer', club, { module_accounting: false })?.href, `/${SLUG}/admin`);
    assert.equal(adminDoorHome(SLUG, 'league_admin', club, { module_house_league: false })?.href, `/${SLUG}/admin`);
    assert.equal(adminDoorHome(SLUG, 'league_registrar', club, { module_house_league: false })?.href, `/${SLUG}/admin`);
    // An override that grants nothing new, or one for another module, changes nothing.
    assert.equal(adminDoorHome(SLUG, 'treasurer', club, { module_house_league: false })?.href, `/${SLUG}/admin/accounting`);
    assert.equal(adminDoorHome(SLUG, 'treasurer', club, null)?.href, `/${SLUG}/admin/accounting`);
  });

  it('a team workspace has no club admin to go back to', () => {
    for (const role of ['owner', 'admin', 'treasurer', 'league_admin']) {
      assert.equal(adminDoorHome(SLUG, role, workspace), null, role);
    }
  });

  it('the door is offered to every role the admin admits, bar the coach-only narrowing', () => {
    // The admission rule the door borrows: the admin layout redirects exactly the roles `volunteerHome` answers for.
    for (const role of ['owner', 'admin', 'staff', 'official', 'league_admin', 'league_registrar', 'treasurer', 'coach']) {
      const admitted = volunteerHome(SLUG, role, null) === null;
      const door = adminDoorHome(SLUG, role, club) !== null;
      assert.equal(door, admitted && role !== 'coach', role);
    }
  });
});

describe('3. the rule is not restated beside the admin’s own', () => {
  for (const file of ['components/coaches/CoachesSidebar.tsx', 'components/coaches/CoachesBottomNav.tsx']) {
    it(`${file} reads the helper and keeps no role list`, () => {
      const code = readCode(file);
      assert.match(code, /adminDoorHome\(/);
      assert.match(code, /href=\{adminHome\.href\}/);
      assert.doesNotMatch(code, /userRole === 'owner' \|\| userRole === 'admin'/);
      assert.doesNotMatch(code, /isOrgAdmin/);
    });
  }
  it('the phone More sheet carries the door (the sheet was nearly missed once)', () => {
    const code = readCode('components/coaches/CoachesBottomNav.tsx');
    assert.match(code, /\{adminHome && \([\s\S]{0,200}id="coaches-mob-back-to-admin"/);
  });
  it('the desktop sidebar carries the door', () => {
    assert.match(readCode('components/coaches/CoachesSidebar.tsx'), /\{adminHome && \(\s*<Link href=\{adminHome\.href\}/);
  });
});

describe('4. the admin layout still admits by the rule the door borrows', () => {
  it('asks volunteerHome and nothing role-specific besides', () => {
    const layout = readCode('app/[orgSlug]/admin/layout.tsx');
    assert.match(layout, /volunteerHome\(orgSlug, authCtx\.role, authCtx\.capabilities\)/);
    assert.match(layout, /if \(volunteer\) redirect\(volunteer\)/);
  });
});
