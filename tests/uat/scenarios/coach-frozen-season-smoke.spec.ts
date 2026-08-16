import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * The frozen past season (Coach Portal Chunk F).
 *
 * PERMANENT regression coverage for the things unit tests can't see — and this chunk's risk is
 * almost entirely READ AUTHORIZATION, so the probes lean that way:
 *
 *  1. GOVERNING RULE 1 — an assistant's access to a past season is what it was AT THE TIME.
 *     The fixture makes this concrete and adversarial: the assistant has money in the LIVE season
 *     and had none in the closed one. If capabilities leaked from the current assignment (which is
 *     exactly what the shipped resolver did before this chunk), the archive would hand them last
 *     year's money. Asserted at the API, not just in the nav.
 *  2. GOVERNING RULE 3 — a coach REMOVED from a past season's staff is refused by the SERVER.
 *     Losing the menu item is not losing access; this is the leak class that has bitten four
 *     chunks running, so it is checked as an HTTP status against a former team-mate's data.
 *  3. GOVERNING RULE 2 — writes are refused for a closed season. A source-level test proves no
 *     write handler can even ADDRESS one (tests/unit/coach-season-write-guard.test.ts); this is
 *     the runtime half.
 *  4. The ROLLED-FORWARD case, which the plan of record never named: a team with a live season
 *     AND past ones. Its archive must be read-only even though the team itself is not closed.
 *  5. Every door a past season opens carries help (the Chunk B rule), walked from the RENDERED
 *     nav rather than a hardcoded list, so a door added later without help fails here.
 *  6. Composed layout at 361px.
 *
 * Computed styles / real DOM / data-level assertions only — never screenshots.
 * Self-provisions via service-role with the `capfrozen-` marker; pre-cleans, tears down, and
 * ASSERTS the teardown. Error-checks EVERY provisioning insert.
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

