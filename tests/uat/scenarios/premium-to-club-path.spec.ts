/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A PREMIUM COACH BECOMES THE CLUB — THE WHOLE PATH IN A BROWSER (Plan & billing Stage 4b, Part 4; plan §6, §8).
 *
 * The unit contracts (workspace-flip-guard, workspace-move-money, plan-billing-*, plan-move-dialog-guard) prove the parts with
 * mocked headers, mocked Stripe and mocked rows. This file proves what only a running app can: the page a coach actually gets,
 * the hop that leaves for Admin as a FULL page load, and the menu that comes back afterwards. Three groups:
 *
 *   A · READ-ONLY on the walk's existing fixtures (nothing is written, nothing is paid):
 *       the Club row (on sale, or the pre-sale "Contact us to move"); the window for a coach on free time from FieldLogicHQ (the
 *       free-days band, the trial sentence, the empty required club name, the address, Due today) and an empty name refused with
 *       NO checkout request; a non-owner typing the billing address, the return marker, or the status read.
 *   B · THE LAPSED PORTAL (owner walk §433, Walk 6) and the `x-pathname` finding Part 4 fixed in proxy.ts: the owner who types
 *       the billing address gets that page in the bare frame; every other address, and a header the browser forges, keeps the wall.
 *   C · THE WHOLE PATH on a coach this file makes and deletes (a new account, a free team, staff-given free time, mock billing):
 *       "Setting up your club" and its two slow states (on a fake clock), then Start my club → checkout → the flip → the full load to
 *       the club's Admin Overview with its setup list and the team shown → the rail and the phone More sheet swapped.
 *
 * NOT COVERED, and why (do not fake these):
 *   · THE WINDOW FOR A PAYING COACH (charge and credit lines adding to Due today, interval kept, no second trial). It needs a real
 *     Stripe subscription: a mock one is not "live" (`hasLiveSubscription` refuses `mock_` ids), so a made-up coach always gets
 *     the checkout variant. No standing Premium-owner session exists (plan §9). The owner walks it (§433 Walk 2); the money is
 *     pinned in workspace-move-money §2-3. When a fixture exists, its line check goes through `dueTodayOf`
 *     (tests/unit/_club-upgrade-money.ts), the one place the GST/HST stage edits.
 *   · THE REAL STRIPE RETURN. Group C pays through MOCK billing, where checkout writes the plan and runs the flip in the same
 *     request. A real payment flips from the webhook, later; that race is the owner's Walk 4 on the dev site.
 *   · A COACH WHO ONCE PAID (no second trial), and Premium set to end ("Open payment settings"): need Stripe history. Unit-pinned
 *     (workspace-move-money "Part 3 · before the owner confirms money"); Walk 5 for the second.
 *   · A STAFF MEMBER OF THE PORTAL typing the address. Making one means the invite flow; this file uses an outsider. The staff
 *     case is pinned in plan-billing-body ("non-owner gets no billing facts") and plan-billing-actions (the marker by role).
 *   · A refusal from the server for a portal holding two teams or already in a club: unit-pinned (workspace-move-money §8).
 *
 * PRECONDITIONS, each one a SKIP with its reason, never a pass: the fixture session files (`npm run test:uat` writes them via
 * auth.setup); Club on sale in this environment (dev has every plan on sale; elsewhere the Club row reads "Contact us to move" and
 * group C stops); a Stripe test key (the window's quote reads the Club price from Stripe; without it the window shows "We couldn't
 * check the charge"); the platform admin's free-time power; migration 414 applied (the flip).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { PLAN_BILLING_WORDS as W } from '../../../lib/plan-billing-words';
import { PLAN_BILLING_TITLE } from '../../../lib/plan-billing-title';
import { PORTAL_FREE_TIME_GRANT_TYPE } from '../../../lib/portal-free-time';

const AUTH = (name: string) => path.join(process.cwd(), 'tests/uat/.auth', name);
const SESSIONS = {
  platformAdmin: AUTH('platform-admin.json'),
  /** The UAT coach: owner of the portal on free time from FieldLogicHQ (walk §433 "Coach on free time"). */
  freeTimeCoach: AUTH('coach.json'),
  /** The free coach: owner of a CANCELLED portal (walk §433 Walk 6). */
  lapsedOwner: AUTH('free-coach.json'),
  /** The uat-test-org owner: a member of neither portal. */
  outsider: AUTH('org-owner.json'),
};
const FREE_TIME_PORTAL = process.env.UAT_FREE_TIME_PORTAL_SLUG ?? 'uat-standalone';
const LAPSED_PORTAL = process.env.UAT_LAPSED_PORTAL_SLUG ?? 'uat-free-team-coaches-portal';
const STATUS_ROUTE = '/api/billing/club-upgrade-status';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** A context signed in from a session file, or a skip naming the missing file (a fixture throws before a test body can skip). */
async function sessionContext(browser: Browser, file: string, options: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
  test.skip(!fs.existsSync(file), `no session file ${path.basename(file)}: run auth.setup with that fixture's env block`);
  return browser.newContext({ storageState: file, ...options });
}

/**
 * Opens the Club row's door and waits for the window's quote — or skips with the reason this environment cannot get there: Club
 * not on sale (the pre-sale row reads "Contact us to move"), or no quote (no Stripe test key, or no Club price row).
 */
async function openClubWindow(page: Page) {
  const change = page.locator('#billing-change');
  await expect(change, 'the Change plan section (a Premium owner sees the Club row)').toBeVisible({ timeout: 20_000 });
  const start = change.getByRole('button', { name: W.clubUpgrade.start });
  const contact = change.getByRole('link', { name: W.change.contactMove });
  await expect(start.or(contact).first()).toBeVisible();
  test.skip(await contact.isVisible(), 'Club is not on sale in this environment (the pre-sale row reads "Contact us to move")');
  const answered = page.waitForResponse(r => r.url().includes('/api/billing/move/preview') && r.request().method() === 'POST');
  await start.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: W.clubUpgrade.title })).toBeVisible();
  const body = await (await answered).json().catch(() => ({})) as { code?: string; checkout?: { trialDays: number; amountDueToday: number } };
  test.skip(body.code !== 'no_live_subscription' || !body.checkout,
    `the window could not quote Club here (${body.code ?? 'no answer'}): a Stripe test key and the Club price row are needed`);
  await expect(dialog.getByText(W.clubUpgrade.dueToday)).toBeVisible();
  return { dialog, quote: body.checkout! };
}

