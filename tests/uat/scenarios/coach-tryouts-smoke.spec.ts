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
 *  5. nothing on the decision board can mail a family — no switch, no per-row send, no confirm —
 *     and an offer mints NO response link (the data-level proof no email machinery ran);
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
  // The Next DEV overlay's <nextjs-portal> host (dev chrome only — it does not exist in prod)
  // can intercept taps at phone size even while visibly empty, which timed out a Cancel click
  // on the scorecard builder's bottom sheet (2026-08-23). display:none, not pointer-events —
  // the overlay's shadow content re-enables its own pointer-events, and hiding the host is the
  // only thing that removes the whole subtree from hit-testing.
  await page.addInitScript(() => {
    const s = document.createElement('style');
    s.textContent = 'nextjs-portal{display:none!important}';
    document.documentElement.appendChild(s);
  });
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
  /* ⚠⚠ MATCH THE LOADING ELEMENT, NEVER ITS WORDS (/review, 2026-08-26). This waited on the
     literal text "Loading…" reaching zero, and Playwright matches a plain string as a SUBSTRING —
     so the moment the portal gave every loading state a subject ("Loading the register…",
     "Loading the roster…"), the substring stopped existing and this wait passed instantly on every
     screen. A no-op wait is worse than no wait: it reads as a deterministic signal while the fetch
     it was built to wait for races on underneath it. `[class*="loadingState"]` is the same
     hashed-CSS-module idiom `main[class*="coachesMain"]` already uses one line up, and it matches
     the shared CoachLoading component AND every hand-written .loadingState still in the portal —
     i.e. it cannot be broken by a copy change. */
  await expect(main.locator('[class*="loadingState"]')).toHaveCount(0, { timeout: 45_000 });
}

const main = (page: Page) => page.locator('main[class*="coachesMain"]');

// ─── 1 · The scoring door ────────────────────────────────────────────────────────