const MARK = 'capfrozen';
const HEAD_EMAIL = `${MARK}-head@dev.local`;
const ASSIST_EMAIL = `${MARK}-assistant@dev.local`;
/** Revoked from the PAST season mid-test — rule 3's subject. */
const REVOKED_EMAIL = `${MARK}-revoked@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const PHONE_ODD = { width: 361, height: 740 };
const DESKTOP = { width: 1280, height: 900 };

let orgId = '';
let headUserId = '';
let assistUserId = '';
let revokedUserId = '';
let repTeamId = '';
/** The LIVE season of a rolled-forward team. */
let liveYearId = '';
/** The CLOSED season — the archive under test. */
let pastYearId = '';
let pastPlayerId = '';
let pastFundraiserId = '';
let revokedCoachRowId = '';

const LIVE_YEAR = new Date().getFullYear() + 1;
const PAST_YEAR = LIVE_YEAR - 1;

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const marked = (users?.users ?? []).filter(u =>
    u.email === HEAD_EMAIL || u.email === ASSIST_EMAIL || u.email === REVOKED_EMAIL);

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      await admin.from('rep_team_events').delete().eq('program_year_id', y.id);
      // ⚠ Entries, then fundraisers, then players — an entry references BOTH, so deleting the
      // roster first leaves a row pointing at a player who is gone and the year delete below
      // fails silently, which surfaces later as the afterAll "teams left behind" assertion
      // rather than as anything to do with fundraisers.
      const { data: frs } = await admin.from('rep_fundraisers').select('id').eq('program_year_id', y.id);
      for (const f of frs ?? []) await admin.from('rep_fundraiser_entries').delete().eq('fundraiser_id', f.id);
      await admin.from('rep_fundraisers').delete().eq('program_year_id', y.id);
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
    }
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  for (const u of marked) {
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
  revokedUserId = await makeCoach(REVOKED_EMAIL);

  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} Archive 12U`, slug: `${MARK}-archive-12u`, sport: 'softball' })
    .select('id').single();
  if (teamErr) throw teamErr;
  repTeamId = team!.id;

  // A ROLLED-FORWARD team: one live season, one finished. This is the shape the plan of record
  // never named, and the one where "read-only" must come from the SEASON not the team.
  const { data: live, error: liveErr } = await admin.from('rep_program_years')
    .insert({ team_id: repTeamId, org_id: orgId, name: `${MARK} ${LIVE_YEAR}`, year: LIVE_YEAR, status: 'active' })
    .select('id').single();
  if (liveErr) throw liveErr;
  liveYearId = live!.id;

  const { data: past, error: pastErr } = await admin.from('rep_program_years')
    .insert({ team_id: repTeamId, org_id: orgId, name: `${MARK} ${PAST_YEAR}`, year: PAST_YEAR, status: 'completed' })
    .select('id').single();
  if (pastErr) throw pastErr;
  pastYearId = past!.id;

  for (const yearId of [liveYearId, pastYearId]) {
    const { error } = await admin.from('rep_team_coaches').insert({
      program_year_id: yearId, team_id: repTeamId, org_id: orgId,
      user_id: headUserId, coach_role: 'head_coach',
    });
    if (error) throw error;
  }

  // ── The rule-1 fixture, built to FAIL LOUDLY if capabilities leak across seasons ──
  // Last year this assistant had NO money. This year they do. Any surface that shows them the
  // past season's money is reading the wrong assignment row.
  // ⚠ Every key is set explicitly: an assistant's grants fall back to ASSISTANT_DEFAULTS, so an
  // omitted key GRANTS it.
  const { error: pastAcErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: pastYearId, team_id: repTeamId, org_id: orgId,
    user_id: assistUserId, coach_role: 'assistant_coach',
    capabilities: { money: 'off', roster: 'view', rosterPii: false, schedule: true, attendance: true, tryouts: false },
  });
  if (pastAcErr) throw pastAcErr;

  const { error: liveAcErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: liveYearId, team_id: repTeamId, org_id: orgId,
    user_id: assistUserId, coach_role: 'assistant_coach',
    capabilities: { money: 'write', roster: 'view', rosterPii: true, schedule: true, attendance: true, tryouts: false },
  });
  if (liveAcErr) throw liveAcErr;

  // Rule 3's subject: on the PAST season's staff, removed part-way through the run.
  const { data: revokedRow, error: revErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: pastYearId, team_id: repTeamId, org_id: orgId,
    user_id: revokedUserId, coach_role: 'assistant_coach',
    capabilities: { money: 'off', roster: 'view', rosterPii: false, schedule: true, attendance: true, tryouts: false },
  }).select('id').single();
  if (revErr) throw revErr;
  revokedCoachRowId = revokedRow!.id;

  // A player who exists ONLY in the past season — the thing an archive is for, and the thing a
  // revoked coach must stop being able to read.
  const { data: player, error: playerErr } = await admin.from('rep_roster_players').insert({
    program_year_id: pastYearId, team_id: repTeamId, org_id: orgId,
    player_first_name: `${MARK}Archived`, player_last_name: 'Player',
    status: 'active', source: 'admin_manual',
  }).select('id').single();
  if (playerErr) throw playerErr;
  pastPlayerId = player!.id;

  /**
   * ── The WRONG-SEASON-ROSTER fixture (2026-08-14) ──
   *
   * A player who exists only in the LIVE season, and a fundraiser that exists only in the PAST
   * one. Together they are a trap that a single boolean cannot pass by accident: a screen showing
   * the archived drive must name the archived player and must NOT name the live one.
   *
   * ⚠ This is the shape of the defect the fundraiser drill-in was built to close. The Fundraisers
   * LIST had served `?year=` since Chunk F, so the archive listed the right drives — but opening
   * one landed on a page with no season rail, which paired the 2025 fundraiser with the 2026
   * roster. Every other assertion in this file would have stayed green through that, because the
   * page really did render and really did lack write controls. Only the NAMES gave it away.
   */
  const { error: liveePlayerErr } = await admin.from('rep_roster_players').insert({
    program_year_id: liveYearId, team_id: repTeamId, org_id: orgId,
    player_first_name: `${MARK}Live`, player_last_name: 'Player',
    status: 'active', source: 'admin_manual',
  });
  if (liveePlayerErr) throw liveePlayerErr;

  const { data: pastFr, error: frErr } = await admin.from('rep_fundraisers').insert({
    org_id: orgId, team_id: repTeamId, program_year_id: pastYearId,
    name: `${MARK} Archived drive`, player_rebate_percent: 40, is_active: false,
  }).select('id').single();
  if (frErr) throw frErr;
  pastFundraiserId = pastFr!.id;

  const { error: feErr } = await admin.from('rep_fundraiser_entries').insert({
    fundraiser_id: pastFundraiserId, org_id: orgId, team_id: repTeamId, player_id: pastPlayerId,
    amount_raised: 250, rebate_percent: 40, rebate_amount: 100,
  });
  if (feErr) throw feErr;
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
const api = () => `/api/coaches/${ORG_SLUG}/teams/${repTeamId}`;
const main = (page: Page) => page.locator('main[class*="coachesMain"]');

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(main(page)).toBeVisible({ timeout: 45_000 });
  await expect(main(page).getByText('Loading…')).toHaveCount(0, { timeout: 45_000 });
}