// ── A · read-only ───────────────────────────────────────────────────────────────────────────────────

test.describe('A · the Club row and the window, read-only', () => {
  test('a coach on free time sees the Club row, and the one window: free days, trial, an empty required name, the address', async ({ browser }) => {
    const ctx = await sessionContext(browser, SESSIONS.freeTimeCoach, { viewport: DESKTOP });
    const page = await ctx.newPage();
    try {
      await page.goto(`/${FREE_TIME_PORTAL}/coaches/billing`, { waitUntil: 'networkidle' });
      // Count every checkout request from here on: none may leave this window.
      const checkouts: string[] = [];
      page.on('request', r => { if (r.url().includes('/api/billing/create-checkout') || r.url().includes('/api/billing/move') && !r.url().includes('/preview')) checkouts.push(r.url()); });

      const { dialog, quote } = await openClubWindow(page);

      await expect(dialog.getByText(W.clubUpgrade.freeTitle())).toBeVisible();
      await expect(dialog.getByText(quote.trialDays > 0 ? W.clubUpgrade.trial(quote.trialDays) : W.clubUpgrade.noTrial)).toBeVisible();
      if (quote.trialDays > 0) expect(quote.amountDueToday, 'nothing is due today during a trial').toBe(0);
      await expect(dialog.getByText(W.clubUpgrade.owner)).toBeVisible();
      const name = dialog.getByLabel(new RegExp(`^${W.clubUpgrade.name}`));
      await expect(name).toHaveValue('');
      await expect(name).toHaveAttribute('required', '');
      // The address the portal already has (read by path: the base URL is the server's environment, not this runner's).
      await expect(dialog.getByText(new RegExp(`/${FREE_TIME_PORTAL}$`))).toBeVisible();
      await expect(dialog.getByText(W.clubUpgrade.addressHelp)).toBeVisible();
      await expect(dialog.getByText(W.clubUpgrade.checkoutFoot)).toBeVisible();
      await expect(dialog.getByText(/\bcard\b/i), 'payment method, never card (ruling T1)').toHaveCount(0);

      // An empty name is refused in the field, before anything is sent.
      await dialog.getByRole('button', { name: W.move.checkout }).click();
      await expect(dialog.locator('#upgrade-name-help')).toHaveText(W.clubUpgrade.nameEmpty);
      await expect(dialog.locator('#upgrade-name-help')).toHaveAttribute('role', 'alert');
      await expect(name).toBeFocused();
      await page.waitForTimeout(1000);
      expect(checkouts, 'an empty club name sends no checkout and no move').toEqual([]);

      // Leaving changes nothing: the window closes (nothing typed, so it does not ask) and the portal is still the portal.
      await dialog.getByRole('button', { name: W.move.cancel }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('#coaches-billing')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('a non-owner gets no billing: not the page, not the setup screen behind the marker, not the status read', async ({ browser }) => {
    const ctx = await sessionContext(browser, SESSIONS.outsider, { viewport: DESKTOP });
    const page = await ctx.newPage();
    try {
      await page.goto(`/${FREE_TIME_PORTAL}/coaches/billing`, { waitUntil: 'networkidle' });
      await expect(page.locator('#billing-change')).toHaveCount(0);
      await expect(page.getByRole('button', { name: W.clubUpgrade.start })).toHaveCount(0);

      await page.goto(`/${FREE_TIME_PORTAL}/admin/org/billing?inPlace=club`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: W.clubUpgrade.settingTitle })).toHaveCount(0);

      const status = await page.request.get(`${STATUS_ROUTE}?orgSlug=${FREE_TIME_PORTAL}`);
      expect(status.status(), 'the status read is owner-only').toBeGreaterThanOrEqual(400);
    } finally {
      await ctx.close();
    }
  });
});

// ── B · the lapsed portal and the header gap ────────────────────────────────────────────────────────

test.describe('B · the way back from a lapsed portal (Walk 6)', () => {
  const ENDED = /subscription has ended/i;

  test('every address but billing keeps the wall', async ({ browser }) => {
    const ctx = await sessionContext(browser, SESSIONS.lapsedOwner, { viewport: DESKTOP });
    const page = await ctx.newPage();
    try {
      await page.goto(`/${LAPSED_PORTAL}/coaches`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: ENDED })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('the owner who types the billing address gets that one page in the bare frame', async ({ browser }) => {
    // Failed before Part 4: proxy.ts had no `/:slug/coaches/…` matcher entry, so the layout never received `x-pathname` here and
    // the owner met the wall. The unit pin is plan-billing-coach-host ("the page the coaches layout trusts is the proxy's").
    const ctx = await sessionContext(browser, SESSIONS.lapsedOwner, { viewport: DESKTOP });
    const page = await ctx.newPage();
    try {
      await page.goto(`/${LAPSED_PORTAL}/coaches/billing`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: ENDED })).toHaveCount(0);
      await expect(page.locator('#billing-reactivate-btn')).toBeVisible();
      await expect(page.locator('#coaches-billing'), 'the bare frame: no left menu').toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test('a browser that SENDS the header itself cannot open another page inside the wall', async ({ browser }) => {
    // The same finding's other half: before Part 4 a header the browser sent reached the layout unchanged, and the wall opened on
    // a page that is not billing (the owner of that organization only; coach APIs stayed closed). The proxy now overwrites it.
    const ctx = await sessionContext(browser, SESSIONS.lapsedOwner, {
      viewport: DESKTOP, extraHTTPHeaders: { 'x-pathname': `/${LAPSED_PORTAL}/coaches/billing` },
    });
    const page = await ctx.newPage();
    try {
      await page.goto(`/${LAPSED_PORTAL}/coaches`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: ENDED })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

// ── C · the whole path, on a coach made for it ──────────────────────────────────────────────────────

type Made = { userId: string; email: string; orgId: string; slug: string; repTeamId: string; basicTeamId: string };

test.describe.serial('C · a coach on free time becomes the club (mock billing)', () => {
  const PASSWORD = 'devpass123';
  const suffix = `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
  const clubName = `UAT Path Club ${suffix}`;
  let made: Made | null = null;
  let previousMock: boolean | null = null;
  let adminCtx: BrowserContext | null = null;
  let mockBillingOn = false;
  let flipped = false;

  // A cold dev server compiles the billing page, the checkout and Admin inside these tests; the default 60 s is not enough.
  test.describe.configure({ timeout: 180_000 });

  /** A fresh context signed in through the login form (the made coach has no session file). */
  async function logIn(browser: Browser, email: string, viewport = DESKTOP): Promise<{ ctx: BrowserContext; page: Page }> {
    // ⚠ An EXPLICITLY empty session: a bare newContext() inherits the project's org-owner storageState, and the sign-in page
    // forwards a signed-in visitor away, so the form would never appear (tests/uat/helpers/fixtures.ts, anonPage).
    const ctx = await browser.newContext({ viewport, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/auth/login');
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(PASSWORD);
    await page.locator('#login-submit').click();
    await page.waitForURL(url => !url.pathname.startsWith('/auth/login'), { timeout: 90_000 });
    return { ctx, page };
  }

  function signedIn(browser: Browser, viewport = DESKTOP) {
    test.skip(!made, 'the coach for this group could not be made (see the first test)');
    return logIn(browser, made!.email, viewport);
  }

  test.beforeAll(async ({ browser }) => {
    if (!fs.existsSync(SESSIONS.platformAdmin)) return;
    adminCtx = await browser.newContext({ storageState: SESSIONS.platformAdmin });
    const current = await adminCtx.request.get('/api/dev/mock-billing');
    if (!current.ok()) return;
    previousMock = ((await current.json()) as { override?: boolean | null }).override ?? null;
    // Checked, not assumed: with mock billing off, the checkout button would reach a real Stripe session.
    mockBillingOn = (await adminCtx.request.post('/api/dev/mock-billing', { data: { enabled: true } })).ok();
  });

  test.afterAll(async () => {
    if (adminCtx) {
      await adminCtx.request.post('/api/dev/mock-billing', { data: { enabled: previousMock } }).catch(() => {});
      await adminCtx.close();
    }
    if (made) {
      await supabaseAdmin.from('organizations').delete().eq('id', made.orgId);
      await supabaseAdmin.from('basic_coach_teams').delete().eq('id', made.basicTeamId);
      await supabaseAdmin.auth.admin.deleteUser(made.userId);
    }
  });

  test('make a free coach, give them free time from FieldLogicHQ: a Premium portal they own', async ({ browser }) => {
    test.skip(!adminCtx || !mockBillingOn, 'needs the platform admin session and the dev mock-billing tool switched on');
    const email = `premium-to-club-${suffix}@dev.local`;
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !user.user) throw error ?? new Error('no user');
    const partial: Partial<Made> = { userId: user.user.id, email };
    try {
      // GST/HST Stage 1: the Start my club window fills the club's billing address in from the coach's own home address, and a
      // checkout refuses without one. Give the new coach a home address (the row goes with the user, ON DELETE CASCADE).
      const { error: addressError } = await supabaseAdmin.from('billing_locations').insert({
        user_id: user.user.id, country: 'CA', region_code: 'ON', line1: '120 Elm Street', city: 'Guelph', postal_code: 'N1H 4H2',
      });
      if (addressError) throw addressError;
      const { ctx, page } = await logIn(browser, email);
      const team = await page.request.post('/api/coaches/teams', { data: { name: `UAT Path ${suffix}`, sport: 'baseball' } });
      expect(team.ok(), 'the free team').toBe(true);
      partial.basicTeamId = ((await team.json()) as { id: string }).id;
      await ctx.close();

      const lastDay = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const give = await adminCtx!.request.post(`/api/platform-admin/people/${user.user.id}/portal-free-time`, {
        data: { team_id: partial.basicTeamId, last_day: lastDay, reason: 'UAT: Premium to Club whole-path spec' },
      });
      test.skip(give.status() === 403, 'the platform admin fixture lacks the free-time power');
      expect(give.ok(), `give free time: ${await give.text()}`).toBe(true);
      partial.orgId = ((await give.json()) as { orgId: string }).orgId;

      const [{ data: org }, { data: ws }] = await Promise.all([
        supabaseAdmin.from('organizations').select('slug, account_kind, plan_id').eq('id', partial.orgId).single(),
        supabaseAdmin.from('team_workspaces').select('rep_team_id, billing_mode').eq('workspace_org_id', partial.orgId).single(),
      ]);
      expect(org?.account_kind).toBe('team_workspace');
      expect(ws?.billing_mode).toBe('platform_override');
      made = { ...partial, slug: org!.slug, repTeamId: ws!.rep_team_id } as Made;
    } finally {
      // Clean up a half-made coach here: afterAll only knows a whole one.
      if (!made) {
        if (partial.orgId) await supabaseAdmin.from('organizations').delete().eq('id', partial.orgId);
        if (partial.basicTeamId) await supabaseAdmin.from('basic_coach_teams').delete().eq('id', partial.basicTeamId);
        await supabaseAdmin.auth.admin.deleteUser(user.user.id);
      }
    }
  });

  test('"Setting up your club" holds, then says it is taking longer, then (on failed reads) that it could not confirm', async ({ browser }) => {
    const { ctx, page } = await signedIn(browser);
    try {
      // The return marker on a portal that has not paid: every read answers "not yet", which is the slow path.
      await page.clock.install();
      await page.goto(`/${made!.slug}/admin/org/billing?inPlace=club`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: W.clubUpgrade.settingTitle })).toBeVisible();
      await expect(page.getByText(W.clubUpgrade.settingBody)).toBeVisible();
      await expect(page.getByRole('button', { name: W.move.checkout }), 'no payment door while waiting').toHaveCount(0);
      for (let read = 1; read <= 20; read++) {
        const answered = page.waitForResponse(r => r.url().includes(STATUS_ROUTE));
        await page.clock.runFor(2_600);
        expect((await answered).status()).toBe(200);
      }
      await expect(page.getByRole('heading', { name: W.clubUpgrade.longerTitle })).toBeVisible();
      await expect(page.getByRole('button', { name: W.clubUpgrade.checkAgain })).toBeVisible();

      // Three failed reads in a row: "couldn't confirm", never "pay again".
      await page.route(`**${STATUS_ROUTE}*`, route => route.fulfill({ status: 500, body: '{}' }));
      await page.getByRole('button', { name: W.clubUpgrade.checkAgain }).click();
      await expect(page.getByRole('heading', { name: W.clubUpgrade.settingTitle })).toBeVisible();
      for (let read = 1; read <= 3; read++) {
        const failed = page.waitForResponse(r => r.url().includes(STATUS_ROUTE));
        await page.clock.runFor(2_600);
        expect((await failed).status()).toBe(500);
      }
      await expect(page.getByRole('heading', { name: W.clubUpgrade.unconfirmedTitle })).toBeVisible();
      await expect(page.getByRole('button', { name: W.move.checkout }), 'never a second payment').toHaveCount(0);
      await expect(page.getByText(W.clubUpgrade.unconfirmedBody)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('Start my club → checkout → the flip → a FULL load into the club\'s Admin Overview, setup list and team shown', async ({ browser }) => {
    const { ctx, page } = await signedIn(browser);
    try {
      await page.goto(`/${made!.slug}/coaches/billing`, { waitUntil: 'networkidle' });
      await expect(page.locator('#coaches-billing'), 'before: the portal rail carries Plan & billing').toBeVisible();
      const { dialog } = await openClubWindow(page);
      await dialog.getByLabel(new RegExp(`^${W.clubUpgrade.name}`)).fill(clubName);

      // Every full document load the page makes from here on. The checkout leaves this document on its own, so a marker set
      // here proves nothing about the LAST hop; a document load whose address is the club's Admin does.
      const documentLoads: string[] = [];
      page.on('load', loaded => { documentLoads.push(new URL(loaded.url()).pathname); });
      await dialog.getByRole('button', { name: W.move.checkout }).click();
      await page.waitForURL(url => url.pathname === `/${made!.slug}/admin` && url.searchParams.get('inPlace') === 'club', { timeout: 60_000 });
      await expect.poll(() => documentLoads, { message: 'the hop into Admin is a full document load, not a client push' }).toContain(`/${made!.slug}/admin`);

      // The landing: ready, the coach is the owner of the club they named, the setup list, their team.
      await expect(page.getByRole('heading', { name: W.clubUpgrade.ready })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(W.clubUpgrade.readyBody(clubName))).toBeVisible();
      const steps = page.getByRole('list', { name: W.clubUpgrade.setupLabel });
      for (const step of [W.clubUpgrade.nameStep, W.clubUpgrade.addressStep, W.clubUpgrade.staffStep, W.clubUpgrade.publicStep]) {
        await expect(steps.getByText(step)).toBeVisible();
      }
      await expect(page.getByRole('link', { name: W.clubUpgrade.openTeam })).toHaveAttribute('href', `/${made!.slug}/coaches/teams/${made!.repTeamId}`);

      // The rows, read fresh: the plan's §3.2 checklist as far as the browser path can see it.
      const [{ data: org }, { data: ws }, { data: grants }] = await Promise.all([
        supabaseAdmin.from('organizations').select('account_kind, team_workspace_status, plan_id, name, slug, is_discoverable').eq('id', made!.orgId).single(),
        supabaseAdmin.from('team_workspaces').select('workspace_state, billing_mode, stripe_subscription_id, stripe_customer_id, rep_team_id').eq('workspace_org_id', made!.orgId).single(),
        supabaseAdmin.from('org_overrides').select('revoked_at, expires_at').eq('org_id', made!.orgId).eq('type', PORTAL_FREE_TIME_GRANT_TYPE),
      ]);
      expect(org, 'is migration 414 applied here? The flip did not run').toMatchObject({
        account_kind: 'organization', team_workspace_status: null, plan_id: 'club', name: clubName, slug: made!.slug, is_discoverable: false,
      });
      expect(ws).toMatchObject({ workspace_state: 'org_owned', billing_mode: 'club_included', stripe_subscription_id: null, stripe_customer_id: null, rep_team_id: made!.repTeamId });
      const running = (grants ?? []).filter(g => !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > new Date()));
      expect(running, 'the staff-given free time ended at the upgrade').toEqual([]);
      flipped = true;
    } finally {
      await ctx.close();
    }
  });

  test('the menu swapped: on a computer and in the phone\'s More sheet, Plan & billing and Tournaments you run gave way to Admin', async ({ browser }) => {
    // A skipped checkout leaves an unflipped coach; "serial" does not skip what follows, so say so here instead of failing misleadingly.
    test.skip(!flipped, 'the previous test did not flip this coach (skipped or failed): there is no club menu to check');
    const desk = await signedIn(browser, DESKTOP);
    try {
      await desk.page.goto(`/${made!.slug}/coaches`, { waitUntil: 'networkidle' });
      await expect(desk.page.locator(`a[href="/${made!.slug}/admin"]`).filter({ hasText: 'Admin' }).first()).toBeVisible({ timeout: 20_000 });
      await expect(desk.page.locator('#coaches-billing')).toHaveCount(0);
      await expect(desk.page.locator('#coaches-tournaments')).toHaveCount(0);
      await expect(desk.page.getByRole('link', { name: PLAN_BILLING_TITLE })).toHaveCount(0);
    } finally {
      await desk.ctx.close();
    }
    const phone = await signedIn(browser, PHONE);
    try {
      await phone.page.goto(`/${made!.slug}/coaches`, { waitUntil: 'networkidle' });
      await phone.page.locator('#coaches-mob-more').click();
      await expect(phone.page.locator('#coaches-mob-back-to-admin')).toBeVisible();
      await expect(phone.page.locator('#coaches-mob-billing')).toHaveCount(0);
      await expect(phone.page.locator('#coaches-mob-tournaments')).toHaveCount(0);
    } finally {
      await phone.ctx.close();
    }
  });
});
