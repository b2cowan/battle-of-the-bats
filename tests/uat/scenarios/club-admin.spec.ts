/**
 * UAT Suite: Club admin (Club Tier Production Readiness plan, Stage 8, finding H01)
 *
 * Proves the club side works end to end, so a release cannot silently break it:
 *   1. Shell            — each role opens the club and sees only the places its role allows;
 *                         no 401, 404 or redirect loop on the way in.
 *   2. Members & roles  — the board's roles list, who can open what, and a refused door that
 *                         stays refused (on reload, and at the server behind it).
 *   3. Teams → coach → portal — a rep team, its head coach, and that coach landing in the portal.
 *   4. Money loop       — Accounting Overview, Budget, allocations (one overdue), payment requests
 *                         in their states (waiting · approved · declined, plus reversed).
 *   5. Public pages     — the club's public site opens signed out.
 *   6. Families         — the Families list, and a household whose children span two teams.
 *
 * Fixture: "UAT Rep Club" (`uat-rep-club`, scripts/seed-club-fixture.mjs) and its five session
 * fixtures. Every repClub* page fixture SKIPS its test by itself when the club's env block or
 * session file is missing (see tests/uat/helpers/fixtures.ts) — never add a body-level skip.
 * ⚠ NOT `uat-club-org`: that org is plan-gating's, and the billing spec can leave it cancelled.
 *
 * READ-ONLY. Nothing here writes to the database, so there is nothing to clean up. A future test
 * that writes must undo its own write in an afterEach/afterAll on dev.
 *
 * Identities pinned (names the seed writes, never figures the calendar moves): the board —
 * Morgan Ellis (owner), Dana Kowalski (admin, every module granted incl. Families), Avery Chen
 * (treasurer, role defaults), Riley Okonkwo (league registrar, role defaults); Jordan Reyes, head
 * coach of 15U AAA; the Okafor household (Ada on 15U AAA, Emeka on 13U AAA).
 */

import type { Page, Response } from '@playwright/test';
import { test, expect } from '../helpers/fixtures';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Records every same-origin document / fetch response that came back 401, 404 or 5xx, and how
 *  many times the main frame navigated — the "no 401, no 404, no redirect loop" contract. */
function watch(page: Page) {
  const bad: string[] = [];
  let navigations = 0;
  const origin = () => new URL(page.url() === 'about:blank' ? 'http://localhost' : page.url()).origin;
  const onResponse = (res: Response) => {
    const type = res.request().resourceType();
    if (type !== 'document' && type !== 'fetch' && type !== 'xhr') return;
    const status = res.status();
    if (status !== 401 && status !== 404 && status < 500) return;
    let sameOrigin = true;
    try { sameOrigin = new URL(res.url()).origin === origin(); } catch { /* keep */ }
    if (sameOrigin) bad.push(`${status} ${type} ${res.url()}`);
  };
  page.on('response', onResponse);
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations += 1; });
  return {
    bad,
    get navigations() { return navigations; },
    reset() { bad.length = 0; navigations = 0; },
  };
}

type Watch = ReturnType<typeof watch>;

/** Opens a path and settles it: the page loaded, nothing 401/404/5xx'd, and it did not bounce. */
async function open(page: Page, w: Watch, path: string) {
  w.reset();
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => { /* dev HMR keeps a socket open */ });
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

function expectClean(w: Watch) {
  expect(w.bad, `401/404/5xx responses:\n${w.bad.join('\n')}`).toEqual([]);
  // A client redirect or two is ordinary (the coaches portal forwards to a team); a loop is not.
  expect(w.navigations, 'main-frame navigations (a redirect loop?)').toBeLessThan(6);
}

/** The pinned admin bar names the place as the page's one visible h1. */
const placeHeading = (page: Page, name: string | RegExp) =>
  page.getByRole('heading', { level: 1, name, exact: typeof name === 'string' });

const refused = (page: Page) => page.locator('[data-not-yours]');

// The doors a role either has or must not have. Labels as the desktop rail prints them.
const RAIL = {
  repTeams: 'Rep teams',
  houseLeague: 'House league',
  accounting: 'Accounting',
  families: 'Families',
  publicSite: 'Public site',
  organization: 'Organization',
  billing: 'Plan & billing',
  tournaments: 'Tournaments',
  portal: 'Coaches Portal',
} as const;
type RailKey = keyof typeof RAIL;

type Role = 'owner' | 'admin' | 'treasurer' | 'registrar' | 'coach';

/** What each role's rail carries on the Club plan (ruling D8; Families is an explicit grant, and
 *  the fixture grants it to the admin). Everything not listed must be ABSENT. */