/** Call an API as the signed-in browser session and return { status, body }. */
async function apiGet(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const res = await fetch(u);
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON error page */ }
    return { status: res.status, body };
  }, url);
}

// ── 1. Governing rule 1 — what you could see THEN ────────────────────────────

test.describe('rule 1 — a past season shows what the coach could see at the time', () => {
  test.use({ viewport: DESKTOP });

  test('an assistant with money NOW is refused the past season’s money', async ({ page }) => {
    await signIn(page, ASSIST_EMAIL);

    // Live season: they genuinely have money, so this must succeed — otherwise the next
    // assertion would pass for the wrong reason.
    const live = await apiGet(page, `${api()}/money-summary`);
    expect(live.status, 'the assistant DOES have money in the live season').toBe(200);

    // Past season: they had none. This is the leak the chunk exists to close.
    const past = await apiGet(page, `${api()}/money-summary?year=${pastYearId}`);
    expect(past.status,
      'capabilities must come from the PAST season’s assignment row, not the current one')
      .toBe(403);
  });

  test('…but the roster they COULD see is still readable', async ({ page }) => {
    await signIn(page, ASSIST_EMAIL);
    const res = await apiGet(page, `${api()}/roster?year=${pastYearId}`);
    expect(res.status).toBe(200);
    const body = res.body as { players?: { playerFirstName: string }[]; isReadOnly?: boolean };
    expect(body.isReadOnly, 'the API must declare the season a record').toBe(true);
    expect(body.players?.some(p => p.playerFirstName === `${MARK}Archived`)).toBe(true);
  });

  /**
   * ⚠⚠ THE TEAM SCRAPBOOK IS HEAD-COACH ONLY (owner ruling, 2026-08-16) — asserted at the API,
   * because that is where it is enforced.
   *
   * The season-by-season history was served to ANY coach who had ever staffed the team, for EVERY
   * season, including years outside their own tenure. This fixture is the right place to prove the
   * fix: it holds a head coach and an assistant on the SAME team and the same seasons, so the two
   * calls differ by nothing except the role.
   *
   * ⚠ Both halves matter. Asserting only that the assistant is refused would pass just as happily
   * if the route were broken for everyone.
   */
  test('the season-by-season history is the head coach’s alone', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const asHead = await apiGet(page, `${api()}/history`);
    expect(asHead.status).toBe(200);
    const headBody = asHead.body as { history?: unknown[]; canViewSeasonHistory?: boolean };
    expect(headBody.canViewSeasonHistory, 'the head coach may see the team scrapbook').toBe(true);
    expect((headBody.history ?? []).length,
      'the head coach must actually get rows, or the assistant assertion below proves nothing')
      .toBeGreaterThan(0);

    await signIn(page, ASSIST_EMAIL);
    const asAssistant = await apiGet(page, `${api()}/history`);
    // Still 200 — they retain the rest of their archive access; only the scrapbook is withheld.
    expect(asAssistant.status).toBe(200);
    const assistBody = asAssistant.body as { history?: unknown[]; canViewSeasonHistory?: boolean };
    expect(assistBody.canViewSeasonHistory, 'an assistant may not see the team scrapbook').toBe(false);
    expect((assistBody.history ?? []).length,
      'the rows must be WITHHELD BY THE SERVER, not merely hidden on the page — otherwise a team’s '
      + 'whole history sits in a browser that is not allowed it')
      .toBe(0);
  });

  test('guardian details stay hidden if they were hidden then', async ({ page }) => {
    await signIn(page, ASSIST_EMAIL);
    const res = await apiGet(page, `${api()}/roster?year=${pastYearId}`);
    const body = res.body as { players?: Record<string, unknown>[] };
    const archived = body.players?.find(p => p.playerFirstName === `${MARK}Archived`);
    expect(archived, 'fixture player must be present or this assertion is vacuous').toBeTruthy();
    // rosterPii was FALSE last season and TRUE this season — a leak would surface the field.
    expect(archived?.guardianEmail ?? null).toBeNull();
  });
});

