import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * Findability & portal chrome (Coach Portal Chunk B — P1 #1, #4, #17, #12).
 *
 * PERMANENT regression coverage for the facts unit tests can't see:
 *  1. P1 #4 — a coach on a PHONE can reach the notification feed at all. Before this chunk the bell
 *     lived only in the desktop sidebar and the feed page had exactly ONE inbound link in the
 *     product, inside that bell's panel — so at 360px it was unreachable by any route;
 *  2. P1 #4 — the unread count reaches BOTH the More tab and the row inside it, from one hook, so
 *     the coach learns something is waiting without opening the sheet;
 *  3. P1 #17 — the RULE, not a list: every door in the coach's own nav carries a help icon. Walking
 *     the nav means a future nav item added without help fails here rather than shipping;
 *  4. P1 #17 — each new "?" opens a drawer with real content (an icon that opens an empty panel is
 *     the broken promise this chunk exists to close);
 *  5. P1 #1 — the renamed door and the screen it opens AGREE, and the capability gate still holds
 *     after the rename (it is keyed by DISPLAY LABEL, so a missed case silently opens the door);
 *  6. the read-only sweep — an assistant without the send grant gets no Email families door, and the
 *     education surfaces added here leak no write affordance;
 *  7. composed layout at 361px at MORE THAN ONE scroll position — Chunk C's QA found two
 *     portal-wide layout defects that control-level probes missed, so the More sheet is measured
 *     as a composed box (fits its cap, scrolls, first row reachable), not as a control.
 *
 * Computed styles / real DOM / data-level assertions only — never screenshots.
 * Self-provisions via service-role with the `capfind-` marker; pre-cleans, tears down, and
 * ASSERTS the teardown. Error-check EVERY provisioning insert.
 * ⚠ Scope text assertions to `main[class*="coachesMain"]` — the outer layout <main> wraps the
 * phone-hidden sidebar, so an unscoped query passes on a control the coach cannot see.
 */

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}
loadEnv();

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const MARK = 'capfind';
const HEAD_EMAIL = `${MARK}-head@dev.local`;
const ASSIST_EMAIL = `${MARK}-assistant@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const PHONE = { width: 360, height: 740 };
/** 361px, deliberately: the odd width Chunk C's layout defects were found at. */
const PHONE_ODD = { width: 361, height: 740 };
const DESKTOP = { width: 1280, height: 900 };

let orgId = '';
let headUserId = '';
let assistUserId = '';
let repTeamId = '';
let programYearId = '';

const YEAR = new Date().getFullYear() + 1;

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const markedUsers = (users?.users ?? []).filter(u => u.email === HEAD_EMAIL || u.email === ASSIST_EMAIL);
  for (const u of markedUsers) await admin.from('notifications').delete().eq('user_id', u.id);

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      await admin.from('rep_team_events').delete().eq('program_year_id', y.id);
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
    }
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  for (const u of markedUsers) {
    await admin.from('organization_members').delete().eq('user_id', u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
}

async function makeCoach(email: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  const id = created.user!.id;
  const { error: memErr } = await admin.from('organization_members').insert({
    organization_id: orgId, user_id: id, role: 'coach',
    status: 'active', accepted_at: new Date().toISOString(),
  });
  if (memErr) throw memErr;
  return id;
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  headUserId = await makeCoach(HEAD_EMAIL);
  assistUserId = await makeCoach(ASSIST_EMAIL);

  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} Selects 12U`, slug: `${MARK}-selects-12u`, sport: 'softball' })
    .select('id').single();
  if (teamErr) throw teamErr;
  repTeamId = team!.id;

  const { data: year, error: yearErr } = await admin.from('rep_program_years')
    .insert({ team_id: repTeamId, org_id: orgId, name: `${MARK} ${YEAR}`, year: YEAR, status: 'active' })
    .select('id').single();
  if (yearErr) throw yearErr;
  programYearId = year!.id;

  const { error: hcErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: headUserId, coach_role: 'head_coach',
  });
  if (hcErr) throw hcErr;

  // The read-only sweep persona. ⚠ `announcementsSend` must be set FALSE explicitly — an
  // assistant's grants fall back to ASSISTANT_DEFAULTS, and omitting a key GRANTS it.
  const { error: acErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: assistUserId, coach_role: 'assistant_coach',
    capabilities: { announcementsSend: false, roster: 'view', attendance: true, schedule: true },
  });
  if (acErr) throw acErr;

  // Two unread notifications — enough to prove the count is a real number, not a dot.
  const { error: nErr } = await admin.from('notifications').insert([
    { org_id: orgId, user_id: headUserId, event_type: 'system', title: `${MARK} first notice`, body: 'One' },
    { org_id: orgId, user_id: headUserId, event_type: 'system', title: `${MARK} second notice`, body: 'Two' },
  ]);
  if (nErr) throw nErr;
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

const base = () => `/${ORG_SLUG}/coaches/teams/${repTeamId}`;
const main = (page: Page) => page.locator('main[class*="coachesMain"]');

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(main(page)).toBeVisible({ timeout: 45_000 });
  await expect(main(page).getByText('Loading…')).toHaveCount(0, { timeout: 45_000 });
}