const RAIL_BY_ROLE: Record<Role, RailKey[]> = {
  owner:     ['repTeams', 'houseLeague', 'accounting', 'families', 'publicSite', 'organization', 'billing', 'tournaments'],
  admin:     ['repTeams', 'houseLeague', 'accounting', 'families', 'publicSite', 'organization', 'tournaments'],
  treasurer: ['accounting', 'organization'],
  registrar: ['houseLeague', 'organization'],
  coach:     ['organization', 'portal'],
};

/** Each admin door, the place name its open page wears, and the refusal marker it shows instead. */
const DOORS = {
  repTeams:    { path: 'rep-teams',    place: 'Rep teams',     notYours: 'repTeams' },
  accounting:  { path: 'accounting',   place: 'Accounting',    notYours: 'accounting' },
  families:    { path: 'families',     place: 'Families',      notYours: 'families' },
  // The house league's landing names its screen "Seasons" (lib/admin-kit-nav.ts, by design).
  houseLeague: { path: 'house-league', place: 'Seasons',       notYours: 'houseLeague' },
  publicSite:  { path: 'public-site',  place: 'Public site',   notYours: 'publicSite' },
  members:     { path: 'org/members',  place: 'Organization',  notYours: 'members' },
  billing:     { path: 'org/billing',  place: null,            notYours: 'billing' },
} as const;
type DoorKey = keyof typeof DOORS;

/** Who opens which door (everything else is refused with the "isn't one of your pages" screen). */
const OPENS: Record<Role, DoorKey[]> = {
  owner:     ['repTeams', 'accounting', 'families', 'houseLeague', 'publicSite', 'members', 'billing'],
  admin:     ['repTeams', 'accounting', 'families', 'houseLeague', 'publicSite', 'members'],
  treasurer: ['accounting', 'members'],
  registrar: ['houseLeague'],
  coach:     [],
};

// Fixtures are lazy: a test only builds the session pages it destructures. Each role-driven test
// below therefore destructures exactly ONE page fixture, picked by a per-role wrapper.
const ROLES: Role[] = ['owner', 'admin', 'treasurer', 'registrar', 'coach'];

function roleTest(title: string, role: Role, body: (page: Page, slug: string) => Promise<void>) {
  switch (role) {
    case 'owner':     return test(title, async ({ repClubOwnerPage: p, repClubOrgSlug: s }) => body(p, s!));
    case 'admin':     return test(title, async ({ repClubAdminPage: p, repClubOrgSlug: s }) => body(p, s!));
    case 'treasurer': return test(title, async ({ repClubTreasurerPage: p, repClubOrgSlug: s }) => body(p, s!));
    case 'registrar': return test(title, async ({ repClubRegistrarPage: p, repClubOrgSlug: s }) => body(p, s!));
    case 'coach':     return test(title, async ({ repClubCoachPage: p, repClubOrgSlug: s }) => body(p, s!));
  }
}

// ── 1. Shell ──────────────────────────────────────────────────────────────────

test.describe('Club admin / shell: each role sees only its places', () => {
  for (const role of ROLES) {
    roleTest(`${role} opens the club Overview and the rail carries only its doors`, role, async (page, slug) => {
      const w = watch(page);
      await open(page, w, `/${slug}/admin`);
      await expect(placeHeading(page, 'Overview')).toBeVisible({ timeout: 30_000 });
      await expect(page).toHaveURL(new RegExp(`/${slug}/admin/?$`));

      const rail = page.getByRole('navigation', { name: 'Admin navigation' });
      await expect(rail).toBeVisible();
      const has = new Set(RAIL_BY_ROLE[role]);
      for (const key of Object.keys(RAIL) as RailKey[]) {
        const link = rail.getByRole('link', { name: new RegExp(`^${RAIL[key]}\\b`) });
        if (has.has(key)) await expect(link, `${role} should see "${RAIL[key]}"`).toHaveCount(1);
        else await expect(link, `${role} must not see "${RAIL[key]}"`).toHaveCount(0);
      }
      expectClean(w);
    });
  }
});

// ── 2. Members and roles ──────────────────────────────────────────────────────