// ── 2. Governing rule 3 — revocation bites at the server ─────────────────────

test.describe('rule 3 — removing a coach from a past season removes their access', () => {
  test.use({ viewport: DESKTOP });

  test('reads the archive before revocation, is refused after', async ({ page }) => {
    await signIn(page, REVOKED_EMAIL);

    const before = await apiGet(page, `${api()}/roster?year=${pastYearId}`);
    expect(before.status, 'must genuinely have access first, or the revocation proves nothing')
      .toBe(200);

    // The head coach removes them from that season's staff (what the Staff screen does).
    const { error } = await admin.from('rep_team_coaches').delete().eq('id', revokedCoachRowId);
    expect(error).toBeNull();

    const after = await apiGet(page, `${api()}/roster?year=${pastYearId}`);
    expect(after.status,
      'a removed coach must be refused BY THE SERVER — losing the menu item is not losing access')
      .toBe(403);

    // And not merely on that one route: the whole archive closes.
    for (const route of ['history', 'attendance', 'events', 'wrapped']) {
      const res = await apiGet(page, `${api()}/${route}?year=${pastYearId}`);
      expect([401, 403, 404], `${route} must refuse a removed coach`).toContain(res.status);
    }
  });
});

// ── 3. Governing rule 2 — nothing in a past season can be written ────────────