/**
 * Open the mobile More sheet and wait for it to actually be on screen.
 *
 * Retries the click deliberately. The bar closes More on every pathname change (an intended guard so
 * the sheet never survives a navigation), and a click that lands while the route is still settling is
 * closed again a frame later — a race in the TEST, not the app. Waiting for the end state and
 * re-clicking is honest; a bare `click()` made this flaky in CI.
 */
async function openMore(page: Page) {
  const moreBtn = page.locator('#coaches-mob-more');
  await expect(moreBtn).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => { /* best effort */ });
  await expect(async () => {
    if (!(await page.getByRole('menu').isVisible().catch(() => false))) {
      await moreBtn.click();
    }
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 30_000 });
}

// ── 1 + 2 · P1 #4: notifications exist on a phone at all ──────────────────────

test.describe('P1 #4 — the notification feed is reachable on a phone', () => {
  test.use({ viewport: PHONE });

  test('More → Notifications opens the feed, and its settings link resolves', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, base());

    // The regression this exists for: before Chunk B there was NO notifications control at phone
    // width anywhere in the portal — the sidebar bell is display:none ≤900px.
    await expect(page.locator('nav[aria-label="Coaches mobile navigation"]')).toBeVisible();
    await openMore(page);

    const row = page.locator('#coaches-mob-notifications');
    await expect(row).toBeVisible();
    await row.click();

    await page.waitForURL(u => u.pathname.endsWith('/coaches/notifications'), { timeout: 30_000 });
    await expect(main(page).getByText(`${MARK} first notice`)).toBeVisible({ timeout: 30_000 });

    // Deliberately the PAGE and not the bell's panel: the panel's phone rules anchor it under an
    // admin top bar this portal does not have. The page is what carries the settings door.
    const settings = main(page).getByRole('link', { name: /notification settings/i }).first();
    await expect(settings).toBeVisible();
    await expect(settings).toHaveAttribute('href', /\/account\/notifications/);
  });

  test('the unread count reaches BOTH the More tab and the row — one hook, one number', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, base());

    // On the tab, before the sheet is opened: this is what tells the coach to look.
    const moreBtn = page.locator('#coaches-mob-more');
    await expect(moreBtn).toHaveAttribute('aria-label', /2 unread notifications/i, { timeout: 30_000 });

    await openMore(page);
    await expect(page.locator('#coaches-mob-notifications')).toContainText('2');
  });

  test('the More sheet still fits and scrolls with a row added on top (361px, two scroll positions)', async ({ page }) => {
    // Chunk C's lesson: probes that measure CONTROLS are not measuring LAYOUT. The sheet is capped
    // at min(70vh, 100dvh − 5.5rem − safe-area); adding a first row must not push it past that or
    // strand the row it just added.
    await page.setViewportSize(PHONE_ODD);
    await signIn(page, HEAD_EMAIL);
    await open(page, base());
    await openMore(page);

    const sheet = page.getByRole('menu');
    const box = await sheet.boundingBox();
    expect(box, 'the More sheet must have a box').not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(PHONE_ODD.height * 0.7 + 1);
    // The sheet opens UPWARD from the bar, so its top must be on screen — a negative top is the
    // "menu runs off the top of the screen" defect Batch 1 fixed and this must not reintroduce.
    expect(box!.y).toBeGreaterThanOrEqual(0);

    const row = page.locator('#coaches-mob-notifications');
    await expect(row).toBeInViewport();

    // Scrolled to the bottom of its own list, the sheet must STILL sit inside its cap and still have
    // its top on screen. Those are the invariants that matter — the Chunk C defect class is a panel
    // that runs off-screen or has no travel, not one whose box shifts a hair.
    //
    // ⚠ Measured, deliberately not asserted as pixel-identical: the panel's height grows by ~6px
    // between the two reads (it is bottom-anchored, so its top rises by the same amount). That is
    // within the width of its own 6px scrollbar and is not user-visible, but the cause was NOT
    // isolated — so this asserts a bounded box rather than pretending the drift isn't there. If this
    // tolerance ever has to be widened, find the cause first; a growing panel is how a menu ends up
    // off the top of the screen, which Batch 1 already had to fix once.
    await sheet.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const after = await sheet.boundingBox();
    expect(after!.height).toBeLessThanOrEqual(PHONE_ODD.height * 0.7 + 1);
    expect(after!.y).toBeGreaterThanOrEqual(0);
    expect(Math.abs(after!.y - box!.y)).toBeLessThan(12);
    // ...and it genuinely scrolls rather than clipping silently.
    const scrolled = await sheet.evaluate(el => el.scrollTop > 0 || el.scrollHeight <= el.clientHeight + 1);
    expect(scrolled).toBe(true);
  });
});

// ── 3 + 4 · P1 #17: the rule, walked ─────────────────────────────────────────