test.describe('Club admin / members and roles', () => {
  test('the board lists each seat with its role, and the Role Guide explains them', async ({ repClubOwnerPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin/org/members`);
    await expect(placeHeading(page, 'Organization')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('navigation', { name: 'Organization' }).getByRole('link', { name: 'Members' }))
      .toHaveAttribute('aria-current', 'page');

    const board = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'What they can open' }) }).first();
    const seats: [string, string, RegExp][] = [
      ['Morgan Ellis', 'Owner', /Everything, including plan & billing/],
      ['Dana Kowalski', 'Admin', /Every program on the plan/],
      ['Avery Chen', 'Treasurer', /Accounting · the team names it allocates to/],
      ['Riley Okonkwo', 'League registrar', /House league registrations/],
    ];
    for (const [person, role, opens] of seats) {
      const row = board.getByRole('row').filter({ hasText: person });
      await expect(row, person).toHaveCount(1);
      await expect(row.getByRole('cell').filter({ hasText: new RegExp(`^${role}$`) })).toHaveCount(1);
      await expect(row).toContainText(opens);
    }
    // The admin's Families grant shows on her row.
    await expect(board.getByRole('row').filter({ hasText: 'Dana Kowalski' })).toContainText('Families');
    // Coaches are not board seats: they sit in their own collapsed group.
    await expect(board.getByRole('row').filter({ hasText: 'Jordan Reyes' })).toHaveCount(0);
    await expect(page.getByText(/^Coaching staff · \d+/)).toBeVisible();

    await expect(page.getByRole('heading', { level: 2, name: 'What each role can open' })).toBeVisible();
    expectClean(w);
  });

  for (const role of ROLES) {
    roleTest(`${role}: opens only its doors; the rest say "isn’t one of your pages"`, role, async (page, slug) => {
      const w = watch(page);
      const opens = new Set(OPENS[role]);
      for (const key of Object.keys(DOORS) as DoorKey[]) {
        const door = DOORS[key];
        await open(page, w, `/${slug}/admin/${door.path}`);
        if (opens.has(key)) {
          if (door.place) await expect(placeHeading(page, door.place), `${role} → ${door.path}`).toBeVisible({ timeout: 30_000 });
          await expect(refused(page), `${role} should open ${door.path}`).toHaveCount(0);
        } else {
          const screen = page.locator(`[data-not-yours="${door.notYours}"]`);
          await expect(screen, `${role} must be refused ${door.path}`).toBeVisible({ timeout: 30_000 });
          await expect(screen.getByRole('heading', { level: 1 })).toHaveText(/isn’t one of your pages$/);
          // The refusal offers a way back, not a dead end.
          await expect(screen.getByRole('link', { name: /^Back to / }).or(screen.getByRole('button', { name: /^Back to / }))).toHaveCount(1);
        }
        expectClean(w);
      }
    });
  }

  test('a refused door stays refused: on reload, and at the server behind it', async ({ repClubTreasurerPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin/rep-teams`);
    await expect(page.locator('[data-not-yours="repTeams"]')).toBeVisible({ timeout: 30_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-not-yours="repTeams"]')).toBeVisible({ timeout: 30_000 });

    // The screen is not the only lock: the routes behind Rep teams and Families refuse the
    // treasurer too, so typing the API address does not open what the screen withholds.
    const q = `orgSlug=${encodeURIComponent(slug)}`;
    const teams = await page.request.get(`/api/admin/rep-teams/teams?${q}`);
    expect(teams.status(), 'rep teams list for a treasurer').toBe(403);
    const families = await page.request.get(`/api/admin/families?${q}`);
    expect(families.status(), 'families list for a treasurer').toBe(403);
    expectClean(w);
  });
});

// ── 3. Teams → coach → portal ─────────────────────────────────────────────────

test.describe('Club admin / teams, their head coaches, and the portal', () => {
  test('the board of rep teams: groups, head coaches, a team with none', async ({ repClubOwnerPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin/rep-teams`);
    await expect(placeHeading(page, 'Rep teams')).toBeVisible({ timeout: 30_000 });

    const table = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Head coach' }) }).first();
    await expect(table).toBeVisible({ timeout: 30_000 });
    await expect(table.getByRole('row').filter({ hasText: /^Senior · 4 teams/ })).toHaveCount(1);
    await expect(table.getByRole('row').filter({ hasText: /^Junior · 4 teams/ })).toHaveCount(1);

    const row = (team: string) => table.getByRole('row').filter({ has: page.getByRole('link', { name: team, exact: true }) });
    await expect(row('15U AAA')).toContainText('Jordan Reyes');
    await expect(row('13U AAA')).toContainText('Priya Nair');
    await expect(row('12U AA')).toContainText('No head coach');
    // (9U AA's head-coach invitation is NOT pinned: an invitation lapses with the calendar, and a
    // lapsed one reads "No head coach" — a check that would turn red by itself one day.)
    // The archived team stays off the default board.
    await expect(row('18U AA')).toHaveCount(0);

    const link = row('15U AAA').getByRole('link', { name: '15U AAA', exact: true });
    const href = await link.getAttribute('href');
    const teamId15AAA = href?.match(/\/teams\/([0-9a-f-]{36})/)?.[1] ?? null;
    expect(teamId15AAA, '15U AAA team link').not.toBeNull();
    expectClean(w);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/admin/rep-teams/teams/${teamId15AAA}`));
    await expect(placeHeading(page, '15U AAA')).toBeVisible({ timeout: 30_000 });
    const coaches = page.getByRole('region', { name: /^Coaches/ }).or(page.locator('section').filter({ has: page.getByRole('heading', { name: /^Coaches/ }) })).first();
    await expect(coaches).toContainText('Jordan Reyes');
    await expect(coaches).toContainText('Head coach');
    expectClean(w);
  });

  test('the head coach lands in the Coaches Portal, and his team opens as his', async ({ repClubCoachPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    // The entry forwards to a team the coach coaches — the one he used last, else the first live
    // one. Which team is NOT pinned: walks sign in as this coach and leave a different one "last".
    await open(page, w, `/${slug}/coaches`);
    await expect(page).toHaveURL(new RegExp(`/${slug}/coaches/teams/[0-9a-f-]{36}$`), { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Not assigned to any teams|No access to this organization/ })).toHaveCount(0);
    expectClean(w);

    // 15U AAA — the team the club's board shows him heading — opens in his portal.
    const { data: team, error } = await supabaseAdmin
      .from('rep_teams').select('id, organizations!inner(slug)')
      .eq('organizations.slug', slug).eq('name', '15U AAA').maybeSingle();
    if (error) throw error;
    expect(team, '15U AAA in the fixture').not.toBeNull();
    await open(page, w, `/${slug}/coaches/teams/${team!.id}`);
    await expect(page).toHaveURL(new RegExp(`/coaches/teams/${team!.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible({ timeout: 30_000 });
    // One team: a link named for it. Several: a switcher button "15U AAA · switch team".
    await expect(
      page.getByRole('link', { name: '15U AAA', exact: true }).or(page.getByRole('button', { name: '15U AAA · switch team' })),
    ).toBeVisible();
    expectClean(w);
  });

  test('from the club side, the coach is offered the portal door', async ({ repClubCoachPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin`);
    const door = page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', { name: /^Coaches Portal/ });
    await expect(door).toHaveAttribute('href', new RegExp(`/${slug}/coaches`));
    expectClean(w);
  });
});

// ── 4. Money loop ─────────────────────────────────────────────────────────────

test.describe('Club admin / the money loop (as the treasurer)', () => {
  const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Accounting' }).getByRole('link', { name, exact: true });

  test('Overview: where the club stands, the teams, the books', async ({ repClubTreasurerPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin/accounting`);
    await expect(placeHeading(page, 'Accounting')).toBeVisible({ timeout: 30_000 });
    await expect(tab(page, 'Overview')).toHaveAttribute('aria-current', 'page');
    for (const name of ['Budget', 'Allocations', 'Payment requests']) await expect(tab(page, name)).toBeVisible();
    await expect(page.getByText(/^Where the club stands · today, /)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('The teams', { exact: true })).toBeVisible();
    await expect(page.getByText('The club’s books', { exact: true })).toBeVisible();
    await expect(page.getByText('We couldn’t load the club’s summary.')).toHaveCount(0);
    expectClean(w);
  });

  test('Budget: this year’s plan lines', async ({ repClubTreasurerPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin/accounting/budget`);
    await expect(tab(page, 'Budget')).toHaveAttribute('aria-current', 'page');
    for (const line of ['Diamond permits — city fields', 'Club insurance', 'Club sponsors']) {
      await expect(page.getByText(line, { exact: true }).first(), line).toBeVisible({ timeout: 30_000 });
    }
    await expect(page.getByText('We couldn’t load the budget.')).toHaveCount(0);
    expectClean(w);
  });

  test('Allocations: Diamond fees has teams overdue, and Coming due puts them first', async ({ repClubTreasurerPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin/accounting/allocations`);
    await expect(tab(page, 'Allocations')).toHaveAttribute('aria-current', 'page');
    const diamond = page.getByRole('row').filter({ hasText: /^Diamond fees \d{4}/ }).first();
    await expect(diamond).toBeVisible({ timeout: 30_000 });
    await expect(diamond).toContainText(/\d+ overdue/i);
    expectClean(w);

    await open(page, w, `/${slug}/admin/accounting/allocations?view=coming-due`);
    await expect(page.getByText(/^Overdue · \d+ · \$/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\d+ days? late/i).first()).toBeVisible();
    expectClean(w);
  });

  test('Payment requests: waiting, approved, declined and reversed', async ({ repClubTreasurerPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin/accounting/payment-requests`);
    await expect(tab(page, 'Payment requests')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/^Waiting on you · \d+ · \$/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^Decided · \d+/).first()).toBeVisible();

    const req = (text: string) => page.getByRole('row').filter({ hasText: text }).first();
    // Waiting: no state chip, an age instead ("Today" / "N days"), and it is holding a payout.
    await expect(req('Tournament entry — Burlington Classic')).toContainText(/Today|\d+ days?/);
    await expect(req('Umpire fees owed for June')).toContainText('Approved');
    await expect(req('New catcher\'s gear')).toContainText('Declined');
    await expect(req('Fundraiser float returned')).toContainText('Reversed');
    expectClean(w);
  });
});