test.describe('rule 2 — a finished season is a record', () => {
  test.use({ viewport: DESKTOP });

  test('a write aimed at a past season’s row is refused', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const res = await page.evaluate(async ({ url }) => {
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerNumber: '99' }),
      });
      return { status: r.status };
    }, { url: `${api()}/roster/${pastPlayerId}` });

    expect([400, 403, 404, 409], 'a past season’s player must not be editable')
      .toContain(res.status);
  });

  test('the archive draws no write controls', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${base()}/roster?year=${pastYearId}`);
    await expect(main(page).getByRole('button', { name: /^Add player/i })).toHaveCount(0);
    await expect(main(page).getByRole('button', { name: /^Import/i })).toHaveCount(0);
  });
});

// ── 4. The rolled-forward team ───────────────────────────────────────────────

test.describe('a rolled-forward team’s archive is still an archive', () => {
  test.use({ viewport: DESKTOP });

  test('the live season is writable and the past one is not, on the same team', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    await open(page, `${base()}/roster`);
    await expect(main(page).getByRole('button', { name: /^Add player/i }),
      'the LIVE season must still be editable — the team is not closed')
      .toHaveCount(1);
    await expect(main(page).getByText(/Complete/), 'no archive chip in a live season')
      .toHaveCount(0);

    await open(page, `${base()}/roster?year=${pastYearId}`);
    await expect(main(page).getByRole('button', { name: /^Add player/i })).toHaveCount(0);
    await expect(main(page).getByText(new RegExp(`${PAST_YEAR}.*Complete`)),
      'the archive names the season it is showing')
      .toBeVisible();
  });
});

// ── 4b. Switching seasons IN THE APP actually reloads the data ───────────────

test.describe('switching seasons in-app repaints the data, not just the label', () => {
  test.use({ viewport: DESKTOP });

  /**
   * ⚠ THE GAP THAT LET A CRITICAL THROUGH. Every other probe here navigates with `page.goto()`,
   * which remounts the page and picks the season up fresh — so all thirteen passed while four
   * section pages silently failed to refetch on an in-app season switch, showing one season's
   * data under another season's heading. A probe that only ever hard-navigates cannot see that.
   *
   * This one drives the SWITCHER, the way a coach does.
   */
  test('roster rows change when the coach switches season from the sidebar', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${base()}/roster`);

    // The live season has no players in this fixture; the past one has the archived player.
    await expect(main(page).getByText(`${MARK}Archived`),
      'the fixture player belongs to the PAST season only').toHaveCount(0);

    // Switch via the real control — client-side navigation, no remount.
    const switcher = page.locator('#coach-season-select');
    await expect(switcher).toBeVisible({ timeout: 30_000 });
    await switcher.selectOption(pastYearId);

    await expect(main(page).getByText(`${MARK}Archived`),
      'switching season must RELOAD the roster, not just relabel the page')
      .toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`year=${pastYearId}`));

    // …and back again, so a one-way refresh can't pass either.
    await switcher.selectOption(liveYearId);
    await expect(main(page).getByText(`${MARK}Archived`),
      'switching back to the live season must reload too')
      .toHaveCount(0, { timeout: 30_000 });
  });

  test('switching season keeps the coach on the section they are reading', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${base()}/attendance`);
    await page.locator('#coach-season-select').selectOption(pastYearId);
    await expect(page, 'Attendance 2026 → Attendance 2025, not back to the front door')
      .toHaveURL(/\/attendance\?year=/, { timeout: 30_000 });
  });

  /**
   * ⚠⚠ THIS TEST'S PREMISE EXPIRED ON 2026-08-16, AND THE REWRITE IS THE LESSON.
   *
   * It used to require the archive nav to show an "Attendance" link, because the archive pointed
   * "Insights" at `/history/results` (the hub being live-season-only) and the results page carries
   * no attendance door — so that nav entry was genuinely the ONLY route to a past season's report.
   * Archive rail Phase 2 made the hub season-aware and pointed the archive's Insights door at it,
   * which retired the workaround: Attendance is reached through Insights in both seasons now.
   *
   * ⚠ So the assertion changes shape, and deliberately does NOT become weaker. What was ever worth
   * protecting is the ACCESS, never the menu line — "a past season's attendance report is
   * reachable" is the property, and it is now proved by walking the route a coach actually takes.
   * A test that had simply dropped the old expectation would have stopped checking anything.
   *
   * The live-nav half is pinned in team-tournament-game-mirror-smoke.spec.ts; the archive half can
   * only be pinned here, because this is the fixture that HAS a finished season.
   */
  test('a finished season reaches attendance through Insights, and offers no way to take it', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    // ── The route a coach actually takes: archive nav → Insights hub → "Who's showing up?" ──
    await open(page, `${base()}/season-end?year=${pastYearId}`);
    const insightsDoor = page.getByRole('link', { name: 'Insights', exact: true }).first();
    await expect(insightsDoor, 'the archive must keep an Insights door').toBeVisible({ timeout: 30_000 });
    await expect(insightsDoor, 'the archive`s Insights door is the HUB now, not the results page')
      .toHaveAttribute('href', new RegExp(`/history\\?year=${pastYearId}$`));

    await open(page, `${base()}/history?year=${pastYearId}`);
    // ⚠ The hub must have resolved the PAST season, or every assertion below is about this year.
    await expect(main(page).getByText(/Complete/).first(),
      'the Insights hub must show the archived-season marker — it held no season resolver at all '
      + 'before Phase 2, and walled a closed-only coach out with "Team not found"')
      .toBeVisible({ timeout: 30_000 });

    const attendanceDoor = main(page).getByRole('link', { name: /Who's showing up/ });
    await expect(attendanceDoor,
      'the attendance report lost its only route into a past season — it left the archive menu on '
      + 'the strength of this door existing')
      .toBeVisible({ timeout: 30_000 });
    await expect(attendanceDoor, 'the door must carry the year, or it opens the LIVE season')
      .toHaveAttribute('href', new RegExp(`/attendance\\?year=${pastYearId}$`));
    await attendanceDoor.click();
    await expect(main(page).getByText(/Complete/).first(),
      'following the door must land in the archived season').toBeVisible({ timeout: 30_000 });

    /**
     * ⚠⚠ THE BACK LINK HAS NOW MOVED THREE TIMES IN THREE DAYS, EACH TIME CORRECTLY, BECAUSE ITS
     * DESTINATION KEPT MOVING — and each move was caught only by re-reading the reason written
     * beside it, never by noticing the link:
     *   · 2026-08-15 — `?year=` REMOVED (the destination read no year; the query dressed an
     *     unsolved problem up as solved).
     *   · 2026-08-16 Phase 1 — destination learned to read the year, so a BARE link became the
     *     defect. The query came back.
     *   · 2026-08-16 Phase 2 — the destination itself changed to the hub, in every season.
     * **A test can certify a defect as correct the moment its premise expires.** This one did.
     */
    await expect(main(page).getByRole('link', { name: 'Insights' }))
      .toHaveAttribute('href', new RegExp(`/history\\?year=${pastYearId}$`));

    /**
     * ⚠⚠ NO INSTRUMENT INSIDE A RECORD (CLAUDE.md rule 1; /review 2026-08-15 found this live).
     * The "Take attendance" shortcut used to render here exactly as in a live season, on a
     * button whose link dropped the year and therefore landed on the LIVE schedule hunting for
     * an event that is not in it — a silent dead end. A finished season offers the report and
     * nothing else.
     */
    await expect(main(page).getByRole('link', { name: /Take attendance/ }),
      'a finished season must not offer to take attendance').toHaveCount(0);
    await expect(main(page).getByRole('link', { name: 'Open schedule' }),
      'a finished season must not invite the coach to add to its schedule').toHaveCount(0);
  });
});

