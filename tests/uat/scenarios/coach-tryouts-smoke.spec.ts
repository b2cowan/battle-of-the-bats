import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { grantMembershipsFromSeasonRows, clearMemberships } from './_coach-membership-fixture';

/**
 * Tryouts & Development tidy-up (Coach Portal Chunk E — P1 #16, P1 #5 remainder, f9-2, D-E9).
 *
 * PERMANENT regression coverage for the facts unit tests can't see:
 *  1. the "Score players" door exists on the Tryout Day tab and lands on a working scorer,
 *     signed in, whose score shows up as the "(you)" chip — with ONE stable self identity;
 *  2. a coach without the tryouts grant sees the honest empty state on the hub AND the check-in
 *     sub-page (the WI-11 gate), and every tryout write API answers 403;
 *  3. a dirty scorecard builder asks before discarding (naming the stake) and a clean one
 *     closes silently; a typed-but-unnamed category row blocks save instead of vanishing;
 *  4. link reissue keeps the SAME evaluator identity (old token dies, scores survive);
 *  5. D-E9 — the decision-email switch renders OFF, a record-only offer mints NO response link
 *     (the data-level proof no email machinery ran), and switching ON makes a pass ask first;
 *  6. the depth VIEW takes the wide column + the CoachScrollX hint while the roster list keeps
 *     the reading column.
 *
 * Computed styles / real DOM / data-level assertions only — never screenshots.
 * Self-provisions via service-role with the `captryout-` marker; pre-cleans, tears down, and
 * ASSERTS the teardown. Error-check EVERY provisioning insert (the Batch 4 lesson).
 * ⚠ Scope text assertions to `main[class*="coachesMain"]` — the outer layout <main> wraps the
 * phone-hidden sidebar. The scorer pages have no coaches chrome; assert on their own content.
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

const MARK = 'captryout';
const HEAD_EMAIL = `${MARK}-head@dev.local`;
const ASSIST_EMAIL = `${MARK}-assistant@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const PHONE = { width: 360, height: 740 };

let orgId = '';
let headUserId = '';
let assistUserId = '';
let repTeamId = '';
let programYearId = '';
let tryoutId = '';
let regCheckedInId = '';
let regNoShowId = '';
let regNoEmailId = '';

async function cleanup() {
  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      const { data: tryouts } = await admin.from('rep_tryouts').select('id').eq('program_year_id', y.id);
      for (const tr of tryouts ?? []) {
        await admin.from('rep_tryout_scores').delete().eq('tryout_id', tr.id);
        await admin.from('rep_tryout_evaluator_sessions').delete().eq('tryout_id', tr.id);
        await admin.from('rep_tryout_rubrics').delete().eq('tryout_id', tr.id);
        await admin.from('rep_tryout_sessions').delete().eq('tryout_id', tr.id);
      }
      await admin.from('rep_tryout_registrations').delete().eq('program_year_id', y.id);
      await admin.from('rep_tryouts').delete().eq('program_year_id', y.id);
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
    }
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    // M1: memberships are team-scoped — clear them before the team row goes, or the
    // FK leaves the team undeletable and it surfaces as the teardown assertion.
    await clearMemberships(admin, t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of users?.users ?? []) {
    if (u.email === HEAD_EMAIL || u.email === ASSIST_EMAIL) {
      await admin.from('organization_members').delete().eq('user_id', u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
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
    .insert({ org_id: orgId, name: `${MARK} Selects 14U`, slug: `${MARK}-selects-14u`, sport: 'softball' })
    .select('id').single();
  if (teamErr) throw teamErr;
  repTeamId = team!.id;

  const { data: year, error: yearErr } = await admin.from('rep_program_years')
    .insert({ team_id: repTeamId, org_id: orgId, name: `${MARK} 2026`, year: 2026, status: 'active' })
    .select('id').single();
  if (yearErr) throw yearErr;
  programYearId = year!.id;

  const { error: hcErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: headUserId, coach_role: 'head_coach',
  });
  if (hcErr) throw hcErr;
  // The read-only sweep persona: an assistant with real grants — but NOT tryouts.
  const { error: acErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: assistUserId, coach_role: 'assistant_coach',
    capabilities: { roster: true, schedule: true },
  });
  if (acErr) throw acErr;

  // Roster players so the depth VIEW renders its grid (WI-4).
  const { error: pErr } = await admin.from('rep_roster_players').insert([
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Avery', player_last_name: 'Chen', player_number: '7', status: 'active' },
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Jordan', player_last_name: 'Bell', player_number: '12', status: 'active' },
  ]);
  if (pErr) throw pErr;

  // The tryout workspace, NAMES REVEALED (is_anonymous false) so board rows carry names and the
  // family-note expand is blind-safe to render.
  const { data: tryout, error: tErr } = await admin.from('rep_tryouts')
    .insert({ program_year_id: programYearId, team_id: repTeamId, org_id: orgId, is_anonymous: false })
    .select('id').single();
  if (tErr) throw tErr;
  tryoutId = tryout!.id;

  const { error: rErr } = await admin.from('rep_tryout_rubrics').insert({
    tryout_id: tryoutId, program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    scale_max: 5,
    categories: [
      { key: 'hitting', label: 'Hitting', weight: 1 },
      { key: 'fielding', label: 'Fielding', weight: 1 },
    ],
  });
  if (rErr) throw rErr;

  // Three candidates: checked-in with a family note (the happy row), a no-show (the
  // "didn't check in" marker), and a checked-in walk-up with NO email (the no-email chip).
  const { data: regs, error: regErr } = await admin.from('rep_tryout_registrations').insert([
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Sam', player_last_name: 'Tran', guardian_first_name: 'Kim', guardian_last_name: 'Tran', guardian_email: `${MARK}-fam1@dev.local`, bib_number: '14', is_checked_in: true, checked_in_at: new Date().toISOString(), player_notes: 'Prefers shortstop; away the first weekend of August.' },
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Ali', player_last_name: 'Reyes', guardian_first_name: 'Maya', guardian_last_name: 'Reyes', guardian_email: `${MARK}-fam2@dev.local`, bib_number: '31', is_checked_in: false },
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Noor', player_last_name: 'Haddad', guardian_first_name: 'Walk-up', guardian_last_name: 'Family', guardian_email: '', bib_number: '22', is_checked_in: true, checked_in_at: new Date().toISOString() },
  ]).select('id');
  if (regErr) throw regErr;
  regCheckedInId = regs![0].id;
  regNoShowId = regs![1].id;
  regNoEmailId = regs![2].id;

  /**
   * ⚠ M1 MEMBERSHIPS — THE ACCESS TRUTH (owner ruling 2026-08-16, mig 245). Without this every
   * coach above 403s at the first membership-gated route, and the spec fails for a reason that
   * has nothing to do with what it tests. PROJECTED from the season rows rather than restated,
   * so the pair can never disagree — see tests/uat/scenarios/_coach-membership-fixture.ts.
   */
  await grantMembershipsFromSeasonRows(admin, repTeamId);
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