test('Tryout Day offers the Score face; the signed-in scorer works; the scoreboard grows a "(you)" chip; the self identity is stable', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, HEAD_EMAIL);
  await open(page, `${base()}/tryouts`);

  // One-Room build (2026-08-23): stage tabs are LINKS, and the scorer is the Tryout day tab's
  // Score FACE — the "Score players" door and its sub-page are gone.
  await main(page).getByRole('link', { name: /tryout day/i }).click();
  const face = main(page).getByRole('navigation', { name: /tryout day views/i }).getByRole('link', { name: 'Score' });
  await expect(face).toBeVisible();

  await face.click();
  // Embedded, the hub's face hint carries the identity; the scorer card carries the candidates.
  await expect(main(page).getByText(/scoring as you — signed in/i)).toBeVisible({ timeout: 45_000 });
  // WI-10: checked-in first, absentees under a muted divider.
  await expect(page.getByText(/not checked in \(1\)/i)).toBeVisible();

  // Score Sam on both categories.
  await page.getByRole('button', { name: /sam tran/i }).click();
  const scale = page.getByRole('button', { name: '4', exact: true });
  await scale.first().click();
  await page.getByRole('button', { name: '5', exact: true }).nth(1).click();
  await page.getByRole('button', { name: /^done$/i }).click();
  await expect(page.getByText(/1 of 3 scored/i)).toBeVisible();

  // Exactly ONE self session exists, keyed `self:` — and a second visit reuses it. The OLD
  // standalone address must still deliver a coach here (redirect, never a 404).
  const { data: selfRows1 } = await admin.from('rep_tryout_evaluator_sessions')
    .select('id, token_hash').eq('tryout_id', tryoutId).like('token_hash', 'self:%');
  expect(selfRows1 ?? []).toHaveLength(1);
  await page.goto(`${base()}/tryouts/score`);
  await expect(page.getByText(/scoring as you — signed in/i)).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/stage=tryout-day&view=score/);
  const { data: selfRows2 } = await admin.from('rep_tryout_evaluator_sessions')
    .select('id').eq('tryout_id', tryoutId).like('token_hash', 'self:%');
  expect(selfRows2 ?? []).toHaveLength(1);

  // Back on the hub, the live scoreboard (the Live board face) names the coach as "(you)" — and
  // the self identity is NOT in the Evaluators links card (it isn't a link).
  await open(page, `${base()}/tryouts`);
  await main(page).getByRole('link', { name: /tryout day/i }).click();
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
  // The gated hub renders NO faces at all — not a Score view waiting to 403.
  await expect(main(page).getByRole('navigation', { name: /tryout day views/i })).toHaveCount(0);

  // The old check-in address redirects into the hub (One-Room build), whose gate answers for it.
  await open(page, `${base()}/tryouts/check-in`);
  await expect(main(page).getByText(/tryouts aren't turned on for you/i)).toBeVisible();
  await expect(main(page).getByRole('button', { name: /add player/i })).toHaveCount(0);

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

  // The checklist ROW's title is also "Evaluation scorecard" — assert on the MODAL's own
  // heading, by its stable id (the 08-17 scorecard-weights rebuild renamed its class; the id
  // is the contract).
  const builderTitle = main(page).locator('h3#rubric-builder-title');

  // 2026-08-17: Set up is ONE checklist card — a done row collapses to a receipt, so expand the
  // scorecard row to reach its manager (the row toggle's name includes the title).
  await main(page).getByRole('button', { name: /evaluation scorecard/i }).click();

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
  // "…and how they count", not "their weights" — the §50 ruling scrubbed weight-language from
  // coach-facing copy (show the SHARE, not the weight).
  await expect(page.getByText(/categor(y|ies) and how they count/i)).toBeVisible();
  await page.getByRole('button', { name: /keep editing/i }).click();
  await expect(main(page).getByPlaceholder(/e\.g\. .*scorecard/i)).toHaveValue('AAA tryout card');

  // A typed weight/note on an UNNAMED row blocks save with a named error — never a silent drop.
  await main(page).getByRole('button', { name: /add category/i }).click();
  // The 08-17 rebuild made the note field per-row and collapsed by default — open the new
  // row's note first, then fill (placeholder reworded in the same rebuild).
  await main(page).getByRole('button', { name: /add a note for evaluators/i }).last().click();
  const noteInputs = main(page).getByPlaceholder(/what should evaluators look for/i);
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

// ─── 5 · Nothing mails a tryout family ───────────────────────────────────────────

/**
 * ⚠ THIS TEST WAS INVERTED ON 2026-08-26. It used to be "D-E9: the decision-email switch" and
 * asserted the switch rendered OFF, that turning it ON made a pass ask first, and that an offered
 * row offered "Email this offer". The owner removed all of it: a rep offer is a custom letter the
 * family SIGNS, often conditional, so FieldLogicHQ sends a tryout family nothing on a coach's
 * behalf. The valuable half of the old test — the DATA-level proof that no offer link was minted —
 * survives here, because that is what proves no mail machinery ran, rather than merely proving a
 * button is absent from a screen.
 */
test('no email control exists on the board; an offer mints NO response link; the honesty chips render', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, HEAD_EMAIL);
  await open(page, `${base()}/tryouts`);
  await main(page).getByRole('link', { name: /decide/i }).click();
  // Every stage panel stays mounted (hidden via CSS) — scope row assertions to the VISIBLE one,
  // or the scoreboard's copies of the same markers match first.
  const panel = main(page).locator('[data-tryout-stage]:visible');

  // The switch and its hint are GONE — not merely defaulted off.
  await expect(main(page).getByText(/email families my decisions/i)).toHaveCount(0);
  await expect(main(page).getByText(/decisions are only recorded here/i)).toHaveCount(0);

  // The honesty chips: a hand-added player with no email, and a no-show distinct from "not scored yet".
  await expect(panel.getByText(/no email on file — reach them by phone/i)).toBeVisible();
  await expect(panel.getByText(/didn’t check in/).first()).toBeVisible();
  // The family's registration note is one tap away.
  await panel.getByRole('button', { name: /family's note/i }).first().click();
  await expect(panel.getByText(/prefers shortstop/i)).toBeVisible();

  // An offer flips status and mints NO response link — the data-level proof that no email
  // machinery ran, since a link only ever existed inside an offer email.
  await main(page).getByRole('group', { name: /decision/i }).first().getByRole('button', { name: /^offering$/i }).click();
  await expect(main(page).getByText(/1.*offered/i).first()).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => {
      const { data } = await admin.from('rep_tryout_registrations')
        .select('status, offer_expires_at, offer_sent_at').eq('id', regCheckedInId).single();
      return data;
    }, { timeout: 15_000 })
    .toMatchObject({ status: 'offered', offer_expires_at: null, offer_sent_at: null });

  // No per-row send, and no response badge for a family that was never asked anything.
  await expect(main(page).getByRole('button', { name: /email this offer|resend offer/i })).toHaveCount(0);
  await expect(main(page).getByText(/awaiting response/i)).toHaveCount(0);

  // A pass no longer asks first: that confirm existed only because an email could not be unsent.
  const noShowGroup = main(page).getByRole('group', { name: /decision/i }).nth(1);
  await noShowGroup.getByRole('button', { name: /not this season/i }).click();
  await expect(page.getByText(/pass on ali reyes\?/i)).toHaveCount(0);
  await expect
    .poll(async () => {
      const { data } = await admin.from('rep_tryout_registrations').select('status').eq('id', regNoShowId).single();
      return data?.status;
    }, { timeout: 15_000 })
    .toBe('declined');
});

// ─── 6 · The depth view's width + honest scroll ──────────────────────────────────

test('roster ?view=depth takes the wide column + CoachScrollX; the list view keeps the reading column; phones get the swipe hint', async ({ page }) => {
  await signIn(page, HEAD_EMAIL);

  // Desktop: the roster takes the wide column UNCONDITIONALLY now (data-dense surfaces take
  // .pageWide on every view — the per-view 960/1200 split this spec was written against is
  // superseded by the committed ruling in the roster page).
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, `${base()}/roster`);
  const pageCol = main(page).locator('div[class*="page"]').first();
  expect(parseFloat(await pageCol.evaluate(el => getComputedStyle(el).maxWidth))).toBe(1200);

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