// ── 4c. The archive is read-only ALL THE WAY DOWN, not just at the top ───────

test.describe('no write control survives anywhere in the archive', () => {
  test.use({ viewport: DESKTOP });

  /**
   * `/review` found the archive was correct at the hub level and leaky one level below — money
   * sub-pages, player detail and lineup detail all silently resolved the LIVE season, with full
   * write UI. This walks the deeper pages and asserts the read-only chip is present and the
   * primary write affordances are not.
   */
  // Money screens are TABS of one hub (?section=…) since 2026-08-13 — the standalone routes are
  // permanent redirects now, so the sweep addresses the hub the way the product does.
  const DEEP_PAGES = [
    { path: '/accounting', label: 'Money hub' },
    { path: '/accounting?section=expenses', label: 'Expenses' },
    { path: '/accounting?section=dues', label: 'Dues' },
    { path: '/accounting?section=budget', label: 'Budget' },
    { path: '/accounting?section=fundraisers', label: 'Fundraisers' },
    { path: '/development', label: 'Development' },
    { path: '/lineups', label: 'Lineups' },
    { path: '/tryouts/history', label: 'Tryout history' },
    // Archive rail Phase 2 (2026-08-16): the Insights hub is the archive's own door now, and the
    // awards report is a door behind it. Both were live-season-only until this phase.
    { path: '/history', label: 'Insights hub' },
    { path: '/history/results', label: 'Insights results' },
    { path: '/history/awards', label: 'Awards' },
  ];

  for (const { path, label } of DEEP_PAGES) {
    test(`${label} is a record, not an editor`, async ({ page }) => {
      await signIn(page, HEAD_EMAIL);
      await open(page, `${base()}${path}${path.includes('?') ? '&' : '?'}year=${pastYearId}`);

      // It must KNOW it is an archive — otherwise it is showing the live season and the
      // absence of write controls below would prove nothing.
      await expect(main(page).getByText(/Complete/).first(),
        `${label} must show the archived-season marker — if it doesn't, it resolved the LIVE season`)
        .toBeVisible({ timeout: 30_000 });

      for (const name of [/^Add /i, /^New /i, /^Log an expense/i, /^Delete$/i, /^Edit details$/i]) {
        await expect(main(page).getByRole('button', { name }),
          `${label} offers a write control inside a finished season`).toHaveCount(0);
        await expect(main(page).getByRole('link', { name }),
          `${label} offers a write link inside a finished season`).toHaveCount(0);
      }
    });
  }

  /**
   * ⚠ THE ROSTER IS THE ASSERTION HERE, not the absence of buttons.
   *
   * Opening a fundraiser used to leave the hub for a page with no season rail, which showed the
   * archived drive beside the LIVE roster — wrong data, presented confidently, on a screen that
   * otherwise passed every read-only check in this file. So this test names names: the player who
   * existed only that year must be listed, and the one who exists only now must not.
   */
  test('a fundraiser opened from the archived list shows THAT season’s roster', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${base()}/accounting?section=fundraisers&year=${pastYearId}`);
    await main(page).getByRole('link', { name: new RegExp(`${MARK} Archived drive`) }).first().click();

    await expect(main(page).getByText(/Complete/).first(),
      'the drill-in must stay in the archived season — the hub above it carries the chip')
      .toBeVisible({ timeout: 30_000 });
    await expect(main(page).getByText(`${MARK}Archived Player`),
      'the archived season’s own player must be on the leaderboard').toBeVisible();
    await expect(main(page).getByText(`${MARK}Live Player`),
      'a player who joined AFTER this season ended is being listed against it — the drill-in '
      + 'resolved the live year').toHaveCount(0);

    for (const name of [/^Settings$/i, /log amount/i, /edit amount/i]) {
      await expect(main(page).getByRole('button', { name }),
        'a finished season’s fundraiser is offering a write control').toHaveCount(0);
    }
  });

  /**
   * ⚠⚠ A HIDDEN TILE IS THE ONLY HONEST ANSWER FOR A REPORT THAT CANNOT SERVE A PAST SEASON, and
   * this probe exists because the failure mode is a *silent* one: both routes below are OFF the
   * season-read rail, so asking them from an archive returns the LIVE season's numbers — a page
   * that renders perfectly, with a season chip above it, describing the wrong year.
   *
   *   · Playing time — ruled live-season-only PERMANENTLY (owner, 2026-08-16): its figures are
   *     recomputed from saved lineups, so a past season would show as today's code reads it.
   *   · Opponents — the scouting book is an INSTRUMENT (owner, 2026-08-04, re-confirmed with this
   *     phase): the notes are the team's CURRENT book, not a snapshot of that year.
   *
   * CLAUDE.md's rule: hide the entry point in an archive rather than letting it dead-end.
   */
  test('the Insights hub hides the two reports a record cannot honestly serve', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${base()}/history?year=${pastYearId}`);
    await expect(main(page).getByText(/Complete/).first(),
      'the hub must have resolved the PAST season, or this proves nothing')
      .toBeVisible({ timeout: 30_000 });

    for (const { name, why } of [
      { name: /Where is playing time going/, why: 'lineup-analytics is off the season-read rail — this tile would open the LIVE season' },
      { name: /Who are we up against/, why: 'the scouting book is a live-season instrument (owner ruling 2026-08-04)' },
    ]) {
      await expect(main(page).getByRole('link', { name }), why).toHaveCount(0);
    }

    // …and both are genuinely offered in the LIVE season, so the assertions above cannot pass
    // for the wrong reason (a tile hidden by a missing capability rather than by the season).
    await open(page, `${base()}/history`);
    await expect(main(page).getByRole('link', { name: /Where is playing time going/ }),
      'the playing-time tile must exist in a live season, or the archive assertion is vacuous')
      .toHaveCount(1);
  });

  test('a player opened from the archived roster is a record, not a dead end', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${base()}/roster?year=${pastYearId}`);
    await main(page).getByRole('link', { name: new RegExp(`${MARK}Archived`) }).click();
    await expect(main(page).getByText(/Complete/).first(),
      'the player page must open in the archived season, not 404 on "no active program year"')
      .toBeVisible({ timeout: 30_000 });
  });
});

// ── 5. Every archive door carries help (the Chunk B rule) ────────────────────

test.describe('every door a past season opens carries help', () => {
  test.use({ viewport: DESKTOP });

  test('walks the RENDERED archive nav, so a future door without help fails here', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${base()}/season-end?year=${pastYearId}`);

    const hrefs = await page.locator('nav a[href*="/coaches/teams/"]').evaluateAll(
      els => Array.from(new Set(els.map(e => (e as HTMLAnchorElement).getAttribute('href') ?? ''))),
    );
    const doors = hrefs.filter(h => h.includes(`year=${pastYearId}`));
    expect(doors.length, 'the archive nav should render several doors').toBeGreaterThan(4);

    for (const href of doors) {
      await open(page, href);
      // Scoped to the content area so the sidebar's own "Help" link can never satisfy this.
      const help = main(page).getByRole('button', { name: /^Help/i }).first();
      await expect(help, `${href} is an archive door and must carry a help icon`)
        .toBeVisible({ timeout: 30_000 });
    }
  });
});

// ── 6. Composed layout at 361px ──────────────────────────────────────────────

test.describe('the archive on a phone', () => {
  test.use({ viewport: PHONE_ODD });

  test('the season list is reachable from More, and nothing scrolls sideways', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${base()}/roster?year=${pastYearId}`);

    // D-F3: the switcher is NOT on the page — that real estate belongs to the data.
    await expect(main(page).getByLabel(/Viewing archive/i),
      'the season switcher must not take a row on a phone screen')
      .toHaveCount(0);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page body must never scroll sideways').toBeLessThanOrEqual(0);

    // The chip is the way back out, and it clears the tap floor.
    const chip = main(page).getByRole('button', { name: /Complete\. Choose a different season/i });
    await expect(chip).toBeVisible({ timeout: 30_000 });
    const box = await chip.boundingBox();
    expect(box!.height, 'the chip is a real tap target').toBeGreaterThanOrEqual(24);

    await chip.click();
    await expect(page.getByRole('listbox', { name: /Choose a season/i })).toBeVisible();
  });
});