async function open(page: Page, url: string) {
  await page.goto(url);
  const main = page.locator('main[class*="coachesMain"]');
  await expect(main).toBeVisible({ timeout: 45_000 });
  await expect(main.getByText('Loading…')).toHaveCount(0, { timeout: 45_000 });
}

const main = (page: Page) => page.locator('main[class*="coachesMain"]');

// ─── 1 · The scoring door ────────────────────────────────────────────────────────

test('Tryout Day tab offers "Score players"; the signed-in scorer works; the scoreboard grows a "(you)" chip; the self identity is stable', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, HEAD_EMAIL);
  await open(page, `${base()}/tryouts`);

  // The tab that promises "score them" finally has the door.
  await main(page).getByRole('tab', { name: /tryout day/i }).click();
  const door = main(page).getByRole('link', { name: /score players/i });
  await expect(door).toBeVisible();

  await door.click();
  // The scorer is the shared fixed-dark surface (no coaches chrome): identity line + candidates.
  await expect(page.getByText(/scoring as .*\(you\) — signed in/i)).toBeVisible({ timeout: 45_000 });
  // WI-10: checked-in first, absentees under a muted divider.
  await expect(page.getByText(/not checked in \(1\)/i)).toBeVisible();

  // Score Sam on both categories.
  await page.getByRole('button', { name: /sam tran/i }).click();
  const scale = page.getByRole('button', { name: '4', exact: true });
  await scale.first().click();
  await page.getByRole('button', { name: '5', exact: true }).nth(1).click();
  await page.getByRole('button', { name: /^done$/i }).click();
  await expect(page.getByText(/1 of 3 scored/i)).toBeVisible();

  // Exactly ONE self session exists, keyed `self:` — and a second visit reuses it.
  const { data: selfRows1 } = await admin.from('rep_tryout_evaluator_sessions')
    .select('id, token_hash').eq('tryout_id', tryoutId).like('token_hash', 'self:%');
  expect(selfRows1 ?? []).toHaveLength(1);
  await page.goto(`${base()}/tryouts/score`);
  await expect(page.getByText(/scoring as .*\(you\)/i)).toBeVisible({ timeout: 45_000 });
  const { data: selfRows2 } = await admin.from('rep_tryout_evaluator_sessions')
    .select('id').eq('tryout_id', tryoutId).like('token_hash', 'self:%');
  expect(selfRows2 ?? []).toHaveLength(1);

  // Back on the hub, the live scoreboard names the coach as "(you)" — and the self identity is
  // NOT in the Evaluators links card (it isn't a link).
  await open(page, `${base()}/tryouts`);
  await main(page).getByRole('tab', { name: /tryout day/i }).click();
  await expect(main(page).getByText(/\(you\)/)).toBeVisible({ timeout: 20_000 });
  // The no-show marker reaches the scoreboard row too (WI-3).
  await expect(main(page).getByText(/didn’t check in/).first()).toBeVisible();
});