// ── 5. Public pages ───────────────────────────────────────────────────────────

test.describe('Club admin / the public site, signed out', () => {
  test('the club home opens for a visitor, and a team page opens from it', async ({ anonPage: page, repClubOrgSlug }) => {
    test.skip(!repClubOrgSlug, 'Club fixture not set up here — set UAT_REP_CLUB_* in .env.local');
    const slug = repClubOrgSlug!;
    const w = watch(page);
    w.reset();
    const res = await page.goto(`/${slug}`, { waitUntil: 'domcontentloaded' });
    expect(res?.status(), 'club home status').toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'UAT Rep Club' })).toBeAttached({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'This club’s site isn’t available' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Teams' }).first()).toBeVisible();

    const team = page.getByRole('link', { name: /15U AAA/ }).first();
    await expect(team).toBeVisible();
    await team.click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/teams/`));
    await expect(page.getByRole('heading', { name: /We couldn’t find that page/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('15U AAA');
    expectClean(w);
  });

  test('the admin side stays closed to a visitor', async ({ anonPage: page, repClubOrgSlug }) => {
    test.skip(!repClubOrgSlug, 'Club fixture not set up here — set UAT_REP_CLUB_* in .env.local');
    await page.goto(`/${repClubOrgSlug}/admin/accounting`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
  });
});

// ── 6. Families ───────────────────────────────────────────────────────────────

test.describe('Club admin / families', () => {
  test('the Families list finds a household whose children are on two teams', async ({ repClubAdminPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    // ?show=all — the landing list is a worklist ("No family on file" / "Owes money") when one has rows.
    await open(page, w, `/${slug}/admin/families?show=all`);
    await expect(placeHeading(page, 'Families')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^\d+ famil(y|ies)/).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('searchbox', { name: 'Search families' }).or(page.getByLabel('Search families')).first().fill('Okafor');
    // Pinned by the seed's email: house-league registrations left on dev can add a second household
    // under the same guardian's name.
    const row = page.getByRole('row').filter({ hasText: 'okafor.family@example.test' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Ada Okafor · 15U AAA');
    await expect(row).toContainText('Emeka Okafor · 13U AAA');
    expectClean(w);

    // The household opens in place, over the list.
    await row.getByRole('button', { name: 'Chidi Okafor' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByRole('heading', { name: 'Chidi Okafor' }).first()).toBeVisible();
    await expect(dialog).toContainText(/Guardian of \d+ children/);
    await expect(dialog.getByRole('heading', { name: 'Children' })).toBeVisible();
    const child = (name: string) => dialog.getByRole('row').filter({ hasText: name }).first();
    await expect(child('Ada Okafor')).toContainText(/15U AAA · \d{4}/);
    await expect(child('Emeka Okafor')).toContainText(/13U AAA · \d{4}/);
    expectClean(w);
  });

  test('a household across two teams and the house league reads all three', async ({ repClubAdminPage: page, repClubOrgSlug }) => {
    const slug = repClubOrgSlug!;
    const w = watch(page);
    await open(page, w, `/${slug}/admin/families?show=all`);
    await page.getByRole('searchbox', { name: 'Search families' }).or(page.getByLabel('Search families')).first().fill('Tremblay');
    const row = page.getByRole('row').filter({ hasText: 'julie.tremblay@example.test' });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText('Luc Tremblay · 13U AAA');
    await expect(row).toContainText('Elise Tremblay · 11U AA');
    await expect(row).toContainText(/Noah Tremblay · .*House League · U9 Rookie/);
    expectClean(w);
  });
});