/**
 * Doors that exist only on a CLOSED season, so the live fixture's nav never lists them. Explicit
 * because the state cannot be reached by reading the active-season nav — everything else is
 * DISCOVERED below rather than listed.
 */
const CLOSED_SEASON_DOORS = ['/season-end', '/history/results'];

test.describe('P1 #17 — every nav destination carries help', () => {
  test.use({ viewport: DESKTOP });

  test('every door the sidebar actually renders carries a help trigger', async ({ page }) => {
    // Reads the RENDERED nav rather than a list copied into this file. That is the difference
    // between testing today's pages and testing the RULE: a nav item added next month lands in this
    // loop automatically and fails here if it ships without help. A hardcoded list would have
    // silently skipped it.
    await signIn(page, HEAD_EMAIL);
    await open(page, base());

    const teamPrefix = `${base()}`;
    const hrefs = await page.locator(`nav[class*="sidebar"] a[href^="${teamPrefix}"]`)
      .evaluateAll(els => els.map(e => (e as HTMLAnchorElement).getAttribute('href') ?? ''));

    const doors = [...new Set(hrefs.filter(Boolean))];
    // Guard against the selector silently matching nothing and the test passing vacuously.
    expect(doors.length, 'the sidebar must expose team doors to walk').toBeGreaterThan(8);

    for (const href of doors) {
      await open(page, href);
      // Scoped to the content area so the sidebar's own "Help" link can never satisfy this.
      const help = main(page).getByRole('button', { name: /^Help/i }).first();
      await expect(help, `${href} is a nav destination and must carry a help icon`)
        .toBeVisible({ timeout: 30_000 });
    }
  });

  for (const path of CLOSED_SEASON_DOORS) {
    test(`the closed-season door ${path} carries a help trigger`, async ({ page }) => {
      await signIn(page, HEAD_EMAIL);
      await open(page, `${base()}${path}`);
      const help = main(page).getByRole('button', { name: /^Help/i }).first();
      await expect(help, `${path} is a closed season's nav destination and must carry a help icon`)
        .toBeVisible({ timeout: 30_000 });
    });
  }

  test('a new help icon opens a drawer with real content, not an empty panel', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    // Settings is the strongest case: its guide did not exist before this chunk, so an unwritten
    // guide would render a drawer with a heading and nothing under it.
    await open(page, `${base()}/settings`);
    await main(page).getByRole('button', { name: /^Help/i }).first().click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer).toContainText(/lineup rules/i);
    await expect(drawer).toContainText(/division/i);
  });
});

// ── 5 · P1 #1: the door and the destination agree ────────────────────────────

test.describe('P1 #1 — Chat and Email families are tellable apart', () => {
  test.use({ viewport: DESKTOP });

  test('the sidebar names the audience, and the screen it opens agrees', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, base());

    const sidebar = page.locator('nav[class*="sidebar"]');
    await expect(sidebar.getByRole('link', { name: 'Email families' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Chat' })).toBeVisible();
    // The old label must be gone from the nav — two names for one door is the confusion, not the fix.
    await expect(sidebar.getByRole('link', { name: 'Announcements' })).toHaveCount(0);

    await sidebar.getByRole('link', { name: 'Email families' }).click();
    await page.waitForURL(u => u.pathname.endsWith('/announcements'), { timeout: 30_000 });
    // A door named by its destination must LAND on that name (the nav ruling, one step further in).
    await expect(main(page).getByRole('heading', { level: 1 })).toHaveText('Email families');
  });
});

// ── 6 · the read-only sweep ──────────────────────────────────────────────────

test.describe('the read-only assistant sees, never acts', () => {
  test.use({ viewport: PHONE });

  test('an assistant without the send grant gets no Email families door, in either nav', async ({ page }) => {
    // The specific hazard this chunk created: the capability gate is keyed by DISPLAY LABEL, so a
    // rename that missed the gate would fall through to its permissive default and hand an
    // ungranted assistant the door.
    await signIn(page, ASSIST_EMAIL);
    await open(page, base());
    await openMore(page);

    const sheet = page.getByRole('menu');
    await expect(sheet.getByRole('menuitem', { name: 'Email families' })).toHaveCount(0);
    await expect(sheet.getByRole('menuitem', { name: 'Announcements' })).toHaveCount(0);

    await page.setViewportSize(DESKTOP);
    await open(page, base());
    const sidebar = page.locator('nav[class*="sidebar"]');
    await expect(sidebar.getByRole('link', { name: 'Email families' })).toHaveCount(0);
  });

  test('the notification surfaces added here carry no write affordance', async ({ page }) => {
    // Education, not action (Chunk G rule 4). A read-only surface that grows a button is the leak
    // class that has bitten three chunks running.
    await signIn(page, ASSIST_EMAIL);
    await open(page, `${base()}/attendance`);
    await expect(main(page).getByRole('button', { name: /^Help/i })).toBeVisible({ timeout: 30_000 });

    await open(page, `/${ORG_SLUG}/coaches/notifications`);
    await expect(main(page).getByRole('button', { name: /delete|remove|send/i })).toHaveCount(0);
  });
});