// ─── 2 · The read-only sweep ─────────────────────────────────────────────────────

test('an assistant without the tryouts grant gets the honest empty state on the hub AND check-in, and every tryout write API answers 403', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, ASSIST_EMAIL);

  await open(page, `${base()}/tryouts`);
  await expect(main(page).getByText(/tryouts aren't turned on for you/i)).toBeVisible();
  await expect(main(page).getByRole('link', { name: /score players/i })).toHaveCount(0);

  // WI-11: the check-in sub-page was the ONLY tryout surface with no client gate.
  await open(page, `${base()}/tryouts/check-in`);
  await expect(main(page).getByText(/tryouts aren't turned on for you/i)).toBeVisible();
  await expect(main(page).getByRole('button', { name: /add walk-up/i })).toHaveCount(0);

  // Server side: every write is refused — including the two NEW routes.
  const posts: Array<[string, Record<string, unknown>]> = [
    [`${api()}/tryout-sessions`, { startsAt: '2026-08-01T18:00' }],
    [`${api()}/tryout-evaluators`, { evaluatorName: 'Sneaky' }],
    [`${api()}/tryout-decisions`, { registrationId: regCheckedInId, decision: 'offer' }],
    [`${api()}/tryout-self-score`, { registrationId: regCheckedInId, categoryKey: 'hitting', score: 5 }],
  ];
  for (const [url, body] of posts) {
    const res = await page.request.post(url, { data: body });
    expect(res.status(), `${url} must refuse a coach without the tryouts grant`).toBe(403);
  }
  const rubricPut = await page.request.put(`${api()}/tryout-rubric`, { data: { scaleMax: 5, categories: [{ label: 'X', weight: 1 }] } });
  expect(rubricPut.status()).toBe(403);
});

// ─── 3 · The discard guard ───────────────────────────────────────────────────────

test('a dirty scorecard builder asks before discarding (naming the stake), a clean one closes silently, and a typed-but-unnamed row blocks save', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, HEAD_EMAIL);
  await open(page, `${base()}/tryouts`);

  // The CARD's title is also "Evaluation scorecard" — assert on the MODAL's own heading class.
  const builderTitle = main(page).locator('h3[class*="modalTitle"]', { hasText: /evaluation scorecard/i });

  // Clean form → Cancel closes silently, no dialog.
  await main(page).getByRole('button', { name: /edit scorecard/i }).click();
  await expect(builderTitle).toBeVisible();
  await main(page).getByRole('button', { name: /^cancel$/i }).click();
  await expect(main(page).getByText(/discard this scorecard/i)).toHaveCount(0);
  await expect(builderTitle).toHaveCount(0);

  // Dirty form → the ask names the stake; "Keep editing" keeps the work.
  await main(page).getByRole('button', { name: /edit scorecard/i }).click();
  await main(page).getByPlaceholder(/e\.g\. .*scorecard/i).fill('AAA tryout card');
  await main(page).getByRole('button', { name: /^cancel$/i }).click();
  await expect(page.getByText(/discard this scorecard\?/i)).toBeVisible();
  await expect(page.getByText(/categor(y|ies) and their weights/i)).toBeVisible();
  await page.getByRole('button', { name: /keep editing/i }).click();
  await expect(main(page).getByPlaceholder(/e\.g\. .*scorecard/i)).toHaveValue('AAA tryout card');

  // A typed weight/note on an UNNAMED row blocks save with a named error — never a silent drop.
  await main(page).getByRole('button', { name: /add category/i }).click();
  const noteInputs = main(page).getByPlaceholder(/note for evaluators/i);
  await noteInputs.last().fill('typed work that must not vanish');
  await main(page).getByRole('button', { name: /save scorecard/i }).click();
  await expect(main(page).getByText(/category 3 needs a name/i)).toBeVisible();

  // Leave via the guard, discarding deliberately (also proves Discard actually closes).
  await main(page).getByRole('button', { name: /^cancel$/i }).click();
  await page.getByRole('button', { name: /^discard$/i }).click();
  await expect(builderTitle).toHaveCount(0);
});

// ─── 4 · Link reissue keeps the identity ─────────────────────────────────────────

test('reissuing an evaluator link kills the old token, works on the same row, and keeps the scores', async ({ page }) => {
  // Retry-safe: a failed earlier attempt leaves its minted link behind (beforeAll runs once per
  // file, not per retry) — clear LINK sessions (and only their scores; the coach's self scores
  // from test 1 must survive) so the count assertion below stays deterministic.
  const { data: staleLinks } = await admin.from('rep_tryout_evaluator_sessions')
    .select('id').eq('tryout_id', tryoutId).not('token_hash', 'like', 'self:%');
  for (const s of staleLinks ?? []) {
    await admin.from('rep_tryout_scores').delete().eq('evaluator_session_id', s.id);
    await admin.from('rep_tryout_evaluator_sessions').delete().eq('id', s.id);
  }

  await signIn(page, HEAD_EMAIL);
  // Mint a link as the head coach (authenticated fetch through the app's own API).
  const mint = await page.request.post(`${api()}/tryout-evaluators`, { data: { evaluatorName: 'Marc Volunteer' } });
  expect(mint.status()).toBe(201);
  const minted = await mint.json();
  const oldToken: string = minted.token;
  const evaluatorId: string = minted.session.id;

  // The volunteer scores one candidate through the public token door.
  const score = await page.request.post(`/api/tryout-score/${oldToken}`, {
    data: { registrationId: regCheckedInId, categoryKey: 'hitting', score: 3 },
  });
  expect(score.status()).toBe(200);

  // Reissue → old token dies with the honest state, new token opens the SAME identity.
  const reissue = await page.request.post(`${api()}/tryout-evaluators/${evaluatorId}`);
  expect(reissue.status()).toBe(200);
  const reissued = await reissue.json();
  expect(reissued.session.id).toBe(evaluatorId);
  const newToken: string = reissued.token;

  const oldGet = await page.request.get(`/api/tryout-score/${oldToken}`);
  expect(oldGet.status()).toBe(404); // hash no longer matches → 'invalid'
  const newGet = await page.request.get(`/api/tryout-score/${newToken}`);
  expect(newGet.status()).toBe(200);
  const ctx = await newGet.json();
  expect(ctx.evaluatorName).toBe('Marc Volunteer');
  // Their prior score survived on the same identity — the double-count fix, provable in data.
  expect(ctx.scores[regCheckedInId]?.hitting?.score).toBe(3);
  expect(typeof ctx.expiresAt).toBe('string'); // WI-8: the page can now say how long it lives

  const { data: rows } = await admin.from('rep_tryout_evaluator_sessions')
    .select('id').eq('tryout_id', tryoutId).not('token_hash', 'like', 'self:%');
  expect(rows ?? []).toHaveLength(1);
});

// ─── 5 · D-E9: the decision-email switch ─────────────────────────────────────────

test('the email switch renders OFF; a record-only offer mints NO response link; switching ON makes a pass ask first; the honesty chips render', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, HEAD_EMAIL);
  await open(page, `${base()}/tryouts`);
  await main(page).getByRole('tab', { name: /decide/i }).click();
  // Every stage panel stays mounted (hidden via CSS) — scope row assertions to the VISIBLE one,
  // or the scoreboard's copies of the same markers match first.
  const panel = main(page).locator('[role="tabpanel"]:visible');

  const emailSwitch = main(page).locator('button[role="switch"]');
  await expect(emailSwitch.first()).toBeVisible();
  await expect(emailSwitch.first()).toHaveAttribute('aria-checked', 'false');
  await expect(main(page).getByText(/decisions are only recorded here/i)).toBeVisible();

  // The honesty chips: a walk-up with no email, and a no-show distinct from "not scored yet".
  await expect(panel.getByText(/no email on file — notify by phone/i)).toBeVisible();
  await expect(panel.getByText(/didn’t check in/).first()).toBeVisible();
  // The family's registration note is one tap away.
  await panel.getByRole('button', { name: /family's note/i }).first().click();
  await expect(panel.getByText(/prefers shortstop/i)).toBeVisible();

  // Record-only offer: status flips, and NO response link is minted (the data-level proof that
  // no email machinery ran — a link only ever exists inside an offer email).
  await main(page).getByRole('group', { name: /decision/i }).first().getByRole('button', { name: /^offer$/i }).click();
  await expect(main(page).getByText(/1.*offered/i).first()).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => {
      const { data } = await admin.from('rep_tryout_registrations')
        .select('status, offer_expires_at, offer_sent_at').eq('id', regCheckedInId).single();
      return data;
    }, { timeout: 15_000 })
    .toMatchObject({ status: 'offered', offer_expires_at: null, offer_sent_at: null });
  // A record-only offer shows the selective per-row send, not a response badge.
  await expect(main(page).getByRole('button', { name: /email this offer/i })).toBeVisible();
  await expect(main(page).getByText(/awaiting response/i)).toHaveCount(0);

  // Switch ON → a pass asks first, naming what the family receives; Cancel sends nothing.
  await emailSwitch.first().click();
  await expect(emailSwitch.first()).toHaveAttribute('aria-checked', 'true');
  const noShowGroup = main(page).getByRole('group', { name: /decision/i }).nth(1);
  await noShowGroup.getByRole('button', { name: /not this season/i }).click();
  await expect(page.getByText(/pass on ali reyes\?/i)).toBeVisible();
  await expect(page.getByText(/can’t be unsent|can't be unsent/i)).toBeVisible();
  await page.getByRole('button', { name: /^cancel$/i }).click();
  const { data: aliRow } = await admin.from('rep_tryout_registrations').select('status').eq('id', regNoShowId).single();
  expect(aliRow!.status).toBe('pending_review');

  // Leave the switch OFF for other tests (device state is per-context anyway).
  await emailSwitch.first().click();
});

// ─── 6 · The depth view's width + honest scroll ──────────────────────────────────

test('roster ?view=depth takes the wide column + CoachScrollX; the list view keeps the reading column; phones get the swipe hint', async ({ page }) => {
  await signIn(page, HEAD_EMAIL);

  // Desktop: list = 960, depth = 1200 (the shipped .pageWide opt-in), scroller present.
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, `${base()}/roster`);
  const pageCol = main(page).locator('div[class*="page"]').first();
  expect(parseFloat(await pageCol.evaluate(el => getComputedStyle(el).maxWidth))).toBe(960);

  await open(page, `${base()}/roster?view=depth`);
  expect(parseFloat(await pageCol.evaluate(el => getComputedStyle(el).maxWidth))).toBe(1200);
  const scroller = main(page).locator('[data-testid="coach-scrollx"]');
  await expect(scroller).toBeVisible();
  // At 1440 the diamond grid fits inside 1200 — an honest hint must NOT claim a swipe.
  await expect(main(page).locator('[data-testid="coach-scrollx-hint"]')).toHaveCount(0);

  // Phone-ish width: the grid overflows its frame → the hint appears, and the PAGE itself
  // never scrolls sideways.
  await page.setViewportSize({ width: 700, height: 900 });
  await open(page, `${base()}/roster?view=depth`);
  await expect(main(page).locator('[data-testid="coach-scrollx-hint"]')).toBeVisible();
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
});
